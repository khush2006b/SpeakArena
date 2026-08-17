import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import PDFReader from '@/components/shared/PDFReader';

expect.extend(toHaveNoViolations);

// Mocking react-pdf
jest.mock('react-pdf', () => {
  const { forwardRef } = require('react');
  
  return {
    pdfjs: {
      GlobalWorkerOptions: {
        workerSrc: 'worker.js',
      },
    },
    Document: ({ children, onLoadSuccess, onLoadError, file }: any) => {
      if (file === 'error.pdf') {
        setTimeout(() => onLoadError(new Error('Failed to load PDF document.')), 0);
        return <div data-testid="pdf-document-error">Failed to load PDF document.</div>;
      }
      setTimeout(() => {
        onLoadSuccess({ numPages: 3 });
      }, 0);
      return <div data-testid="pdf-document">{children}</div>;
    },
    Page: forwardRef(({ pageNumber }: any, ref: any) => (
      <div data-testid="pdf-page" ref={ref}>
        Page {pageNumber}
      </div>
    )),
  };
});

describe('PDFReader Component', () => {
  const mockFile = 'sample.pdf';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(<PDFReader file={mockFile} />);
    expect(screen.getByRole('progressbar', { name: /loading pdf/i })).toBeInTheDocument();
  });

  it('renders document and first page successfully', async () => {
    render(<PDFReader file={mockFile} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('pdf-document')).toBeInTheDocument();
    });
    
    expect(screen.getByTestId('pdf-page')).toHaveTextContent('Page 1');
    expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
  });

  it('handles next and previous page interactions', async () => {
    const user = userEvent.setup();
    render(<PDFReader file={mockFile} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('pdf-page')).toHaveTextContent('Page 1');
    });

    const nextBtn = screen.getByRole('button', { name: /next page/i });
    const prevBtn = screen.getByRole('button', { name: /previous page/i });

    // Previous button should be disabled on first page
    expect(prevBtn).toBeDisabled();

    // Go to next page
    await user.click(nextBtn);
    expect(screen.getByTestId('pdf-page')).toHaveTextContent('Page 2');
    expect(prevBtn).not.toBeDisabled();

    // Go to next page
    await user.click(nextBtn);
    expect(screen.getByTestId('pdf-page')).toHaveTextContent('Page 3');
    
    // Next button should be disabled on last page
    expect(nextBtn).toBeDisabled();

    // Go to previous page
    await user.click(prevBtn);
    expect(screen.getByTestId('pdf-page')).toHaveTextContent('Page 2');
  });

  it('handles keyboard navigation (ArrowRight and ArrowLeft)', async () => {
    const user = userEvent.setup();
    render(<PDFReader file={mockFile} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('pdf-page')).toHaveTextContent('Page 1');
    });

    // Press ArrowRight to go to next page
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('pdf-page')).toHaveTextContent('Page 2');

    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('pdf-page')).toHaveTextContent('Page 3');

    // Trying to go beyond last page should stay on page 3
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('pdf-page')).toHaveTextContent('Page 3');

    // Press ArrowLeft to go to previous page
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByTestId('pdf-page')).toHaveTextContent('Page 2');
  });

  it('displays error state if PDF fails to load', async () => {
    render(<PDFReader file="error.pdf" />);
    
    await waitFor(() => {
      expect(screen.getByText(/failed to load pdf document/i)).toBeInTheDocument();
    });
  });

  it('passes accessibility tests', async () => {
    const { container } = render(<PDFReader file={mockFile} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('pdf-document')).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
