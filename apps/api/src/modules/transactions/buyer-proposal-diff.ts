export type BuyerProposalChange = {
  field: string;
  from: string;
  to: string;
};

export type BuyerProposalSnapshot = {
  title?: string | null;
  description?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  condition?: string | null;
  category?: string | null;
};

export type SellerConfirmSnapshot = {
  title: string;
  description: string;
  amountCents: number;
  currency: string;
  condition: string;
  category: string;
};

function normText(value?: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function formatAmount(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

function pushIfDifferent(
  changes: BuyerProposalChange[],
  field: string,
  from: string,
  to: string,
): void {
  if (from === to) return;
  changes.push({ field, from: from || '(vacío)', to: to || '(vacío)' });
}

/**
 * Compara la propuesta del comprador con lo que confirma el vendedor.
 * Las fotos no cuentan: el comprador no las carga y el vendedor debe adjuntar al menos una.
 */
export function diffBuyerProposalVsSellerConfirm(
  buyer: BuyerProposalSnapshot,
  seller: SellerConfirmSnapshot,
): BuyerProposalChange[] {
  const changes: BuyerProposalChange[] = [];

  pushIfDifferent(
    changes,
    'title',
    normText(buyer.title),
    normText(seller.title),
  );
  pushIfDifferent(
    changes,
    'description',
    normText(buyer.description),
    normText(seller.description),
  );

  const buyerCurrency = (buyer.currency ?? 'UYU').toUpperCase();
  const sellerCurrency = seller.currency.toUpperCase();
  const buyerAmount = buyer.amountCents ?? 0;
  if (buyerAmount !== seller.amountCents || buyerCurrency !== sellerCurrency) {
    changes.push({
      field: 'price',
      from: formatAmount(buyerAmount, buyerCurrency),
      to: formatAmount(seller.amountCents, sellerCurrency),
    });
  }

  // Condición/categoría: el comprador suele no cargarlas; solo cuentan si las definió.
  if (buyer.condition?.trim()) {
    pushIfDifferent(
      changes,
      'condition',
      buyer.condition.toUpperCase(),
      seller.condition.toUpperCase(),
    );
  }
  if (buyer.category?.trim()) {
    pushIfDifferent(
      changes,
      'category',
      buyer.category.toUpperCase(),
      seller.category.toUpperCase(),
    );
  }

  return changes;
}
