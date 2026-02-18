"""Unit tests for the knowledge retrieval skill stack."""

from __future__ import annotations

import base64
from datetime import datetime
from typing import Dict, List, Optional

import pathlib
import sys

import pytest

_BACKEND_DIR = pathlib.Path(__file__).resolve().parents[1]
_REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
for candidate in (str(_REPO_ROOT), str(_BACKEND_DIR)):
    if candidate not in sys.path:
        sys.path.insert(0, candidate)

from backend.app import database
from backend.app.services.knowledgebase import (
    KnowledgebaseDownloadError,
    MimeType,
)
from backend.app.data import ReachNettDataManager as reachnett_module
from backend.app.data.ReachNettDataManager import ReachNettDataManager
from app.agents.skills.knowledge_retrieval import (
    create_knowledge_retrieval_node,
    retrieve_ppt_knowledge,
    retrieve_user_attachment,
)
from app.agents.skills.knowledge_retrieval import knowledge_retrieval as knowledge_module


@pytest.fixture()
def temp_db(tmp_path, monkeypatch):
    """Provide an isolated SQLite database for knowledge metadata tests."""

    db_path = tmp_path / "knowledge.db"
    monkeypatch.setattr(database, "DB_PATH", db_path)
    database.init_database()
    return db_path


def _insert_metadata(rows: List[Dict[str, str]]):
    with database.get_db_connection() as conn:
        cursor = conn.cursor()
        for row in rows:
            cursor.execute(
                """
                INSERT INTO KnowledgeBaseMetaData (object_key, company_name, content_type, task_name, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    row["object_key"],
                    row["company_name"],
                    row["content_type"],
                    row.get("task_name"),
                    row["created_at"],
                ),
            )


def test_list_knowledgebase_uploads_filters_by_mime(temp_db):
    now = datetime.utcnow()
    _insert_metadata(
        [
            {
                "object_key": "acme-llc/us01/onboarding.pptx",
                "company_name": "acme-llc",
                "content_type": MimeType.MS_POWERPOINT_OPENXML.value,
                "task_name": "onboarding",
                "created_at": now.isoformat(),
            },
            {
                "object_key": "acme-llc/us01/handbook.pdf",
                "company_name": "acme-llc",
                "content_type": MimeType.PDF.value,
                "task_name": "handbook",
                "created_at": (now.replace(year=now.year - 1)).isoformat(),
            },
            {
                "object_key": "acme-llc/us01/policies.ppt",
                "company_name": "acme-llc",
                "content_type": MimeType.MS_POWERPOINT.value,
                "task_name": "policies",
                "created_at": (now.replace(year=now.year - 2)).isoformat(),
            },
        ]
    )

    results = database.list_knowledgebase_uploads(
        company_name="acme-llc",
        content_types=(
            MimeType.MS_POWERPOINT.value,
            MimeType.MS_POWERPOINT_OPENXML.value,
        ),
        limit=5,
    )

    assert len(results) == 2
    # Should be ordered by created_at desc
    assert results[0]["object_key"].endswith("onboarding.pptx")
    assert results[1]["object_key"].endswith("policies.ppt")


def test_list_ppt_assets_downloads_and_handles_errors(monkeypatch):
    captured_args = {}

    def fake_list(**kwargs):
        captured_args.update(kwargs)
        return [
            {
                "object_key": "acme-llc/us01/welcome.pptx",
                "company_name": "acme-llc",
                "content_type": MimeType.MS_POWERPOINT_OPENXML.value,
                "task_name": "welcome",
                "created_at": "2024-01-02T00:00:00",
            },
            {
                "object_key": "acme-llc/us01/broken.pptx",
                "company_name": "acme-llc",
                "content_type": MimeType.MS_POWERPOINT_OPENXML.value,
                "task_name": "broken",
                "created_at": "2024-01-01T00:00:00",
            },
        ]

    monkeypatch.setattr(reachnett_module, "list_knowledgebase_uploads", fake_list)

    class DummyDownload:
        def __init__(self):
            self.calls: List[str] = []

        def fetch_bytes_by_object_key(self, object_key: str) -> bytes:
            self.calls.append(object_key)
            if object_key.endswith("broken.pptx"):
                raise KnowledgebaseDownloadError("unavailable")
            return b"ppt-bytes"

    manager = ReachNettDataManager(download_service=DummyDownload())
    assets = manager.list_ppt_assets("Acme LLC", max_documents=2, offset=1)

    assert captured_args == {
        "company_name": "acme-llc",
        "content_types": (
            MimeType.MS_POWERPOINT.value,
            MimeType.MS_POWERPOINT_OPENXML.value,
        ),
        "limit": 2,
        "offset": 1,
    }
    assert len(assets) == 2

    first, second = assets
    assert first["object_key"].endswith("welcome.pptx")
    assert first["size_bytes"] == len(b"ppt-bytes")
    assert first["data"] == b"ppt-bytes"
    assert "error" not in first

    assert second["object_key"].endswith("broken.pptx")
    assert "data" not in second
    assert second["error"] == "unavailable"


def test_retrieve_user_attachment_validates_payload():
    data_url = "data:application/vnd.ms-powerpoint;base64," + base64.b64encode(b"demo").decode("ascii")
    document = retrieve_user_attachment(
        {
            "id": "part-1",
            "type": "file",
            "mime": MimeType.MS_POWERPOINT.value,
            "filename": "Upload.ppt",
            "url": data_url,
        }
    )

    assert document.get("error") is None
    assert document["size_bytes"] == 4
    assert document["data_b64"] == base64.b64encode(b"demo").decode("ascii")


def test_retrieve_ppt_knowledge_merges_sources(monkeypatch):
    class StubManager:
        def list_ppt_assets(self, company_name: str, *, max_documents: int):
            assert company_name == "Acme Inc"
            assert max_documents == 1
            return [
                {
                    "object_key": "acme-inc/us01/policies.pptx",
                    "company_name": "acme-inc",
                    "content_type": MimeType.MS_POWERPOINT_OPENXML.value,
                    "task_name": "policies",
                    "created_at": "2024-01-05T00:00:00",
                    "data": b"ppt",
                    "size_bytes": 3,
                }
            ]

    monkeypatch.setattr(knowledge_module, "_get_data_manager", lambda: StubManager())

    state = {
        "company_name": "Acme Inc",
        "query": "policy deck",
        "attachments": [
            {
                "type": "file",
                "mime": MimeType.MS_POWERPOINT_OPENXML.value,
                "filename": "UserUpload.pptx",
                "url": "data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64," + base64.b64encode(b"user").decode("ascii"),
            }
        ],
    }

    updated = retrieve_ppt_knowledge(state, max_documents=1)
    result = updated["knowledge_retrieval"]

    assert result["company_name"] == "Acme Inc"
    assert result["max_documents"] == 1
    assert len(result["documents"]) == 2
    sources = [doc["source"] for doc in result["documents"]]
    assert sources == ["attachment", "reachnett"]
    assert result["errors"] == []


def test_create_node_delegates_to_skill(monkeypatch):
    calls: List[int] = []

    def fake_retrieve(state: Dict[str, Any], *, max_documents: Optional[int] = None):
        calls.append(max_documents)
        new_state = dict(state)
        new_state["knowledge_retrieval"] = {"documents": []}
        return new_state

    monkeypatch.setattr(knowledge_module, "retrieve_ppt_knowledge", fake_retrieve)

    node = create_knowledge_retrieval_node(max_documents=5)
    result_state = node({"company_name": "Acme"})

    assert result_state["knowledge_retrieval"] == {"documents": []}
    assert calls == [5]
