import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { BillingHistory } from '@/features/student/components/BillingHistory';

expect.extend(toHaveNoViolations);

const mockPayments = [
  { id: 'pay_1', date: '2023-10-01', amount: 49.99, status: 'completed', description: 'Pro Plan Monthly' },
  { id: 'pay_2', date: '2023-11-01', amount: 49.99, status: 'pending', description: 'Pro Plan Monthly' },
];

const server = setupServer(
  rest.get('/api/v1/payments/history', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ payments: mockPayments }));
  }),
  rest.post('/api/v1/payments/create-order', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ orderId: 'ord_12345', checkoutUrl: 'https://checkout.stripe.com/c/pay/test_123' }));
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('BillingHistory Component', () => {
  it('renders payment history successfully', async () => {
    render(<BillingHistory />);

    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Pro Plan Monthly')).toBeInTheDocument();
    });

    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getAllByText('$49.99').length).toBe(2);
  });

  it('handles checkout button functionality', async () => {
    const user = userEvent.setup();
    render(<BillingHistory />);

    await waitFor(() => {
      expect(screen.getByText('Pro Plan Monthly')).toBeInTheDocument();
    });

    const checkoutButton = screen.getByRole('button', { name: /checkout/i });
    expect(checkoutButton).toBeInTheDocument();

    await user.click(checkoutButton);

    await waitFor(() => {
      expect(screen.getByText(/redirecting to checkout/i)).toBeInTheDocument();
    });
  });

  it('displays an error state when payment history fails to load', async () => {
    server.use(
      rest.get('/api/v1/payments/history', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ message: 'Internal Server Error' }));
      })
    );

    render(<BillingHistory />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load payment history/i)).toBeInTheDocument();
    });
  });

  it('is accessible with no violations', async () => {
    const { container } = render(<BillingHistory />);

    await waitFor(() => {
      expect(screen.getByText('Pro Plan Monthly')).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
