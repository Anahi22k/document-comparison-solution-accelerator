import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Compare from './Compare'
import { AppStateProvider } from '../../state/AppProvider'

// Mock fetch
global.fetch = jest.fn()

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AppStateProvider>
        {component}
      </AppStateProvider>
    </BrowserRouter>
  )
}

describe('Compare Component', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear()
  })

  test('renders compare page with upload areas', () => {
    renderWithProviders(<Compare />)
    
    expect(screen.getByText('Document Comparison')).toBeInTheDocument()
    expect(screen.getByText('Document 1 (Template)')).toBeInTheDocument()
    expect(screen.getByText('Document 2 (Comparison)')).toBeInTheDocument()
    expect(screen.getByText('Compare Documents')).toBeInTheDocument()
  })

  test('enables compare button when both files are selected', async () => {
    renderWithProviders(<Compare />)
    
    const compareButton = screen.getByText('Compare Documents')
    expect(compareButton).toBeDisabled()

    // Create mock files
    const file1 = new File(['test content'], 'test1.pdf', { type: 'application/pdf' })
    const file2 = new File(['test content'], 'test2.pdf', { type: 'application/pdf' })

    // Find file inputs
    const fileInputs = screen.getAllByDisplayValue('')
    
    // Simulate file uploads
    fireEvent.change(fileInputs[0], { target: { files: [file1] } })
    fireEvent.change(fileInputs[1], { target: { files: [file2] } })

    await waitFor(() => {
      expect(compareButton).not.toBeDisabled()
    })
  })

  test('shows error for invalid file types', async () => {
    renderWithProviders(<Compare />)
    
    const compareButton = screen.getByText('Compare Documents')

    // Create mock files with invalid types
    const file1 = new File(['test'], 'test1.exe', { type: 'application/exe' })
    const file2 = new File(['test'], 'test2.pdf', { type: 'application/pdf' })

    const fileInputs = screen.getAllByDisplayValue('')
    
    fireEvent.change(fileInputs[0], { target: { files: [file1] } })
    fireEvent.change(fileInputs[1], { target: { files: [file2] } })

    fireEvent.click(compareButton)

    await waitFor(() => {
      expect(screen.getByText(/Please upload PDF, image/)).toBeInTheDocument()
    })
  })

  test('handles successful document comparison', async () => {
    const mockResponse = {
      success: true,
      comparison: {
        document1: {
          filename: 'test1.pdf',
          page_count: 1,
          table_count: 0,
          content_length: 100
        },
        document2: {
          filename: 'test2.pdf',
          page_count: 1,
          table_count: 0,
          content_length: 120
        },
        similarity_score: 0.85,
        differences: {
          added_content: ['New sentence'],
          removed_content: [],
          common_content_count: 10,
          total_added: 1,
          total_removed: 0
        },
        structure_comparison: {
          page_count_diff: 0,
          table_count_diff: 0,
          doc1_pages: 1,
          doc2_pages: 1,
          doc1_tables: 0,
          doc2_tables: 0
        },
        summary: 'The documents are 85.0% similar in content.'
      }
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    renderWithProviders(<Compare />)
    
    const file1 = new File(['test'], 'test1.pdf', { type: 'application/pdf' })
    const file2 = new File(['test'], 'test2.pdf', { type: 'application/pdf' })

    const fileInputs = screen.getAllByDisplayValue('')
    
    fireEvent.change(fileInputs[0], { target: { files: [file1] } })
    fireEvent.change(fileInputs[1], { target: { files: [file2] } })

    const compareButton = screen.getByText('Compare Documents')
    fireEvent.click(compareButton)

    await waitFor(() => {
      expect(screen.getByText('Comparison Results')).toBeInTheDocument()
      expect(screen.getByText('85.0%')).toBeInTheDocument()
      expect(screen.getByText('The documents are 85.0% similar in content.')).toBeInTheDocument()
    })
  })

  test('handles comparison error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Processing failed' })
    })

    renderWithProviders(<Compare />)
    
    const file1 = new File(['test'], 'test1.pdf', { type: 'application/pdf' })
    const file2 = new File(['test'], 'test2.pdf', { type: 'application/pdf' })

    const fileInputs = screen.getAllByDisplayValue('')
    
    fireEvent.change(fileInputs[0], { target: { files: [file1] } })
    fireEvent.change(fileInputs[1], { target: { files: [file2] } })

    const compareButton = screen.getByText('Compare Documents')
    fireEvent.click(compareButton)

    await waitFor(() => {
      expect(screen.getByText(/Processing failed/)).toBeInTheDocument()
    })
  })

  test('allows reset after comparison', async () => {
    renderWithProviders(<Compare />)
    
    // First complete a comparison
    const mockResponse = {
      success: true,
      comparison: {
        document1: { filename: 'test1.pdf', page_count: 1, table_count: 0, content_length: 100 },
        document2: { filename: 'test2.pdf', page_count: 1, table_count: 0, content_length: 120 },
        similarity_score: 0.85,
        differences: { added_content: [], removed_content: [], common_content_count: 10, total_added: 0, total_removed: 0 },
        structure_comparison: { page_count_diff: 0, table_count_diff: 0, doc1_pages: 1, doc2_pages: 1, doc1_tables: 0, doc2_tables: 0 },
        summary: 'Test summary'
      }
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const file1 = new File(['test'], 'test1.pdf', { type: 'application/pdf' })
    const file2 = new File(['test'], 'test2.pdf', { type: 'application/pdf' })

    const fileInputs = screen.getAllByDisplayValue('')
    
    fireEvent.change(fileInputs[0], { target: { files: [file1] } })
    fireEvent.change(fileInputs[1], { target: { files: [file2] } })

    fireEvent.click(screen.getByText('Compare Documents'))

    await waitFor(() => {
      expect(screen.getByText('Comparison Results')).toBeInTheDocument()
    })

    // Now test reset
    const newComparisonButton = screen.getByText('New Comparison')
    fireEvent.click(newComparisonButton)

    await waitFor(() => {
      expect(screen.getByText('Compare Documents')).toBeInTheDocument()
      expect(screen.queryByText('Comparison Results')).not.toBeInTheDocument()
    })
  })
})
