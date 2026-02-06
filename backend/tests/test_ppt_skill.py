"""
Unit tests for Enhanced PPT Content Extractor skill.
Validated for unstructured.io partitioning, coordinate ordering, and semantic tagging.
"""

try:
    from app.agents.skills.ppt_content_extractor.get_ppt_content import (
        get_ppt_content,
        extract_ppt_text,
        get_ppt_slides_summary,
        get_skill_info,
        PPTContentExtractionError,
        create_ppt_content_node
    )
    IMPORT_SUCCESS = True
except ImportError:
    IMPORT_SUCCESS = False


import pytest
from pathlib import Path
from io import BytesIO
from unittest.mock import Mock, patch, MagicMock


class MockUnstructuredElement:
    def __init__(self, text, category):
        self.text = text
        self.category = category

class MockPageBreak:
    pass


@pytest.mark.skipif(not IMPORT_SUCCESS, reason="Required modules not found")
class TestEnhancedPPTSkill:

    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.partition_pptx')
    def test_extract_ppt_text_with_semantic_tags(self, mock_partition):

        mock_partition.return_value = [
            MockUnstructuredElement("TurboSAP Payroll Guide", "Title"),
            MockUnstructuredElement("This covers payment methods.", "NarrativeText")
        ]
        
        text = extract_ppt_text(b"fake_bytes")
        

        assert "[TITLE]: TurboSAP Payroll Guide" in text
        assert "[NARRATIVETEXT]: This covers payment methods." in text

    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.partition_pptx')
    def test_coordinate_ordering_logic(self, mock_partition):

        elements = [
            MockUnstructuredElement("First Element", "Title"),
            MockUnstructuredElement("Second Element", "NarrativeText"),
            MockUnstructuredElement("Third Element", "ListItem")
        ]
        mock_partition.return_value = elements
        
        text = extract_ppt_text(b"fake_bytes")
        
        pos1 = text.find("First Element")
        pos2 = text.find("Second Element")
        pos3 = text.find("Third Element")
        assert pos1 < pos2 < pos3

    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.partition_pptx')
    def test_slide_summary_with_page_breaks(self, mock_partition):

        elements = [
            MockUnstructuredElement("Slide 1 Title", "Title"),
            MockPageBreak(),
            MockUnstructuredElement("Slide 2 Title", "Title")
        ]
        mock_partition.return_value = elements
        
        summary = get_ppt_slides_summary(b"fake_bytes")
        
        assert len(summary) == 2
        assert summary[0]["slide_number"] == 1
        assert summary[0]["title"] == "Slide 1 Title"
        assert summary[1]["slide_number"] == 2
        assert summary[1]["title"] == "Slide 2 Title"

    def test_get_skill_info_version(self):

        info = get_skill_info()
        assert info["version"] == "1.1.0"
        assert "coordinate_aware_text_extraction" in info["capabilities"]

    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content._get_download_service')
    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.get_ppt_content')
    def test_langgraph_node_execution(self, mock_get_content, mock_download):

        node = create_ppt_content_node()
        mock_get_content.return_value = {"success": True, "full_text": "Sample content"}
        
        initial_state = {"ppt_object_key": "company/code/test.pptx"}
        final_state = node(initial_state)
        
        assert "ppt_content" in final_state
        assert final_state["ppt_content"]["full_text"] == "Sample content"
        assert final_state["ppt_extraction_error"] is None

class TestErrorScenarios:
    
    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.partition_pptx')
    def test_invalid_file_error(self, mock_partition):

        mock_partition.side_effect = Exception("System Corrupted")
        
        with pytest.raises(PPTContentExtractionError) as excinfo:
            extract_ppt_text(b"broken_bytes")
        assert "Failed to extract text using unstructured" in str(excinfo.value)

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
"""
Unit tests for Enhanced PPT Content Extractor skill.
Validated for unstructured.io partitioning, coordinate ordering, and semantic tagging.
"""

try:
    from app.agents.skills.ppt_content_extractor.get_ppt_content import (
        get_ppt_content,
        extract_ppt_text,
        get_ppt_slides_summary,
        get_skill_info,
        PPTContentExtractionError,
        create_ppt_content_node,
        create_ppt_router_node,
        get_ppt_contents_batch,
        search_ppt_by_query,
        _index_ppt_slides_to_db,
        get_ppt_metadata
    )
    IMPORT_SUCCESS = True
except ImportError:
    IMPORT_SUCCESS = False


import pytest
from pathlib import Path
from io import BytesIO
from unittest.mock import Mock, patch, MagicMock


class MockUnstructuredElement:
    def __init__(self, text, category):
        self.text = text
        self.category = category

class MockPageBreak:
    pass


