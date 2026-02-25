"""Enhanced knowledge service combining S3 storage with Qdrant vector search."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from .knowledgebase import (
    KnowledgebaseUploadService,
    KnowledgebaseDownloadService,
    KnowledgebaseUploadError,
    KnowledgebaseDownloadError,
)
from ..database import get_latest_knowledgebase_upload

logger = logging.getLogger(__name__)

try:
    import sys

    sys.path.append(
        str(
            Path(__file__).parent.parent.parent
            / "agents"
            / ".opencode"
            / "skills"
            / "context_storage"
        )
    )
    from context_storage import ContextStorageSkill, QdrantSkillConfig

    CONTEXT_STORAGE_AVAILABLE = True
except ImportError:
    CONTEXT_STORAGE_AVAILABLE = False
    logger.warning("ContextStorageSkill not available - vector search disabled")


class EnhancedKnowledgeService:
    """Enhanced knowledge service with both S3 storage and vector search capabilities."""

    def __init__(
        self,
        upload_service: Optional[KnowledgebaseUploadService] = None,
        download_service: Optional[KnowledgebaseDownloadService] = None,
        context_storage: Optional[ContextStorageSkill] = None,
    ):
        self.upload_service = upload_service or KnowledgebaseUploadService()
        self.download_service = download_service or KnowledgebaseDownloadService()

        if CONTEXT_STORAGE_AVAILABLE and context_storage is None:
            config = QdrantSkillConfig(
                collection_name="knowledgebase",
                vector_size=128,
            )
            self.context_storage = ContextStorageSkill(config=config)
        else:
            self.context_storage = context_storage

    def store_knowledge(
        self,
        *,
        company_code: str,
        company_name: str,
        content: Union[bytes, Dict[str, Any]],
        mime_type: str,
        task_name: Optional[str] = None,
        title: Optional[str] = None,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Store knowledge with both S3 and vector indexing."""

        # Prepare content for S3 upload
        if isinstance(content, dict):
            content_bytes = json.dumps(content, ensure_ascii=False).encode("utf-8")
            mime_type = mime_type or "application/json"
        else:
            content_bytes = content

        # Upload to S3
        try:
            s3_url = self.upload_service.upload_document(
                company_code=company_code,
                company_name=company_name,
                document_bytes=content_bytes,
                mime_type=mime_type,
                task_name=task_name,
            )
        except KnowledgebaseUploadError as e:
            logger.error(f"S3 upload failed: {e}")
            raise

        # Store in vector database if available
        vector_result = None
        if self.context_storage and isinstance(content, dict):
            try:
                context_data = {
                    "content": content,
                    "title": title,
                    "description": description,
                    "tags": tags or [],
                    "company_name": company_name,
                    "task_name": task_name,
                    "s3_url": s3_url,
                    "mime_type": mime_type,
                }

                vector_result = self.context_storage.store_context(
                    context_data,
                    metadata=metadata or {},
                )
                logger.info(
                    f"Stored knowledge in vector DB: {vector_result['context_id']}"
                )
            except Exception as e:
                logger.warning(f"Vector storage failed: {e}")

        return {
            "s3_url": s3_url,
            "vector_result": vector_result,
            "company_name": company_name,
            "task_name": task_name,
        }

    def search_knowledge(
        self,
        query: str,
        company_name: Optional[str] = None,
        task_name: Optional[str] = None,
        tags: Optional[List[str]] = None,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """Search knowledge using vector similarity."""

        if not self.context_storage:
            logger.warning(
                "Vector search not available - falling back to metadata search"
            )
            return self._search_by_metadata(company_name, task_name, tags, limit)

        try:
            # Create a search context from the query
            search_context = {
                "query": query,
                "company_name": company_name,
                "task_name": task_name,
                "tags": tags or [],
            }

            # Store the query temporarily to get its embedding
            temp_result = self.context_storage.store_context(search_context)
            query_embedding = self.context_storage.client.retrieve(
                collection_name=self.context_storage.config.collection_name,
                ids=[temp_result["context_id"]],
            )[0].vector

            # Search for similar documents
            search_results = self.context_storage.client.search(
                collection_name=self.context_storage.config.collection_name,
                query_vector=query_embedding,
                limit=limit + 1,  # +1 to exclude the query itself
                query_filter=self._build_filter(company_name, task_name, tags),
            )

            # Convert results to readable format
            results = []
            for result in search_results[
                1:
            ]:  # Skip the first result (the query itself)
                payload = result.payload
                results.append(
                    {
                        "score": result.score,
                        "context_id": result.id,
                        "content": payload.get("context", {}).get("content"),
                        "title": payload.get("context", {}).get("title"),
                        "description": payload.get("context", {}).get("description"),
                        "tags": payload.get("context", {}).get("tags", []),
                        "company_name": payload.get("context", {}).get("company_name"),
                        "task_name": payload.get("context", {}).get("task_name"),
                        "s3_url": payload.get("context", {}).get("s3_url"),
                        "inserted_at": payload.get("inserted_at"),
                    }
                )

            return results

        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return self._search_by_metadata(company_name, task_name, tags, limit)

    def get_knowledge_by_metadata(
        self,
        company_name: str,
        task_name: str,
    ) -> Optional[Dict[str, Any]]:
        """Get knowledge by simple metadata lookup."""

        try:
            metadata = get_latest_knowledgebase_upload(
                company_name=company_name,
                task_name=task_name,
            )
            if not metadata:
                return None

            # Download the actual content
            if metadata.get("object_key"):
                content = self.download_service.fetch_json_by_object_key(
                    metadata["object_key"]
                )
                return {
                    "content": content,
                    "metadata": metadata,
                }
            return {"metadata": metadata}

        except KnowledgebaseDownloadError as e:
            logger.error(f"Failed to retrieve knowledge: {e}")
            return None

    def _search_by_metadata(
        self,
        company_name: Optional[str],
        task_name: Optional[str],
        tags: Optional[List[str]],
        limit: int,
    ) -> List[Dict[str, Any]]:
        """Fallback search using metadata only."""

        # This is a simplified fallback - in a real implementation,
        # you might want to add full-text search capabilities
        results = []

        if company_name and task_name:
            knowledge = self.get_knowledge_by_metadata(company_name, task_name)
            if knowledge:
                results.append(
                    {
                        "content": knowledge.get("content"),
                        "metadata": knowledge.get("metadata"),
                        "score": 1.0,  # Perfect match for direct lookup
                    }
                )

        return results[:limit]

    def _build_filter(
        self,
        company_name: Optional[str],
        task_name: Optional[str],
        tags: Optional[List[str]],
    ) -> Optional[Dict[str, Any]]:
        """Build Qdrant filter from search parameters."""

        if not any([company_name, task_name, tags]):
            return None

        conditions = []

        if company_name:
            conditions.append(
                {
                    "key": "context.company_name",
                    "match": {"value": company_name},
                }
            )

        if task_name:
            conditions.append(
                {
                    "key": "context.task_name",
                    "match": {"value": task_name},
                }
            )

        if tags:
            for tag in tags:
                conditions.append(
                    {
                        "key": "context.tags",
                        "match": {"value": tag},
                    }
                )

        return {"must": conditions} if conditions else None


__all__ = ["EnhancedKnowledgeService"]
