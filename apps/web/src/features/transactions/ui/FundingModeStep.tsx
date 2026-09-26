import { AGENT_FEE_ONLY_UYU_CENTS } from '@confiapp/shared';

import { formatOperationMoney } from '@/shared/lib/money';

import type { FundingMode } from '../model/types';

const AGENT_FEE_LABEL = formatOperationMoney(AGENT_FEE_ONLY_UYU_CENTS, 'UYU');

type FundingModeStepProps = {
  value: FundingMode;
  onChange: (mode: FundingMode) => void;
  /** Si false, la card de escrow se muestra deshabilitada. */
  escrowFullEnabled?: boolean;
};

/**
 * Paso “Pago”: escrow completo (off) vs solo contratación del Agente.
 */
export function FundingModeStep({
  value,
  onChange,
  escrowFullEnabled = false,
}: FundingModeStepProps) {
  return (
    <div className="ca-tx-funding" role="radiogroup" aria-label="Modo de pago">
      <button
        type="button"
        role="radio"
        aria-checked={value === 'AGENT_FEE_ONLY'}
        className={`ca-tx-funding__card${value === 'AGENT_FEE_ONLY' ? ' is-selected' : ''}`}
        onClick={() => onChange('AGENT_FEE_ONLY')}
      >
        <span className="ca-tx-funding__badge">Disponible</span>
        <strong className="ca-tx-funding__title">Solo pago del Agente</strong>
        <p className="ca-tx-funding__lead">
          El comprador paga {AGENT_FEE_LABEL} a ConfiApp por contratar al Agente. El monto queda
          retenido hasta el fin de la operación; el Agente lo recibe en su wallet tras el plazo de
          disponibilidad. El precio y la forma de pago del producto se acuerdan entre las partes;
          ConfiApp no interviene en esa decisión.
        </p>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={value === 'ESCROW_FULL'}
        aria-disabled={!escrowFullEnabled}
        disabled={!escrowFullEnabled}
        className={`ca-tx-funding__card${!escrowFullEnabled ? ' ca-tx-funding__card--disabled' : ''}${
          value === 'ESCROW_FULL' ? ' is-selected' : ''
        }`}
        onClick={() => {
          if (escrowFullEnabled) onChange('ESCROW_FULL');
        }}
      >
        <span className="ca-tx-funding__badge ca-tx-funding__badge--soon">Próximamente</span>
        <strong className="ca-tx-funding__title">Resguardo en la app</strong>
        <p className="ca-tx-funding__lead">
          Próximamente, ConfiApp podrá gestionar y custodiar el pago del producto y el pago
          del Agente directamente desde la plataforma, haciendo que todo el proceso sea más
          simple, seguro y transparente para ambas partes.
        </p>
      </button>
    </div>
  );
}
