"""
Base Adapter for Legacy Modules

Defines the interface that all legacy module adapters must implement.
Each adapter knows how to validate, normalize, and export data for
a specific legacy module based on its contract (config.json).
"""

import csv
import io
import logging
from abc import ABC, abstractmethod
from typing import Any

logger = logging.getLogger(__name__)


class BaseAdapter(ABC):
    """
    Abstract base class for legacy module adapters.

    Each adapter transforms browser localStorage data into the
    standardized output format used by SessionOutputStore —
    the same format generic modules produce via output_generator.
    """

    def __init__(self, contract: dict[str, Any]):
        self.contract = contract
        self.slug = contract["slug"]
        self.outputs_schema = contract.get("outputs", {})

    @abstractmethod
    def validate(self, client_data: dict[str, Any]) -> tuple[bool, list[str]]:
        """
        Validate client-reported data against the contract schema.

        Args:
            client_data: Raw data from the frontend (parsed localStorage)

        Returns:
            (is_valid, list_of_error_messages)
        """
        ...

    @abstractmethod
    def normalize(self, client_data: dict[str, Any]) -> dict[str, Any]:
        """
        Extract and normalize data into the contract's output shape.

        Args:
            client_data: Raw data from the frontend

        Returns:
            Dict keyed by output name (matches contract outputs keys),
            each value being the cleaned data.
        """
        ...

    @abstractmethod
    def to_csv(self, normalized: dict[str, Any]) -> dict[str, str]:
        """
        Generate CSV file contents from normalized data.

        Args:
            normalized: Output of normalize()

        Returns:
            Dict mapping filename → CSV string content
        """
        ...

    def process(self, client_data: dict[str, Any]) -> dict[str, Any]:
        """
        Full pipeline: validate → normalize → generate CSVs.

        Returns dict with:
            - normalized: the cleaned data (for answers.json)
            - files: dict of filename → CSV string
            - valid: bool
            - errors: list of validation errors (if any)
        """
        valid, errors = self.validate(client_data)
        if not valid:
            return {"valid": False, "errors": errors, "normalized": {}, "files": {}}

        normalized = self.normalize(client_data)
        files = self.to_csv(normalized)

        return {
            "valid": True,
            "errors": [],
            "normalized": normalized,
            "files": files,
        }

    # ── Helpers ──────────────────────────────────────────────

    @staticmethod
    def _dict_rows_to_csv(columns: list[dict[str, str]], rows: list[dict[str, Any]]) -> str:
        """
        Convert a list of dicts to CSV using specified column definitions.

        Args:
            columns: List of {"key": "field_name", "label": "Header_Label"}
            rows: List of dicts with field_name keys

        Returns:
            CSV string with header row
        """
        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([col["label"] for col in columns])

        # Data rows
        for row in rows:
            writer.writerow([str(row.get(col["key"], "")) for col in columns])

        return output.getvalue()

    def _check_required_fields(
        self, items: list[dict], schema: dict[str, dict], label: str
    ) -> list[str]:
        """Check required fields across a list of items."""
        errors = []
        for i, item in enumerate(items):
            for field_name, field_def in schema.items():
                if field_def.get("required") and not item.get(field_name):
                    errors.append(f"{label}[{i}]: missing required field '{field_name}'")
        return errors
