from pathlib import Path
import json
import re
from typing import Any, Dict, List, Optional

from ..database import get_latest_knowledgebase_upload
from ..services.knowledgebase import (
    KnowledgebaseDownloadError,
    KnowledgebaseDownloadService,
    KnowledgebaseUploadService,
    MimeType
)


_COMPANY_RE = re.compile(r"[^a-z0-9-]")


class ReachNettDataManager:
    def __init__(
        self,
        upload_service: Optional[KnowledgebaseUploadService] = None,
        download_service: Optional[KnowledgebaseDownloadService] = None,
    ):
        self.base_dir = (Path(__file__).resolve().parent / "reachnett").resolve()
        self._upload_service = upload_service or KnowledgebaseUploadService()
        self._download_service = download_service or KnowledgebaseDownloadService()

    def root_dir(self) -> Path:
        return self.base_dir
    # -------------------------
    # Customer / Company Helpers
    # -------------------------
    def customer_dir(self, customer: str) -> Path:
        return self.base_dir / customer

    def company_dir(self, customer: str, company_code: str) -> Path:
        return self.customer_dir(customer) / company_code

    def _task_file(self, company_name: str, company_code: str, task_name: str) -> Dict[str, Any]:
        """LTS"""
        """Return the latest task JSON fetched from ReachNett storage."""

        metadata = get_latest_knowledgebase_upload(
            company_name=company_name,
            task_name=task_name,
        )
        print(f"metadata: {metadata}")
        if not metadata:
            return {}

        object_key = metadata.get("object_key")
        if not object_key:
            print("no object_key found")
            return {}

        content_type = metadata.get("content_type")
        match content_type:
            case MimeType.JSON:
                try:
                    return self._download_service.fetch_json_by_object_key(object_key)
                except KnowledgebaseDownloadError:
                    return {}
            case _:
                print("Unable to handle file download content type other than application/json")
                return {}
    # -------------------------
    # Discovery APIs
    # -------------------------
    def list_customers(self) -> List[str]:
        if not self.base_dir.exists():
            return []
        return sorted([
            p.name for p in self.base_dir.iterdir()
            if p.is_dir()
        ])

    def list_company_codes(self, customer: str) -> List[str]:
        root = self.customer_dir(customer)
        if not root.exists():
            return []
        return sorted([
            p.name for p in root.iterdir()
            if p.is_dir()
        ])

    # -------------------------
    # Company Metadata
    # -------------------------
    def load_company_info(self, customer: str) -> Optional[dict]:
        path = self.customer_dir(customer) / "company.info.json"
        if not path.exists():
            return None
        return json.loads(path.read_text())

    def load_company_logo_path(self, customer: str) -> Optional[Path]:
        path = self.customer_dir(customer) / "company.logo.jpg"
        return path if path.exists() else None

    # -------------------------
    # Module Data
    # -------------------------
    def _sanitize_company_name(self, company: str) -> str:
        company = (company or "").strip().lower().replace(" ", "-")
        company = _COMPANY_RE.sub("-", company)
        company = re.sub(r"-{2,}", "-", company).strip("-")
        return company[:64]

    def load_task(self, company_name: str, company_code: str, task_name: str) -> dict:
        """LTS AWS s3 storage loader"""
        sanitized_company = self._sanitize_company_name(company_name)
        return self._task_file(sanitized_company, company_code, task_name)

    def save_task(self, company_name: str, company_code: str, task_name: str, data: dict, mime_type=MimeType.JSON) -> str:
        """LTS AWS s3 storage file saver"""
        payload = json.dumps(data, indent=2).encode("utf-8")

        # Upload task JSON to ReachNett knowledgebase storage as a canonical copy.
        return self._upload_service.upload_document(
            company_name=company_name,
            company_code=company_code,
            document_bytes=payload,
            mime_type=mime_type,
            task_name=task_name,
        )
