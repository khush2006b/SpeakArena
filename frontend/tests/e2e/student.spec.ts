import { test, expect } from '@playwright/test';

test.describe('Student Flow E2E', () => {
  test('Student signs up, purchases, and consumes course content', async ({ page }) => {
    // 1. Mock API Responses
    
    // Mock Signup
    await page.route('**/api/auth/signup', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'fake-jwt-token', user: { id: 1, role: 'student', name: 'Test Student' } }),
      });
    });

    // Mock Course List
    await page.route('**/api/courses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 101, title: 'English Masterclass', price: 50, description: 'Learn English.' }]),
      });
    });

    // Mock Course Details
    await page.route('**/api/courses/101', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 101,
          title: 'English Masterclass',
          price: 50,
          description: 'Learn English.',
          modules: [
            { id: 1, title: 'Module 1', type: 'video', url: '/videos/mod1.mp4' },
            { id: 2, title: 'Module 2', type: 'pdf', url: '/docs/mod2.pdf' }
          ],
          resources: [{ id: 1, name: 'Worksheet', url: '/downloads/worksheet.pdf' }]
        }),
      });
    });

    // Mock Enrollment / Purchase
    await page.route('**/api/courses/101/enroll', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Enrolled successfully' }),
      });
    });
    
    // Mock Enrollment Check
    await page.route('**/api/courses/101/enrollment-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ isEnrolled: true }),
      });
    });

    // Mock Note-taking save
    await page.route('**/api/notes', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, content: 'This is an important note.' }),
      });
    });

    // Mock Meeting Join URL
    await page.route('**/api/courses/101/live-class', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ joinUrl: 'https://zoom.us/j/fake-meeting' }),
      });
    });

    // 2. The Journey

    // Navigate to Signup
    await page.goto('/signup');
    await page.fill('input[name="name"]', 'Test Student');
    await page.fill('input[name="email"]', 'student@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard or course list
    await expect(page).toHaveURL(/\/dashboard|\/courses/);

    // Browse to courses and select course 101
    await page.goto('/courses');
    await page.click('text=English Masterclass');
    
    // Purchase / Enroll
    await page.click('button:has-text("Enroll")');
    await expect(page.locator('text=Enrolled successfully')).toBeVisible();

    // Access the course
    await page.click('button:has-text("Go to Course")');
    await expect(page).toHaveURL(/\/courses\/101/);

    // Watch a Video
    await page.click('text=Module 1');
    const videoPlayer = page.locator('video');
    await expect(videoPlayer).toBeVisible();

    // Read a PDF
    await page.click('text=Module 2');
    const pdfViewer = page.locator('.pdf-viewer, iframe[src*=".pdf"]');
    await expect(pdfViewer).toBeVisible();

    // Take Notes
    await page.fill('textarea[placeholder="Take your notes here..."]', 'This is an important note.');
    await page.click('button:has-text("Save Note")');
    await expect(page.locator('text=Note saved successfully')).toBeVisible();

    // Join a Live Class
    await page.click('text=Live Class');
    const joinUrlPromise = page.waitForEvent('popup');
    await page.click('a:has-text("Join Live Class")');
    const joinPopup = await joinUrlPromise;
    expect(joinPopup.url()).toContain('zoom.us');

    // Download Resources
    await page.click('text=Resources');
    const downloadPromise = page.waitForEvent('download');
    await page.click('text=Worksheet');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('worksheet');
  });
});
