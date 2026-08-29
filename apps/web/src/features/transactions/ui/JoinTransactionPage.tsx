import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import { AnimatePresence, motion } from 'framer-motion';
import { ImagePlus, Tag, Trash2 } from 'lucide-react';

import { useZodForm } from '@/shared/lib/form';
import {
  defaultPaymentCurrency,
  formatOperationMoney,
  PAYMENT_CURRENCY_OPTIONS,
} from '@/shared/lib/money';
import { usePreferencesSnapshot, useUserPreferences } from '@/shared/preferences';
import { getApiErrorMessage } from '@/shared/api/client';
import { useProfile } from '@/features/profile/hooks/useProfile';

import { useAcceptPurchase, useConfirmSale, useInvitePreview } from '../hooks/useTransactions';
import {
  acceptPurchaseSchema,
  confirmSaleSchema,
  type AcceptPurchaseValues,
  type ConfirmSaleValues,
} from '../model/schemas';
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  FEE_PAYER_LABELS,
  STATUS_LABELS,
  type DeliveryLocationValue,
  type FeePayer,
  type InvitePreview,
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

const DEFAULT_DELIVERY: DeliveryLocationValue = { mode: 'MAP' };

const JOIN_STEPS = [
  {
    id: 'product',
    label: 'Producto',
    title: 'Producto',
    lead: 'Revisá el producto y completá lo que hace falta.',
  },
  {
    id: 'price',
    label: 'Precio',
    title: 'Precio y comisión',
    lead: 'Confirmá el precio y quién cubre la comisión de ConfiApp.',
  },
  {
    id: 'meeting',
    label: 'Encuentro',
    title: 'Punto de encuentro',
    lead: 'Indicá dónde querés que se haga la entrega intermediada.',
  },
  {
    id: 'agent',
    label: 'Agente',
    title: 'Instrucciones al Agente',
    lead: 'La contraparte no ve estas instrucciones.',
  },
  {
    id: 'review',
    label: 'Revisar',
    title: 'Revisar y confirmar',
    lead: 'Confirmá los datos antes de unirte a la operación.',
  },
] as const;

type JoinStepId = (typeof JOIN_STEPS)[number]['id'];

const BUYER_STEP_FIELDS: Record<JoinStepId, (keyof AcceptPurchaseValues)[]> = {
  product: ['productTitle', 'productDescription'],
  price: ['feePayer'],
  meeting: [],
  agent: ['conditionsSummary'],
  review: [],
};

const SELLER_STEP_FIELDS: Record<JoinStepId, (keyof ConfirmSaleValues)[]> = {
  product: ['title', 'description', 'condition', 'category'],
  price: ['price', 'currency', 'feePayer'],
  meeting: [],
  agent: ['conditionsSummary', 'returnInstructions'],
  review: [],
};

