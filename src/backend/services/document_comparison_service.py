"""
Document comparison service using Azure Document Intelligence
"""
import logging
import tempfile
import uuid
from typing import Dict, Any, List, Tuple
from io import BytesIO

from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
from azure.identity import DefaultAzureCredential
from backend.settings import app_settings

logger = logging.getLogger(__name__)


class DocumentComparisonService:
    """Service for comparing documents using Azure Document Intelligence"""
    
    def __init__(self):
        """Initialize the Document Intelligence client"""
        self.endpoint = app_settings.azure_document_intelligence.endpoint
        
        # Use managed identity if available, otherwise use key
        try:
            credential = DefaultAzureCredential()
            self.client = DocumentAnalysisClient(
                endpoint=self.endpoint,
                credential=credential
            )
            logger.info("Document Intelligence client initialized with managed identity")
        except Exception as e:
            logger.warning(f"Failed to initialize with managed identity: {e}")
            # Fallback to key-based authentication if needed
            if app_settings.azure_document_intelligence.key:
                credential = AzureKeyCredential(app_settings.azure_document_intelligence.key)
                self.client = DocumentAnalysisClient(
                    endpoint=self.endpoint,
                    credential=credential
                )
                logger.info("Document Intelligence client initialized with API key")
            else:
                raise Exception("No valid authentication method found for Document Intelligence")
    
    async def analyze_document(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """
        Analyze a document and extract text content
        
        Args:
            file_content: The document content as bytes
            filename: The name of the file
            
        Returns:
            Dictionary containing extracted text and metadata
        """
        try:
            # Use the general read model for text extraction
            poller = self.client.begin_analyze_document(
                "prebuilt-read", 
                document=BytesIO(file_content)
            )
            result = poller.result()
            
            # Extract text content
            content = result.content if result.content else ""
            
            # Extract pages with their content
            pages = []
            for page in result.pages:
                page_content = ""
                if page.lines:
                    page_content = "\n".join([line.content for line in page.lines])
                
                pages.append({
                    "page_number": page.page_number,
                    "content": page_content,
                    "width": page.width,
                    "height": page.height
                })
            
            # Extract tables if any
            tables = []
            if result.tables:
                for table in result.tables:
                    table_data = []
                    for cell in table.cells:
                        table_data.append({
                            "content": cell.content,
                            "row_index": cell.row_index,
                            "column_index": cell.column_index,
                            "row_span": cell.row_span,
                            "column_span": cell.column_span
                        })
                    tables.append({
                        "row_count": table.row_count,
                        "column_count": table.column_count,
                        "cells": table_data
                    })
            
            return {
                "filename": filename,
                "content": content,
                "pages": pages,
                "tables": tables,
                "page_count": len(pages)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing document {filename}: {str(e)}")
            raise Exception(f"Failed to analyze document: {str(e)}")
    
    def compare_documents(self, doc1_analysis: Dict[str, Any], doc2_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compare two analyzed documents and identify differences
        
        Args:
            doc1_analysis: Analysis result from first document
            doc2_analysis: Analysis result from second document
            
        Returns:
            Dictionary containing comparison results
        """
        try:
            # Basic text comparison
            doc1_content = doc1_analysis.get("content", "")
            doc2_content = doc2_analysis.get("content", "")
            
            # Calculate similarity metrics
            similarity_score = self._calculate_text_similarity(doc1_content, doc2_content)
            
            # Find differences at sentence level
            doc1_sentences = self._split_into_sentences(doc1_content)
            doc2_sentences = self._split_into_sentences(doc2_content)
            
            # Find added, removed, and common sentences
            added_sentences = []
            removed_sentences = []
            common_sentences = []
            
            doc1_sentence_set = set(doc1_sentences)
            doc2_sentence_set = set(doc2_sentences)
            
            added_sentences = list(doc2_sentence_set - doc1_sentence_set)
            removed_sentences = list(doc1_sentence_set - doc2_sentence_set)
            common_sentences = list(doc1_sentence_set & doc2_sentence_set)
            
            # Compare structure (pages, tables)
            structure_comparison = {
                "page_count_diff": doc2_analysis.get("page_count", 0) - doc1_analysis.get("page_count", 0),
                "table_count_diff": len(doc2_analysis.get("tables", [])) - len(doc1_analysis.get("tables", [])),
                "doc1_pages": doc1_analysis.get("page_count", 0),
                "doc2_pages": doc2_analysis.get("page_count", 0),
                "doc1_tables": len(doc1_analysis.get("tables", [])),
                "doc2_tables": len(doc2_analysis.get("tables", []))
            }
            
            return {
                "document1": {
                    "filename": doc1_analysis.get("filename", "Document 1"),
                    "page_count": doc1_analysis.get("page_count", 0),
                    "table_count": len(doc1_analysis.get("tables", [])),
                    "content_length": len(doc1_content)
                },
                "document2": {
                    "filename": doc2_analysis.get("filename", "Document 2"),
                    "page_count": doc2_analysis.get("page_count", 0),
                    "table_count": len(doc2_analysis.get("tables", [])),
                    "content_length": len(doc2_content)
                },
                "similarity_score": similarity_score,
                "differences": {
                    "added_content": added_sentences[:10],  # Limit to first 10 for display
                    "removed_content": removed_sentences[:10],  # Limit to first 10 for display
                    "common_content_count": len(common_sentences),
                    "total_added": len(added_sentences),
                    "total_removed": len(removed_sentences)
                },
                "structure_comparison": structure_comparison,
                "summary": self._generate_comparison_summary(
                    similarity_score, 
                    len(added_sentences), 
                    len(removed_sentences),
                    structure_comparison
                )
            }
            
        except Exception as e:
            logger.error(f"Error comparing documents: {str(e)}")
            raise Exception(f"Failed to compare documents: {str(e)}")
    
    def _calculate_text_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity between two texts using simple word overlap"""
        if not text1 and not text2:
            return 1.0
        if not text1 or not text2:
            return 0.0
        
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        intersection = words1 & words2
        union = words1 | words2
        
        if len(union) == 0:
            return 1.0
        
        return len(intersection) / len(union)
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences"""
        import re
        # Simple sentence splitting - could be enhanced with more sophisticated NLP
        sentences = re.split(r'[.!?]+', text)
        return [s.strip() for s in sentences if s.strip()]
    
    def _generate_comparison_summary(self, similarity_score: float, added_count: int, 
                                   removed_count: int, structure_diff: Dict[str, Any]) -> str:
        """Generate a human-readable summary of the comparison"""
        similarity_percent = round(similarity_score * 100, 1)
        
        summary_parts = [f"The documents are {similarity_percent}% similar in content."]
        
        if added_count > 0:
            summary_parts.append(f"Document 2 contains {added_count} additional sentence(s) not found in Document 1.")
        
        if removed_count > 0:
            summary_parts.append(f"Document 2 is missing {removed_count} sentence(s) that are present in Document 1.")
        
        page_diff = structure_diff.get("page_count_diff", 0)
        if page_diff > 0:
            summary_parts.append(f"Document 2 has {page_diff} more page(s) than Document 1.")
        elif page_diff < 0:
            summary_parts.append(f"Document 2 has {abs(page_diff)} fewer page(s) than Document 1.")
        
        table_diff = structure_diff.get("table_count_diff", 0)
        if table_diff > 0:
            summary_parts.append(f"Document 2 has {table_diff} more table(s) than Document 1.")
        elif table_diff < 0:
            summary_parts.append(f"Document 2 has {abs(table_diff)} fewer table(s) than Document 1.")
        
        if similarity_score > 0.8:
            summary_parts.append("The documents are very similar.")
        elif similarity_score > 0.5:
            summary_parts.append("The documents have moderate similarity.")
        else:
            summary_parts.append("The documents are quite different.")
        
        return " ".join(summary_parts)


# Singleton instance
_document_comparison_service = None

def get_document_comparison_service() -> DocumentComparisonService:
    """Get the singleton instance of DocumentComparisonService"""
    global _document_comparison_service
    if _document_comparison_service is None:
        _document_comparison_service = DocumentComparisonService()
    return _document_comparison_service
