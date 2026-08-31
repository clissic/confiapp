import { formatDateTime } from '@/shared/lib/money';

type DeliveryConfirmationHintProps = {
  showDeadline?: boolean;
  autoReleaseAt?: string;
  /** Versión compacta sin caja destacada. */
  subtle?: boolean;
};

/** Aviso de plazos de confirmación (inline). */
export function DeliveryConfirmationHint({
  showDeadline,
  autoReleaseAt,
  subtle = false,
}: DeliveryConfirmationHintProps) {
  return (
    <p
      className={`ca-tx-delivery-hint mb-0${subtle ? ' ca-tx-delivery-hint--subtle' : ''}`}
      role="note"
    >
      <span className="ca-tx-delivery-hint__emphasis">¡No generes demoras innecesarias!</span>
      {showDeadline && autoReleaseAt ? (
        <>
          {' '}
          Si falta la otra confirmación, la operación puede completarse automáticamente el{' '}
          <time dateTime={autoReleaseAt}>{formatDateTime(autoReleaseAt)}</time>.
        </>
      ) : (
        <> Confirmá en cuanto corresponda para avanzar con la liberación de fondos.</>
      )}
    </p>
  );
}
