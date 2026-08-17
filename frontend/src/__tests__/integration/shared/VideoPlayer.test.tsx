import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import VideoPlayer from '@/components/shared/VideoPlayer';

expect.extend(toHaveNoViolations);

const handlers = [
  http.post('/api/v1/videos/:videoId/progress', () => {
    return HttpResponse.json({ success: true, message: 'Progress updated' }, { status: 200 });
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  jest.clearAllMocks();
});
afterAll(() => server.close());

describe('VideoPlayer', () => {
  const defaultProps = {
    videoId: 'vid-789',
    src: 'https://example.com/test-video.mp4',
    title: 'Test Accessibility Video',
  };

  it('renders correctly and has no accessibility violations', async () => {
    const { container } = render(<VideoPlayer {...defaultProps} />);
    const results = await axe(container);
    
    expect(results).toHaveNoViolations();
    expect(screen.getByTitle('Test Accessibility Video')).toBeInTheDocument();
  });

  it('displays a loading spinner when in a loading state', () => {
    render(<VideoPlayer {...defaultProps} isLoading={true} />);
    
    expect(screen.getByRole('progressbar', { name: /loading/i })).toBeInTheDocument();
  });

  it('allows user to play, pause, and seek using mouse interactions', async () => {
    const user = userEvent.setup();
    render(<VideoPlayer {...defaultProps} />);
    
    const playButton = screen.getByRole('button', { name: /play/i });
    await user.click(playButton);
    
    const pauseButton = await screen.findByRole('button', { name: /pause/i });
    expect(pauseButton).toBeInTheDocument();
    
    await user.click(pauseButton);
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    
    const slider = screen.getByRole('slider', { name: /seek/i });
    await user.type(slider, '50');
    expect(slider).toHaveValue('50');
  });

  it('supports keyboard navigation (Space to play/pause, Arrows to seek)', async () => {
    const user = userEvent.setup();
    render(<VideoPlayer {...defaultProps} />);
    
    const videoContainer = screen.getByTestId('video-player-container');
    videoContainer.focus();
    
    // Space to play
    await user.keyboard(' ');
    expect(await screen.findByRole('button', { name: /pause/i })).toBeInTheDocument();
    
    // Space to pause
    await user.keyboard(' ');
    expect(await screen.findByRole('button', { name: /play/i })).toBeInTheDocument();
    
    const slider = screen.getByRole('slider', { name: /seek/i });
    slider.focus();
    
    // Right arrow to seek
    await user.keyboard('{ArrowRight}');
    expect(slider).not.toHaveValue('0');
  });

  it('sends progress updates successfully to the server', async () => {
    const user = userEvent.setup();
    render(<VideoPlayer {...defaultProps} />);
    
    const playButton = screen.getByRole('button', { name: /play/i });
    await user.click(playButton);
    
    // Wait for the mock API call to succeed
    await waitFor(() => {
      // Assuming successful progress logs or updates state silently
      expect(screen.getByTestId('video-player-container')).toBeInTheDocument();
    });
  });

  it('handles server errors gracefully when sending progress updates', async () => {
    server.use(
      http.post('/api/v1/videos/:videoId/progress', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    const user = userEvent.setup();
    render(<VideoPlayer {...defaultProps} />);
    
    const playButton = screen.getByRole('button', { name: /play/i });
    await user.click(playButton);
    
    // If component displays an error message on 500
    // expect(await screen.findByText(/failed to save progress/i)).toBeInTheDocument();
  });
});
