import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../hooks/useReputation', () => ({
  usePendingTargets: () => ({
    isLoading: false,
    isError: false,
    data: {
      transactionCode: 'TXDEMO',
      transactionId: 't1',
      myRole: 'BUYER',
      windowDays: 30,
      targets: [
        { userId: '507f1f77bcf86cd799439011', role: 'SELLER', alreadyReviewed: false },
        { userId: '507f1f77bcf86cd799439012', role: 'AGENT', alreadyReviewed: false },
      ],
    },
  }),
  useCreateReview: () => ({
    isPending: false,
    mutateAsync: vi.fn().mockResolvedValue({ id: 'r1' }),
  }),
}));

import { ReviewFormPanel } from './ReviewFormPanel';

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('ReviewFormPanel', () => {
  it('renderiza destinos y permite enviar', async () => {
    const user = userEvent.setup();
    wrap(<ReviewFormPanel transactionCode="TXDEMO" />);

    expect(screen.getByText(/Calificar participantes/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Enviar calificación/i }));
    expect(await screen.findByText(/Calificación enviada/i)).toBeInTheDocument();
  });
});
