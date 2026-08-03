import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Handshake,
  ImagePlus,
  Package,
  ShoppingBag,
  Trash2,
  UserPlus,
} from 'lucide-react';

import { useZodForm } from '@/shared/lib/form';

import { formatMoney } from '../api/transactions.api';
import {
  useAcceptPurchase,
  useConfirmSale,
  useInvitePreview,
} from '../hooks/useTransactions';
import {
  confirmSaleSchema,
  type ConfirmSaleValues,
} from '../model/schemas';
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  STATUS_LABELS,
  type ProductCategory,
  type ProductCondition,
} from '../model/types';
import '../styles/transactions.css';

const SELLER_STEPS = [
  { id: 1, label: 'Invitación' },
  { id: 2, label: 'Producto' },
  { id: 3, label: 'Confirmar' },
] as const;

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function JoinTransactionPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useInvitePreview(token);
  const confirm = useConfirmSale();
  const acceptPurchase = useAcceptPurchase();

  const [step, setStep] = useState(1);
  const [images, setImages] = useState<Array<{ url: string; alt?: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const form = useZodForm(confirmSaleSchema, {
    defaultValues: {
      title: '',
      description: '',
      condition: 'GOOD',
      category: 'OTHER',
      price: undefined as unknown as number,
      currency: 'UYU',
      imageUrl: '',
    },
  });

  const preview = data?.data;
  const values = form.watch();
  const isSellerInitiated = preview?.initiatedBy === 'SELLER';

  const summaryPrice = useMemo(() => {
    const price = Number(values.price);
    if (!Number.isFinite(price)) return '—';
    return formatMoney(Math.round(price * 100), values.currency || 'UYU');
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
        Enlace inválido o no disponible.{' '}
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
    if (file.size > 1_500_000) {
      setError('La imagen local debe pesar menos de 1.5 MB (o usá una URL)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result.startsWith('data:image/')) {
        setError('No se pudo leer la imagen');
        return;
      }
      if (result.length > 2048 && localStorage.getItem('accessToken')) {
        setError(
          'Con sesión API usá una URL pública (las fotos locales grandes solo funcionan en demo).',
        );
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
    form.setValue('title', preview.title);
    form.setValue(
      'price',
      preview.amountCents != null ? preview.amountCents / 100 : (undefined as unknown as number),
    );
    form.setValue(
      'currency',
      preview.currency === 'USD' || preview.currency === 'UYU'
        ? preview.currency
        : 'UYU',
    );    setStep(2);
  };

  const goToConfirm = form.handleSubmit(() => {
    setError(null);
    if (images.length < 1) {
      setError('Agregá al menos una foto del producto');
      return;
    }
    setStep(3);
  });

  const onConfirmSale = async () => {
    if (!token) return;
    setError(null);
    const parsed = confirmSaleSchema.safeParse(form.getValues());
    if (!parsed.success) {
      setError('Revisá los datos del producto');
      setStep(2);
      return;
    }
    if (images.length < 1) {
      setError('Agregá al menos una foto');
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
          images,
        },
      });
      navigate(`/operaciones/${result.data.code}`, {
        state: { sellerConfirmed: true },
      });
    } catch {
      setError('No se pudo confirmar la venta. Verificá la sesión o el enlace.');
    }
  };

  const onAcceptAsBuyer = async () => {
    if (!token) return;
    setError(null);
    try {
      const result = await acceptPurchase.mutateAsync(token);
      navigate(`/operaciones/${result.data.code}`, {
        state: { buyerAccepted: true },
      });
    } catch {
      setError('No se pudo aceptar la compra. Verificá la sesión o el enlace.');
    }
  };

  if (isSellerInitiated) {
    return (
      <div className="ca-tx">
        <header className="ca-tx__header">
          <div className="ca-tx__brand">
            <ShoppingBag size={22} strokeWidth={1.75} />
            <div>
              <p className="ca-tx__kicker">Comprador · invitación</p>
              <h2 className="ca-tx__title">Te invitaron a comprar</h2>
              <p className="ca-tx__lead">
                {preview.creatorName
                  ? `${preview.creatorName} publicó un producto y te invita a la operación.`
                  : 'Un vendedor te invita a comprar con escrow ConfiApp.'}
              </p>
            </div>
          </div>
          <div className="ca-tx__meta">
            <Badge bg="primary">{STATUS_LABELS[preview.status]}</Badge>
            <Badge bg="light" text="dark">
              {data?.source === 'demo' ? 'Modo demo' : 'API'}
            </Badge>
          </div>
        </header>

        {error ? <Alert variant="danger">{error}</Alert> : null}

        <motion.section
          className="ca-tx-panel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="ca-section-title">{preview.title}</h3>
          <p className="ca-section-lead">
            Código <code>{preview.code}</code> ·{' '}
            {formatMoney(preview.amountCents, preview.currency)}
          </p>
          {preview.description ? <p>{preview.description}</p> : null}
          <p>{preview.conditionsSummary}</p>

          {preview.product ? (
            <div className="ca-tx-invite-product">
              <h4 className="ca-section-title">Producto</h4>
              <p className="ca-section-lead">
                {CONDITION_LABELS[preview.product.condition]} ·{' '}
                {CATEGORY_LABELS[preview.product.category]}
              </p>
              <p className="fw-semibold mb-1">{preview.product.title}</p>
              {preview.product.description ? <p>{preview.product.description}</p> : null}
              {preview.product.images.length ? (
                <ul className="ca-tx-photos__grid">
                  {preview.product.images.map((img) => (
                    <li key={`${img.sortOrder}-${img.url}`}>
                      <img src={img.url} alt={img.alt || preview.product!.title} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {preview.isExpired ? (
            <Alert variant="warning" className="mb-0">
              Este enlace expiró. Pedile al vendedor que regenere la invitación.
            </Alert>
          ) : preview.hasCounterparty || preview.status === 'ACCEPTED' ? (
            <Alert variant="info" className="mb-0">
              Esta compra ya fue aceptada.{' '}
              <Link to={`/operaciones/${preview.code}`}>Ver detalle</Link>
            </Alert>
          ) : (
            <div className="ca-form-actions">
              <Button
                className="ca-btn-cta"
                disabled={acceptPurchase.isPending}
                onClick={() => void onAcceptAsBuyer()}
              >
                {acceptPurchase.isPending ? (
                  <Spinner size="sm" animation="border" className="me-2" />
                ) : (
                  <UserPlus size={16} className="me-1" />
                )}
                Aceptar compra
              </Button>
              <p className="ca-section-lead mb-0">
                Al aceptar, el estado pasa automáticamente a{' '}
                <strong>Aceptada</strong> (pendiente de fondeo).
              </p>
            </div>
          )}
        </motion.section>
      </div>
    );
  }

  return (
    <div className="ca-tx">
      <header className="ca-tx__header">
        <div className="ca-tx__brand">
          <Handshake size={22} strokeWidth={1.75} />
          <div>
            <p className="ca-tx__kicker">Vendedor · invitación</p>
            <h2 className="ca-tx__title">Recibiste un enlace de operación</h2>
            <p className="ca-tx__lead">
              {preview.creatorName
                ? `${preview.creatorName} te invita a vender con escrow.`
                : 'Completá el producto y confirmá la venta.'}
            </p>
          </div>
        </div>
        <div className="ca-tx__meta">
          <Badge bg="primary">{STATUS_LABELS[preview.status]}</Badge>
          <Badge bg="light" text="dark">
            {data?.source === 'demo' ? 'Modo demo' : 'API'}
          </Badge>
        </div>
      </header>

      <ol className="ca-tx-steps">
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
            <span>{item.id}</span>
            {item.label}
          </li>
        ))}
      </ol>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {step === 1 ? (
        <motion.section
          className="ca-tx-panel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="ca-section-title">{preview.title}</h3>
          <p className="ca-section-lead">
            Código <code>{preview.code}</code> · propuesta{' '}
            {formatMoney(preview.amountCents, preview.currency)}
          </p>
          {preview.description ? <p>{preview.description}</p> : null}
          <p>{preview.conditionsSummary}</p>

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
            <div className="ca-form-actions">
              <Button className="ca-btn-cta" onClick={goToProduct}>
                <Package size={16} className="me-1" />
                Agregar producto y continuar
              </Button>
            </div>
          )}
        </motion.section>
      ) : null}

      {step === 2 ? (
        <motion.section
          className="ca-tx-panel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="ca-section-title">Datos del producto</h3>
          <p className="ca-section-lead">
            Precio, condición, descripción y fotos. Se persisten al confirmar la venta.
          </p>

          <Form onSubmit={goToConfirm} className="ca-form-grid" noValidate>
            <Form.Group className="ca-form-grid__full" controlId="sale-title">
              <Form.Label>Título del producto</Form.Label>
              <Form.Control
                {...form.register('title')}
                isInvalid={Boolean(form.formState.errors.title)}
              />
              <Form.Control.Feedback type="invalid">
                {form.formState.errors.title?.message}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="ca-form-grid__full" controlId="sale-description">
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

            <Form.Group controlId="sale-price">
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

            <Form.Group controlId="sale-currency">
              <Form.Label>Moneda</Form.Label>
              <Form.Select {...form.register('currency')}>
                <option value="UYU">UYU · Peso uruguayo</option>
                <option value="USD">USD · Dólar</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </Form.Select>
            </Form.Group>

            <div className="ca-form-grid__full ca-tx-photos">
              <h4 className="ca-section-title">Fotos</h4>
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
            </div>

            <div className="ca-form-grid__full ca-form-actions">
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
          className="ca-tx-panel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="ca-section-title">Confirmar venta</h3>
          <p className="ca-section-lead">
            Al confirmar te unís como vendedor, se persiste el producto y la operación queda
            pendiente de fondeo.
          </p>

          <dl className="ca-tx-summary">
            <div>
              <dt>Producto</dt>
              <dd>{values.title}</dd>
            </div>
            <div>
              <dt>Precio</dt>
              <dd>{summaryPrice}</dd>
            </div>
            <div>
              <dt>Condición</dt>
              <dd>
                {CONDITION_LABELS[(values.condition || 'GOOD') as ProductCondition]}
              </dd>
            </div>
            <div>
              <dt>Fotos</dt>
              <dd>{images.length}</dd>
            </div>
          </dl>

          <p>{values.description}</p>

          {images.length ? (
            <ul className="ca-tx-photos__grid">
              {images.map((img) => (
                <li key={img.url}>
                  <img src={img.url} alt={img.alt || 'Foto'} />
                </li>
              ))}
            </ul>
          ) : null}

          <div className="ca-form-actions">
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