const DELIVERY_MODE_LABELS: Record<DeliveryLocationValue['mode'], string> = {
  MAP: 'Punto en el mapa',
  HOME: 'Domicilio registrado',
  CHAT: 'Coordinar en el chat',
};

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function majorToCents(amount: number): number {
  return Math.round(amount * 100);
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

function WizardChrome({
  heading,
  lead,
  status,
  stepIndex,
  step,
  onGoToStep,
  error,
  children,
  onBack,
  isFirst,
  isLast,
  isPending,
  submitLabel,
  pendingLabel,
}: {
  heading: string;
  lead: string;
  status: string;
  stepIndex: number;
  step: { id: JoinStepId; label: string; title: string; lead: string };
  onGoToStep: (index: number) => void;
  error: string | null;
  children: ReactNode;
  onBack: () => void;
  isFirst: boolean;
  isLast: boolean;
  isPending: boolean;
  submitLabel: string;
  pendingLabel: string;
}) {
  return (
    <>
      <div className="ca-tx-buyer-wizard__intro">
        <div>
          <div className="ca-tx-buyer-wizard__title-row">
            <h1 className="ca-tx-buyer-wizard__heading">{heading}</h1>
            <Badge bg="primary">{status}</Badge>
          </div>
          <p className="ca-tx-buyer-wizard__step-lead mb-0 mt-2">{lead}</p>
        </div>
      </div>

      <nav className="ca-tx-buyer-wizard__steps-wrap" aria-label="Pasos del formulario">
        <ol className="ca-tx-steps ca-tx-buyer-wizard__steps">
          {JOIN_STEPS.map((item, index) => {
            const done = index < stepIndex;
            const active = index === stepIndex;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={[
                    'ca-tx-steps__item',
                    done ? 'ca-tx-steps__item--done' : '',
                    active ? 'ca-tx-steps__item--active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={!done}
                  aria-current={active ? 'step' : undefined}
                  onClick={() => onGoToStep(index)}
                >
                  <span className="ca-tx-steps__num" aria-hidden>
                    {index + 1}
                  </span>
                  <span className="ca-tx-steps__label">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="ca-tx-steps__current">
          Paso {stepIndex + 1} de {JOIN_STEPS.length} · {step.label}
        </p>
      </nav>

      <header className="ca-tx-buyer-wizard__step-head">
        <h2 className="ca-tx-buyer-wizard__step-title">{step.title}</h2>
        {step.lead ? <p className="ca-tx-buyer-wizard__step-lead">{step.lead}</p> : null}
      </header>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {children}

      <div className="ca-tx-buyer-wizard__actions">
        <Button
          type="button"
          variant="outline-secondary"
          disabled={isFirst || isPending}
          onClick={onBack}
        >
          Atrás
        </Button>
        {isLast ? (
          <Button type="submit" className="ca-btn-cta" disabled={isPending}>
            {isPending ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                {pendingLabel}
              </>
            ) : (
              submitLabel
            )}
          </Button>
        ) : (
          <Button type="submit" className="ca-btn-primary" disabled={isPending}>
            Siguiente
          </Button>
        )}
      </div>
    </>
  );
}

/** Comprador acepta invitación iniciada por el vendedor. */
function JoinAsBuyerWizard({
  token,
  preview,
}: {
  token: string;
  preview: InvitePreview;
}) {
  const navigate = useNavigate();
  const acceptPurchase = useAcceptPurchase();
  const { data: profileData } = useProfile();
  const profile = profileData?.profile;

  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [buyerDelivery, setBuyerDelivery] = useState<DeliveryLocationValue>(DEFAULT_DELIVERY);
  const [buyerChecklistItems, setBuyerChecklistItems] = useState<ChecklistDraftItem[]>([
    createEmptyChecklistItem(),
  ]);
  const didPrefill = useRef(false);

  const acceptForm = useZodForm(acceptPurchaseSchema, {
    defaultValues: {
      conditionsSummary: '',
      feePayer: preview.feePayer ?? 'BUYER',
      productTitle: '',
      productDescription: '',
    },
  });

  useEffect(() => {
    if (didPrefill.current) return;
    didPrefill.current = true;
    const sellerTitle =
      preview.productTitle || preview.product?.title || preview.title || '';
    if (sellerTitle) {
      acceptForm.setValue('productTitle', sellerTitle);
    }
    if (preview.feePayer) {
      acceptForm.setValue('feePayer', preview.feePayer);
    }
  }, [preview, acceptForm]);

  const acceptFeePayer = acceptForm.watch('feePayer');
  const values = acceptForm.watch();
  const step = JOIN_STEPS[stepIndex]!;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === JOIN_STEPS.length - 1;

  const product = preview.product;
  const productImages = (product?.images ?? []).map((img) => ({
    url: img.url,
    alt: img.alt || product?.title || preview.title,
  }));

  const checklistPreview = useMemo(
    () => buyerChecklistItems.map((item) => item.text.trim()).filter(Boolean),
    [buyerChecklistItems],
  );

  const priceMajor = preview.amountCents != null ? preview.amountCents / 100 : null;
  const displayCurrency = product?.currency ?? preview.currency ?? 'UYU';

  const stepWithLead =
    step.id === 'product'
      ? {
          ...step,
          lead: 'El vendedor publicó este producto. Indicá qué esperás recibir.',
        }
      : step.id === 'agent'
        ? {
            ...step,
            lead: 'El vendedor no ve estas instrucciones ni el checklist.',
          }
        : step;

  async function goNext() {
    setError(null);
    const fields = BUYER_STEP_FIELDS[step.id];
    if (fields.length > 0) {
      const ok = await acceptForm.trigger(fields);
      if (!ok) return;
    }

    if (step.id === 'meeting') {
      const deliveryError = validateDelivery(buyerDelivery, profile);
      if (deliveryError) {
        setError(deliveryError);
        return;
      }
    }

    if (step.id === 'agent') {
      if (checklistPreview.length === 0) {
        setError('Agregá al menos un ítem en el checklist para el Agente.');
        return;
      }
    }

    setStepIndex((i) => Math.min(i + 1, JOIN_STEPS.length - 1));
  }

  function goBack() {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function goToStep(index: number) {
    if (index < stepIndex) {
      setError(null);
      setStepIndex(index);
    }
  }

  const onSubmit = acceptForm.handleSubmit(async (formValues: AcceptPurchaseValues) => {
    setError(null);
    const deliveryError = validateDelivery(buyerDelivery, profile);
    if (deliveryError) {
      setError(deliveryError);
      setStepIndex(2);
      return;
    }
    if (checklistPreview.length === 0) {
      setError('Agregá al menos un ítem en el checklist para el Agente.');
      setStepIndex(3);
      return;
    }

    try {
      const result = await acceptPurchase.mutateAsync({
        token,
        payload: {
          conditionsSummary: formValues.conditionsSummary,
          checklist: checklistDraftToPayload(buyerChecklistItems),
          meetingLocationMode: buyerDelivery.mode,
          meetingLocation:
            buyerDelivery.mode === 'CHAT' ? undefined : buyerDelivery.meetingLocation,
          productTitle: formValues.productTitle,
          productDescription: formValues.productDescription,
          feePayer: formValues.feePayer,
        },
      });
      navigate(`/operaciones/${result.data.code}`, {
        state: { buyerAccepted: true },
      });
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'No se pudo aceptar la compra. Verificá la sesión o el enlace.'),
      );
    }
  });

  const introLead = preview.creatorName
    ? `${preview.creatorName} te invita a comprar. Completá tus datos para el Agente.`
    : 'Un vendedor te invita a comprar. Completá tus instrucciones para el Agente.';

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        if (isLast) void onSubmit();
        else void goNext();
      }}
      className="ca-tx ca-tx-buyer-wizard ca-tx--invite-buy"
      noValidate
    >
      <WizardChrome
        heading="Te invitaron a comprar"
        lead={introLead}
        status={STATUS_LABELS[preview.status]}
        stepIndex={stepIndex}
        step={stepWithLead}
        onGoToStep={goToStep}
        error={error}
        onBack={goBack}
        isFirst={isFirst}
        isLast={isLast}
        isPending={acceptPurchase.isPending}
        submitLabel="Aceptar compra"
        pendingLabel="Aceptando…"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            className="ca-tx-buyer-wizard__panel"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
          >
            {step.id === 'product' ? (
              <div className="ca-tx-buyer-wizard__stack">
                <div className="ca-tx-invite-buy__head">
                  <p className="ca-tx-invite-buy__kicker">Producto del vendedor</p>
                  <h3 className="ca-tx-invite-buy__title">
                    {preview.productTitle || product?.title || preview.title}
                  </h3>
                  <p className="ca-tx-invite-buy__price">
                    {formatOperationMoney(
                      product?.estimatedValueCents ?? preview.amountCents,
                      displayCurrency,
                    )}
                  </p>
                  {product ? (
                    <div className="ca-tx-invite-buy__chips">
                      <span className="ca-tx-invite-buy__chip">
                        <Tag size={14} />
                        {CONDITION_LABELS[product.condition]}
                      </span>
                      <span className="ca-tx-invite-buy__chip">
                        {CATEGORY_LABELS[product.category]}
                      </span>
                    </div>
                  ) : null}
                </div>

                {preview.productDescription || product?.description ? (
                  <div className="ca-tx-invite-buy__section">
                    <h3>Descripción del vendedor</h3>
                    <p>{preview.productDescription || product?.description}</p>
                  </div>
                ) : null}

                {productImages.length ? (
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
                ) : null}

                <div className="ca-tx-start-grid">
                  <Form.Group className="ca-tx-start-grid__full" controlId="buy-product-title">
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
                  <Form.Group className="ca-tx-start-grid__full" controlId="buy-product-desc">
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
                </div>
              </div>
            ) : null}

            {step.id === 'price' ? (
              <div className="ca-tx-buyer-wizard__stack">
                <div className="ca-tx-start-grid ca-tx-start-grid--price">
                  <Form.Group>
                    <Form.Label>Precio</Form.Label>
                    <Form.Control
                      plaintext
                      readOnly
                      value={
                        priceMajor != null
                          ? formatOperationMoney(preview.amountCents, displayCurrency)
                          : '—'
                      }
                    />
                  </Form.Group>
                </div>
                <FeePayerFields
                  controlId="buy-fee-payer"
                  feePayer={acceptFeePayer}
                  onFeePayerChange={(value) =>
                    acceptForm.setValue('feePayer', value, { shouldValidate: true })
                  }
                  priceMajor={priceMajor}
                  currency={displayCurrency}
                  error={acceptForm.formState.errors.feePayer?.message}
                  disabled={acceptPurchase.isPending}
                  viewerHint="buyer"
                />
              </div>
            ) : null}

            {step.id === 'meeting' ? (
              <div className="ca-tx-delivery-wrap">
                <DeliveryLocationPicker
                  value={buyerDelivery}
                  onChange={setBuyerDelivery}
                  profile={profile}
                  disabled={acceptPurchase.isPending}
                  hideHeader
                />
              </div>
            ) : null}

            {step.id === 'agent' ? (
              <div className="ca-tx-start-grid">
                <Form.Group className="ca-tx-start-grid__full" controlId="buy-conditions">
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
                <div className="ca-tx-start-grid__full">
                  <ChecklistEditor
                    items={buyerChecklistItems}
                    onChange={setBuyerChecklistItems}
                  />
                </div>
              </div>
            ) : null}

            {step.id === 'review' ? (
              <div className="ca-tx-buyer-review">
                <section className="ca-tx-buyer-review__block">
                  <h3 className="ca-tx-buyer-review__label">Producto</h3>
                  <dl className="ca-tx-buyer-review__dl">
                    <div className="ca-tx-buyer-review__wide">
                      <dt>Del vendedor</dt>
                      <dd>{preview.productTitle || product?.title || preview.title || '—'}</dd>
                    </div>
                    <div className="ca-tx-buyer-review__wide">
                      <dt>Qué esperás</dt>
                      <dd>{values.productTitle || '—'}</dd>
                    </div>
                    <div className="ca-tx-buyer-review__wide">
                      <dt>Tu descripción</dt>
                      <dd>{values.productDescription || '—'}</dd>
                    </div>
                  </dl>
                </section>

                <section className="ca-tx-buyer-review__block">
                  <h3 className="ca-tx-buyer-review__label">Precio</h3>
                  <dl className="ca-tx-buyer-review__dl">
                    <div>
                      <dt>Monto</dt>
                      <dd>
                        {preview.amountCents != null
                          ? formatOperationMoney(preview.amountCents, displayCurrency)
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Comisión</dt>
                      <dd>
                        {FEE_PAYER_LABELS[values.feePayer as FeePayer] ?? values.feePayer}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section className="ca-tx-buyer-review__block">
                  <h3 className="ca-tx-buyer-review__label">Encuentro</h3>
                  <dl className="ca-tx-buyer-review__dl">
                    <div className="ca-tx-buyer-review__wide">
                      <dt>Modo</dt>
                      <dd>{DELIVERY_MODE_LABELS[buyerDelivery.mode]}</dd>
                    </div>
                    {buyerDelivery.mode !== 'CHAT' && buyerDelivery.meetingLocation?.label ? (
                      <div className="ca-tx-buyer-review__wide">
                        <dt>Lugar</dt>
                        <dd>{buyerDelivery.meetingLocation.label}</dd>
                      </div>
                    ) : null}
                  </dl>
                </section>

                <section className="ca-tx-buyer-review__block">
                  <h3 className="ca-tx-buyer-review__label">Agente</h3>
                  <dl className="ca-tx-buyer-review__dl">
                    <div className="ca-tx-buyer-review__wide">
                      <dt>Instrucciones</dt>
                      <dd>{values.conditionsSummary || '—'}</dd>
                    </div>
                    <div className="ca-tx-buyer-review__wide">
                      <dt>Checklist</dt>
                      <dd>
                        {checklistPreview.length > 0 ? (
                          <ul className="ca-tx-buyer-review__list">
                            {checklistPreview.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                  </dl>
                </section>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </WizardChrome>

      <PhotoLightbox
        images={productImages}
        index={galleryIndex ?? 0}
        open={galleryIndex != null}
        onClose={() => setGalleryIndex(null)}
        onIndexChange={setGalleryIndex}
      />
    </Form>
  );
}

/** Vendedor confirma venta en invitación iniciada por el comprador. */
function JoinAsSellerWizard({
  token,
  preview,
}: {
  token: string;
  preview: InvitePreview;
}) {
  const navigate = useNavigate();
  const confirm = useConfirmSale();
  const { data: profileData } = useProfile();
  const profile = profileData?.profile;
  const { currency: preferredCurrency } = useUserPreferences();

  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<Array<{ url: string; alt?: string }>>([]);
  const [delivery, setDelivery] = useState<DeliveryLocationValue>(DEFAULT_DELIVERY);
  const didPrefill = useRef(false);

  const form = useZodForm(confirmSaleSchema, {
    defaultValues: {
      title: '',
      description: '',
      condition: 'GOOD',
      category: 'OTHER',
      price: undefined as unknown as number,
      currency: defaultPaymentCurrency(preferredCurrency),
      feePayer: preview.feePayer ?? 'BUYER',
      imageUrl: '',
      conditionsSummary: '',
      returnInstructions: '',
    },
  });

  useEffect(() => {
    if (didPrefill.current) return;
    didPrefill.current = true;
    form.setValue('title', preview.productTitle || preview.title || '');
    form.setValue('description', preview.productDescription || '');
    form.setValue(
      'price',
      preview.amountCents != null
        ? preview.amountCents / 100
        : (undefined as unknown as number),
    );
    form.setValue(
      'currency',
      (preview.currency as 'UYU' | 'USD' | undefined) ||
        defaultPaymentCurrency(preferredCurrency),
    );
    if (preview.feePayer) {
      form.setValue('feePayer', preview.feePayer);
    }
  }, [preview, form, preferredCurrency]);

  const values = form.watch();
  const step = JOIN_STEPS[stepIndex]!;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === JOIN_STEPS.length - 1;

  const buyerRequestLabel = preview.productTitle || preview.title;
  const stepWithLead =
    step.id === 'product'
      ? {
          ...step,
          lead: buyerRequestLabel
            ? `El comprador pidió: ${buyerRequestLabel}${
                preview.productDescription ? ` — ${preview.productDescription}` : ''
              }`
            : 'Publicá el producto que vas a vender.',
        }
      : step.id === 'agent'
        ? {
            ...step,
            lead: 'El comprador no ve estas instrucciones ni las de devolución.',
          }
        : step;

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

  async function goNext() {
    setError(null);
    const fields = SELLER_STEP_FIELDS[step.id];
    if (fields.length > 0) {
      const ok = await form.trigger(fields);
      if (!ok) return;
    }

    if (step.id === 'product') {
      if (images.length < 1) {
        setError('Agregá al menos una foto del producto');
        return;
      }
    }

    if (step.id === 'meeting') {
      const deliveryError = validateDelivery(delivery, profile);
      if (deliveryError) {
        setError(deliveryError);
        return;
      }
    }

    setStepIndex((i) => Math.min(i + 1, JOIN_STEPS.length - 1));
  }

  function goBack() {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function goToStep(index: number) {
    if (index < stepIndex) {
      setError(null);
      setStepIndex(index);
    }
  }

  const onSubmit = form.handleSubmit(async (formValues: ConfirmSaleValues) => {
    setError(null);
    if (images.length < 1) {
      setError('Agregá al menos una foto del producto');
      setStepIndex(0);
      return;
    }
    const deliveryError = validateDelivery(delivery, profile);
    if (deliveryError) {
      setError(deliveryError);
      setStepIndex(2);
      return;
    }

    try {
      const result = await confirm.mutateAsync({
        token,
        payload: {
          title: formValues.title,
          description: formValues.description,
          condition: formValues.condition as ProductCondition,
          category: formValues.category as ProductCategory,
          price: formValues.price,
          currency: formValues.currency,
          feePayer: formValues.feePayer,
          images,
          conditionsSummary: formValues.conditionsSummary,
          meetingLocationMode: delivery.mode,
          meetingLocation: delivery.mode === 'CHAT' ? undefined : delivery.meetingLocation,
          returnInstructions: formValues.returnInstructions,
        },
      });
      navigate(`/operaciones/${result.data.code}`, {
        state: {
          sellerConfirmed: true,
          pendingBuyerConfirm: result.data.status === 'PENDING_BUYER_CONFIRM',
        },
      });
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'No se pudo confirmar la venta. Verificá la sesión o el enlace.'),
      );
    }
  });

  const introLead = preview.creatorName
    ? `${preview.creatorName} te invita a vender. Completá el producto y tus instrucciones.`
    : 'Completá el producto y tus instrucciones para el Agente.';

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        if (isLast) void onSubmit();
        else void goNext();
      }}
      className="ca-tx ca-tx-buyer-wizard ca-tx--invite-sell"
      noValidate
    >
      <WizardChrome
        heading="Te invitaron a vender"
        lead={introLead}
        status={STATUS_LABELS[preview.status]}
        stepIndex={stepIndex}
        step={stepWithLead}
        onGoToStep={goToStep}
        error={error}
        onBack={goBack}
        isFirst={isFirst}
        isLast={isLast}
        isPending={confirm.isPending}
        submitLabel="Confirmar venta"
        pendingLabel="Confirmando…"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            className="ca-tx-buyer-wizard__panel"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
          >
            {step.id === 'product' ? (
              <div className="ca-tx-buyer-wizard__stack">
                <div className="ca-tx-start-grid">
                  <Form.Group className="ca-tx-start-grid__full" controlId="sale-title">
                    <Form.Label>Título del producto</Form.Label>
                    <Form.Control
                      {...form.register('title')}
                      placeholder="Ej. Notebook Lenovo ThinkPad"
                      isInvalid={Boolean(form.formState.errors.title)}
                    />
                    <Form.Control.Feedback type="invalid">
                      {form.formState.errors.title?.message}
                    </Form.Control.Feedback>
                  </Form.Group>

                  <Form.Group className="ca-tx-start-grid__full" controlId="sale-description">
                    <Form.Label>Descripción</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      {...form.register('description')}
                      placeholder="Estado, accesorios, detalles relevantes…"
                      isInvalid={Boolean(form.formState.errors.description)}
                    />
                    <Form.Control.Feedback type="invalid">
                      {form.formState.errors.description?.message}
                    </Form.Control.Feedback>
                  </Form.Group>

                  <Form.Group controlId="sale-condition">
                    <Form.Label>Condición</Form.Label>
                    <Form.Select {...form.register('condition')}>
                      {(Object.keys(CONDITION_LABELS) as ProductCondition[]).map((key) => (
                        <option key={key} value={key}>
                          {CONDITION_LABELS[key]}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>

                  <Form.Group controlId="sale-category">
                    <Form.Label>Categoría</Form.Label>
                    <Form.Select {...form.register('category')}>
                      {(Object.keys(CATEGORY_LABELS) as ProductCategory[]).map((key) => (
                        <option key={key} value={key}>
                          {CATEGORY_LABELS[key]}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </div>

                <div className="ca-tx-photos ca-tx-photos--start">
                  <p className="ca-tx-buyer-wizard__photos-label">Fotos</p>
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
                    onChange={(event) => {
                      const input = event.currentTarget as unknown as HTMLInputElement;
                      onFileSelected(input.files);
                    }}
                  />
                  {images.length ? (
                    <ul className="ca-tx-photos__grid">
                      {images.map((img) => (
                        <li key={img.url}>
                          <img src={img.url} alt={img.alt || 'Foto'} />
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
                  ) : null}
                </div>
              </div>
            ) : null}

            {step.id === 'price' ? (
              <div className="ca-tx-buyer-wizard__stack">
                <div className="ca-tx-start-grid ca-tx-start-grid--price">
                  <Form.Group controlId="sale-price">
                    <Form.Label>Precio</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.01"
                      min="1"
                      inputMode="decimal"
                      {...form.register('price')}
                      isInvalid={Boolean(form.formState.errors.price)}
                    />
                    <Form.Control.Feedback type="invalid">
                      {form.formState.errors.price?.message}
                    </Form.Control.Feedback>
                  </Form.Group>

                  <Form.Group controlId="sale-currency">
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
              </div>
            ) : null}

            {step.id === 'meeting' ? (
              <div className="ca-tx-delivery-wrap">
                <DeliveryLocationPicker
                  value={delivery}
                  onChange={setDelivery}
                  profile={profile}
                  disabled={confirm.isPending}
                  hideHeader
                />
              </div>
            ) : null}

            {step.id === 'agent' ? (
              <div className="ca-tx-start-grid">
                <Form.Group className="ca-tx-start-grid__full" controlId="sale-conditions">
                  <Form.Label>Instrucciones para el Agente</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    {...form.register('conditionsSummary')}
                    placeholder="Horarios, lugares de entrega, qué verificar…"
                    isInvalid={Boolean(form.formState.errors.conditionsSummary)}
                  />
                  <Form.Control.Feedback type="invalid">
                    {form.formState.errors.conditionsSummary?.message}
                  </Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="ca-tx-start-grid__full" controlId="sale-return">
                  <Form.Label>Instrucciones de devolución</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    {...form.register('returnInstructions')}
                    placeholder="Ej. Devolver en el mismo punto, embalar con el packaging original…"
                    isInvalid={Boolean(form.formState.errors.returnInstructions)}
                  />
                  <Form.Text muted>
                    Solo lo ve el Agente si el comprador rechaza el producto.
                  </Form.Text>
                  <Form.Control.Feedback type="invalid">
                    {form.formState.errors.returnInstructions?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </div>
            ) : null}

            {step.id === 'review' ? (
              <div className="ca-tx-buyer-review">
                <section className="ca-tx-buyer-review__block">
                  <h3 className="ca-tx-buyer-review__label">Producto</h3>
                  <dl className="ca-tx-buyer-review__dl">
                    <div className="ca-tx-buyer-review__wide">
                      <dt>Título</dt>
                      <dd>{values.title || '—'}</dd>
                    </div>
                    <div className="ca-tx-buyer-review__wide">
                      <dt>Descripción</dt>
                      <dd>{values.description || '—'}</dd>
                    </div>
                    <div>
                      <dt>Condición</dt>
                      <dd>
                        {CONDITION_LABELS[(values.condition || 'GOOD') as ProductCondition]}
                      </dd>
                    </div>
                    <div>
                      <dt>Categoría</dt>
                      <dd>
                        {CATEGORY_LABELS[(values.category || 'OTHER') as ProductCategory]}
                      </dd>
                    </div>
                    <div className="ca-tx-buyer-review__wide">
                      <dt>Fotos</dt>
                      <dd>
                        {images.length > 0 ? (
                          <ul className="ca-tx-buyer-review__photos">
                            {images.map((img) => (
                              <li key={img.url}>
                                <img src={img.url} alt={img.alt || 'Foto'} />
                              </li>
                            ))}
                          </ul>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section className="ca-tx-buyer-review__block">
                  <h3 className="ca-tx-buyer-review__label">Precio</h3>
                  <dl className="ca-tx-buyer-review__dl">
                    <div>
                      <dt>Monto</dt>
                      <dd>
                        {Number(values.price) > 0
                          ? formatOperationMoney(
                              majorToCents(Number(values.price)),
                              values.currency,
                            )
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Comisión</dt>
                      <dd>
                        {FEE_PAYER_LABELS[values.feePayer as FeePayer] ?? values.feePayer}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section className="ca-tx-buyer-review__block">
                  <h3 className="ca-tx-buyer-review__label">Encuentro</h3>
                  <dl className="ca-tx-buyer-review__dl">
                    <div className="ca-tx-buyer-review__wide">
                      <dt>Modo</dt>
                      <dd>{DELIVERY_MODE_LABELS[delivery.mode]}</dd>
                    </div>
                    {delivery.mode !== 'CHAT' && delivery.meetingLocation?.label ? (
                      <div className="ca-tx-buyer-review__wide">
                        <dt>Lugar</dt>
                        <dd>{delivery.meetingLocation.label}</dd>
                      </div>
                    ) : null}
                  </dl>
                </section>

                <section className="ca-tx-buyer-review__block">
                  <h3 className="ca-tx-buyer-review__label">Agente</h3>
                  <dl className="ca-tx-buyer-review__dl">
                    <div className="ca-tx-buyer-review__wide">
                      <dt>Instrucciones</dt>
                      <dd>{values.conditionsSummary || '—'}</dd>
                    </div>
                    <div className="ca-tx-buyer-review__wide">
                      <dt>Devolución</dt>
                      <dd>{values.returnInstructions || '—'}</dd>
                    </div>
                  </dl>
                </section>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </WizardChrome>
    </Form>
  );
}

export function JoinTransactionPage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError, error: previewError } = useInvitePreview(token);
  usePreferencesSnapshot();

  const preview = data?.data;

  if (isLoading) {
    return (
      <div className="ca-tx ca-tx--loading">
        <Spinner animation="border" />
        <span>Validando enlace…</span>
      </div>
    );
  }

  if (isError || !preview || !token) {
    return (
      <Alert variant="danger">
        {getApiErrorMessage(previewError, 'Enlace inválido o no disponible.')}{' '}
        <Link to="/operaciones">Ir a operaciones</Link>
      </Alert>
    );
  }

  const isSellerInitiated = preview.initiatedBy === 'SELLER';

  if (isSellerInitiated) {
    const canAccept =
      !preview.isExpired && !preview.hasCounterparty && preview.status !== 'ACCEPTED';

    if (preview.isExpired) {
      return (
        <Alert variant="warning">
          Este enlace expiró. Pedile al vendedor que regenere la invitación.
        </Alert>
      );
    }

    if (!canAccept) {
      return (
        <Alert variant="info">
          Esta compra ya fue aceptada.{' '}
          <Link to={`/operaciones/${preview.code}`}>Ver detalle</Link>
        </Alert>
      );
    }

    return <JoinAsBuyerWizard token={token} preview={preview} />;
  }

  if (preview.isExpired) {
    return (
      <Alert variant="warning">
        Este enlace expiró. Pedile al comprador que regenere la invitación.
      </Alert>
    );
  }

  if (preview.hasProduct) {
    return (
      <Alert variant="info">
        Ya hay un producto confirmado en esta operación.{' '}
        <Link to={`/operaciones/${preview.code}`}>Ver detalle</Link>
      </Alert>
    );
  }

  return <JoinAsSellerWizard token={token} preview={preview} />;
}
