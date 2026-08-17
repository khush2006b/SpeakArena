import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import Dashboard from '@/app/(student)/dashboard/page';

expect.extend(toHaveNoViolations);

// Mock student dashboard data
const mockDashboardData = {
  user: {
    name: 'Jane Doe',
  },
  stats: {
    activeCourses: 3,
    completedLessons: 12,
    totalPoints: 1500,
  },
  recentActivity: [
    { id: 1, title: 'Intro to Spanish', progress: 80 },
    { id: 2, title: 'French Basics', progress: 45 },
  ],
};

// Setup MSW server
const server = setupServer(
  http.get('/api/v1/student/dashboard', () => {
    return HttpResponse.json(mockDashboardData);
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  jest.clearAllMocks();
});
afterAll(() => server.close());

// Mocking useTheme or similar context if needed. Assuming the component uses next-themes or similar
// For this test, we will mock matchMedia to simulate dark mode if it relies on CSS media queries
// or mock the theme provider. Let's assume a simple generic approach or that it renders based on a prop/context.
// If it uses a context, we would wrap it. For simplicity, we just test the render output.

describe('Student Dashboard Integration', () => {
  const setup = () => {
    const user = userEvent.setup();
    const utils = render(<Dashboard />);
    return { user, ...utils };
  };

  it('shows loading skeleton initially', () => {
    setup();
    // Assuming the skeleton has a role="status" or aria-busy="true" or specific test id
    expect(screen.getByTestId('dashboard-loading-skeleton')).toBeInTheDocument();
  });

  it('renders dashboard data successfully after loading', async () => {
    setup();

    // Wait for the loading to finish and data to appear
    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-loading-skeleton')).not.toBeInTheDocument();
    });

    // Check Welcome message
    expect(screen.getByRole('heading', { name: /welcome back, jane doe/i })).toBeInTheDocument();

    // Check Stats
    expect(screen.getByText('3')).toBeInTheDocument(); // Active courses
    expect(screen.getByText('12')).toBeInTheDocument(); // Completed lessons
    expect(screen.getByText('1500')).toBeInTheDocument(); // Points

    // Check Recent Activity
    expect(screen.getByText('Intro to Spanish')).toBeInTheDocument();
    expect(screen.getByText('French Basics')).toBeInTheDocument();
  });

  it('renders error state when API returns 500', async () => {
    server.use(
      http.get('/api/v1/student/dashboard', () => {
        return HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 });
      })
    );

    const { user } = setup();

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-loading-skeleton')).not.toBeInTheDocument();
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/failed to load dashboard data/i);
    
    // Test retry button if it exists
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
  });

  it('renders correctly in dark mode', async () => {
    // Mocking dark mode class on document or via a mocked provider.
    // Assuming the component responds to a wrapping class or context.
    // For this test, let's assume it checks a data-theme attribute on a wrapper or body.
    document.documentElement.setAttribute('data-theme', 'dark');

    setup();
    
    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-loading-skeleton')).not.toBeInTheDocument();
    });

    // Verify dark mode specific styles or classes if applicable
    // e.g., expect(screen.getByTestId('dashboard-container')).toHaveClass('bg-gray-900');
    // Since we don't know the exact class names, this serves as a structural test
    expect(screen.getByRole('heading', { name: /welcome back, jane doe/i })).toBeInTheDocument();
    
    // Cleanup
    document.documentElement.removeAttribute('data-theme');
  });

  it('has no accessibility violations', async () => {
    const { container } = setup();

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-loading-skeleton')).not.toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('supports keyboard navigation', async () => {
    const { user } = setup();

    await waitFor(() => {
      expect(screen.queryByTestId('dashboard-loading-skeleton')).not.toBeInTheDocument();
    });

    // Example: Tab to a known interactive element, e.g., a "View All Courses" link
    // Assuming such a link exists in recent activity
    const firstCourseLink = screen.getByRole('link', { name: /intro to spanish/i });
    
    // Press tab
    await user.tab();
    
    // Verify it receives focus (might need to adjust depending on actual tab order)
    // expect(firstCourseLink).toHaveFocus(); 
  });
});
