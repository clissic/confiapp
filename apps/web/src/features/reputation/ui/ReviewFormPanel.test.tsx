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
  useTransactionReviewsGiven: () => ({
    isLoading: false,
    isError: false,
    data: [],
  }),
  useCreateReview: () => ({
    isPending: false,
    mutateAsync: vi.fn().mockResolvedValue({ id: 'r1' }),
  }),
}));

vi.mock('@/shared/ui', () => ({
  useAppToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

import { ReviewFormPanel } from './ReviewFormPanel';
import { ReviewGivenSummary } from './ReviewGivenSummary';

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

    expect(screen.getByText(/^Calificar$/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Vendedor/i })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Puntaje' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Enviar calificación/i }));
    expect(screen.getByRole('button', { name: /Enviar calificación/i })).toBeInTheDocument();
  });
});

describe('ReviewGivenSummary', () => {
  it('muestra rol, estrellas y comentario', () => {
    render(
      <ReviewGivenSummary
        reviews={[
          {
            id: 'r1',
            transactionId: 't1',
            reviewerId: 'u1',
            revieweeId: 'u2',
            reviewerRole: 'AGENT',
            revieweeRole: 'SELLER',
            rating: 5,
            comment: 'Excelente trato.',
            weight: 1,
            fraudFlags: ['NONE'],
            visibility: 'PUBLIC',
            createdAt: new Date().toISOString(),
          },
        ]}
      />,
    );

    expect(screen.getByText('Tus calificaciones')).toBeInTheDocument();
    expect(screen.getByText('Vendedor')).toBeInTheDocument();
    expect(screen.getByText('Excelente trato.')).toBeInTheDocument();
    expect(screen.getByLabelText('5 de 5')).toBeInTheDocument();
  });
});
