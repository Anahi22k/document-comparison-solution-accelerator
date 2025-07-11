import React, { useState, useRef, useContext } from 'react'
import { Stack, DefaultButton, PrimaryButton, MessageBar, MessageBarType, ProgressIndicator, Text } from '@fluentui/react'
import { DocumentRegular, ArrowUploadRegular } from '@fluentui/react-icons'
import styles from './Compare.module.css'
import { AppStateContext } from '../../state/AppProvider'

interface DocumentAnalysis {
  filename: string
  content: string
  pages: Array<{
    page_number: number
    content: string
    width: number
    height: number
  }>
  tables: Array<{
    row_count: number
    column_count: number
    cells: Array<{
      content: string
      row_index: number
      column_index: number
      row_span: number
      column_span: number
    }>
  }>
  page_count: number
}

interface ComparisonResult {
  document1: {
    filename: string
    page_count: number
    table_count: number
    content_length: number
  }
  document2: {
    filename: string
    page_count: number
    table_count: number
    content_length: number
  }
  similarity_score: number
  differences: {
    added_content: string[]
    removed_content: string[]
    common_content_count: number
    total_added: number
    total_removed: number
  }
  structure_comparison: {
    page_count_diff: number
    table_count_diff: number
    doc1_pages: number
    doc2_pages: number
    doc1_tables: number
    doc2_tables: number
  }
  summary: string
}