@pytest.mark.skipif(not IMPORT_SUCCESS, reason="Required modules not found")
class TestEnhancedPPTSkill:

    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.partition_pptx')
    def test_extract_ppt_text_with_semantic_tags(self, mock_partition):

        mock_partition.return_value = [
            MockUnstructuredElement("TurboSAP Payroll Guide", "Title"),
            MockUnstructuredElement("This covers payment methods.", "NarrativeText")
        ]
        
        text = extract_ppt_text(b"fake_bytes")
        

        assert "[TITLE]: TurboSAP Payroll Guide" in text
        assert "[NARRATIVETEXT]: This covers payment methods." in text

    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.partition_pptx')
    def test_coordinate_ordering_logic(self, mock_partition):

        elements = [
            MockUnstructuredElement("First Element", "Title"),
            MockUnstructuredElement("Second Element", "NarrativeText"),
            MockUnstructuredElement("Third Element", "ListItem")
        ]
        mock_partition.return_value = elements
        
        text = extract_ppt_text(b"fake_bytes")
        
        pos1 = text.find("First Element")
        pos2 = text.find("Second Element")
        pos3 = text.find("Third Element")
        assert pos1 < pos2 < pos3

    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.partition_pptx')
    def test_slide_summary_with_page_breaks(self, mock_partition):

        elements = [
            MockUnstructuredElement("Slide 1 Title", "Title"),
            MockPageBreak(),
            MockUnstructuredElement("Slide 2 Title", "Title")
        ]
        mock_partition.return_value = elements
        
        summary = get_ppt_slides_summary(b"fake_bytes")
        
        assert len(summary) == 2
        assert summary[0]["slide_number"] == 1
        assert summary[0]["title"] == "Slide 1 Title"
        assert summary[1]["slide_number"] == 2
        assert summary[1]["title"] == "Slide 2 Title"

    def test_get_skill_info_version(self):

        info = get_skill_info()
        assert info["version"] == "1.1.0"
        assert "coordinate_aware_text_extraction" in info["capabilities"]

    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content._get_download_service')
    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.get_ppt_content')
    def test_langgraph_node_execution(self, mock_get_content, mock_download):

        node = create_ppt_content_node()
        mock_get_content.return_value = {"success": True, "full_text": "Sample content"}
        
        initial_state = {"ppt_object_key": "company/code/test.pptx"}
        final_state = node(initial_state)
        
        assert "ppt_content" in final_state
        assert final_state["ppt_content"]["full_text"] == "Sample content"
        assert final_state["ppt_extraction_error"] is None

    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content._get_download_service')
    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.search_ppt_by_query')
    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.get_ppt_content')
    def test_langgraph_node_with_hybrid_retrieval(self, mock_get_content, mock_search, mock_download):
        """Test LangGraph node with hybrid retrieval (config + PPT search)"""
        node = create_ppt_content_node()
        
        mock_get_content.return_value = {
            "success": True,
            "full_text": "Sample content",
            "slides": [{"slide_number": 1, "title": "Intro"}]
        }
        mock_search.return_value = [
            {
                "object_key": "company/code/test.pptx",
                "slide_number": 1,
                "title": "Payment Methods",
                "content": "Available methods...",
                "rank": -2.5
            }
        ]
        
        initial_state = {
            "ppt_object_key": "company/code/test.pptx",
            "ppt_query": "payment methods"
        }
        final_state = node(initial_state)
        
        assert final_state["ppt_content"]["success"] is True
        assert "ppt_search_results" in final_state
        assert len(final_state["ppt_search_results"]) == 1
        assert final_state["ppt_search_results"][0]["title"] == "Payment Methods"

    def test_create_ppt_router_node(self):
        """Test PPT router node creation and state updates"""
        router = create_ppt_router_node()
        
        # Test with object_key present
        state1 = {"ppt_object_key": "company/code/test.pptx"}
        result1 = router(state1)
        assert result1["has_ppt"] is True
        
        # Test without required fields
        state2 = {}
        result2 = router(state2)
        assert result2["has_ppt"] is False
        
        # Test with alternative query field
        state3 = {"ppt_query": "test"}
        result3 = router(state3)
        assert result3["has_ppt"] is False

class TestErrorScenarios:
    
    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.partition_pptx')
    def test_invalid_file_error(self, mock_partition):

        mock_partition.side_effect = Exception("System Corrupted")
        
        with pytest.raises(PPTContentExtractionError) as excinfo:
            extract_ppt_text(b"broken_bytes")
        assert "Failed to extract text using unstructured" in str(excinfo.value)


class TestDatabaseIndexing:
    """Tests for PPT slide indexing to database"""
    
    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.database.get_db_connection')
    def test_index_ppt_slides_to_db(self, mock_db_conn):
        """Test indexing slides to database"""
        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db_conn.return_value.__enter__.return_value = mock_conn
        
        slides = [
            {
                "slide_number": 1,
                "title": "Introduction",
                "text_content": "This is an introduction slide"
            },
            {
                "slide_number": 2,
                "title": "Payment Methods",
                "text_content": "Available payment methods include..."
            }
        ]
        metadata = {"author": "Test"}
        
        _index_ppt_slides_to_db("company/code/test.pptx", slides, metadata)
        
        # Verify database operations were called
        assert mock_cursor.execute.called
        assert mock_cursor.executemany.called
        mock_conn.commit.assert_called_once()
    
    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.database.search_ppt_index')
    def test_search_ppt_by_query(self, mock_search):
        """Test searching PPT content by query"""
        mock_search.return_value = [
            {
                "object_key": "company/code/test.pptx",
                "slide_number": 2,
                "title": "Payment Methods",
                "content": "Methods include...",
                "rank": -2.34
            }
        ]
        
        results = search_ppt_by_query("payment methods", limit=5)
        
        assert len(results) == 1
        assert results[0]["title"] == "Payment Methods"
        mock_search.assert_called_once_with("payment methods", 5)
    
    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.database.search_ppt_index')
    def test_search_ppt_with_custom_limit(self, mock_search):
        """Test search with custom limit"""
        mock_search.return_value = []
        
        search_ppt_by_query("test query", limit=10)
        
        mock_search.assert_called_once_with("test query", 10)


