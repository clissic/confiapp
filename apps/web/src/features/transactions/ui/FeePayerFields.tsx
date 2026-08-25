import { Form } from 'react-bootstrap';
import {
  amountCentsToUyu,
  commissionForProductUyu,
  commissionUyuToCents,
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

function commissionCentsForPrice(
  productCents: number,
  currency: string,
): number {
  if (productCents < 100) return 0;
  const productUyu = amountCentsToUyu(productCents, currency, DEFAULT_UYU_PER_USD);
  const commissionUyu = commissionForProductUyu(productUyu);
  return commissionUyuToCents(commissionUyu, currency, DEFAULT_UYU_PER_USD);
}

function coverageHint(
  feePayer: string,
  commissionCents: number,
  currency: string,
): string {
  const commissionLabel = formatOperationMoney(commissionCents, currency);
  if (feePayer === 'SELLER') {
    return `Para este precio la comisión es ${commissionLabel}. Si el vendedor la asume, el precio del producto debe ser al menos ese monto (o elegí que la pague el comprador).`;
  }
  if (feePayer === 'SPLIT_50_50') {
    const half = Math.ceil(commissionCents / 2);
    return `Para este precio la comisión es ${commissionLabel}. En el reparto 50/50, el precio del producto debe cubrir al menos ${formatOperationMoney(half, currency)} (parte del vendedor), o cambiá quién paga.`;
  }
  return `Para este precio la comisión es ${commissionLabel}.`;
}

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

  const commissionCents = commissionCentsForPrice(productCents, currency);

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
          ? coverageHint(feePayer, commissionCents, currency)
          : 'No se pudo calcular la comisión';
    }
  }

  const commissionLabel =
    commissionCents > 0 ? formatOperationMoney(commissionCents, currency) : null;

  let helperText: string | null = null;
  if (!error) {
    if (!commissionLabel) {
      helperText = 'Ingresá el precio del producto para ver cuánto suma la comisión.';
    } else if (feePayer === 'BUYER') {
      helperText =
        viewerHint === 'buyer'
          ? `Según el precio, la comisión a adicionar es ${commissionLabel}.`
          : `Según el precio, el comprador adiciona ${commissionLabel} de comisión.`;
    } else if (feePayer === 'SELLER') {
      helperText =
        viewerHint === 'seller'
          ? `Según el precio, se descuenta ${commissionLabel} de comisión de lo que recibís.`
          : `Según el precio, se descuenta ${commissionLabel} de comisión al vendedor.`;
    } else {
      helperText = `Según el precio, la comisión total es ${commissionLabel} y se reparte en partes iguales.`;
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
        ) : helperText ? (
          <Form.Text className="text-muted">{helperText}</Form.Text>
        ) : null}
      </Form.Group>

      {preview ? (
        <div className="ca-tx-fee-preview mt-3">
          {feePayer === 'BUYER' ? (
            <div className="ca-tx-fee-preview__row">
              <span>Comisión a adicionar al precio</span>
              <strong>{formatOperationMoney(preview.commissionCents, currency)}</strong>
            </div>
          ) : feePayer === 'SPLIT_50_50' ? (
            <>
              <div className="ca-tx-fee-preview__row">
                <span>Comisión total</span>
                <strong>{formatOperationMoney(preview.commissionCents, currency)}</strong>
              </div>
              <div className="ca-tx-fee-preview__row">
                <span>Parte a adicionar (comprador)</span>
                <strong>
                  {formatOperationMoney(
                    preview.buyerPaysCents - preview.productCents,
                    currency,
                  )}
                </strong>
              </div>
            </>
          ) : (
            <div className="ca-tx-fee-preview__row">
              <span>Comisión (se descuenta al vendedor)</span>
              <strong>{formatOperationMoney(preview.commissionCents, currency)}</strong>
            </div>
          )}
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
        </div>
      ) : null}

      {previewError ? (
        <p className="text-danger small mt-2 mb-0">{previewError}</p>
      ) : null}
    </div>
  );
}
