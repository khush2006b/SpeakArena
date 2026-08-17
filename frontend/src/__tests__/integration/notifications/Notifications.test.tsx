import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import NotificationDropdown from '@/components/layout/NotificationDropdown';

expect.extend(toHaveNoViolations);

const mockUnreadCount = { count: 3 };
const mockNotifications = [
  { id: '1', message: 'New message from Alice', read: false },
  { id: '2', message: 'Bob liked your post', read: false },
  { id: '3', message: 'System update', read: false },
];

const server = setupServer(
  http.get('/api/v1/notifications/unread-count', () => {
    return HttpResponse.json(mockUnreadCount);
  }),
  http.get('/api/v1/notifications', () => {
    return HttpResponse.json(mockNotifications);
  }),
  http.post('/api/v1/notifications/read-all', () => {
    return HttpResponse.json({ success: true });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('NotificationDropdown Integration', () => {
  it('renders unread badge with count from API', async () => {
    render(<NotificationDropdown />);
    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('opens the dropdown and renders notifications', async () => {
    const user = userEvent.setup();
    render(<NotificationDropdown />);
    
    // Ensure component mounts and badge appears
    await screen.findByText('3');
    
    const toggleButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(toggleButton);

    expect(await screen.findByText('New message from Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob liked your post')).toBeInTheDocument();
    expect(screen.getByText('System update')).toBeInTheDocument();
  });

  it('handles clicking "Mark all as read" with optimistic UI update', async () => {
    const user = userEvent.setup();
    render(<NotificationDropdown />);
    
    await screen.findByText('3');
    
    const toggleButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(toggleButton);
    
    await screen.findByText('New message from Alice');
    
    const markAllReadButton = screen.getByRole('button', { name: /mark all as read/i });
    await user.click(markAllReadButton);
    
    await waitFor(() => {
      expect(screen.queryByText('3')).not.toBeInTheDocument();
    });
  });

  it('should have no accessibility violations', async () => {
    const { container } = render(<NotificationDropdown />);
    
    await screen.findByText('3');
    
    let results = await axe(container);
    expect(results).toHaveNoViolations();
    
    const user = userEvent.setup();
    const toggleButton = screen.getByRole('button', { name: /notifications/i });
    await user.click(toggleButton);
    
    await screen.findByText('New message from Alice');
    
    results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<NotificationDropdown />);
    
    await screen.findByText('3');
    
    const toggleButton = screen.getByRole('button', { name: /notifications/i });
    
    toggleButton.focus();
    expect(toggleButton).toHaveFocus();
    
    await user.keyboard('{Enter}');
    
    await screen.findByText('New message from Alice');
    
    await user.tab();
    const markAllReadButton = screen.getByRole('button', { name: /mark all as read/i });
    expect(markAllReadButton).toHaveFocus();
  });
});
