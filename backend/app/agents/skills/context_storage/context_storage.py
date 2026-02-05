"""Qdrant-backed skills that persists arbitrary JSON context for retrieval."""
from __future__ import annotations

import hashlib
import json
import logging
import os
import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, MutableMapping, Optional

from qdrant_client import QdrantClient
from qdrant_client import models

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class QdrantSkillConfig:
    """Runtime configuration for the context storage skills."""

    url: str = os.environ.get("QDRANT_URL", "http://localhost:6333")
    api_key: Optional[str] = os.environ.get("QDRANT_API_KEY")
    collection_name: str = os.environ.get("QDRANT_COLLECTION", "agent-context")
    vector_size: int = int(os.environ.get("QDRANT_VECTOR_SIZE", "8"))
    timeout: float = float(os.environ.get("QDRANT_TIMEOUT", "5"))

    def __post_init__(self) -> None:
        if self.vector_size <= 0:
            raise ValueError("QDRANT_VECTOR_SIZE must be greater than zero")
        if not self.collection_name:
            raise ValueError("QDRANT_COLLECTION must not be empty")


class ContextStorageSkill:
    """Skill for persisting JSON context documents into Qdrant."""

    def __init__(
        self,
        client: Optional[QdrantClient] = None,
        config: Optional[QdrantSkillConfig] = None,
    ) -> None:
        self.config = config or QdrantSkillConfig()
        self.client = client or QdrantClient(
            url=self.config.url,
            api_key=self.config.api_key,
            timeout=self.config.timeout,
        )
        self._ensure_collection()

    def __call__(self, context: MutableMapping[str, Any]) -> Dict[str, Any]:
        """Allow the instance to behave like a callable skills."""
        return self.store_context(context)

    # Public API ---------------------------------------------------------
    def store_context(
        self,
        context: MutableMapping[str, Any],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Insert the provided context payload into Qdrant.

        Args:
            context: Arbitrary JSON-compatible mapping describing the agent context.
            metadata: Optional metadata merged into the payload.
        Returns:
            Dict with inserted context id and collection info.
        """

        payload_json = json.dumps(context, sort_keys=True, separators=(",", ":"))
        embedding = self._embed_payload(payload_json)
        point_id = str(uuid.uuid4())

        payload: Dict[str, Any] = {
            "context": context,
            "metadata": metadata or {},
            "inserted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

        logger.debug(
            "Upserting context into Qdrant", extra={"collection": self.config.collection_name, "context_id": point_id}
        )

        self.client.upsert(
            collection_name=self.config.collection_name,
            points=[
                models.PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload=payload,
                )
            ],
        )

        return {
            "context_id": point_id,
            "collection": self.config.collection_name,
            "vector_size": self.config.vector_size,
        }

    # Internal helpers ---------------------------------------------------
    def _ensure_collection(self) -> None:
        """Create the collection if it does not exist."""
        if self.client.collection_exists(self.config.collection_name):
            return

        logger.info(
            "Creating Qdrant collection %s with dimension %s",
            self.config.collection_name,
            self.config.vector_size,
        )

        self.client.create_collection(
            collection_name=self.config.collection_name,
            vectors_config=models.VectorParams(
                size=self.config.vector_size,
                distance=models.Distance.COSINE,
            ),
        )

    def _embed_payload(self, serialized_payload: str) -> List[float]:
        """Generate a deterministic pseudo-embedding from the payload text."""
        digest = hashlib.sha256(serialized_payload.encode("utf-8")).digest()
        # Repeat digest bytes if the requested vector size is larger than 32
        repeats = (self.config.vector_size + len(digest) - 1) // len(digest)
        repeated = (digest * repeats)[: self.config.vector_size]
        return [((b / 255.0) * 2.0) - 1.0 for b in repeated]
    
    def search_context(self, query_context: Dict[str, Any], limit: int = 5) -> List[Dict[str, Any]]:
        """Search for stored contexts that exactly or closely match the provided JSON structure."""
        
        # 1. Use the SAME deterministic hashing logic as store_context
        payload_json = json.dumps(query_context, sort_keys=True, separators=(",", ":"))
        query_vector = self._embed_payload(payload_json)

        # 2. Query Qdrant
        results = self.client.search(
            collection_name=self.config.collection_name,
            query_vector=query_vector,
            limit=limit,
            with_payload=True
        )
        
        # 3. Return only the 'context' and 'metadata' from the payloads
        return [hit.payload for hit in results]


__all__ = ["ContextStorageSkill", "QdrantSkillConfig"]