class TestBatchProcessing:
    """Tests for batch PPT processing"""
    
    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.get_ppt_content')
    def test_batch_processing_success(self, mock_get_content):
        """Test batch processing of multiple PPT files"""
        mock_get_content.side_effect = [
            {"success": True, "object_key": "file1.pptx"},
            {"success": True, "object_key": "file2.pptx"},
            {"success": True, "object_key": "file3.pptx"}
        ]
        
        results = get_ppt_contents_batch([
            "company/code/file1.pptx",
            "company/code/file2.pptx",
            "company/code/file3.pptx"
        ])
        
        assert len(results) == 3
        assert all(r["success"] for r in results)
    
    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.get_ppt_content')
    def test_batch_processing_with_errors(self, mock_get_content):
        """Test batch processing handles errors gracefully"""
        mock_get_content.side_effect = [
            {"success": True, "object_key": "file1.pptx"},
            PPTContentExtractionError("Failed to extract"),
            {"success": True, "object_key": "file3.pptx"}
        ]
        
        results = get_ppt_contents_batch([
            "company/code/file1.pptx",
            "company/code/file2.pptx",
            "company/code/file3.pptx"
        ])
        
        assert len(results) == 3
        assert results[0]["success"] is True
        assert results[1]["success"] is False
        assert "error" in results[1]
        assert results[2]["success"] is True


class TestMetadataExtraction:
    """Tests for PPT metadata extraction"""
    
    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.Presentation')
    def test_get_ppt_metadata(self, mock_presentation_class):
        """Test extracting metadata from PPT"""
        mock_props = MagicMock()
        mock_props.title = "Test Title"
        mock_props.author = "Test Author"
        mock_props.subject = "Test Subject"
        mock_props.keywords = "test, keywords"
        mock_props.created = MagicMock()
        mock_props.created.isoformat.return_value = "2026-02-01T10:00:00"
        mock_props.modified = MagicMock()
        mock_props.modified.isoformat.return_value = "2026-02-01T11:00:00"
        
        mock_presentation = MagicMock()
        mock_presentation.core_properties = mock_props
        mock_presentation.slides = [1, 2, 3]  # 3 slides
        mock_presentation_class.return_value = mock_presentation
        
        metadata = get_ppt_metadata(b"fake_bytes")
        
        assert metadata["title"] == "Test Title"
        assert metadata["author"] == "Test Author"
        assert metadata["subject"] == "Test Subject"
        assert metadata["slide_count"] == 3
    
    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.Presentation')
    def test_get_ppt_metadata_defaults(self, mock_presentation_class):
        """Test metadata extraction with missing fields"""
        mock_props = MagicMock()
        mock_props.title = None
        mock_props.author = None
        mock_props.subject = ""
        mock_props.keywords = ""
        mock_props.created = None
        mock_props.modified = None
        
        mock_presentation = MagicMock()
        mock_presentation.core_properties = mock_props
        mock_presentation.slides = []
        mock_presentation_class.return_value = mock_presentation
        
        metadata = get_ppt_metadata(b"fake_bytes")
        
        assert metadata["title"] == "Untitled"
        assert metadata["author"] == "Unknown"
        assert metadata["created"] is None
        assert metadata["slide_count"] == 0


class TestHybridRetrieval:
    """Tests for hybrid retrieval with PPT and database integration"""
    
    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.database.get_db_connection')
    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content._get_download_service')
    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.get_ppt_content')
    def test_langgraph_node_missing_object_key(self, mock_get_content, mock_download, mock_db):
        """Test node handles missing object_key gracefully"""
        node = create_ppt_content_node()
        
        initial_state = {"ppt_query": "test"}  # Missing ppt_object_key
        final_state = node(initial_state)
        
        assert final_state["ppt_extraction_error"] == "No ppt_object_key in state"
        assert final_state["ppt_content"] is None
    
    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content._get_download_service')
    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.get_ppt_content')
    def test_langgraph_node_error_handling(self, mock_get_content, mock_download):
        """Test node error handling"""
        node = create_ppt_content_node()
        
        mock_get_content.side_effect = PPTContentExtractionError("Test error")
        
        initial_state = {"ppt_object_key": "company/code/test.pptx"}
        final_state = node(initial_state)
        
        assert final_state["ppt_extraction_error"] is not None
        assert "Test error" in final_state["ppt_extraction_error"]
        assert final_state["ppt_content"] is None
        assert final_state["ppt_search_results"] is None

if __name__ == "__main__":
    pytest.main([__file__, "-v"])