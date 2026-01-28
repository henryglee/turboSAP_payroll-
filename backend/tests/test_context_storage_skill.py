"""Tests for the Qdrant-backed context storage skills."""
from __future__ import annotations

import json
import sys
import uuid
from pathlib import Path

import pytest
from qdrant_client import models, QdrantClient

CONTEXT_STORAGE_DIR = (
    Path(__file__).resolve().parents[1]
    / "app"
    / "agents"
    / ".opencode"
    / "skills"
    / "context_storage"
)
if str(CONTEXT_STORAGE_DIR) not in sys.path:
    sys.path.append(str(CONTEXT_STORAGE_DIR))

from context_storage import ContextStorageSkill, QdrantSkillConfig  # noqa: E402


class StubQdrantClient:
    """Minimal stub of the Qdrant client used for unit tests."""

    def __init__(self, *, collection_exists: bool = True, config: QdrantSkillConfig | None = None) -> None:
        self._collection_exists = collection_exists
        self.collection_exists_checks: list[str] = []
        self.create_collection_calls: list[dict[str, object]] = []
        self.upsert_calls: list[dict[str, object]] = []
        self.config = config or QdrantSkillConfig()
        self.client = QdrantClient(
            url=self.config.url,
            api_key=self.config.api_key,
            timeout=self.config.timeout,
        )

    def collection_exists(self, collection_name: str) -> bool:
        self.collection_exists_checks.append(collection_name)
        try:
            return self.client.collection_exists(collection_name)
        except Exception:
            raise

    def create_collection(self, *, collection_name: str, vectors_config: models.VectorParams) -> None:
        self.create_collection_calls.append(
            {
                "collection_name": collection_name,
                "vectors_config": vectors_config,
            }
        )
        try:
            self.client.create_collection(collection_name=collection_name, vectors_config=vectors_config)
        except Exception:
            raise
        finally:
            self._collection_exists = True

    def upsert(self, *, collection_name: str, points: list[models.PointStruct]) -> None:
        self.upsert_calls.append(
            {
                "collection_name": collection_name,
                "points": points,
            }
        )
        try:
            self.client.upsert(collection_name=collection_name, points=points)
        except Exception:
            raise


@pytest.fixture()
def stub_client() -> StubQdrantClient:
    return StubQdrantClient()


def test_context_storage_creates_collection_when_missing() -> None:
    client = StubQdrantClient(collection_exists=False)
    config = QdrantSkillConfig(collection_name="unit-tests", vector_size=16)

    ContextStorageSkill(client=client, config=config)

    assert client.create_collection_calls, "expect create_collection to be invoked"
    call = client.create_collection_calls[0]
    assert call["collection_name"] == config.collection_name
    vectors_config = call["vectors_config"]
    assert vectors_config.size == config.vector_size
    assert vectors_config.distance == models.Distance.COSINE


def test_store_context_upserts_expected_payload(stub_client: StubQdrantClient) -> None:
    config = QdrantSkillConfig(collection_name="unit-tests", vector_size=16)
    skill = ContextStorageSkill(client=stub_client, config=config)
    context = {"text": "Remind me to sync payroll", "module": "payroll"}
    metadata = {"source": "unit"}

    result = skill.store_context(context, metadata)

    assert result["collection"] == config.collection_name
    assert result["vector_size"] == config.vector_size

    # validate context_id is a UUID
    uuid.UUID(result["context_id"])

    assert len(stub_client.upsert_calls) == 1
    call = stub_client.upsert_calls[0]
    assert call["collection_name"] == config.collection_name

    point = call["points"][0]
    assert point.payload["context"] == context
    assert point.payload["metadata"] == metadata
    assert "inserted_at" in point.payload

    payload_json = json.dumps(context, sort_keys=True, separators=(",", ":"))
    assert point.vector == skill._embed_payload(payload_json)


def test_store_context_generates_uuid_when_missing(stub_client: StubQdrantClient) -> None:
    config = QdrantSkillConfig(collection_name="unit-tests", vector_size=8)
    skill = ContextStorageSkill(client=stub_client, config=config)

    result = skill.store_context({"foo": "bar"})

    generated_id = result["context_id"]
    assert uuid.UUID(generated_id)
    call = stub_client.upsert_calls[-1]
    assert call["points"][0].id == generated_id


def test_embed_payload_is_deterministic(stub_client: StubQdrantClient) -> None:
    config = QdrantSkillConfig(collection_name="unit-tests", vector_size=10)
    skill = ContextStorageSkill(client=stub_client, config=config)

    payload = "{\"foo\": \"bar\"}"
    vector_one = skill._embed_payload(payload)
    vector_two = skill._embed_payload(payload)

    assert vector_one == vector_two
    assert len(vector_one) == config.vector_size
    assert all(-1.0 <= value <= 1.0 for value in vector_one)


def test_config_validation_errors() -> None:
    with pytest.raises(ValueError):
        QdrantSkillConfig(vector_size=0)

    with pytest.raises(ValueError):
        QdrantSkillConfig(collection_name="")
