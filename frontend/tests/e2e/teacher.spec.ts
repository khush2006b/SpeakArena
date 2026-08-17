import { test, expect } from '@playwright/test';

test.describe('Teacher Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock user session for Teacher role
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: { id: 'teacher-123', name: 'Alice Teacher', role: 'TEACHER' },
        }
      });
    });
  });

  test('Teacher can create, add content, and publish a course', async ({ page }) => {
    // 1. Log in and navigate to teacher dashboard
    await page.goto('/teacher/dashboard');
    
    // 2. Mock course creation
    await page.route('**/api/courses', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          json: { id: 'course-1', title: 'Mastering Playwright', status: 'DRAFT' }
        });
      } else {
        await route.fallback();
      }
    });

    // Mock retrieving the newly created course details
    await page.route('**/api/courses/course-1', async (route) => {
      await route.fulfill({
        status: 200,
        json: { id: 'course-1', title: 'Mastering Playwright', status: 'DRAFT', materials: [], liveClasses: [] }
      });
    });

    // UI Interaction: Create a new draft course
    await page.click('button:has-text("Create New Course")');
    await page.fill('input[name="title"]', 'Mastering Playwright');
    await page.click('button[type="submit"]:has-text("Create")');

    // Wait for navigation to course edit/management page
    await expect(page).toHaveURL(/\/teacher\/courses\/course-1/);
    
    // 3. Upload Video & PDF
    // Mock presigned URL endpoint for Cloudflare R2
    await page.route('**/api/upload/presigned-url', async (route) => {
      await route.fulfill({
        status: 200,
        json: { uploadUrl: 'https://mock-r2-bucket.com/upload', fileKey: 'mock-file-key' }
      });
    });

    // Mock the actual R2 file upload
    await page.route('https://mock-r2-bucket.com/upload', async (route) => {
      await route.fulfill({ status: 200 });
    });

    // Mock adding material metadata to the course
    await page.route('**/api/courses/course-1/materials', async (route) => {
      const payload = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        json: { id: `mat-${Date.now()}`, title: payload.title, type: payload.type, url: 'mock-file-key' }
      });
    });

    // Upload Video UI Interaction
    await page.click('button:has-text("Add Material")');
    await page.setInputFiles('input[type="file"]', {
      name: 'intro.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('mock video content')
    });
    await page.fill('input[name="materialTitle"]', 'Course Intro Video');
    await page.selectOption('select[name="materialType"]', 'VIDEO');
    await page.click('button:has-text("Upload")');
    
    // Assert video appears in list
    await expect(page.locator('text=Course Intro Video')).toBeVisible();

    // Upload PDF UI Interaction
    await page.click('button:has-text("Add Material")');
    await page.setInputFiles('input[type="file"]', {
      name: 'syllabus.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('mock pdf content')
    });
    await page.fill('input[name="materialTitle"]', 'Course Syllabus');
    await page.selectOption('select[name="materialType"]', 'PDF');
    await page.click('button:has-text("Upload")');
    
    // Assert PDF appears in list
    await expect(page.locator('text=Course Syllabus')).toBeVisible();

    // 4. Create Live Class (simulating Google Meet API response)
    await page.route('**/api/courses/course-1/live-classes', async (route) => {
      const payload = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        json: { 
          id: 'live-1', 
          title: payload.title, 
          startTime: payload.startTime,
          meetingLink: 'https://meet.google.com/abc-defg-hij' 
        }
      });
    });

    // Schedule Live Class UI Interaction
    await page.click('button:has-text("Schedule Live Class")');
    await page.fill('input[name="liveTitle"]', 'Weekly Q&A');
    await page.fill('input[name="startTime"]', '2026-08-10T10:00');
    await page.click('button:has-text("Schedule")');
    
    // Assert Live Class appears
    await expect(page.locator('text=Weekly Q&A')).toBeVisible();
    await expect(page.locator('text=https://meet.google.com/abc-defg-hij')).toBeVisible();

    // 5. Publish Course
    await page.route('**/api/courses/course-1/publish', async (route) => {
      await route.fulfill({
        status: 200,
        json: { id: 'course-1', title: 'Mastering Playwright', status: 'PUBLISHED' }
      });
    });

    // Publish UI Interaction
    await page.click('button:has-text("Publish Course")');
    
    // Assert on UI state changes
    await expect(page.locator('text=Course Published')).toBeVisible();
    await expect(page.locator('text=Status: PUBLISHED')).toBeVisible();
  });
});
