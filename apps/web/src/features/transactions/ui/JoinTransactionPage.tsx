import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Handshake,
  ImagePlus,
  Package,
  ShoppingBag,
  Tag,
  Trash2,
  UserPlus,
} from 'lucide-react';

import { useZodForm } from '@/shared/lib/form';
import { defaultPaymentCurrency, formatOperationMoney, PAYMENT_CURRENCY_OPTIONS } from '@/shared/lib/money';
import { usePreferencesSnapshot, useUserPreferences } from '@/shared/preferences';
import { getApiErrorMessage } from '@/shared/api/client';
import { useProfile } from '@/features/profile/hooks/useProfile';

import { useAcceptPurchase, useConfirmSale, useInvitePreview } from '../hooks/useTransactions';
import {
  acceptPurchaseSchema,
  confirmSaleSchema,
  type AcceptPurchaseValues,
} from '../model/schemas';
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  STATUS_LABELS,
  type DeliveryLocationValue,
  type ProductCategory,
  type ProductCondition,
} from '../model/types';
import {
  ChecklistEditor,
  checklistDraftToPayload,
  createEmptyChecklistItem,
  type ChecklistDraftItem,
} from './ChecklistEditor';
import { DeliveryLocationPicker, hasRegisteredAddress } from './DeliveryLocationPicker';
import { FeePayerFields } from './FeePayerFields';
import { PhotoLightbox } from './PhotoLightbox';
import '../styles/transactions.css';

const SELLER_STEPS = [
  { id: 1, label: 'Invitación' },
  { id: 2, label: 'Producto' },
  { id: 3, label: 'Confirmar' },
] as const;

const DEFAULT_DELIVERY: DeliveryLocationValue = { mode: 'MAP' };

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function validateDelivery(
  delivery: DeliveryLocationValue,
  profile: Parameters<typeof hasRegisteredAddress>[0],
): string | null {
  if (delivery.mode === 'MAP') {
    if (
      !delivery.meetingLocation?.label ||
      !delivery.meetingLocation.coordinates ||
      delivery.meetingLocation.coordinates.length !== 2
    ) {
      return 'Elegí un punto en el mapa o buscá una dirección.';
    }
  }
  if (delivery.mode === 'HOME') {
    if (!hasRegisteredAddress(profile)) {
      return 'Completá tu domicilio en el perfil para usar esta opción.';
    }
    if (!delivery.meetingLocation?.coordinates) {
      return 'No pudimos ubicar tu domicilio. Revisalo en el perfil o elegí otro modo.';
    }
  }
  return null;
}

