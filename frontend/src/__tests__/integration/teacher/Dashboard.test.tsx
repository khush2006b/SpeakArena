import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import Dashboard from '@/app/(teacher)/dashboard/page';

expect.extend(toHaveNoViolations);

const mockDashboardData = {
  revenue: 12500,
  activeStudents: 145,
  totalCourses: 12,
  recentActivity: [
    { id: '1', type: 'ENROLLMENT', studentName: 'John Doe', courseName: 'React Mastery', date: '2026-08-07T10:00:00Z' },
    { id: '2', type: 'COMPLETION', studentName: 'Jane Smith', courseName: 'Advanced CSS', date: '2026-08-06T15:30:00Z' },
  ]
};

const server = setupServer(
  http.get('/api/v1/teacher/dashboard', ({ request }) => {
    const url = new URL(request.url);
    const timeframe = url.searchParams.get('timeframe') || 'monthly';
    
    if (timeframe === 'weekly') {
      return HttpResponse.json({
        ...mockDashboardData,
        revenue: 3200,
        activeStudents: 140,
      });
    }

    return HttpResponse.json(mockDashboardData);
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Teacher Dashboard Integration Tests', () => {
  it('renders loading state initially', () => {
    render(<Dashboard />);
    expect(screen.getByRole('progressbar', { name: /loading dashboard/i })).toBeInTheDocument();
  });

  it('fetches and displays dashboard metrics successfully', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/total revenue/i)).toBeInTheDocument();
    expect(screen.getByText(/\$12,500/i)).toBeInTheDocument();
    expect(screen.getByText(/active students/i)).toBeInTheDocument();
    expect(screen.getByText(/145/i)).toBeInTheDocument();
    expect(screen.getByText(/total courses/i)).toBeInTheDocument();
    expect(screen.getByText(/12/i)).toBeInTheDocument();
  });

  it('handles timeframe filter interaction and updates data', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/\$12,500/i)).toBeInTheDocument();
    });

    const filterButton = screen.getByRole('combobox', { name: /timeframe/i });
    await user.click(filterButton);
    
    const weeklyOption = screen.getByRole('option', { name: /weekly/i });
    await user.click(weeklyOption);

    // Wait for the data to update
    await waitFor(() => {
      expect(screen.getByText(/\$3,200/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/140/i)).toBeInTheDocument();
  });

  it('displays an error message when API fails (500)', async () => {
    server.use(
      http.get('/api/v1/teacher/dashboard', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    
    expect(screen.getByText(/failed to load dashboard data/i)).toBeInTheDocument();
    
    // Test retry button
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
  });

  it('renders recent activity feed correctly', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/recent activity/i)).toBeInTheDocument();
    });

    const feed = screen.getByRole('list', { name: /recent activity/i });
    const items = within(feed).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    
    expect(within(items[0]).getByText(/john doe enrolled in react mastery/i)).toBeInTheDocument();
    expect(within(items[1]).getByText(/jane smith completed advanced css/i)).toBeInTheDocument();
  });

  it('should not have any accessibility violations', async () => {
    const { container } = render(<Dashboard />);

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('supports keyboard navigation for timeframe filter', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    const filterButton = screen.getByRole('combobox', { name: /timeframe/i });
    
    // Focus the combobox using tab
    await user.tab();
    expect(filterButton).toHaveFocus();

    // Open dropdown
    await user.keyboard('[Enter]');
    
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();
    
    // Navigate options
    await user.keyboard('[ArrowDown]');
    const weeklyOption = screen.getByRole('option', { name: /weekly/i });
    expect(weeklyOption).toHaveFocus();

    // Select option
    await user.keyboard('[Enter]');

    await waitFor(() => {
      expect(screen.getByText(/\$3,200/i)).toBeInTheDocument();
    });
  });
});