const Compare: React.FC = () => {
  const appStateContext = useContext(AppStateContext)
  const ui = appStateContext?.state.frontendSettings?.ui

  const [doc1File, setDoc1File] = useState<File | null>(null)
  const [doc2File, setDoc2File] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string>('')

  const doc1InputRef = useRef<HTMLInputElement>(null)
  const doc2InputRef = useRef<HTMLInputElement>(null)

  const handleDoc1Upload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setDoc1File(file)
      setError(null)
    }
  }

  const handleDoc2Upload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setDoc2File(file)
      setError(null)
    }
  }

  const validateFiles = (): boolean => {
    if (!doc1File || !doc2File) {
      setError('Please select both documents to compare')
      return false
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'text/plain']
    
    if (!allowedTypes.includes(doc1File.type) || !allowedTypes.includes(doc2File.type)) {
      setError('Please upload PDF, image (JPEG, PNG, TIFF), or text files only')
      return false
    }

    const maxSize = 20 * 1024 * 1024 // 20MB
    if (doc1File.size > maxSize || doc2File.size > maxSize) {
      setError('File size must be less than 20MB')
      return false
    }

    return true
  }

  const compareDocuments = async () => {
    if (!validateFiles()) return

    setIsUploading(true)
    setError(null)
    setComparisonResult(null)
    setUploadProgress('Uploading documents...')

    try {
      const formData = new FormData()
      formData.append('document1', doc1File!)
      formData.append('document2', doc2File!)

      setUploadProgress('Analyzing documents with Azure Document Intelligence...')

      const response = await fetch('/api/compare/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to compare documents')
      }

      setUploadProgress('Generating comparison results...')
      
      setTimeout(() => {
        setComparisonResult(result.comparison)
        setUploadProgress('')
      }, 500)

    } catch (err) {
      console.error('Error comparing documents:', err)
      setError(err instanceof Error ? err.message : 'An error occurred while comparing documents')
    } finally {
      setIsUploading(false)
    }
  }

  const resetComparison = () => {
    setDoc1File(null)
    setDoc2File(null)
    setComparisonResult(null)
    setError(null)
    setUploadProgress('')
    if (doc1InputRef.current) doc1InputRef.current.value = ''
    if (doc2InputRef.current) doc2InputRef.current.value = ''
  }

  const getSimilarityColor = (score: number): string => {
    if (score >= 0.8) return '#107C10' // Green
    if (score >= 0.5) return '#FF8C00' // Orange
    return '#D13438' // Red
  }

  const formatPercentage = (score: number): string => {
    return `${(score * 100).toFixed(1)}%`
  }

  return (
    <div className={styles.compareContainer}>
      <Stack className={styles.compareHeader}>
        <div className={styles.headerContent}>
          <DocumentRegular className={styles.headerIcon} />
          <div>
            <Text variant="xxLarge" className={styles.title}>
              Document Comparison
            </Text>
            <Text variant="large" className={styles.subtitle}>
              Compare two documents and identify their differences using AI
            </Text>
          </div>
        </div>
      </Stack>

      {!comparisonResult && (
        <Stack className={styles.uploadSection}>
          <div className={styles.uploadArea}>
            <div className={styles.uploadBox}>
              <Text variant="large" className={styles.uploadTitle}>Document 1 (Template)</Text>
              <div 
                className={`${styles.dropZone} ${doc1File ? styles.hasFile : ''}`}
                onClick={() => doc1InputRef.current?.click()}
              >
                <ArrowUploadRegular className={styles.uploadIcon} />
                <Text variant="medium">
                  {doc1File ? doc1File.name : 'Click to upload or drag and drop'}
                </Text>
                <Text variant="small" className={styles.fileInfo}>
                  PDF, Images (JPEG, PNG, TIFF), or Text files up to 20MB
                </Text>
              </div>
              <input
                ref={doc1InputRef}
                type="file"
                onChange={handleDoc1Upload}
                accept=".pdf,.jpg,.jpeg,.png,.tiff,.txt"
                style={{ display: 'none' }}
              />
            </div>

            <div className={styles.uploadBox}>
              <Text variant="large" className={styles.uploadTitle}>Document 2 (Comparison)</Text>
              <div 
                className={`${styles.dropZone} ${doc2File ? styles.hasFile : ''}`}
                onClick={() => doc2InputRef.current?.click()}
              >
                <ArrowUploadRegular className={styles.uploadIcon} />
                <Text variant="medium">
                  {doc2File ? doc2File.name : 'Click to upload or drag and drop'}
                </Text>
                <Text variant="small" className={styles.fileInfo}>
                  PDF, Images (JPEG, PNG, TIFF), or Text files up to 20MB
                </Text>
              </div>
              <input
                ref={doc2InputRef}
                type="file"
                onChange={handleDoc2Upload}
                accept=".pdf,.jpg,.jpeg,.png,.tiff,.txt"
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {error && (
            <MessageBar messageBarType={MessageBarType.error} className={styles.errorMessage}>
              {error}
            </MessageBar>
          )}

          {isUploading && (
            <div className={styles.progressSection}>
              <ProgressIndicator label={uploadProgress} />
            </div>
          )}

          <Stack horizontal horizontalAlign="center" className={styles.buttonSection}>
            <PrimaryButton
              text="Compare Documents"
              onClick={compareDocuments}
              disabled={!doc1File || !doc2File || isUploading}
              className={styles.compareButton}
            />
            <DefaultButton
              text="Reset"
              onClick={resetComparison}
              disabled={isUploading}
            />
          </Stack>
        </Stack>
      )}

      {comparisonResult && (
        <Stack className={styles.resultsSection}>
          <div className={styles.resultHeader}>
            <Text variant="xLarge" className={styles.resultTitle}>Comparison Results</Text>
            <DefaultButton text="New Comparison" onClick={resetComparison} />
          </div>

          <div className={styles.summaryCard}>
            <Text variant="large" className={styles.summaryTitle}>Summary</Text>
            <Text variant="medium" className={styles.summaryText}>
              {comparisonResult.summary}
            </Text>
            <div className={styles.similarityScore}>
              <Text variant="large">
                Similarity Score: 
                <span style={{ color: getSimilarityColor(comparisonResult.similarity_score), fontWeight: 'bold' }}>
                  {' '}{formatPercentage(comparisonResult.similarity_score)}
                </span>
              </Text>
            </div>
          </div>

          <div className={styles.detailsSection}>
            <div className={styles.detailCard}>
              <Text variant="large" className={styles.cardTitle}>Document Information</Text>
              <div className={styles.docInfo}>
                <div className={styles.docColumn}>
                  <Text variant="medium" className={styles.docName}>📄 {comparisonResult.document1.filename}</Text>
                  <Text variant="small">Pages: {comparisonResult.document1.page_count}</Text>
                  <Text variant="small">Tables: {comparisonResult.document1.table_count}</Text>
                  <Text variant="small">Content Length: {comparisonResult.document1.content_length.toLocaleString()} characters</Text>
                </div>
                <div className={styles.docColumn}>
                  <Text variant="medium" className={styles.docName}>📄 {comparisonResult.document2.filename}</Text>
                  <Text variant="small">Pages: {comparisonResult.document2.page_count}</Text>
                  <Text variant="small">Tables: {comparisonResult.document2.table_count}</Text>
                  <Text variant="small">Content Length: {comparisonResult.document2.content_length.toLocaleString()} characters</Text>
                </div>
              </div>
            </div>

            <div className={styles.detailCard}>
              <Text variant="large" className={styles.cardTitle}>Content Differences</Text>
              <div className={styles.differencesGrid}>
                <div className={styles.diffSection}>
                  <Text variant="medium" className={styles.diffTitle}>
                    ➕ Added Content ({comparisonResult.differences.total_added} items)
                  </Text>
                  {comparisonResult.differences.added_content.length > 0 ? (
                    <div className={styles.contentList}>
                      {comparisonResult.differences.added_content.map((content, index) => (
                        <div key={index} className={styles.contentItem}>
                          {content}
                        </div>
                      ))}
                      {comparisonResult.differences.total_added > comparisonResult.differences.added_content.length && (
                        <Text variant="small" className={styles.moreItems}>
                          ... and {comparisonResult.differences.total_added - comparisonResult.differences.added_content.length} more
                        </Text>
                      )}
                    </div>
                  ) : (
                    <Text variant="small" className={styles.noContent}>No additional content found</Text>
                  )}
                </div>

                <div className={styles.diffSection}>
                  <Text variant="medium" className={styles.diffTitle}>
                    ➖ Removed Content ({comparisonResult.differences.total_removed} items)
                  </Text>
                  {comparisonResult.differences.removed_content.length > 0 ? (
                    <div className={styles.contentList}>
                      {comparisonResult.differences.removed_content.map((content, index) => (
                        <div key={index} className={styles.contentItem}>
                          {content}
                        </div>
                      ))}
                      {comparisonResult.differences.total_removed > comparisonResult.differences.removed_content.length && (
                        <Text variant="small" className={styles.moreItems}>
                          ... and {comparisonResult.differences.total_removed - comparisonResult.differences.removed_content.length} more
                        </Text>
                      )}
                    </div>
                  ) : (
                    <Text variant="small" className={styles.noContent}>No removed content found</Text>
                  )}
                </div>
              </div>
              <Text variant="small" className={styles.commonContent}>
                ✓ {comparisonResult.differences.common_content_count} common content sections found
              </Text>
            </div>
          </div>
        </Stack>
      )}
    </div>
  )
}

export default Compare
