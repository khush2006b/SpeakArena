import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  const loginUrl = '/login';
  const dashboardUrl = '/dashboard';

  test('Login successfully as Teacher', async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'fake-jwt-token-teacher',
          user: { id: 1, role: 'teacher', name: 'Test Teacher' }
        }),
      });
    });

    await page.goto(loginUrl);
    
    await page.fill('input[name="email"]', 'teacher@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard');
    await expect(page).toHaveURL(/.*\/dashboard/);
    // Assuming a welcome message based on role/name
    await expect(page.locator('text=Welcome, Test Teacher')).toBeVisible();
  });

  test('Login successfully as Student', async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'fake-jwt-token-student',
          user: { id: 2, role: 'student', name: 'Test Student' }
        }),
      });
    });

    await page.goto(loginUrl);
    
    await page.fill('input[name="email"]', 'student@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard');
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.locator('text=Welcome, Test Student')).toBeVisible();
  });

  test('Logout', async ({ page }) => {
    // Mock user fetching for authenticated state
    await page.route('**/api/user/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 1, role: 'teacher', name: 'Test Teacher' }
        }),
      });
    });

    await page.route('**/api/auth/logout', async (route) => {
      await route.fulfill({ status: 200 });
    });

    // Seed localStorage with a fake token and go to dashboard
    await page.goto('/'); 
    await page.evaluate(() => localStorage.setItem('token', 'fake-jwt-token-teacher'));
    await page.goto(dashboardUrl);

    await expect(page.locator('text=Welcome, Test Teacher')).toBeVisible();
    
    // Click logout button (fallback selector for common usage)
    await page.click('button[data-testid="logout-button"], button:has-text("Logout"), a:has-text("Logout")');

    // Should redirect to login
    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/.*\/login/);
    
    // Check token is removed
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });

  test('JWT persistence across reloads', async ({ page }) => {
    await page.route('**/api/user/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 1, role: 'teacher', name: 'Test Teacher' }
        }),
      });
    });

    // Seed localStorage
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('token', 'fake-jwt-token-teacher'));
    
    // Go to dashboard
    await page.goto(dashboardUrl);
    await expect(page.locator('text=Welcome, Test Teacher')).toBeVisible();

    // Reload the page
    await page.reload();
    
    // Should still be on dashboard with user data visible
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.locator('text=Welcome, Test Teacher')).toBeVisible();
    
    // Token should still be in localStorage
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBe('fake-jwt-token-teacher');
  });

  test('Session Expiry (401 response and redirect to login)', async ({ page }) => {
    // Return 401 Unauthorized for the user profile call to simulate expired token
    await page.route('**/api/user/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Token expired' }),
      });
    });

    // Seed localStorage with an expired token
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('token', 'expired-jwt-token'));
    
    // Attempt to access protected dashboard
    await page.goto(dashboardUrl);

    // Should automatically redirect to login because of the 401 interceptor
    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/.*\/login/);
    
    // Token should be removed from localStorage by the client's interceptor logic
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });
});
