import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';

import { useZodForm } from '@/shared/lib/form';
import { defaultPaymentCurrency } from '@/shared/lib/money';
import { useUserPreferences } from '@/shared/preferences';

import { useCreateTransaction } from '../hooks/useTransactions';
import {
  createTransactionSchema,
  type CreateTransactionValues,
} from '../model/schemas';
import {
  ChecklistEditor,
  checklistDraftToPayload,
  createEmptyChecklistItem,
  type ChecklistDraftItem,
} from './ChecklistEditor';
import '../styles/transactions.css';

export function StartTransactionPage() {
  const navigate = useNavigate();
  const create = useCreateTransaction();
  const { currency: preferredCurrency } = useUserPreferences();
  const [error, setError] = useState<string | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistDraftItem[]>([
    createEmptyChecklistItem(),
  ]);

  const form = useZodForm(createTransactionSchema, {
    defaultValues: {
      title: '',
      description: '',
      conditionsSummary: '',
      amount: undefined as unknown as number,
      currency: defaultPaymentCurrency(preferredCurrency),
      inviteExpiresInDays: 7,
    },
  });

  const onSubmit = form.handleSubmit(async (values: CreateTransactionValues) => {
    setError(null);
    const checklist = checklistDraftToPayload(checklistItems);

    try {
      const result = await create.mutateAsync({
        title: values.title,
        description: values.description || undefined,
        conditionsSummary: values.conditionsSummary,
        checklist,
        amount: values.amount,
        currency: values.currency,
        inviteExpiresInDays: values.inviteExpiresInDays,
      });
      navigate(`/operaciones/${result.data.code}`, {
        state: { shareUrl: result.data.invite.shareUrl, justCreated: true },
      });
    } catch {
      setError('No se pudo crear la operación. Revisá los datos e intentá de nuevo.');
    }
  });

  return (
    <div className="ca-tx ca-tx--buyer">
      <header className="ca-tx-flow-hero">
        <div className="ca-tx-flow-hero__visual">
          <img
            src="/landing/Shopping.png"
            alt=""
            width={480}
            height={480}
            decoding="async"
          />
        </div>
        <div className="ca-tx-flow-hero__copy">
          <p className="ca-tx__kicker">Nueva operación</p>
          <h2 className="ca-tx__title">Iniciar como comprador</h2>
          <p className="ca-tx__lead">
            Definí el acuerdo, el monto y generaremos un enlace para que el vendedor
            complete el producto.
          </p>
          <Link to="/operaciones/nueva" className="btn btn-outline-secondary ca-tx-flow-hero__action">
            Cambiar rol
          </Link>
        </div>
      </header>

      <motion.div
        className="ca-tx-panel"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <header className="ca-tx-panel__head">
          <h3 className="ca-section-title">Datos de la operación</h3>
          <p className="ca-section-lead ca-section-lead--soft-emphasis">
            Completá el acuerdo y el monto. Al crear la operación te damos un enlace para
            compartirlo con el vendedor.
          </p>
        </header>

        {error ? <Alert variant="danger">{error}</Alert> : null}

        <Form onSubmit={onSubmit} className="ca-tx-edit" noValidate>
          <div className="row g-3">
            <Form.Group className="col-12" controlId="tx-title">
              <Form.Label>Título</Form.Label>
              <Form.Control
                {...form.register('title')}
                placeholder="Ej. Compra de notebook usada"
                isInvalid={Boolean(form.formState.errors.title)}
              />
              <Form.Control.Feedback type="invalid">
                {form.formState.errors.title?.message}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="col-12" controlId="tx-description">
              <Form.Label>Descripción (opcional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                {...form.register('description')}
                placeholder="Contexto breve del acuerdo"
              />
            </Form.Group>

            <Form.Group className="col-12" controlId="tx-conditions">
              <Form.Label>Condiciones acordadas</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                {...form.register('conditionsSummary')}
                placeholder="Entrega en persona, inspección previa, pago retenido hasta confirmación…"
                isInvalid={Boolean(form.formState.errors.conditionsSummary)}
              />
              <Form.Control.Feedback type="invalid">
                {form.formState.errors.conditionsSummary?.message}
              </Form.Control.Feedback>
            </Form.Group>

            <div className="col-12">
              <ChecklistEditor items={checklistItems} onChange={setChecklistItems} />
            </div>

            <Form.Group className="col-6 col-md-4" controlId="tx-amount">
              <Form.Label>Monto</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                min="1"
                {...form.register('amount')}
                isInvalid={Boolean(form.formState.errors.amount)}
              />
              <Form.Control.Feedback type="invalid">
                {form.formState.errors.amount?.message}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="col-6 col-md-4" controlId="tx-currency">
              <Form.Label>Moneda</Form.Label>
              <Form.Select {...form.register('currency')}>
                <option value="UYU">UYU $</option>
                <option value="USD">USD $</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="col-12 col-md-4" controlId="tx-expires">
              <Form.Label>Validez del enlace (días)</Form.Label>
              <Form.Control
                type="number"
                min={1}
                max={30}
                {...form.register('inviteExpiresInDays')}
              />
            </Form.Group>

            <div className="col-12 ca-form-actions">
              <Button type="submit" className="ca-btn-cta" disabled={create.isPending}>
                {create.isPending ? (
                  <>
                    <Spinner size="sm" animation="border" className="me-2" />
                    Generando…
                  </>
                ) : (
                  'Generar enlace y crear'
                )}
              </Button>
            </div>
          </div>
        </Form>
      </motion.div>
    </div>
  );
}
