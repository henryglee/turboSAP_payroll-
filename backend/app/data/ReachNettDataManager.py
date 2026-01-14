from pathlib import Path
import json
from typing import List, Optional

from ..services.knowledgebase_upload import KnowledgebaseUploadService


class ReachNettDataManager:
    def __init__(self, upload_service: Optional[KnowledgebaseUploadService] = None):
        self.base_dir = (Path(__file__).resolve().parent /"reachnett").resolve()
        self._upload_service = upload_service or KnowledgebaseUploadService()

    def root_dir(self) -> Path:
        return self.base_dir
    # -------------------------
    # Customer / Company Helpers
    # -------------------------
    def customer_dir(self, customer: str) -> Path:
        return self.base_dir / customer

    def company_dir(self, customer: str, company_code: str) -> Path:
        return self.customer_dir(customer) / company_code

    def module_file(self, customer: str, company_code: str, module: str) -> Path:
        return self.company_dir(customer, company_code) / f"{module}.json"

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
    def load_module(self, customer: str, company_code: str, module: str) -> dict:
        path = self.module_file(customer, company_code, module)
        if not path.exists():
            return {}
        return json.loads(path.read_text())

    def save_module(self, customer: str, company_code: str, module: str, data: dict) -> str:
        path = self.module_file(customer, company_code, module)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(data, indent=2)
        path.write_text(payload)

        # Upload module JSON to ReachNett knowledgebase storage as a canonical copy.
        return self._upload_service.upload_document(
            company_code=company_code,
            company_name=customer,
            content_type=module,
            document_bytes=payload.encode("utf-8"),
            mime_type="application/json",
        )
