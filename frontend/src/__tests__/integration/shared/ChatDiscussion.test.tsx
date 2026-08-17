import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import ChatDiscussion from '@/components/chat/ChatDiscussion';

expect.extend(toHaveNoViolations);

const mockMessages = [
  { id: '1', content: 'Hello everyone!', author: 'Alice', role: 'student', isPinned: false, createdAt: '2026-08-07T09:00:00Z' },
  { id: '2', content: 'Welcome to the class.', author: 'Mr. Smith', role: 'teacher', isPinned: true, createdAt: '2026-08-07T09:05:00Z' },
];

const server = setupServer(
  http.get('/api/v1/chat/:courseId/messages', () => {
    return HttpResponse.json(mockMessages);
  }),
  http.post('/api/v1/chat/:courseId/messages', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: '3',
      content: (body as any).content,
      author: 'CurrentUser',
      role: 'student',
      isPinned: false,
      createdAt: new Date().toISOString(),
    });
  }),
  http.post('/api/v1/chat/:courseId/messages/:messageId/pin', () => {
    return HttpResponse.json({ success: true });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  jest.clearAllMocks();
});
afterAll(() => server.close());

const renderComponent = (props = {}) => {
  return render(
    <ChatDiscussion courseId="course-123" currentUserRole="student" {...props} />
  );
};

describe('ChatDiscussion', () => {
  it('renders loading state initially and then displays messages', async () => {
    renderComponent();
    expect(screen.getByRole('status', { name: /loading messages/i })).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /loading messages/i })).not.toBeInTheDocument();
    });

    expect(screen.getByText('Hello everyone!')).toBeInTheDocument();
    expect(screen.getByText('Welcome to the class.')).toBeInTheDocument();
  });

  it('sends a new message successfully', async () => {
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /loading messages/i })).not.toBeInTheDocument();
    });

    const input = screen.getByRole('textbox', { name: /type a message/i });
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'This is a new test message');
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('This is a new test message')).toBeInTheDocument();
    });
  });

  it('handles slow-mode (429 response) gracefully', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/v1/chat/:courseId/messages', () => {
        return HttpResponse.json({ error: 'Slow mode active. Please wait.' }, { status: 429 });
      })
    );

    renderComponent();
    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /loading messages/i })).not.toBeInTheDocument();
    });

    const input = screen.getByRole('textbox', { name: /type a message/i });
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'Spam message');
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText(/slow mode active/i)).toBeInTheDocument();
    });
  });

  it('allows teacher to pin a message', async () => {
    const user = userEvent.setup();
    renderComponent({ currentUserRole: 'teacher' });

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /loading messages/i })).not.toBeInTheDocument();
    });

    const message1 = screen.getByText('Hello everyone!').closest('li');
    const pinButton = within(message1!).getByRole('button', { name: /pin message/i });

    await user.click(pinButton);

    await waitFor(() => {
      expect(screen.getByText(/message pinned successfully/i)).toBeInTheDocument();
    });
  });

  it('supports keyboard navigation for sending messages', async () => {
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /loading messages/i })).not.toBeInTheDocument();
    });

    const input = screen.getByRole('textbox', { name: /type a message/i });
    input.focus();
    expect(input).toHaveFocus();

    await user.keyboard('Testing Enter key');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Testing Enter key')).toBeInTheDocument();
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = renderComponent();
    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /loading messages/i })).not.toBeInTheDocument();
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders correctly in dark mode', async () => {
    // Assuming dark mode is controlled via a wrapper or class on body
    document.body.classList.add('dark');
    renderComponent({ theme: 'dark' });
    
    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /loading messages/i })).not.toBeInTheDocument();
    });
    
    const chatContainer = screen.getByTestId('chat-container');
    expect(chatContainer).toHaveClass('dark');
    document.body.classList.remove('dark');
  });

  it('displays error state on 500 response during initial load', async () => {
    server.use(
      http.get('/api/v1/chat/:courseId/messages', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    renderComponent();
    await waitFor(() => {
      expect(screen.getByText(/failed to load messages/i)).toBeInTheDocument();
    });
  });
});
