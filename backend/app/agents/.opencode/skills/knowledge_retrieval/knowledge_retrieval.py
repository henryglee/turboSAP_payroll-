"""Knowledge retrieval skill for deterministic PPT discovery."""

from __future__ import annotations

import base64
import binascii
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, TypedDict

_BACKEND_PATH = Path(__file__).resolve().parents[5]
if str(_BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(_BACKEND_PATH))

from app.data.ReachNettDataManager import ReachNettAsset, ReachNettDataManager
from app.services.knowledgebase import MimeType

logger = logging.getLogger(__name__)

DEFAULT_MAX_DOCUMENTS = 3
_ALLOWED_MIME_TYPES = {
    MimeType.MS_POWERPOINT.value,
    MimeType.MS_POWERPOINT_OPENXML.value,
}

_DATA_MANAGER: Optional[ReachNettDataManager] = None


class FilePart(TypedDict, total=False):
    """Subset of the SDK file-part schema that the skill understands."""

    id: Optional[str]
    type: Optional[str]
    mime: Optional[str]
    mediaType: Optional[str]
    url: Optional[str]
    data: Optional[str]
    filename: Optional[str]


class RetrievedDocument(TypedDict, total=False):
    """Structured representation of retrieved PPT knowledge."""

    source: str
    object_key: Optional[str]
    company_name: Optional[str]
    filename: str
    mime_type: str
    created_at: Optional[str]
    task_name: Optional[str]
    size_bytes: Optional[int]
    data_b64: Optional[str]
    attachment_id: Optional[str]
    error: Optional[str]


class KnowledgeRetrievalResult(TypedDict):
    """Top-level return payload stored on the LangGraph state."""

    query: str
    company_name: Optional[str]
    max_documents: int
    documents: List[RetrievedDocument]
    errors: List[str]


def _get_data_manager() -> ReachNettDataManager:
    global _DATA_MANAGER
    if _DATA_MANAGER is None:
        _DATA_MANAGER = ReachNettDataManager()
    return _DATA_MANAGER


def _coerce_limit(*candidates: Any) -> int:
    for candidate in candidates:
        if candidate is None:
            continue
        try:
            value = int(candidate)
        except (TypeError, ValueError):
            continue
        if value >= 0:
            return value
    return DEFAULT_MAX_DOCUMENTS


def _extract_company_name(state: Dict[str, Any]) -> Optional[str]:
    candidate_fields = (
        "company_name",
        "companyName",
        "customer_name",
        "customer",
        "tenant",
    )
    for key in candidate_fields:
        value = state.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    profile = state.get("profile")
    if isinstance(profile, dict):
        nested = profile.get("company_name") or profile.get("name")
        if isinstance(nested, str) and nested.strip():
            return nested.strip()
    return None


def _safe_filename(name: Optional[str]) -> str:
    cleaned = (name or "ppt_attachment").strip()
    if not cleaned:
        return "ppt_attachment.pptx"
    return cleaned


def _decode_data_url(payload: str) -> bytes:
    if not isinstance(payload, str):
        raise ValueError("payload must be a string")
    if not payload.startswith("data:"):
        raise ValueError("payload must be a data URL")
    try:
        header, encoded = payload.split(",", 1)
    except ValueError as exc:  # pragma: no cover - defensive
        raise ValueError("invalid data URL") from exc
    if ";base64" not in header:
        raise ValueError("data URL must be base64 encoded")
    return base64.b64decode(encoded, validate=True)


def _asset_to_document(asset: ReachNettAsset) -> RetrievedDocument:
    object_key = asset.get("object_key")
    filename = _safe_filename(object_key.split("/")[-1] if object_key else None)
    data = asset.get("data")

    document: RetrievedDocument = {
        "source": "reachnett",
        "object_key": object_key,
        "company_name": asset.get("company_name"),
        "filename": filename,
        "mime_type": asset.get("content_type") or MimeType.MS_POWERPOINT_OPENXML.value,
        "created_at": asset.get("created_at"),
        "task_name": asset.get("task_name"),
        "error": None,
    }

    if data:
        document["data_b64"] = base64.b64encode(data).decode("ascii")
        document["size_bytes"] = asset.get("size_bytes") or len(data)
    else:
        document["error"] = asset.get("error") or "missing_payload"

    return document


def retrieve_user_attachment(file_part: FilePart) -> RetrievedDocument:
    """Convert a FilePart payload into a deterministic document descriptor."""

    attachment_id = file_part.get("id") if isinstance(file_part.get("id"), str) else None
    mime_type = (file_part.get("mime") or file_part.get("mediaType") or "").lower()
    filename = _safe_filename(file_part.get("filename"))

    document: RetrievedDocument = {
        "source": "attachment",
        "object_key": None,
        "company_name": None,
        "filename": filename,
        "mime_type": mime_type,
        "created_at": None,
        "task_name": None,
        "attachment_id": attachment_id,
        "error": None,
    }

    if file_part.get("type") != "file":
        document["error"] = "unsupported_part_type"
        return document

    if mime_type not in _ALLOWED_MIME_TYPES:
        document["error"] = "unsupported_mime_type"
        return document

    payload = file_part.get("url") or file_part.get("data")
    if not isinstance(payload, str) or not payload:
        document["error"] = "missing_payload"
        return document

    try:
        if payload.startswith("data:"):
            data = _decode_data_url(payload)
        else:
            data = base64.b64decode(payload, validate=True)
    except (ValueError, binascii.Error) as exc:
        document["error"] = f"invalid_payload:{exc}"[:128]
        return document

    document["data_b64"] = base64.b64encode(data).decode("ascii")
    document["size_bytes"] = len(data)
    return document


def retrieve_ppt_knowledge(
    state: Dict[str, Any],
    *,
    max_documents: Optional[int] = None,
) -> Dict[str, Any]:
    """Enrich the state with deterministic PPT knowledge artifacts."""

    limit = _coerce_limit(max_documents, state.get("max_documents"))
    query = str(state.get("query") or "").strip()
    documents: List[RetrievedDocument] = []
    errors: List[str] = []

    raw_attachments = state.get("attachments")
    if isinstance(raw_attachments, list):
        for part in raw_attachments:
            if not isinstance(part, dict):
                continue
            document = retrieve_user_attachment(part)
            if document.get("error"):
                errors.append(f"attachment:{document['error']}")
            else:
                documents.append(document)

    company_name = _extract_company_name(state)
    if limit > 0:
        if company_name:
            manager = _get_data_manager()
            assets = manager.list_ppt_assets(company_name, max_documents=limit)
            for asset in assets:
                document = _asset_to_document(asset)
                if document.get("error"):
                    errors.append(f"reachnett:{document['error']}")
                documents.append(document)
        else:
            errors.append("missing_company_name")

    result: KnowledgeRetrievalResult = {
        "query": query,
        "company_name": company_name,
        "max_documents": limit,
        "documents": documents,
        "errors": errors,
    }

    next_state = dict(state)
    next_state["knowledge_retrieval"] = result
    return next_state


def create_knowledge_retrieval_node(*, max_documents: int = DEFAULT_MAX_DOCUMENTS):
    """Factory that produces a LangGraph node invoking the retrieval skill."""

    def node(state: Dict[str, Any]) -> Dict[str, Any]:
        enforced_limit = max_documents if max_documents is not None else DEFAULT_MAX_DOCUMENTS
        return retrieve_ppt_knowledge(state, max_documents=enforced_limit)

    node.__name__ = "knowledge_retrieval_node"
    return node


__all__ = [
    "retrieve_ppt_knowledge",
    "retrieve_user_attachment",
    "create_knowledge_retrieval_node",
]
