import { describe, expect, it } from 'vitest';

import {
  isMercadoPagoSandboxCheckoutUrl,
  resolveCheckoutUrl,
  resolveReusableCheckoutUrl,
} from './checkout-url';

const PROD_URL = 'https://www.mercadopago.com.uy/checkout/v1/redirect?pref_id=prod-1';
const SANDBOX_URL = 'https://sandbox.mercadopago.com.uy/checkout/v1/redirect?pref_id=sbx-1';
const MOCK_URL = 'http://localhost:3001/operaciones/ABC/pagar/simular?paymentId=hold-1';

describe('resolveCheckoutUrl', () => {
  it('prioriza initPoint aunque también haya sandboxInitPoint', () => {
    expect(
      resolveCheckoutUrl({
        initPoint: PROD_URL,
        sandboxInitPoint: SANDBOX_URL,
      }),
    ).toBe(PROD_URL);
  });

  it('usa initPoint cuando es el único valor', () => {
    expect(resolveCheckoutUrl({ initPoint: PROD_URL })).toBe(PROD_URL);
  });

  it('cae a sandboxInitPoint solo si initPoint falta', () => {
    expect(resolveCheckoutUrl({ sandboxInitPoint: SANDBOX_URL })).toBe(SANDBOX_URL);
    expect(resolveCheckoutUrl({ initPoint: '', sandboxInitPoint: SANDBOX_URL })).toBe(SANDBOX_URL);
    expect(resolveCheckoutUrl({ initPoint: '   ', sandboxInitPoint: SANDBOX_URL })).toBe(
      SANDBOX_URL,
    );
  });

  it('devuelve undefined si no hay ninguna URL', () => {
    expect(resolveCheckoutUrl({})).toBeUndefined();
    expect(resolveCheckoutUrl({ initPoint: '', sandboxInitPoint: null })).toBeUndefined();
  });

  it('recorta espacios en las URLs', () => {
    expect(resolveCheckoutUrl({ initPoint: `  ${PROD_URL}  ` })).toBe(PROD_URL);
  });
});

describe('resolveReusableCheckoutUrl', () => {
  it('reutiliza initPoint de producción aunque el metadata tenga URL de sandbox', () => {
    expect(
      resolveReusableCheckoutUrl({
        initPoint: PROD_URL,
        sandboxInitPoint: SANDBOX_URL,
      }),
    ).toBe(PROD_URL);
  });

  it('no reutiliza un hold que solo tiene URL de sandbox (hay que regenerar)', () => {
    expect(
      resolveReusableCheckoutUrl({
        sandboxInitPoint: SANDBOX_URL,
      }),
    ).toBeUndefined();
    expect(
      resolveReusableCheckoutUrl({
        initPoint: SANDBOX_URL,
        sandboxInitPoint: SANDBOX_URL,
      }),
    ).toBeUndefined();
  });

  it('reutiliza la URL mock (no es sandbox de Mercado Pago)', () => {
    expect(
      resolveReusableCheckoutUrl({
        initPoint: MOCK_URL,
        sandboxInitPoint: MOCK_URL,
      }),
    ).toBe(MOCK_URL);
  });

  it('devuelve undefined si el metadata no tiene URLs', () => {
    expect(resolveReusableCheckoutUrl({})).toBeUndefined();
  });
});

describe('isMercadoPagoSandboxCheckoutUrl', () => {
  it('detecta el host de sandbox de Mercado Pago', () => {
    expect(isMercadoPagoSandboxCheckoutUrl(SANDBOX_URL)).toBe(true);
    expect(isMercadoPagoSandboxCheckoutUrl('https://SANDBOX.MERCADOPAGO.com/checkout')).toBe(true);
    expect(isMercadoPagoSandboxCheckoutUrl(PROD_URL)).toBe(false);
    expect(isMercadoPagoSandboxCheckoutUrl(MOCK_URL)).toBe(false);
    expect(isMercadoPagoSandboxCheckoutUrl(undefined)).toBe(false);
  });
});
