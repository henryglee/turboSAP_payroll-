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
import os
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, Optional, Union
from urllib import error, request
from urllib.parse import quote

from ..database import (
    get_latest_knowledgebase_upload,
    record_knowledgebase_upload,
)

DEFAULT_PRESIGN_ENDPOINT = (
    "https://idsn7cy3rf.execute-api.us-east-1.amazonaws.com/default/getPresignedURL"
)

class MimeType(str, Enum):
    PDF = "application/pdf"
    MS_WORD = "application/msword"
    MS_WORD_OPENXML = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    MS_EXCEL = "application/vnd.ms-excel"
    MS_EXCEL_OPENXML = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    MS_POWERPOINT = "application/vnd.ms-powerpoint"
    MS_POWERPOINT_OPENXML = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    JSON = "application/json"
    JPEG = "image/jpeg"
    PNG = "image/png"


class KnowledgebaseUploadError(RuntimeError):
    """Raised when the document upload flow fails."""


class KnowledgebaseDownloadError(RuntimeError):
    """Raised when downloading or parsing knowledgebase data fails."""


@dataclass
class PresignedUpload:
    """Container for the presigned-url response payload."""

    upload_url: str
    raw_response: Dict[str, Any]

@dataclass
class KnowledgeMetaData:
    """Container for the Knowledgebase metadata."""



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

        upload_url = self._extract_upload_url(parsed)
        return PresignedUpload(upload_url=upload_url, raw_response=parsed)

    def record_upload_metadata(self, presigned: PresignedUpload,task_name:Optional[str]) -> Optional[int]:
        """Persist the metadata returned from the presign request."""

        if not isinstance(presigned, PresignedUpload):
            raise TypeError("presigned must be a PresignedUpload instance")

        print(f"""
        {"Presigned".center(40, "*")}
        {presigned}
        """)

        object_key = presigned.raw_response.get("key")
        content_type = presigned.raw_response.get("contentType")
        company_name = self._extract_company_name(object_key)

        if not (object_key and content_type):
            # print a warning here
            print("Missing object key or content type, not recording metadata")
            return None

        return record_knowledgebase_upload(
            object_key=str(object_key),
            company_name=str(company_name),
            content_type=str(content_type),
            task_name=task_name,
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
        document_bytes: bytes,
        mime_type: str,
        task_name: Optional[str] = None,
    ) -> str:
        """Convenience wrapper that requests a URL and uploads the document."""

        presigned = self.request_presigned_upload(
            company_code=company_code,
            company_name=company_name,
            content_type=mime_type,
        )
        self.record_upload_metadata(
            presigned,
            task_name)

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
    @staticmethod
    def _extract_company_name(object_key: str) -> str:
        return object_key.split("/",1)[0]

    @staticmethod
    def _extract_company_code(object_key: str) -> str:
        return object_key.split("/",1)[1]


class KnowledgebaseDownloadService:
    """Service for downloading and parsing knowledgebase JSON payloads."""

    def __init__(
        self,
        *,
        download_base_url: Optional[str] = DEFAULT_PRESIGN_ENDPOINT,
        timeout: int = 30,
    ):
        self.download_base_url = download_base_url
        self.timeout = timeout

    def fetch_latest_json(self, *, company_name: str, content_type: str) -> Dict[str, Any]:
        """Return the newest JSON payload for the given company/module."""

        metadata = get_latest_knowledgebase_upload(
            company_name=company_name,
            content_type=content_type,
        )
        if not metadata:
            raise KnowledgebaseDownloadError(
                f"No knowledgebase uploads recorded for {company_name}/{content_type}"
            )

        object_key = metadata.get("object_key")
        if not object_key:
            raise KnowledgebaseDownloadError("Knowledgebase metadata missing object key")

        return self.fetch_json_by_object_key(object_key)

    def fetch_json_by_object_key(self, object_key: str) -> Dict[str, Any]:
        """Download and parse a JSON payload using the provided object key."""

        payload = self._download_bytes(object_key)
        return self._parse_json(payload)

    def _download_bytes(self, object_key: str) -> bytes:
        url = self._build_download_url(object_key)

        if object_key.startswith(("http://", "https://")):
            download_url = url
        else:
            req = request.Request(url, method="GET")
            try:
                with request.urlopen(req, timeout=self.timeout) as resp:
                    metadata_bytes = resp.read()
            except error.URLError as exc:  # pragma: no cover - runtime safety
                raise KnowledgebaseDownloadError(
                    f"Unable to request download URL for: {object_key}"
                ) from exc

            try:
                metadata_text = metadata_bytes.decode("utf-8")
                metadata = json.loads(metadata_text)
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise KnowledgebaseDownloadError(
                    "Download metadata response was not valid JSON"
                ) from exc

            download_url = metadata.get("downloadURL")
            if not download_url:
                raise KnowledgebaseDownloadError(
                    "Download metadata missing downloadURL"
                )

            method = metadata.get("method", "GET")
            if method and method.upper() != "GET":
                raise KnowledgebaseDownloadError(
                    f"Unsupported download method '{method}'"
                )

        req = request.Request(download_url, method="GET")
        try:
            with request.urlopen(req, timeout=self.timeout) as resp:
                return resp.read()
        except error.URLError as exc:  # pragma: no cover - runtime safety
            raise KnowledgebaseDownloadError(
                f"Unable to download knowledgebase object: {object_key}"
            ) from exc

    def _build_download_url(self, object_key: str) -> str:
        if object_key.startswith(("http://", "https://")):
            return object_key

        if not self.download_base_url:
            raise KnowledgebaseDownloadError(
                "Download base URL is not configured for relative object keys"
            )

        encoded_key = quote(object_key.lstrip("/"))
        base = self.download_base_url.rstrip("/")
        separator = "&" if "?" in base else "?"
        return f"{base}{separator}key={encoded_key}"

    @staticmethod
    def _parse_json(payload: bytes) -> Dict[str, Any]:
        try:
            text = payload.decode("utf-8")
        except UnicodeDecodeError as exc:  # pragma: no cover - defensive
            raise KnowledgebaseDownloadError("Downloaded payload is not UTF-8") from exc

        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:  # pragma: no cover - defensive
            raise KnowledgebaseDownloadError("Downloaded payload is not valid JSON") from exc

__all__ = [
    "KnowledgebaseUploadError",
    "KnowledgebaseUploadService",
    "PresignedUpload",
    "KnowledgebaseDownloadError",
    "KnowledgebaseDownloadService",
]
