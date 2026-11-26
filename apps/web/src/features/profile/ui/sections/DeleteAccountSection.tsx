import { ACCOUNT_DELETION_CONFIRMATION, ACCOUNT_DELETION_GRACE_DAYS } from '@confiapp/shared';
import { useState } from 'react';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/features/auth/ui/AuthProvider';
import { getApiErrorMessage } from '@/shared/api/client';
import { useAppToast } from '@/shared/ui';

import { deleteMyAccount } from '../../api/profile.api';

export function DeleteAccountSection() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const toast = useAppToast();
  const [showModal, setShowModal] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = confirmation === ACCOUNT_DELETION_CONFIRMATION && !submitting;

  const closeModal = () => {
    if (submitting) return;
    setShowModal(false);
    setConfirmation('');
    setError(null);
  };

  const handleDelete = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    setError(null);
    try {
      await deleteMyAccount(ACCOUNT_DELETION_CONFIRMATION);
      toast.showToast(
        `Cuenta suspendida. Tenés ${ACCOUNT_DELETION_GRACE_DAYS} días para recuperarla iniciando sesión.`,
        { variant: 'warning' },
      );
      await logout();
      navigate('/ingresar', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo eliminar la cuenta.'));
      setSubmitting(false);
    }
  };

  return (
    <section className="ca-profile-danger" aria-labelledby="perfil-zona-peligro">
      <div className="ca-profile-danger__card">
        <h3 id="perfil-zona-peligro" className="ca-profile-danger__heading">
          Zona de peligro
        </h3>
        <p className="ca-profile-danger__text mb-3">
          Eliminar tu cuenta la suspende por {ACCOUNT_DELETION_GRACE_DAYS} días. Si iniciás sesión
          dentro de ese plazo, se recupera automáticamente. Pasado ese tiempo, la eliminación es
          definitiva. No podés eliminarla si tenés operaciones en curso, trabajos de agente
          aceptados, saldo en wallet o retiros/comisiones pendientes.
        </p>
        <Button
          type="button"
          variant="outline-danger"
          className="ca-profile-danger__btn"
          onClick={() => setShowModal(true)}
        >
          Eliminar cuenta
        </Button>
      </div>

      <Modal show={showModal} onHide={closeModal} centered backdrop={submitting ? 'static' : true}>
        <Modal.Header closeButton={!submitting}>
          <Modal.Title>Eliminar cuenta</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning" className="mb-3">
            Al confirmar, tu cuenta quedará{' '}
            <strong>suspendida por {ACCOUNT_DELETION_GRACE_DAYS} días</strong>. Si iniciás sesión
            nuevamente dentro de ese período, se recuperará automáticamente. Pasados los{' '}
            {ACCOUNT_DELETION_GRACE_DAYS} días, la eliminación será definitiva.
          </Alert>
          <p className="ca-tx-secondary small mb-3">
            La eliminación se rechaza si tenés operaciones en curso como comprador/vendedor, trabajos
            de agente aceptados, saldo en wallet (disponible, pendiente o retenido), retiros en
            proceso o comisiones de agente sin liquidar. Estas reglas se validan en el servidor y no
            se pueden omitir desde la app.
          </p>
          <p className="ca-tx-secondary small mb-3">
            El borrado de la cuenta no implica que todos tus datos personales desaparezcan de la base
            de datos: pueden conservarse los necesarios para resolver disputas o investigaciones
            requeridas por el ministerio público, y demás obligaciones legales.
          </p>
          <Form.Group controlId="delete-account-confirm">
            <Form.Label>
              Escribí <strong>{ACCOUNT_DELETION_CONFIRMATION}</strong> para continuar
            </Form.Label>
            <Form.Control
              type="text"
              autoComplete="off"
              value={confirmation}
              disabled={submitting}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={ACCOUNT_DELETION_CONFIRMATION}
            />
          </Form.Group>
          {error ? (
            <Alert variant="danger" className="mt-3 mb-0">
              {error}
            </Alert>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="outline-secondary" onClick={closeModal} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={!canConfirm}
            onClick={() => void handleDelete()}
          >
            {submitting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Eliminando…
              </>
            ) : (
              'Confirmar eliminación'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
}
