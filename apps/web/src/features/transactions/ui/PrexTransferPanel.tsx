import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { Building2, Copy, QrCode, Upload } from 'lucide-react';

import { useAppToast } from '@/shared/ui';

const DEFAULT_PREX = {
  bank: 'Prex',
  accountName: 'Ignacio La Cava',
  accountNumber: '1065233',
} as const;

const PREX_QR_SRC = '/landing/QRprex.png';

export interface PrexAccountInfo {
  bank?: string;
  accountName: string;
  accountNumber: string;
}

interface PrexTransferPanelProps {
  amountLabel: string;
  operationCode: string;
  account?: PrexAccountInfo | null;
  disabled?: boolean;
  isPending?: boolean;
  onSubmit: (payload: { receiptDataUrl: string; receiptFileName: string }) => Promise<void>;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('No se pudo leer el archivo'));
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

/** MVP: transferencia a Prex + comprobante. Mercado Pago queda en standby. */
export function PrexTransferPanel({
  amountLabel,
  operationCode,
  account,
  disabled,
  isPending,
  onSubmit,
}: PrexTransferPanelProps) {
  const toast = useAppToast();
  const [fileName, setFileName] = useState<string | null>(null);
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const prex = {
    bank: account?.bank || DEFAULT_PREX.bank,
    accountName: account?.accountName || DEFAULT_PREX.accountName,
    accountNumber: account?.accountNumber || DEFAULT_PREX.accountNumber,
  };

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error(`No se pudo copiar ${label.toLowerCase()}.`);
    }
  };

  const onFileSelected = async (file: File | undefined) => {
    setLocalError(null);
    if (!file) return;

    const okType =
      /^(image\/(jpeg|jpg|png|webp)|application\/pdf)$/i.test(file.type) ||
      /\.(jpe?g|png|webp|pdf)$/i.test(file.name);
    if (!okType) {
      setLocalError('Subí una imagen (JPEG, PNG, WebP) o un PDF.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setLocalError('El archivo supera 4 MB. Comprimilo o usá otra captura.');
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setReceiptDataUrl(dataUrl);
      setFileName(file.name);
    } catch {
      setLocalError('No se pudo leer el archivo.');
    }
  };

  const handleSubmit = async () => {
    setLocalError(null);
    if (!receiptDataUrl || !fileName) {
      setLocalError('Subí el comprobante de la transferencia antes de continuar.');
      return;
    }
    await onSubmit({ receiptDataUrl, receiptFileName: fileName });
  };

  return (
    <section className="ca-tx-panel ca-tx-pay-prex">
      <div className="ca-tx-pay-prex__intro">
        <h2 className="ca-tx-pay-cta__title">Transferí el pago</h2>
        <p className="ca-tx-pay-cta__lead mb-0">
          Por ahora el cobro es por transferencia a Prex (MVP). Transferí{' '}
          <strong>{amountLabel}</strong> a la cuenta de abajo y subí el comprobante. Nuestro equipo
          verificará la transferencia antes de habilitar el trabajo para agentes.
        </p>
      </div>

      <div className="ca-tx-pay-prex__grid">
        <div className="ca-tx-pay-prex__qr" aria-label="Código QR de la transferencia">
          <img
            src={PREX_QR_SRC}
            alt="QR de la cuenta Prex"
            width={220}
            height={220}
          />
          <p className="ca-tx-pay-prex__qr-hint">
            <QrCode size={14} aria-hidden />
            Escaneá o usá los datos de la cuenta
          </p>
        </div>

        <div className="ca-tx-pay-prex__account">
          <p className="ca-tx-pay-prex__bank">
            <Building2 size={16} aria-hidden />
            {prex.bank}
          </p>
          <dl className="ca-tx-pay-prex__dl">
            <div>
              <dt>Titular</dt>
              <dd>
                <span>{prex.accountName}</span>
                <button
                  type="button"
                  className="ca-tx-pay-prex__copy"
                  onClick={() => void copyText('Titular', prex.accountName)}
                  aria-label="Copiar titular"
                >
                  <Copy size={14} />
                </button>
              </dd>
            </div>
            <div>
              <dt>Nº de cuenta</dt>
              <dd>
                <span className="ca-tx-pay-prex__account-number">{prex.accountNumber}</span>
                <button
                  type="button"
                  className="ca-tx-pay-prex__copy"
                  onClick={() => void copyText('Número de cuenta', prex.accountNumber)}
                  aria-label="Copiar número de cuenta"
                >
                  <Copy size={14} />
                </button>
              </dd>
            </div>
            <div>
              <dt>Monto exacto</dt>
              <dd>
                <strong>{amountLabel}</strong>
              </dd>
            </div>
            <div>
              <dt>Referencia</dt>
              <dd>
                <span>{operationCode}</span>
                <button
                  type="button"
                  className="ca-tx-pay-prex__copy"
                  onClick={() => void copyText('Referencia', operationCode)}
                  aria-label="Copiar código de operación"
                >
                  <Copy size={14} />
                </button>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="ca-tx-pay-prex__upload">
        <Form.Label htmlFor="prex-receipt" className="ca-tx-pay-prex__upload-label">
          <Upload size={16} aria-hidden />
          Comprobante de transferencia
        </Form.Label>
        <Form.Control
          id="prex-receipt"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
          disabled={disabled || isPending}
          onChange={(event) => {
            const input = event.currentTarget as unknown as HTMLInputElement;
            // FileList es live: capturar el File antes de limpiar el input.
            const file = input.files?.[0];
            void onFileSelected(file);
          }}
        />
        <Form.Text muted>JPEG, PNG, WebP o PDF · máximo 4 MB</Form.Text>
        {fileName ? (
          <p className="ca-tx-pay-prex__file-name mb-0">Archivo: {fileName}</p>
        ) : null}
        {receiptDataUrl?.startsWith('data:image/') ? (
          <img
            src={receiptDataUrl}
            alt="Vista previa del comprobante"
            className="ca-tx-pay-prex__preview"
          />
        ) : null}
      </div>

      {localError ? <Alert variant="danger">{localError}</Alert> : null}

      <div className="ca-tx-pay-cta__actions ca-tx-pay-prex__actions">
        <Button
          type="button"
          className="ca-btn-cta"
          disabled={disabled || isPending || !receiptDataUrl}
          onClick={() => void handleSubmit()}
        >
          {isPending ? (
            <>
              <Spinner size="sm" animation="border" className="me-2" />
              Confirmando pago…
            </>
          ) : (
            'Ya transferí — enviar comprobante'
          )}
        </Button>
      </div>
    </section>
  );
}
