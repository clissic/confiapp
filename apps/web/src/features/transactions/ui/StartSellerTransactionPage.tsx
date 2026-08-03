import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { ImagePlus, Package, Trash2 } from 'lucide-react';

import { useZodForm } from '@/shared/lib/form';

import { useCreateSellerTransaction } from '../hooks/useTransactions';
import {
  createSellerTransactionSchema,
  type CreateSellerTransactionValues,
} from '../model/schemas';
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  type ProductCategory,
  type ProductCondition,
} from '../model/types';
import '../styles/transactions.css';

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function StartSellerTransactionPage() {
  const navigate = useNavigate();
  const create = useCreateSellerTransaction();
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<Array<{ url: string; alt?: string }>>([]);

  const form = useZodForm(createSellerTransactionSchema, {
    defaultValues: {
      title: '',
      description: '',
      conditionsSummary: '',
      checklistText: '',
      inviteExpiresInDays: 7,
      productTitle: '',
      productDescription: '',
      condition: 'GOOD',
      category: 'OTHER',
      price: undefined as unknown as number,
      currency: 'UYU',
      imageUrl: '',
    },
  });

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
    setImages((prev) => [...prev, { url }]);
    form.setValue('imageUrl', '');
  };

  const onFileSelected = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file || !file.type.startsWith('image/')) {
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

  const onSubmit = form.handleSubmit(async (values: CreateSellerTransactionValues) => {
    setError(null);
    if (images.length < 1) {
      setError('Agregá al menos una foto del producto');
      return;
    }

    const checklist = values.checklistText
      ? values.checklistText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
      : undefined;

    try {
      const result = await create.mutateAsync({
        title: values.title,
        description: values.description || undefined,
        conditionsSummary: values.conditionsSummary,
        checklist,
        inviteExpiresInDays: values.inviteExpiresInDays,
        product: {
          title: values.productTitle,
          description: values.productDescription,
          condition: values.condition as ProductCondition,
          category: values.category as ProductCategory,
          price: values.price,
          currency: values.currency,
          images,
        },
      });
      navigate(`/operaciones/${result.data.code}`, {
        state: {
          shareUrl: result.data.invite.shareUrl,
          justCreated: true,
          initiatedBySeller: true,
        },
      });
    } catch {
      setError('No se pudo crear la operación. Revisá los datos e intentá de nuevo.');
    }
  });

  return (
    <div className="ca-tx">
      <header className="ca-tx__header">
        <div className="ca-tx__brand">
          <Package size={22} strokeWidth={1.75} />
          <div>
            <p className="ca-tx__kicker">Nueva operación</p>
            <h2 className="ca-tx__title">Iniciar como vendedor</h2>
            <p className="ca-tx__lead">
              Cargá el producto y generamos un enlace para que el comprador acepte la
              operación.
            </p>
          </div>
        </div>
        <Link to="/operaciones/nueva" className="btn btn-outline-secondary">
          Cambiar rol
        </Link>
      </header>

      <motion.div
        className="ca-tx-panel"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {error ? <Alert variant="danger">{error}</Alert> : null}

        <Form onSubmit={onSubmit} className="ca-form-grid" noValidate>
          <h3 className="ca-section-title ca-form-grid__full">Acuerdo</h3>

          <Form.Group className="ca-form-grid__full" controlId="seller-tx-title">
            <Form.Label>Título de la operación</Form.Label>
            <Form.Control
              {...form.register('title')}
              placeholder="Ej. Venta de notebook usada"
              isInvalid={Boolean(form.formState.errors.title)}
            />
            <Form.Control.Feedback type="invalid">
              {form.formState.errors.title?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="ca-form-grid__full" controlId="seller-tx-desc">
            <Form.Label>Descripción (opcional)</Form.Label>
            <Form.Control as="textarea" rows={2} {...form.register('description')} />
          </Form.Group>

          <Form.Group className="ca-form-grid__full" controlId="seller-tx-conditions">
            <Form.Label>Condiciones del acuerdo</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              {...form.register('conditionsSummary')}
              isInvalid={Boolean(form.formState.errors.conditionsSummary)}
            />
            <Form.Control.Feedback type="invalid">
              {form.formState.errors.conditionsSummary?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="ca-form-grid__full" controlId="seller-tx-checklist">
            <Form.Label>Checklist (una línea por ítem)</Form.Label>
            <Form.Control as="textarea" rows={2} {...form.register('checklistText')} />
          </Form.Group>

          <Form.Group controlId="seller-tx-expires">
            <Form.Label>Validez del enlace (días)</Form.Label>
            <Form.Control
              type="number"
              min={1}
              max={30}
              {...form.register('inviteExpiresInDays')}
            />
          </Form.Group>

          <h3 className="ca-section-title ca-form-grid__full">Producto</h3>

          <Form.Group className="ca-form-grid__full" controlId="seller-product-title">
            <Form.Label>Título del producto</Form.Label>
            <Form.Control
              {...form.register('productTitle')}
              isInvalid={Boolean(form.formState.errors.productTitle)}
            />
            <Form.Control.Feedback type="invalid">
              {form.formState.errors.productTitle?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="ca-form-grid__full" controlId="seller-product-desc">
            <Form.Label>Descripción del producto</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              {...form.register('productDescription')}
              isInvalid={Boolean(form.formState.errors.productDescription)}
            />
            <Form.Control.Feedback type="invalid">
              {form.formState.errors.productDescription?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group controlId="seller-condition">
            <Form.Label>Condición</Form.Label>
            <Form.Select {...form.register('condition')}>
              {(Object.keys(CONDITION_LABELS) as ProductCondition[]).map((key) => (
                <option key={key} value={key}>
                  {CONDITION_LABELS[key]}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group controlId="seller-category">
            <Form.Label>Categoría</Form.Label>
            <Form.Select {...form.register('category')}>
              {(Object.keys(CATEGORY_LABELS) as ProductCategory[]).map((key) => (
                <option key={key} value={key}>
                  {CATEGORY_LABELS[key]}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group controlId="seller-price">
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

          <Form.Group controlId="seller-currency">
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

          <div className="ca-form-grid__full ca-form-actions">
            <Button type="submit" className="ca-btn-cta" disabled={create.isPending}>
              {create.isPending ? (
                <>
                  <Spinner size="sm" animation="border" className="me-2" />
                  Generando…
                </>
              ) : (
                'Generar enlace para el comprador'
              )}
            </Button>
          </div>
        </Form>
      </motion.div>
    </div>
  );
}
