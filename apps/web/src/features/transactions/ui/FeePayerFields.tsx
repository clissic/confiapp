import { Form } from 'react-bootstrap';
import {
  computeIntermediationFees,
  DEFAULT_UYU_PER_USD,
  FEE_PAYER_LABELS,
  IntermediationFeeError,
  type FeePayer,
} from '@confiapp/shared';

import { formatOperationMoney } from '@/shared/lib/money';

export const FEE_PAYER_OPTIONS: Array<{ value: FeePayer; label: string }> = [
  { value: 'BUYER', label: FEE_PAYER_LABELS.BUYER },
  { value: 'SELLER', label: FEE_PAYER_LABELS.SELLER },
  { value: 'SPLIT_50_50', label: FEE_PAYER_LABELS.SPLIT_50_50 },
];

type FeePayerFieldsProps = {
  feePayer: FeePayer | string;
  onFeePayerChange: (value: FeePayer) => void;
  /** Precio en unidades mayores (no centavos). */
  priceMajor?: number | null;
  currency?: string;
  error?: string;
  disabled?: boolean;
  /** Comprador vs vendedor: copy del preview. */
  viewerHint?: 'buyer' | 'seller' | 'neutral';
  controlId?: string;
};

export function FeePayerFields({
  feePayer,
  onFeePayerChange,
  priceMajor,
  currency = 'UYU',
  error,
  disabled,
  viewerHint = 'neutral',
  controlId = 'fee-payer',
}: FeePayerFieldsProps) {
  const productCents =
    typeof priceMajor === 'number' && Number.isFinite(priceMajor) && priceMajor > 0
      ? Math.round(priceMajor * 100)
      : 0;

  let preview: ReturnType<typeof computeIntermediationFees> | null = null;
  let previewError: string | null = null;
  if (productCents >= 100) {
    try {
      preview = computeIntermediationFees({
        productCents,
        currency,
        feePayer: feePayer as FeePayer,
        uyuPerUsd: DEFAULT_UYU_PER_USD,
      });
    } catch (err) {
      previewError =
        err instanceof IntermediationFeeError
          ? err.message
          : 'No se pudo calcular la comisión';
    }
  }

  return (
    <div className="ca-tx-fee-payer">
      <Form.Group controlId={controlId}>
        <Form.Label>¿Quién paga la comisión de intermediación?</Form.Label>
        <Form.Select
          value={feePayer}
          disabled={disabled}
          isInvalid={Boolean(error)}
          onChange={(e) => onFeePayerChange(e.target.value as FeePayer)}
        >
          {FEE_PAYER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Form.Select>
        {error ? (
          <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
        ) : (
          <Form.Text className="text-muted">
            La comisión es un monto fijo según el precio (no un % del producto). ConfiApp se
            queda con el 20% de esa comisión y el agente con el 80%.
          </Form.Text>
        )}
      </Form.Group>

      {preview ? (
        <div className="ca-tx-fee-preview mt-3">
          <div className="ca-tx-fee-preview__row">
            <span>Comisión de intermediación</span>
            <strong>
              {formatOperationMoney(preview.commissionCents, currency)}
              <span className="ca-tx-fee-preview__hint">
                {' '}
                (USD ${preview.commissionUsd})
              </span>
            </strong>
          </div>
          <div className="ca-tx-fee-preview__row">
            <span>
              {viewerHint === 'seller' ? 'Vas a recibir' : 'El vendedor recibe'}
            </span>
            <strong>{formatOperationMoney(preview.sellerNetCents, currency)}</strong>
          </div>
          <div className="ca-tx-fee-preview__row">
            <span>
              {viewerHint === 'buyer' ? 'Vas a pagar' : 'El comprador paga'}
            </span>
            <strong>{formatOperationMoney(preview.buyerPaysCents, currency)}</strong>
          </div>
          <div className="ca-tx-fee-preview__split">
            <span>
              ConfiApp 20%: {formatOperationMoney(preview.platformFeeCents, currency)}
            </span>
            <span>
              Agente 80%: {formatOperationMoney(preview.agentFeeCents, currency)}
            </span>
          </div>
        </div>
      ) : null}
      {previewError ? (
        <p className="text-danger small mt-2 mb-0">{previewError}</p>
      ) : null}
    </div>
  );
}
