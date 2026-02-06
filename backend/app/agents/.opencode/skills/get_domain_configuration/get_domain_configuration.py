"""
Domain Configuration Retriever Agent Skill

Retrieves JSON domain configuration files from the knowledge base by querying
the KnowledgeBaseMetaData table and downloading from S3.

Architecture:
- Two-step retrieval process: metadata lookup → file download
- Integrates with KnowledgebaseDownloadService for S3 access
- Uses database queries to track object keys by task and company

Main Functions:
    - get_domain_config: Retrieve configuration by task and company
    - find_config_by_task: Query metadata to find object_key
    - create_domain_config_node: LangGraph integration node
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime

# Add backend app to path for imports
import sys
_BACKEND_PATH = Path(__file__).resolve().parent.parent.parent.parent
if str(_BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(_BACKEND_PATH))

from app.services.knowledgebase import (
    KnowledgebaseDownloadService,
    KnowledgebaseDownloadError,
)
from app import database


# ============================================
# Module Setup
# ============================================

class DomainConfigurationError(Exception):
    """Raised when domain configuration retrieval fails."""
    pass


# Global instances
_download_service: Optional[KnowledgebaseDownloadService] = None


def _get_download_service() -> KnowledgebaseDownloadService:
    """Lazy-load download service singleton."""
    global _download_service
    if _download_service is None:
        _download_service = KnowledgebaseDownloadService()
    return _download_service


# ============================================
# Database Query Functions
# ============================================

def find_config_by_task(
    task_name: str,
    company_name: str,
    content_type: str = "application/json"
) -> Optional[Dict[str, Any]]:
    """
    Query KnowledgeBaseMetaData table to find the object_key for a specific task.
    
    Retrieves the most recent configuration for a given task and company.
    
    Args:
        task_name: Name of the task (e.g., "payment_method", "payroll_area")
        company_name: Name of the company
        content_type: Expected content type (default: "application/json")
        
    Returns:
        Dict with keys:
            - object_key: S3 path to the configuration file
            - task_name: Task identifier
            - company_name: Company name
            - content_type: MIME type of the file
            - created_at: Timestamp of when config was uploaded
        Returns None if not found
        
    Raises:
        DomainConfigurationError: If database query fails
        
    Example:
        metadata = find_config_by_task("payment_method", "Acme Corp")
        print(f"Config location: {metadata['object_key']}")
    """
    try:
        metadata = database.get_latest_knowledgebase_upload(
            company_name=company_name,
            task_name=task_name
        )
        return metadata
    except Exception as e:
        raise DomainConfigurationError(
            f"Failed to query KnowledgeBaseMetaData for task={task_name}, "
            f"company={company_name}: {str(e)}"
        ) from e


# ============================================
# Core Functions
# ============================================

def get_domain_config(
    task_name: str,
    company_name: str,
) -> Dict[str, Any]:
    """
    Retrieve domain configuration JSON for a specific task and company.
    
    Two-step process:
    1. Query KnowledgeBaseMetaData table to find the object_key
    2. Download the JSON configuration file from S3
    
    Args:
        task_name: Configuration task identifier
                   Examples: "payment_method", "payroll_area", "salary_rules"
        company_name: Name of the company
        
    Returns:
        Dict containing:
            - success: bool
            - task_name: str (requested task)
            - company_name: str (requested company)
            - configuration: Dict (parsed JSON configuration)
            - metadata: Dict (from KnowledgeBaseMetaData table)
            - file_size: int (bytes)
            - downloaded_at: ISO timestamp
            - error: Optional[str] (if any error occurred)
            
    Raises:
        DomainConfigurationError: If metadata lookup or download fails
        KnowledgebaseDownloadError: If S3 download fails
        json.JSONDecodeError: If JSON parsing fails
        
    Example:
        result = get_domain_config(
            task_name="payment_method",
            company_name="Acme Corp"
        )
        
        if result['success']:
            config = result['configuration']
            print(f"Payment methods: {config.get('methods', [])}")
        else:
            print(f"Error: {result['error']}")
    """
    try:
        # Step 1: Look up metadata in database
        metadata = find_config_by_task(task_name, company_name)
        
        if not metadata:
            raise DomainConfigurationError(
                f"No configuration found in database for task='{task_name}', "
                f"company='{company_name}'. Upload configuration first."
            )
        
        object_key = metadata.get("object_key")
        if not object_key:
            raise DomainConfigurationError(
                f"Invalid metadata: missing object_key for task='{task_name}'"
            )
        
        # Step 2: Download JSON from S3
        service = _get_download_service()
        json_bytes = service._download_bytes(object_key)
        file_size = len(json_bytes)
        
        # Parse JSON
        try:
            configuration = json.loads(json_bytes.decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            raise DomainConfigurationError(
                f"Failed to parse JSON from S3 ({object_key}): {str(e)}"
            ) from e
        
        return {
            "success": True,
            "task_name": task_name,
            "company_name": company_name,
            "configuration": configuration,
            "metadata": metadata,
            "file_size": file_size,
            "downloaded_at": datetime.now().isoformat(),
            "error": None,
        }
        
    except DomainConfigurationError:
        raise
    except KnowledgebaseDownloadError as e:
        raise KnowledgebaseDownloadError(
            f"Failed to download configuration from S3: {str(e)}"
        ) from e
    except Exception as e:
        raise DomainConfigurationError(f"Unexpected error: {str(e)}") from e


def get_domain_config_by_object_key(object_key: str) -> Dict[str, Any]:
    """
    Retrieve domain configuration directly by S3 object key.
    
    Bypasses the metadata lookup step when object_key is already known.
    
    Args:
        object_key: Full S3 object key (e.g., "company/code/config.json")
        
    Returns:
        Dict with keys: configuration, file_size, downloaded_at, error
        
    Raises:
        KnowledgebaseDownloadError: If S3 download fails
        json.JSONDecodeError: If JSON parsing fails
        
    Example:
        result = get_domain_config_by_object_key("Acme/ACME001/payment_method.json")
        config = result['configuration']
    """
    try:
        service = _get_download_service()
        json_bytes = service._download_bytes(object_key)
        file_size = len(json_bytes)
        
        try:
            configuration = json.loads(json_bytes.decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            raise DomainConfigurationError(
                f"Failed to parse JSON from S3 ({object_key}): {str(e)}"
            ) from e
        
        return {
            "success": True,
            "object_key": object_key,
            "configuration": configuration,
            "file_size": file_size,
            "downloaded_at": datetime.now().isoformat(),
            "error": None,
        }
        
    except KnowledgebaseDownloadError as e:
        raise KnowledgebaseDownloadError(
            f"Failed to download configuration from S3: {str(e)}"
        ) from e
    except Exception as e:
        raise DomainConfigurationError(f"Unexpected error: {str(e)}") from e


def list_configs_by_company(company_name: str) -> List[Dict[str, Any]]:
    """
    List all available configurations for a company.
    
    Queries KnowledgeBaseMetaData table for all JSON configurations
    associated with the company.
    
    Args:
        company_name: Name of the company
        
    Returns:
        List of metadata dicts with keys:
            - object_key
            - task_name
            - company_name
            - content_type
            - created_at
            
    Example:
        configs = list_configs_by_company("Acme Corp")
        for cfg in configs:
            print(f"Task: {cfg['task_name']} - Created: {cfg['created_at']}")
    """
    try:
        with database.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT object_key, task_name, company_name, content_type, created_at
                FROM KnowledgeBaseMetaData
                WHERE company_name = ? AND content_type = 'application/json'
                ORDER BY created_at DESC
            """, (company_name,))
            return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        raise DomainConfigurationError(
            f"Failed to list configurations for company '{company_name}': {str(e)}"
        ) from e