export function JoinTransactionPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, error: previewError } = useInvitePreview(token);
  const confirm = useConfirmSale();
  const acceptPurchase = useAcceptPurchase();
  const { data: profileData } = useProfile();
  const profile = profileData?.profile;
  usePreferencesSnapshot();
  const { currency: preferredCurrency } = useUserPreferences();

  const [step, setStep] = useState(1);
  const [images, setImages] = useState<Array<{ url: string; alt?: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [delivery, setDelivery] = useState<DeliveryLocationValue>(DEFAULT_DELIVERY);
  const [buyerChecklistItems, setBuyerChecklistItems] = useState<ChecklistDraftItem[]>([
    createEmptyChecklistItem(),
  ]);
  const [buyerDelivery, setBuyerDelivery] = useState<DeliveryLocationValue>(DEFAULT_DELIVERY);

  const form = useZodForm(confirmSaleSchema, {
    defaultValues: {
      title: '',
      description: '',
      condition: 'GOOD',
      category: 'OTHER',
      price: undefined as unknown as number,
      currency: defaultPaymentCurrency(preferredCurrency),
      feePayer: 'BUYER',
      imageUrl: '',
      conditionsSummary: '',
      returnInstructions: '',
    },
  });

  const acceptForm = useZodForm(acceptPurchaseSchema, {
    defaultValues: {
      conditionsSummary: '',
      feePayer: 'BUYER',
      productTitle: '',
      productDescription: '',
    },
  });

  const preview = data?.data;
  const values = form.watch();
  const acceptFeePayer = acceptForm.watch('feePayer');
  const isSellerInitiated = preview?.initiatedBy === 'SELLER';

  useEffect(() => {
    if (!preview?.feePayer) return;
    acceptForm.setValue('feePayer', preview.feePayer);
    form.setValue('feePayer', preview.feePayer);
  }, [preview?.feePayer, acceptForm, form]);

  const summaryPrice = useMemo(() => {
    const price = Number(values.price);
    if (!Number.isFinite(price)) return '—';
    return formatOperationMoney(Math.round(price * 100), values.currency || 'UYU');
  }, [values.price, values.currency]);

  if (isLoading) {
    return (
      <div className="ca-tx ca-tx--loading">
        <Spinner animation="border" />
        <span>Validando enlace…</span>
      </div>
    );
  }

  if (isError || !preview) {
    return (
      <Alert variant="danger">
        {getApiErrorMessage(previewError, 'Enlace inválido o no disponible.')}{' '}
        <Link to="/operaciones">Ir a operaciones</Link>
      </Alert>
    );
  }

  const addImage = () => {
    setError(null);
    const url = (form.getValues('imageUrl') || '').trim();
    if (!url) {
      setError('Pegá una URL de imagen');
      return;
    }
    if (!isHttpUrl(url) && !url.startsWith('data:image/')) {
      setError('La foto debe ser una URL http(s) o data:image');
      return;
    }
    if (images.some((img) => img.url === url)) {
      setError('Esa foto ya está en la lista');
      return;
    }
    if (images.length >= 20) {
      setError('Máximo 20 fotos');
      return;
    }
    setImages((prev) => [...prev, { url, alt: values.title || undefined }]);
    form.setValue('imageUrl', '');
  };

  const onFileSelected = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten imágenes');
      return;
    }
    if (file.size > 1_200_000) {
      setError('La imagen local debe pesar menos de 1.2 MB (o usá una URL)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result.startsWith('data:image/')) {
        setError('No se pudo leer la imagen');
        return;
      }
      setImages((prev) => [...prev, { url: result, alt: file.name }]);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const goToProduct = () => {
    setError(null);
    if (preview.isExpired) return;
    if (preview.hasProduct) {
      setError('Esta operación ya tiene un producto confirmado.');
      return;
    }
    form.setValue('title', preview.productTitle || preview.title);
    form.setValue('description', preview.productDescription || '');
    form.setValue(
      'price',
      preview.amountCents != null ? preview.amountCents / 100 : (undefined as unknown as number),
    );
    form.setValue(
      'currency',
      'UYU',
    );
    if (preview.feePayer) {
      form.setValue('feePayer', preview.feePayer);
    }
    setStep(2);
  };

  const goToConfirm = form.handleSubmit(() => {
    setError(null);
    if (images.length < 1) {
      setError('Agregá al menos una foto del producto');
      return;
    }
    const deliveryError = validateDelivery(delivery, profile);
    if (deliveryError) {
      setError(deliveryError);
      return;
    }
    setStep(3);
  });

  const onConfirmSale = async () => {
    if (!token) return;
    setError(null);
    const parsed = confirmSaleSchema.safeParse(form.getValues());
    if (!parsed.success) {
      setError('Revisá los datos del producto y las instrucciones para el Agente');
      setStep(2);
      return;
    }
    if (images.length < 1) {
      setError('Agregá al menos una foto');
      setStep(2);
      return;
    }
    const deliveryError = validateDelivery(delivery, profile);
    if (deliveryError) {
      setError(deliveryError);
      setStep(2);
      return;
    }

    try {
      const result = await confirm.mutateAsync({
        token,
        payload: {
          title: parsed.data.title,
          description: parsed.data.description,
          condition: parsed.data.condition as ProductCondition,
          category: parsed.data.category as ProductCategory,
          price: parsed.data.price,
          currency: parsed.data.currency,
          feePayer: parsed.data.feePayer,
          images,
          conditionsSummary: parsed.data.conditionsSummary,
          meetingLocationMode: delivery.mode,
          meetingLocation: delivery.mode === 'CHAT' ? undefined : delivery.meetingLocation,
          returnInstructions: parsed.data.returnInstructions,
        },
      });
      navigate(`/operaciones/${result.data.code}`, {
        state: {
          sellerConfirmed: true,
          pendingBuyerConfirm: result.data.status === 'PENDING_BUYER_CONFIRM',
        },
      });
    } catch {
      setError('No se pudo confirmar la venta. Verificá la sesión o el enlace.');
    }
  };

  const onAcceptAsBuyer = acceptForm.handleSubmit(async (values: AcceptPurchaseValues) => {
    if (!token) return;
    setError(null);
    const deliveryError = validateDelivery(buyerDelivery, profile);
    if (deliveryError) {
      setError(deliveryError);
      return;
    }

    try {
      const result = await acceptPurchase.mutateAsync({
        token,
        payload: {
          conditionsSummary: values.conditionsSummary,
          checklist: checklistDraftToPayload(buyerChecklistItems),
          meetingLocationMode: buyerDelivery.mode,
          meetingLocation:
            buyerDelivery.mode === 'CHAT' ? undefined : buyerDelivery.meetingLocation,
          productTitle: values.productTitle,
          productDescription: values.productDescription,
          feePayer: values.feePayer,
        },
      });
      navigate(`/operaciones/${result.data.code}`, {
        state: { buyerAccepted: true },
      });
    } catch {
      setError('No se pudo aceptar la compra. Verificá la sesión o el enlace.');
    }
  });

  if (isSellerInitiated) {
    const product = preview.product;
    const productImages = (product?.images ?? []).map((img) => ({
      url: img.url,
      alt: img.alt || product?.title || preview.title,
    }));
    const canAccept =
      !preview.isExpired && !preview.hasCounterparty && preview.status !== 'ACCEPTED';

    return (
      <div className="ca-tx ca-tx--invite-buy">
        <header className="ca-tx__header">
          <div className="ca-tx__brand">
            <ShoppingBag size={22} strokeWidth={1.75} />
            <div>
              <p className="ca-tx__kicker">Comprador · invitación</p>
              <h2 className="ca-tx__title">Te invitaron a comprar</h2>
              <p className="ca-tx__lead">
                {preview.creatorName
                  ? `${preview.creatorName} publicó un producto. Ves la descripción; tus instrucciones van al Agente.`
                  : 'Un vendedor te invita a comprar. Completá tus instrucciones para el Agente.'}
              </p>
            </div>
          </div>
          <div className="ca-tx__meta">
            <Badge bg="primary">{STATUS_LABELS[preview.status]}</Badge>
          </div>
        </header>

        {error ? <Alert variant="danger">{error}</Alert> : null}

        <motion.section
          className="ca-tx-panel ca-tx-invite-buy"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {productImages.length ? (
            <div className="ca-tx-invite-buy__media">
              <ul className="ca-tx-invite-buy__thumbs">
                {productImages.map((img, index) => (
                  <li key={`${index}-${img.url}`}>
                    <button
                      type="button"
                      onClick={() => setGalleryIndex(index)}
                      aria-label={`Ampliar foto ${index + 1}`}
                    >
                      <img src={img.url} alt={img.alt || `Foto ${index + 1}`} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="ca-tx-invite-buy__head">
            <p className="ca-tx-invite-buy__kicker">
              {product ? 'Producto a comprar' : 'Operación'}
            </p>
            <h3 className="ca-tx-invite-buy__title">
              {preview.productTitle || product?.title || preview.title}
            </h3>
            <p className="ca-tx-invite-buy__price">
              {formatOperationMoney(
                product?.estimatedValueCents ?? preview.amountCents,
                product?.currency ?? preview.currency,
              )}
            </p>
            {product ? (
              <div className="ca-tx-invite-buy__chips">
                <span className="ca-tx-invite-buy__chip">
                  <Tag size={14} />
                  {CONDITION_LABELS[product.condition]}
                </span>
                <span className="ca-tx-invite-buy__chip">{CATEGORY_LABELS[product.category]}</span>
              </div>
            ) : null}
          </div>

          {preview.productDescription || product?.description ? (
            <div className="ca-tx-invite-buy__section">
              <h3>Descripción del vendedor</h3>
              <p>{preview.productDescription || product?.description}</p>
            </div>
          ) : null}

          <div className="ca-tx-invite-buy__meta">
            <div className="ca-tx-invite-buy__meta-row">
              <span>Operación</span>
              <strong>{preview.title}</strong>
            </div>
            <div className="ca-tx-invite-buy__meta-row">
              <span>Código</span>
              <strong>
                <code>{preview.code}</code>
              </strong>
            </div>
            {preview.creatorName ? (
              <div className="ca-tx-invite-buy__meta-row">
                <span>Vendedor</span>
                <strong>{preview.creatorName}</strong>
              </div>
            ) : null}
            {preview.inviteExpiresAt ? (
              <div className="ca-tx-invite-buy__meta-row">
                <span>Válido hasta</span>
                <strong>
                  {new Date(preview.inviteExpiresAt).toLocaleDateString('es-UY', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </strong>
              </div>
            ) : null}
          </div>

          {preview.isExpired ? (
            <Alert variant="warning" className="mb-0">
              Este enlace expiró. Pedile al vendedor que regenere la invitación.
            </Alert>
          ) : !canAccept ? (
            <Alert variant="info" className="mb-0">
              Esta compra ya fue aceptada.{' '}
              <Link to={`/operaciones/${preview.code}`}>Ver detalle</Link>
            </Alert>
          ) : (
            <Form onSubmit={onAcceptAsBuyer} className="ca-tx-edit mt-3" noValidate>
              <fieldset className="ca-tx-fieldset">
                <legend>Para el Agente</legend>
                <p className="ca-tx-fieldset__hint">
                  El vendedor no ve estas instrucciones ni tu ubicación.
                </p>
                <div className="row g-3">
                  <Form.Group className="col-12" controlId="buy-product-title">
                    <Form.Label>Qué esperás recibir (título)</Form.Label>
                    <Form.Control
                      {...acceptForm.register('productTitle')}
                      placeholder="Ej. Notebook Lenovo ThinkPad T14"
                      isInvalid={Boolean(acceptForm.formState.errors.productTitle)}
                    />
                    <Form.Control.Feedback type="invalid">
                      {acceptForm.formState.errors.productTitle?.message}
                    </Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group className="col-12" controlId="buy-product-desc">
                    <Form.Label>Descripción para el Agente / vendedor</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      {...acceptForm.register('productDescription')}
                      placeholder="Detalles de lo que aceptás comprar…"
                      isInvalid={Boolean(acceptForm.formState.errors.productDescription)}
                    />
                    <Form.Text muted>
                      Esta descripción la ve el vendedor. El resto solo el Agente.
                    </Form.Text>
                    <Form.Control.Feedback type="invalid">
                      {acceptForm.formState.errors.productDescription?.message}
                    </Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group className="col-12" controlId="buy-conditions">
                    <Form.Label>Instrucciones para el Agente</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      {...acceptForm.register('conditionsSummary')}
                      placeholder="Horarios disponibles, lugares de entrega, etc."
                      isInvalid={Boolean(acceptForm.formState.errors.conditionsSummary)}
                    />
                    <Form.Control.Feedback type="invalid">
                      {acceptForm.formState.errors.conditionsSummary?.message}
                    </Form.Control.Feedback>
                  </Form.Group>
                  <div className="col-12">
                    <FeePayerFields
                      controlId="buy-fee-payer"
                      feePayer={acceptFeePayer}
                      onFeePayerChange={(value) =>
                        acceptForm.setValue('feePayer', value, { shouldValidate: true })
                      }
                      priceMajor={
                        preview.amountCents != null ? preview.amountCents / 100 : null
                      }
                      currency={preview.currency || 'UYU'}
                      error={acceptForm.formState.errors.feePayer?.message}
                      disabled={acceptPurchase.isPending}
                      viewerHint="buyer"
                    />
                  </div>
                  <div className="col-12">
                    <ChecklistEditor
                      items={buyerChecklistItems}
                      onChange={setBuyerChecklistItems}
                    />
                  </div>
                </div>
              </fieldset>

              <div className="ca-tx-delivery-wrap">
                <DeliveryLocationPicker
                  value={buyerDelivery}
                  onChange={setBuyerDelivery}
                  profile={profile}
                  disabled={acceptPurchase.isPending}
                />
              </div>

              <div className="ca-tx-invite-buy__actions">
                <Button type="submit" className="ca-btn-cta" disabled={acceptPurchase.isPending}>
                  {acceptPurchase.isPending ? (
                    <Spinner size="sm" animation="border" className="me-2" />
                  ) : (
                    <UserPlus size={16} className="me-1" />
                  )}
                  Aceptar compra
                </Button>
              </div>
            </Form>
          )}
        </motion.section>

        <PhotoLightbox
          images={productImages}
          index={galleryIndex ?? 0}
          open={galleryIndex != null}
          onClose={() => setGalleryIndex(null)}
          onIndexChange={setGalleryIndex}
        />
      </div>
    );
  }

  const currentStepLabel =
    SELLER_STEPS.find((item) => item.id === step)?.label ?? 'Invitación';

  return (
    <div className="ca-tx ca-tx--invite-sell">
      <header className="ca-tx__header">
        <div className="ca-tx__brand">
          <Handshake size={22} strokeWidth={1.75} />
          <div>
            <p className="ca-tx__kicker">Vendedor · invitación</p>
            <h2 className="ca-tx__title">Recibiste un enlace de operación</h2>
            <p className="ca-tx__lead">
              {preview.creatorName
                ? `${preview.creatorName} te invita a vender. Ves la descripción del producto; tus instrucciones van al Agente.`
                : 'Completá el producto y tus instrucciones para el Agente.'}
            </p>
          </div>
        </div>
        <div className="ca-tx__meta">
          <Badge bg="primary">{STATUS_LABELS[preview.status]}</Badge>
        </div>
      </header>

      <section className="ca-tx-panel ca-tx-steps-panel">
        <div className="ca-tx-steps-wrap">
          <ol className="ca-tx-steps" aria-label="Pasos para confirmar la venta">
            {SELLER_STEPS.map((item) => (
              <li
                key={item.id}
                className={[
                  'ca-tx-steps__item',
                  step === item.id ? 'ca-tx-steps__item--active' : '',
                  step > item.id ? 'ca-tx-steps__item--done' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="ca-tx-steps__num">{item.id}</span>
                <span className="ca-tx-steps__label">{item.label}</span>
              </li>
            ))}
          </ol>
          <p className="ca-tx-steps__current" aria-live="polite">
            {currentStepLabel}
          </p>
        </div>
      </section>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {step === 1 ? (
        <motion.section
          className="ca-tx-panel ca-tx-invite-sell"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="ca-tx-invite-sell__head">
            <p className="ca-tx-invite-sell__kicker">Pedido del comprador</p>
            <h3 className="ca-tx-invite-sell__title">
              {preview.productTitle || preview.title}
            </h3>
            <p className="ca-tx-invite-sell__price">
              {formatOperationMoney(preview.amountCents, preview.currency)}
            </p>
          </div>

          {preview.productDescription ? (
            <div className="ca-tx-invite-sell__section">
              <h3>Descripción del comprador</h3>
              <p>{preview.productDescription}</p>
            </div>
          ) : null}

          <div className="ca-tx-invite-sell__meta">
            <div className="ca-tx-invite-sell__meta-row">
              <span>Operación</span>
              <strong>{preview.title}</strong>
            </div>
            <div className="ca-tx-invite-sell__meta-row">
              <span>Código</span>
              <strong>
                <code>{preview.code}</code>
              </strong>
            </div>
            {preview.creatorName ? (
              <div className="ca-tx-invite-sell__meta-row">
                <span>Comprador</span>
                <strong>{preview.creatorName}</strong>
              </div>
            ) : null}
            {preview.inviteExpiresAt ? (
              <div className="ca-tx-invite-sell__meta-row">
                <span>Válido hasta</span>
                <strong>
                  {new Date(preview.inviteExpiresAt).toLocaleDateString('es-UY', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </strong>
              </div>
            ) : null}
          </div>

          <div className="ca-tx-invite-sell__actions">
            {preview.isExpired ? (
              <Alert variant="warning" className="mb-0">
                Este enlace expiró. Pedile al comprador que regenere la invitación.
              </Alert>
            ) : preview.hasProduct ? (
              <Alert variant="info" className="mb-0">
                Ya hay un producto confirmado en esta operación.{' '}
                <Link to={`/operaciones/${preview.code}`}>Ver detalle</Link>
              </Alert>
            ) : (
              <Button className="ca-btn-cta" onClick={goToProduct}>
                <Package size={16} className="me-1" />
                Agregar producto y continuar
              </Button>
            )}
          </div>
        </motion.section>
      ) : null}

      {step === 2 ? (
        <motion.section
          className="ca-tx-panel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <header className="ca-tx-panel__head">
            <h3 className="ca-section-title">Producto e instrucciones</h3>
            <p className="ca-section-lead ca-section-lead--soft-emphasis">
              La descripción del producto la ve el comprador. Condiciones, ubicación y devolución
              solo las ve el Agente.
            </p>
          </header>

          <Form onSubmit={goToConfirm} className="ca-tx-edit" noValidate>
            <fieldset className="ca-tx-fieldset">
              <legend>Producto</legend>
              <div className="row g-3">
                <Form.Group className="col-12" controlId="sale-title">
                  <Form.Label>Título del producto</Form.Label>
                  <Form.Control
                    {...form.register('title')}
                    isInvalid={Boolean(form.formState.errors.title)}
                  />
                  <Form.Control.Feedback type="invalid">
                    {form.formState.errors.title?.message}
                  </Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="col-12" controlId="sale-description">
                  <Form.Label>Descripción</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    {...form.register('description')}
                    isInvalid={Boolean(form.formState.errors.description)}
                  />
                  <Form.Control.Feedback type="invalid">
                    {form.formState.errors.description?.message}
                  </Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="col-6 col-md-3" controlId="sale-condition">
                  <Form.Label>Condición</Form.Label>
                  <Form.Select {...form.register('condition')}>
                    {(Object.keys(CONDITION_LABELS) as ProductCondition[]).map((key) => (
                      <option key={key} value={key}>
                        {CONDITION_LABELS[key]}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <Form.Group className="col-6 col-md-3" controlId="sale-category">
                  <Form.Label>Categoría</Form.Label>
                  <Form.Select {...form.register('category')}>
                    {(Object.keys(CATEGORY_LABELS) as ProductCategory[]).map((key) => (
                      <option key={key} value={key}>
                        {CATEGORY_LABELS[key]}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <Form.Group className="col-6 col-md-3" controlId="sale-price">
                  <Form.Label>Precio</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    min="1"
                    {...form.register('price')}
                    isInvalid={Boolean(form.formState.errors.price)}
                  />
                  <Form.Control.Feedback type="invalid">
                    {form.formState.errors.price?.message}
                  </Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="col-6 col-md-3" controlId="sale-currency">
                  <Form.Label>Moneda</Form.Label>
                  <Form.Select {...form.register('currency')}>
                    {PAYMENT_CURRENCY_OPTIONS.map((option) => (
                      <option
                        key={option.code}
                        value={option.code}
                        disabled={option.disabled}
                      >
                        {option.label}
                        {option.disabled ? ' (próximamente)' : ''}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>

              <FeePayerFields
                controlId="sale-fee-payer"
                feePayer={values.feePayer}
                onFeePayerChange={(value) =>
                  form.setValue('feePayer', value, { shouldValidate: true })
                }
                priceMajor={Number(values.price) || null}
                currency={values.currency}
                error={form.formState.errors.feePayer?.message}
                disabled={confirm.isPending}
                viewerHint="seller"
              />
            </fieldset>

            <fieldset className="ca-tx-fieldset ca-tx-photos">
              <legend>Fotos</legend>
              <div className="ca-tx-photos__add">
                <Form.Control
                  {...form.register('imageUrl')}
                  placeholder="https://…"
                  aria-label="URL de foto"
                />
                <Button type="button" variant="outline-primary" onClick={addImage}>
                  <ImagePlus size={16} className="me-1" />
                  Agregar
                </Button>
              </div>
              <Form.Control
                type="file"
                accept="image/*"
                className="mt-2"
                onChange={(event) => {
                  const input = event.currentTarget as unknown as HTMLInputElement;
                  onFileSelected(input.files);
                }}
              />
              {images.length ? (
                <ul className="ca-tx-photos__grid">
                  {images.map((img) => (
                    <li key={img.url}>
                      <img src={img.url} alt={img.alt || 'Foto del producto'} />
                      <button
                        type="button"
                        aria-label="Quitar foto"
                        onClick={() =>
                          setImages((prev) => prev.filter((item) => item.url !== img.url))
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ca-section-lead mb-0">Sin fotos todavía.</p>
              )}
            </fieldset>

            <fieldset className="ca-tx-fieldset">
              <legend>Para el Agente</legend>
              <div className="row g-3">
                <Form.Group className="col-12" controlId="sale-conditions">
                  <Form.Label>Instrucciones para el Agente</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    {...form.register('conditionsSummary')}
                    placeholder="Horarios disponibles, lugares de entrega, etc."
                    isInvalid={Boolean(form.formState.errors.conditionsSummary)}
                  />
                  <Form.Control.Feedback type="invalid">
                    {form.formState.errors.conditionsSummary?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </div>
            </fieldset>

            <div className="ca-tx-delivery-wrap">
              <DeliveryLocationPicker
                value={delivery}
                onChange={setDelivery}
                profile={profile}
                disabled={confirm.isPending}
              />
            </div>

            <fieldset className="ca-tx-fieldset">
              <legend>Devolución</legend>
              <p className="ca-tx-fieldset__hint">
                Indicále al Agente cómo devolver tu producto si el comprador lo rechaza en la
                entrega personal. Solo lo ve el Agente.
              </p>
              <Form.Group controlId="sale-return">
                <Form.Label>Instrucciones para el Agente</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  {...form.register('returnInstructions')}
                  isInvalid={Boolean(form.formState.errors.returnInstructions)}
                />
                <Form.Control.Feedback type="invalid">
                  {form.formState.errors.returnInstructions?.message}
                </Form.Control.Feedback>
              </Form.Group>
            </fieldset>

            <div className="ca-form-actions">
              <Button type="button" variant="outline-secondary" onClick={() => setStep(1)}>
                Atrás
              </Button>
              <Button type="submit" className="ca-btn-primary">
                Revisar y confirmar
              </Button>
            </div>
          </Form>
        </motion.section>
      ) : null}

      {step === 3 ? (
        <motion.section
          className="ca-tx-panel ca-tx-confirm"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <header className="ca-tx-panel__head">
            <h3 className="ca-section-title">Confirmar venta</h3>
            <p className="ca-section-lead ca-section-lead--soft-emphasis">
              Al confirmar te unís como vendedor y la operación queda pendiente de fondeo.
            </p>
          </header>

          <div className="ca-tx-confirm__body">
            <div className="ca-tx-confirm__main">
              <p className="ca-tx-confirm__kicker">Producto</p>
              <h3 className="ca-tx-confirm__title">{values.title}</h3>
              <p className="ca-tx-confirm__price">{summaryPrice}</p>
              <div className="ca-tx-confirm__chips">
                <span className="ca-tx-confirm__chip">
                  <Tag size={14} aria-hidden />
                  {CONDITION_LABELS[(values.condition || 'GOOD') as ProductCondition]}
                </span>
                {values.category ? (
                  <span className="ca-tx-confirm__chip">
                    {CATEGORY_LABELS[values.category as ProductCategory]}
                  </span>
                ) : null}
                <span className="ca-tx-confirm__chip">
                  {images.length} foto{images.length === 1 ? '' : 's'}
                </span>
              </div>
              {values.description ? (
                <p className="ca-tx-confirm__desc">{values.description}</p>
              ) : null}
            </div>

            {images.length ? (
              <ul className="ca-tx-confirm__thumbs" aria-label="Fotos del producto">
                {images.map((img) => (
                  <li key={img.url}>
                    <img src={img.url} alt={img.alt || 'Foto'} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="ca-tx-confirm__actions ca-form-actions">
            <Button type="button" variant="outline-secondary" onClick={() => setStep(2)}>
              Editar
            </Button>
            <Button
              className="ca-btn-cta"
              disabled={confirm.isPending}
              onClick={() => void onConfirmSale()}
            >
              {confirm.isPending ? (
                <Spinner size="sm" animation="border" className="me-2" />
              ) : (
                <CheckCircle2 size={16} className="me-1" />
              )}
              Confirmar venta
            </Button>
          </div>
        </motion.section>
      ) : null}
    </div>
  );
}
