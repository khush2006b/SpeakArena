import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import CourseCurriculum from '@/features/student/components/CourseCurriculum';

expect.extend(toHaveNoViolations);

const mockCourseData = {
  id: 'course-123',
  title: 'SpeakArena Mastery',
  sections: [
    {
      id: 'section-1',
      title: 'Module 1: Basics',
      lessons: [
        { id: 'lesson-1', title: 'What is Public Speaking?', isLocked: false },
        { id: 'lesson-2', title: 'Overcoming Fear', isLocked: false },
      ],
    },
    {
      id: 'section-2',
      title: 'Module 2: Advanced Techniques',
      lessons: [
        { id: 'lesson-3', title: 'Vocal Variety', isLocked: true },
        { id: 'lesson-4', title: 'Body Language', isLocked: true },
      ],
    },
  ],
};

const server = setupServer(
  http.get('/api/v1/courses/:courseId', () => {
    return HttpResponse.json(mockCourseData);
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  jest.clearAllMocks();
});
afterAll(() => server.close());

const mockToast = jest.fn();
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('CourseCurriculum Integration Tests', () => {
  const renderComponent = () => render(<CourseCurriculum courseId="course-123" />);

  it('renders course outline and sections after loading', async () => {
    renderComponent();

    // Test Loading State
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Module 1: Basics')).toBeInTheDocument();
    expect(screen.getByText('Module 2: Advanced Techniques')).toBeInTheDocument();
  });

  it('expands and collapses a section on click', async () => {
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Module 1: Basics')).toBeInTheDocument();
    });

    const sectionButton = screen.getByRole('button', { name: /Module 1: Basics/i });
    
    await user.click(sectionButton);

    const lesson1 = screen.getByText('What is Public Speaking?');
    expect(lesson1).toBeVisible();

    await user.click(sectionButton);
    
    await waitFor(() => {
      expect(lesson1).not.toBeVisible();
    });
  });

  it('prevents navigation and shows toast when clicking a locked lesson', async () => {
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Module 2: Advanced Techniques')).toBeInTheDocument();
    });

    const section2Button = screen.getByRole('button', { name: /Module 2: Advanced Techniques/i });
    await user.click(section2Button);

    const lockedLesson = screen.getByText('Vocal Variety');
    await user.click(lockedLesson);

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.any(String),
      description: expect.stringMatching(/locked/i),
    }));
  });

  it('has no accessibility violations', async () => {
    const { container } = renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Module 1: Basics')).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('supports keyboard navigation for sections', async () => {
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Module 1: Basics')).toBeInTheDocument();
    });

    const section1Button = screen.getByRole('button', { name: /Module 1: Basics/i });
    section1Button.focus();
    expect(section1Button).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByText('What is Public Speaking?')).toBeVisible();
  });

  it('handles error state gracefully when fetching curriculum fails', async () => {
    server.use(
      http.get('/api/v1/courses/:courseId', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/failed to load curriculum/i)).toBeInTheDocument();
    });
  });
});
