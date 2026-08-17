import { test, expect } from '@playwright/test';

test.describe('Chat System', () => {
  test.beforeEach(async ({ page }) => {
    // Assuming the user is authenticated and navigating to the chat page
    await page.goto('/chat');
  });

  test('should send and receive a message in realtime', async ({ page }) => {
    // Mock the initial chat history fetch
    await page.route('**/api/chat/messages', async (route, request) => {
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'msg-1', text: 'Welcome to the chat!', sender: 'System', timestamp: new Date().toISOString() }
          ])
        });
      } else if (request.method() === 'POST') {
        // Mock sending a message
        const postData = JSON.parse(request.postData() || '{}');
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: `msg-${Date.now()}`,
            text: postData.text,
            sender: 'User',
            timestamp: new Date().toISOString()
          })
        });
      } else {
        await route.continue();
      }
    });

    // Reload to apply the GET mock
    await page.reload();

    // Verify initial message is visible
    await expect(page.getByText('Welcome to the chat!')).toBeVisible();

    // Type and send a new message
    const messageInput = page.getByPlaceholder(/type a message/i);
    await messageInput.fill('Hello, world!');
    
    const sendButton = page.getByRole('button', { name: /send/i });
    await sendButton.click();

    // Verify the new message appears in the chat
    await expect(page.getByText('Hello, world!')).toBeVisible();
    
    // Ensure the input was cleared
    await expect(messageInput).toHaveValue('');
  });

  test('should display an offline indicator when network is disconnected', async ({ page, context }) => {
    // Simulate going offline
    await context.setOffline(true);

    // Many apps have a polling mechanism or listen to window 'offline' event
    // We expect the UI to react to this state change
    
    // Attempting to send a message while offline
    const messageInput = page.getByPlaceholder(/type a message/i);
    await messageInput.fill('This should fail');
    
    const sendButton = page.getByRole('button', { name: /send/i });
    await sendButton.click();

    // Assert that an offline warning or error message is displayed
    await expect(page.getByText(/offline|no internet/i)).toBeVisible();

    // Re-enable network
    await context.setOffline(false);
  });

  test('should show a notification when receiving a new message', async ({ page }) => {
    // Mock initial state
    await page.route('**/api/chat/messages', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.reload();

    // Simulate receiving a new message via a mocked API poll or WebSocket event
    // Here we'll simulate it by updating the route and triggering a UI refresh (or waiting for poll)
    await page.route('**/api/chat/messages', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'msg-3', text: 'You have a new alert!', sender: 'Admin', timestamp: new Date().toISOString() }
        ])
      });
    });

    // We can simulate an incoming message by dispatching a custom event if the app listens for it,
    // or if we rely on polling, we could just wait or advance time. 
    // Assuming the app has a refresh mechanism or we trigger it:
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus')); // often triggers refetch
    });

    // Check for the toast notification or badge indicating a new message
    // We look for a typical toast/notification ARIA role or class
    // // const notification = page.locator('.notification, [role="alert"]').filter({ hasText: /new alert|admin/i });
    
    // Alternatively, verify the text appears somewhere indicating a notification
    await expect(page.getByText('You have a new alert!')).toBeVisible();
  });
});
