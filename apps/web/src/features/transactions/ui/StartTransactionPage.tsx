import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { Handshake } from 'lucide-react';

import { useZodForm } from '@/shared/lib/form';

import { useCreateTransaction } from '../hooks/useTransactions';
import {
  createTransactionSchema,
  type CreateTransactionValues,
} from '../model/schemas';
import '../styles/transactions.css';

export function StartTransactionPage() {
  const navigate = useNavigate();
  const create = useCreateTransaction();
  const [error, setError] = useState<string | null>(null);

  const form = useZodForm(createTransactionSchema, {
    defaultValues: {
      title: '',
      description: '',
      conditionsSummary: '',
      checklistText: '',
      amount: undefined as unknown as number,
      currency: 'UYU',
      inviteExpiresInDays: 7,
    },
  });

  const onSubmit = form.handleSubmit(async (values: CreateTransactionValues) => {
    setError(null);
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
    <div className="ca-tx">
      <header className="ca-tx__header">
        <div className="ca-tx__brand">
          <Handshake size={22} strokeWidth={1.75} />
          <div>
            <p className="ca-tx__kicker">Nueva operación</p>
            <h2 className="ca-tx__title">Iniciar como comprador</h2>
            <p className="ca-tx__lead">
              Definí el acuerdo, el monto y generaremos un enlace para que el vendedor
              complete el producto.
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
        <h3 className="ca-section-title">Datos de la operación</h3>
        <p className="ca-section-lead">
          Estos datos se persisten con estado <code>WAITING_PARTICIPANT</code> hasta que
          alguien se una con el enlace.
        </p>

        {error ? <Alert variant="danger">{error}</Alert> : null}

        <Form onSubmit={onSubmit} className="ca-form-grid" noValidate>
          <Form.Group className="ca-form-grid__full" controlId="tx-title">
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

          <Form.Group className="ca-form-grid__full" controlId="tx-description">
            <Form.Label>Descripción (opcional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              {...form.register('description')}
              placeholder="Contexto breve del acuerdo"
            />
          </Form.Group>

          <Form.Group className="ca-form-grid__full" controlId="tx-conditions">
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

          <Form.Group className="ca-form-grid__full" controlId="tx-checklist">
            <Form.Label>Checklist (una línea por ítem)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              {...form.register('checklistText')}
              placeholder={'Verificar serie\nProbar encendido\nEntregar caja'}
            />
          </Form.Group>

          <Form.Group controlId="tx-amount">
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

          <Form.Group controlId="tx-currency">
            <Form.Label>Moneda</Form.Label>
            <Form.Select {...form.register('currency')}>
              <option value="UYU">UYU · Peso uruguayo</option>
              <option value="USD">USD · Dólar</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </Form.Select>
          </Form.Group>

          <Form.Group controlId="tx-expires">
            <Form.Label>Validez del enlace (días)</Form.Label>
            <Form.Control
              type="number"
              min={1}
              max={30}
              {...form.register('inviteExpiresInDays')}
            />
          </Form.Group>

          <div className="ca-form-grid__full ca-form-actions">
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
        </Form>
      </motion.div>
    </div>
  );
}