# ============================================
# LangGraph Integration
# ============================================

def create_domain_config_node():
    """
    Factory function to create a LangGraph node for domain configuration retrieval.
    
    Usage in LangGraph:
        from get_domain_configuration import create_domain_config_node
        
        graph_builder.add_node("get_config", create_domain_config_node())
    
    The node expects state to have:
        - task_name: str (e.g., "payment_method")
        - company_name: str (e.g., "Acme Corp")
        - Optional: object_key (if provided, skips metadata lookup)
    
    And will add to state:
        - domain_config: Dict (retrieval result)
        - domain_config_error: Optional[str]
    """
    
    def config_node(state: Dict[str, Any]) -> Dict[str, Any]:
        task_name = state.get("task_name")
        company_name = state.get("company_name")
        object_key = state.get("object_key")
        
        try:
            if object_key:
                # Direct retrieval by object_key
                result = get_domain_config_by_object_key(object_key)
            elif task_name and company_name:
                # Standard retrieval by task + company
                result = get_domain_config(task_name, company_name)
            else:
                raise DomainConfigurationError(
                    "State must have either 'object_key' or both 'task_name' and 'company_name'"
                )
            
            state["domain_config"] = result
            state["domain_config_error"] = None
            
        except (DomainConfigurationError, KnowledgebaseDownloadError) as e:
            state["domain_config"] = None
            state["domain_config_error"] = str(e)
        
        return state
    
    return config_node


def create_config_router_node():
    """
    Factory function to create a router node for conditional configuration retrieval.
    
    Returns a node that checks if required fields are present in state.
    
    Usage:
        graph_builder.add_node("check_config", create_config_router_node())
    """
    
    def router_node(state: Dict[str, Any]) -> Dict[str, Any]:
        has_task_info = bool(state.get("task_name") and state.get("company_name"))
        has_object_key = bool(state.get("object_key"))
        
        state["can_retrieve_config"] = has_task_info or has_object_key
        return state
    
    return router_node


# ============================================
# Module Info
# ============================================

def get_skill_info() -> Dict[str, Any]:
    """Return metadata about this skill."""
    return {
        "name": "Domain Configuration Retriever",
        "version": "1.0.0",
        "description": "Retrieve JSON domain configurations from knowledge base by task and company",
        "capabilities": [
            "retrieve_config_by_task",
            "retrieve_config_by_object_key",
            "list_available_configs",
            "query_metadata",
        ],
        "supported_formats": [".json"],
        "dependencies": [
            "KnowledgebaseDownloadService",
            "KnowledgeBaseMetaData table",
        ],
    }


if __name__ == "__main__":
    print(get_skill_info())
