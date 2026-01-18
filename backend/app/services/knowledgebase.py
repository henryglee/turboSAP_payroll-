"""Utility service for uploading Knowledgebase documents to S3.

The service performs a two-step process:
1. Call the ReachNett API that returns a presigned URL for upload.
2. Use the presigned URL to upload the binary document payload to S3.

Front-end callers should provide the ReachNett company code, company name,
and content type ("docs", "words", "ppt" or "xlxs") so the API can
route the upload to the proper bucket.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, Optional
from urllib import error, request

from ..database import record_knowledgebase_upload


DEFAULT_PRESIGN_ENDPOINT = (
    "https://idsn7cy3rf.execute-api.us-east-1.amazonaws.com/default/getPresignedURL"
)


class KnowledgebaseUploadError(RuntimeError):
    """Raised when the document upload flow fails."""


@dataclass
class PresignedUpload:
    """Container for the presigned-url response payload."""

    upload_url: str
    raw_response: Dict[str, Any]


class KnowledgebaseUploadService:
    """Client used to obtain presigned URLs and upload documents."""

    def __init__(self, presign_endpoint: str = DEFAULT_PRESIGN_ENDPOINT, timeout: int = 30):
        self.presign_endpoint = presign_endpoint
        self.timeout = timeout

    def request_presigned_upload(
        self,
        *,
        company_code: str,
        company_name: str,
        content_type: str,
    ) -> PresignedUpload:
        """Request a presigned upload URL for a document type."""

        payload = {
            "companyCode": company_code,
            "companyName": company_name,
            "contentType": content_type,
        }
        body = json.dumps(payload).encode("utf-8")
        req = request.Request(
            self.presign_endpoint,
            data=body,
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        try:
            with request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode("utf-8")
        except error.URLError as exc:  # pragma: no cover - runtime safety
            raise KnowledgebaseUploadError("Unable to request presigned upload URL") from exc

        try:
            parsed: Dict[str, Any] = json.loads(raw) if raw else {}
        except json.JSONDecodeError as exc:  # pragma: no cover - defensive
            raise KnowledgebaseUploadError("Presign endpoint returned invalid JSON") from exc

        print(f"parsed:== {parsed}")
        upload_url = self._extract_upload_url(parsed)
        return PresignedUpload(upload_url=upload_url, raw_response=parsed)

    def record_upload_metadata(self, presigned: PresignedUpload) -> Optional[int]:
        """Persist the metadata returned from the presign request."""

        if not isinstance(presigned, PresignedUpload):
            raise TypeError("presigned must be a PresignedUpload instance")

        object_key = presigned.raw_response.get("key")
        company_name = presigned.raw_response.get("company")
        content_type = presigned.raw_response.get("contentType")

        if not (object_key and company_name and content_type):
            return None

        return record_knowledgebase_upload(
            object_key=str(object_key),
            company_name=str(company_name),
            content_type=str(content_type),
        )

    def upload_bytes(self, *, upload_url: str, payload: bytes, mime_type: str) -> str:
        """Upload bytes to S3 using a presigned URL."""

        req = request.Request(upload_url, data=payload, method="PUT")
        req.add_header("Content-Type", mime_type)

        try:
            with request.urlopen(req, timeout=self.timeout) as resp:
                status_code = resp.getcode()
        except error.URLError as exc:  # pragma: no cover - runtime safety
            raise KnowledgebaseUploadError("Knowledgebase document upload failed") from exc

        if status_code not in (200, 201):  # pragma: no cover - defensive
            raise KnowledgebaseUploadError(
                f"Upload failed with unexpected status code {status_code}"
            )

        # Strip query parameters so consumers get the canonical object URL.
        return upload_url.split("?")[0]

    def upload_document(
        self,
        *,
        company_code: str,
        company_name: str,
        content_type: str,
        document_bytes: bytes,
        mime_type: str,
    ) -> str:
        """Convenience wrapper that requests a URL and uploads the document."""

        presigned = self.request_presigned_upload(
            company_code=company_code,
            company_name=company_name,
            content_type=content_type,
        )
        self.record_upload_metadata(presigned)

        return self.upload_bytes(
            upload_url=presigned.upload_url,
            payload=document_bytes,
            mime_type=mime_type,
        )

    @staticmethod
    def _extract_upload_url(payload: Dict[str, Any]) -> str:
        for key in ("uploadURL", "url", "presignedUrl", "signedUrl"):
            url = payload.get(key)
            if isinstance(url, str) and url:
                return url
        raise KnowledgebaseUploadError(
            "Presign endpoint response did not contain an upload URL"
        )
    @staticmethod
    def _extract_object_key(payload: Dict[str, Any]) -> str:
        key = payload.get("raw_response", {}).get("key")

        if isinstance(key, str) and key:
            return key

        raise KnowledgebaseUploadError(
            "Knowledgebase document upload did not contain an object key"
        )

__all__ = [
    "KnowledgebaseUploadError",
    "KnowledgebaseUploadService",
    "PresignedUpload",
]
