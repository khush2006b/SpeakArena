import { test, expect } from '@playwright/test';

test.describe('Payments E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/checkout');
  });

  test('Simulates a successful payment checkout', async ({ page }) => {
    await page.route('**/api/v1/payments/create-order', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          order_id: 'mock_order_123',
          amount: 5000,
          currency: 'INR',
        }),
      });
    });

    await page.route('**/api/v1/payments/verify', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.addInitScript(() => {
      (window as any).Razorpay = class RazorpayMock {
        options: any;
        constructor(options: any) {
          this.options = options;
        }
        open() {
          if (this.options.handler) {
            setTimeout(() => {
              this.options.handler({
                razorpay_payment_id: 'mock_payment_123',
                razorpay_order_id: 'mock_order_123',
                razorpay_signature: 'mock_signature_123',
              });
            }, 100);
          }
        }
        on(_event: string, _callback: Function) {
          // No-op for success scenario
        }
      };
    });

    await page.getByRole('button', { name: /Pay Now|Checkout/i }).click();

    await expect(page.getByText(/Payment Successful/i)).toBeVisible();
    await expect(page.url()).toContain('/payment-success');
  });

  test('Simulates a payment failure and retry', async ({ page }) => {
    let orderCreationCount = 0;
    await page.route('**/api/v1/payments/create-order', async (route) => {
      orderCreationCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          order_id: `mock_order_fail_${orderCreationCount}`,
          amount: 5000,
          currency: 'INR',
        }),
      });
    });

    await page.addInitScript(() => {
      (window as any).Razorpay = class RazorpayMock {
        options: any;
        constructor(options: any) {
          this.options = options;
        }
        open() {
          // Simulate failure by triggering the registered failure callback
          if (this.options.handler) {
            // Emulate delay
          }
        }
        on(event: string, callback: Function) {
          if (event === 'payment.failed') {
            setTimeout(() => {
              callback({
                error: {
                  code: 'BAD_REQUEST_ERROR',
                  description: 'Payment failed',
                  source: 'business',
                  step: 'payment_authentication',
                  reason: 'invalid_payment_details',
                  metadata: {
                    order_id: 'mock_order_fail',
                    payment_id: 'mock_payment_fail',
                  },
                },
              });
            }, 100);
          }
        }
      };
    });

    await page.getByRole('button', { name: /Pay Now|Checkout/i }).click();

    await expect(page.getByText(/Payment Failed/i)).toBeVisible();

    await page.getByRole('button', { name: /Retry/i }).click();

    expect(orderCreationCount).toBeGreaterThan(1);
  });
});
