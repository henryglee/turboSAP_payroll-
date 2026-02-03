"""
Unit tests for Domain Configuration Retriever Agent Skill.

Tests cover:
- Database metadata lookup
- S3 file download
- JSON parsing
- Error handling
- LangGraph node integration
"""






import pytest
from datetime import datetime
from unittest.mock import Mock, patch, MagicMock
import json

from app.agents.skills.get_domain_configuration.get_domain_configuration import (
        get_domain_config,
        find_config_by_task,
        get_domain_config_by_object_key,
        list_configs_by_company,
        create_domain_config_node,
        create_config_router_node,
        get_skill_info,
        DomainConfigurationError,
)

class TestDomainConfigurationRetriever:
    """Test suite for domain configuration retrieval."""

    # ============================================
    # Fixtures
    # ============================================

    @pytest.fixture
    def mock_metadata(self):
        """Sample metadata from KnowledgeBaseMetaData table."""
        return {
            "object_key": "Acme Corp/ACME001/payment_method.json",
            "company_name": "Acme Corp",
            "task_name": "payment_method",
            "content_type": "application/json",
            "created_at": "2026-01-29T10:30:00"
        }

    @pytest.fixture
    def mock_configuration(self):
        """Sample JSON configuration."""
        return {
            "methods": ["direct_deposit", "check", "wire_transfer"],
            "default": "direct_deposit",
            "rules": {
                "min_amount": 100,
                "max_amount": 100000,
                "processing_days": 2
            }
        }

    @pytest.fixture
    def mock_config_bytes(self, mock_configuration):
        """Sample configuration as JSON bytes."""
        return json.dumps(mock_configuration).encode('utf-8')

    # ============================================
    # Tests: find_config_by_task()
    # ============================================

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration.database')
    def test_find_config_by_task_success(self, mock_db, mock_metadata):
        """Test successful metadata lookup."""
        mock_db.get_latest_knowledgebase_upload.return_value = mock_metadata

        result = find_config_by_task("payment_method", "Acme Corp")

        assert result is not None
        assert result["object_key"] == "Acme Corp/ACME001/payment_method.json"
        assert result["task_name"] == "payment_method"
        mock_db.get_latest_knowledgebase_upload.assert_called_once_with(
            company_name="Acme Corp",
            task_name="payment_method"
        )

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration.database')
    def test_find_config_by_task_not_found(self, mock_db):
        """Test metadata lookup when config not found."""
        mock_db.get_latest_knowledgebase_upload.return_value = None

        result = find_config_by_task("nonexistent_task", "Unknown Corp")

        assert result is None
        mock_db.get_latest_knowledgebase_upload.assert_called_once()

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration.database')
    def test_find_config_by_task_database_error(self, mock_db):
        """Test error handling for database failures."""
        mock_db.get_latest_knowledgebase_upload.side_effect = Exception("DB connection failed")

        with pytest.raises(DomainConfigurationError) as exc_info:
            find_config_by_task("payment_method", "Acme Corp")

        assert "Failed to query KnowledgeBaseMetaData" in str(exc_info.value)

    # ============================================
    # Tests: get_domain_config()
    # ============================================

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration._get_download_service')
    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration.database')
    def test_get_domain_config_success(self, mock_db, mock_service_factory, mock_metadata, mock_config_bytes):
        """Test successful domain configuration retrieval."""
        mock_db.get_latest_knowledgebase_upload.return_value = mock_metadata
        
        mock_service = MagicMock()
        mock_service._download_bytes.return_value = mock_config_bytes
        mock_service_factory.return_value = mock_service

        result = get_domain_config("payment_method", "Acme Corp")

        assert result["success"] is True
        assert result["task_name"] == "payment_method"
        assert result["company_name"] == "Acme Corp"
        assert result["configuration"]["methods"] == ["direct_deposit", "check", "wire_transfer"]
        assert result["file_size"] == len(mock_config_bytes)
        assert result["error"] is None
        assert "downloaded_at" in result

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration.database')
    def test_get_domain_config_metadata_not_found(self, mock_db):
        """Test error when metadata not found in database."""
        mock_db.get_latest_knowledgebase_upload.return_value = None

        with pytest.raises(DomainConfigurationError) as exc_info:
            get_domain_config("unknown_task", "Unknown Corp")

        assert "No configuration found in database" in str(exc_info.value)

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration._get_download_service')
    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration.database')
    def test_get_domain_config_s3_download_failure(self, mock_db, mock_service_factory, mock_metadata):
        """Test error handling for S3 download failures."""
        from app.services.knowledgebase import KnowledgebaseDownloadError
        
        mock_db.get_latest_knowledgebase_upload.return_value = mock_metadata
        
        mock_service = MagicMock()
        mock_service._download_bytes.side_effect = KnowledgebaseDownloadError("S3 access denied")
        mock_service_factory.return_value = mock_service

        with pytest.raises(KnowledgebaseDownloadError):
            get_domain_config("payment_method", "Acme Corp")

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration._get_download_service')
    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration.database')
    def test_get_domain_config_invalid_json(self, mock_db, mock_service_factory, mock_metadata):
        """Test error handling for invalid JSON."""
        mock_db.get_latest_knowledgebase_upload.return_value = mock_metadata
        
        mock_service = MagicMock()
        mock_service._download_bytes.return_value = b"invalid json {{{{"
        mock_service_factory.return_value = mock_service

        with pytest.raises(DomainConfigurationError) as exc_info:
            get_domain_config("payment_method", "Acme Corp")

        assert "Failed to parse JSON" in str(exc_info.value)

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration._get_download_service')
    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration.database')
    def test_get_domain_config_non_utf8_encoding(self, mock_db, mock_service_factory, mock_metadata):
        """Test error handling for non-UTF8 encoded files."""
        mock_db.get_latest_knowledgebase_upload.return_value = mock_metadata
        
        mock_service = MagicMock()
        # Invalid UTF-8 sequence
        mock_service._download_bytes.return_value = b"\xff\xfe"
        mock_service_factory.return_value = mock_service

        with pytest.raises(DomainConfigurationError) as exc_info:
            get_domain_config("payment_method", "Acme Corp")

        assert "Failed to parse JSON" in str(exc_info.value)

    # ============================================
    # Tests: get_domain_config_by_object_key()
    # ============================================

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration._get_download_service')
    def test_get_domain_config_by_object_key_success(self, mock_service_factory, mock_config_bytes):
        """Test direct retrieval by object key."""
        mock_service = MagicMock()
        mock_service._download_bytes.return_value = mock_config_bytes
        mock_service_factory.return_value = mock_service

        result = get_domain_config_by_object_key("Acme Corp/ACME001/payment_method.json")

        assert result["success"] is True
        assert result["object_key"] == "Acme Corp/ACME001/payment_method.json"
        assert result["configuration"]["methods"] == ["direct_deposit", "check", "wire_transfer"]
        assert result["file_size"] == len(mock_config_bytes)

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration._get_download_service')
    def test_get_domain_config_by_object_key_s3_error(self, mock_service_factory):
        """Test S3 error when retrieving by object key."""
        from app.services.knowledgebase import KnowledgebaseDownloadError
        
        mock_service = MagicMock()
        mock_service._download_bytes.side_effect = KnowledgebaseDownloadError("File not found")
        mock_service_factory.return_value = mock_service

        with pytest.raises(KnowledgebaseDownloadError):
            get_domain_config_by_object_key("nonexistent/path/config.json")

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration._get_download_service')
    def test_get_domain_config_by_object_key_invalid_json(self, mock_service_factory):
        """Test JSON parsing error for object key retrieval."""
        mock_service = MagicMock()
        mock_service._download_bytes.return_value = b"not json"
        mock_service_factory.return_value = mock_service

        with pytest.raises(DomainConfigurationError) as exc_info:
            get_domain_config_by_object_key("some/path/config.json")

        assert "Failed to parse JSON" in str(exc_info.value)

    # ============================================
    # Tests: list_configs_by_company()
    # ============================================

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration.database')
    def test_list_configs_by_company_success(self, mock_db):
        """Test listing all configs for a company."""
        mock_configs = [
            {
                "object_key": "Acme Corp/ACME001/payment_method.json",
                "task_name": "payment_method",
                "company_name": "Acme Corp",
                "content_type": "application/json",
                "created_at": "2026-01-29T10:30:00"
            },
            {
                "object_key": "Acme Corp/ACME001/payroll_area.json",
                "task_name": "payroll_area",
                "company_name": "Acme Corp",
                "content_type": "application/json",
                "created_at": "2026-01-29T11:00:00"
            }
        ]
        
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = mock_configs
        mock_conn.__enter__.return_value.cursor.return_value = mock_cursor
        
        with patch('app.agents.skills.get_domain_configuration.get_domain_configuration.database.get_db_connection', 
                   return_value=mock_conn):
            result = list_configs_by_company("Acme Corp")

        assert len(result) == 2
        assert result[0]["task_name"] == "payment_method"
        assert result[1]["task_name"] == "payroll_area"

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration.database')
    def test_list_configs_by_company_empty(self, mock_db):
        """Test listing configs when company has none."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_conn.__enter__.return_value.cursor.return_value = mock_cursor
        
        with patch('app.agents.skills.get_domain_configuration.get_domain_configuration.database.get_db_connection',
                   return_value=mock_conn):
            result = list_configs_by_company("Unknown Corp")

        assert result == []

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration.database')
    def test_list_configs_by_company_database_error(self, mock_db):
        """Test error handling for database failures."""
        mock_conn = MagicMock()
        mock_conn.__enter__.side_effect = Exception("DB error")
        
        with patch('app.agents.skills.get_domain_configuration.get_domain_configuration.database.get_db_connection',
                   return_value=mock_conn):
            with pytest.raises(DomainConfigurationError) as exc_info:
                list_configs_by_company("Acme Corp")

        assert "Failed to list configurations" in str(exc_info.value)

    # ============================================
    # Tests: LangGraph Integration
    # ============================================

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration._get_download_service')
    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration.database')
    def test_create_domain_config_node_success(self, mock_db, mock_service_factory, 
                                               mock_metadata, mock_config_bytes):
        """Test LangGraph node for successful retrieval."""
        mock_db.get_latest_knowledgebase_upload.return_value = mock_metadata
        
        mock_service = MagicMock()
        mock_service._download_bytes.return_value = mock_config_bytes
        mock_service_factory.return_value = mock_service

        node = create_domain_config_node()
        state = {
            "task_name": "payment_method",
            "company_name": "Acme Corp"
        }

        result = node(state)

        assert result["domain_config"]["success"] is True
        assert result["domain_config_error"] is None
        assert result["domain_config"]["configuration"]["methods"] is not None

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration._get_download_service')
    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration.database')
    def test_create_domain_config_node_error(self, mock_db, mock_service_factory):
        """Test LangGraph node error handling."""
        mock_db.get_latest_knowledgebase_upload.return_value = None

        node = create_domain_config_node()
        state = {
            "task_name": "unknown_task",
            "company_name": "Unknown Corp"
        }

        result = node(state)

        assert result["domain_config"] is None
        assert "No configuration found" in result["domain_config_error"]

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration._get_download_service')
    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration.database')
    def test_create_domain_config_node_by_object_key(self, mock_db, mock_service_factory, mock_config_bytes):
        """Test LangGraph node with object key (skips metadata lookup)."""
        mock_service = MagicMock()
        mock_service._download_bytes.return_value = mock_config_bytes
        mock_service_factory.return_value = mock_service

        node = create_domain_config_node()
        state = {
            "object_key": "Acme Corp/ACME001/payment_method.json"
        }

        result = node(state)

        assert result["domain_config"]["success"] is True
        assert result["domain_config_error"] is None
        # Database should not be called when object_key is provided
        mock_db.get_latest_knowledgebase_upload.assert_not_called()

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration._get_download_service')
    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration.database')
    def test_create_domain_config_node_missing_params(self, mock_db, mock_service_factory):
        """Test LangGraph node with missing required parameters."""
        node = create_domain_config_node()
        state = {}

        result = node(state)

        assert result["domain_config"] is None
        assert "must have either" in result["domain_config_error"]

    def test_create_config_router_node_has_task_info(self):
        """Test router node when task info is present."""
        router = create_config_router_node()
        state = {
            "task_name": "payment_method",
            "company_name": "Acme Corp"
        }

        result = router(state)

        assert result["can_retrieve_config"] is True

    def test_create_config_router_node_has_object_key(self):
        """Test router node when object key is present."""
        router = create_config_router_node()
        state = {
            "object_key": "Acme Corp/ACME001/config.json"
        }

        result = router(state)

        assert result["can_retrieve_config"] is True

    def test_create_config_router_node_missing_all(self):
        """Test router node with missing all parameters."""
        router = create_config_router_node()
        state = {}

        result = router(state)

        assert result["can_retrieve_config"] is False

    # ============================================
    # Tests: Skill Info
    # ============================================

    def test_get_skill_info(self):
        """Test skill metadata."""
        info = get_skill_info()

        assert info["name"] == "Domain Configuration Retriever"
        assert info["version"] == "1.0.0"
        assert "retrieve_config_by_task" in info["capabilities"]
        assert "retrieve_config_by_object_key" in info["capabilities"]
        assert ".json" in info["supported_formats"]

    # ============================================
    # Integration Tests
    # ============================================

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration._get_download_service')
    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration.database')
    def test_full_workflow_task_lookup_to_download(self, mock_db, mock_service_factory, 
                                                     mock_metadata, mock_config_bytes, mock_configuration):
        """Test complete workflow from task lookup to config download."""
        mock_db.get_latest_knowledgebase_upload.return_value = mock_metadata
        
        mock_service = MagicMock()
        mock_service._download_bytes.return_value = mock_config_bytes
        mock_service_factory.return_value = mock_service

        # Get config
        result = get_domain_config("payment_method", "Acme Corp")

        # Verify complete workflow
        assert result["success"] is True
        assert result["configuration"] == mock_configuration
        assert result["metadata"]["object_key"] == mock_metadata["object_key"]
        assert result["file_size"] == len(mock_config_bytes)
        
        # Verify calls were made in correct order
        mock_db.get_latest_knowledgebase_upload.assert_called_once()
        mock_service._download_bytes.assert_called_once_with(mock_metadata["object_key"])

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration._get_download_service')
    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration.database')
    def test_multiple_configs_for_company(self, mock_db, mock_service_factory):
        """Test retrieving multiple different configs for same company."""
        configs = {
            "payment_method": {
                "methods": ["direct_deposit", "check"]
            },
            "payroll_area": {
                "areas": ["HR", "Finance"]
            }
        }

        call_count = 0
        def get_latest_side_effect(company_name, task_name):
            metadata = {
                "object_key": f"Acme/{task_name}.json",
                "task_name": task_name,
                "company_name": company_name
            }
            return metadata

        mock_db.get_latest_knowledgebase_upload.side_effect = get_latest_side_effect

        mock_service = MagicMock()
        def download_side_effect(object_key):
            if "payment_method" in object_key:
                return json.dumps(configs["payment_method"]).encode('utf-8')
            elif "payroll_area" in object_key:
                return json.dumps(configs["payroll_area"]).encode('utf-8')
            return b"{}"

        mock_service._download_bytes.side_effect = download_side_effect
        mock_service_factory.return_value = mock_service

        # Get both configs
        result1 = get_domain_config("payment_method", "Acme Corp")
        result2 = get_domain_config("payroll_area", "Acme Corp")

        assert result1["configuration"]["methods"] == ["direct_deposit", "check"]
        assert result2["configuration"]["areas"] == ["HR", "Finance"]


class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration.database')
    def test_find_config_empty_strings(self, mock_db):
        """Test with empty strings."""
        mock_db.get_latest_knowledgebase_upload.return_value = None

        result = find_config_by_task("", "")

        assert result is None

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration._get_download_service')
    def test_get_config_very_large_json(self, mock_service_factory):
        """Test with large JSON file."""
        large_config = {f"key_{i}": f"value_{i}" for i in range(10000)}
        large_json = json.dumps(large_config).encode('utf-8')

        mock_service = MagicMock()
        mock_service._download_bytes.return_value = large_json
        mock_service_factory.return_value = mock_service

        result = get_domain_config_by_object_key("path/large_config.json")

        assert result["success"] is True
        assert len(result["configuration"]) == 10000
        assert result["file_size"] == len(large_json)

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration._get_download_service')
    def test_get_config_empty_json_object(self, mock_service_factory):
        """Test with empty JSON object."""
        mock_service = MagicMock()
        mock_service._download_bytes.return_value = b"{}"
        mock_service_factory.return_value = mock_service

        result = get_domain_config_by_object_key("path/empty.json")

        assert result["success"] is True
        assert result["configuration"] == {}

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration._get_download_service')
    def test_get_config_json_array_instead_of_object(self, mock_service_factory):
        """Test when JSON is array instead of object."""
        mock_service = MagicMock()
        mock_service._download_bytes.return_value = b'["item1", "item2"]'
        mock_service_factory.return_value = mock_service

        result = get_domain_config_by_object_key("path/array.json")

        assert result["success"] is True
        assert result["configuration"] == ["item1", "item2"]

    @patch('app.agents.skills.get_domain_configuration.get_domain_configuration._get_download_service')
    def test_get_config_special_characters_in_json(self, mock_service_factory):
        """Test JSON with special characters and unicode."""
        config = {
            "name": "Acme® Corp",
            "emoji": "🎉",
            "chinese": "中文",
            "special": "line1\nline2\ttab"
        }
        mock_service = MagicMock()
        mock_service._download_bytes.return_value = json.dumps(config).encode('utf-8')
        mock_service_factory.return_value = mock_service

        result = get_domain_config_by_object_key("path/unicode.json")

        assert result["success"] is True
        assert result["configuration"]["name"] == "Acme® Corp"
        assert result["configuration"]["emoji"] == "🎉"
        assert result["configuration"]["chinese"] == "中文"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
