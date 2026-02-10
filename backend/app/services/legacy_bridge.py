"""
Legacy Bridge Service

Internal abstraction for legacy module operations.
Keeps legacy-specific logic separate from the generic module pipeline
(module_runner, output_generator, session_output_store).

Responsibilities:
- Read contract metadata for legacy modules
- Validate completion status given client-reported data
- Provide output schema information for downstream consumers

This service does NOT manage sessions, generate CSVs, or serve questions.
Those are generic-module concerns handled by module_runner.py.
"""

import logging
from typing import Any, Optional

from ..schemas.module import ModuleMetadata
from .module_service import ModuleService, module_service

logger = logging.getLogger(__name__)


class LegacyBridge:
    """
    Bridge layer for legacy (custom-coded) modules.

    Legacy modules store data in browser localStorage and have
    their own React pages. This service reads their contract
    declarations (config.json) and can validate completion status
    when the frontend reports its localStorage state.
    """

    def __init__(self, module_svc: Optional[ModuleService] = None):
        self.module_service = module_svc or module_service

    def is_legacy(self, slug: str) -> bool:
        """Check if a module is legacy type."""
        metadata = self.module_service.get_module_metadata(slug)
        if not metadata:
            return False
        return metadata.type == "legacy"

    def get_contract(self, slug: str) -> Optional[dict[str, Any]]:
        """
        Get the full contract for a module (works for both legacy and generic).

        Returns a dict with identity, dependencies, outputs (with schemas),
        completion rules, and dataAccess info. Returns None if module not found.
        """
        metadata = self.module_service.get_module_metadata(slug)
        if not metadata:
            return None

        contract = {
            "slug": metadata.slug,
            "name": metadata.name,
            "description": metadata.description,
            "type": metadata.type or "generic",
            "route": metadata.route,
            "icon": metadata.icon,
            "status": metadata.status,
            "dependencies": metadata.dependencies,
            "outputs": metadata.outputs,
            "completion": metadata.completion,
            "dataAccess": metadata.data_access,
        }
        return contract

    def validate_completion(
        self, slug: str, client_data: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Validate whether a legacy module is complete based on client-reported data.

        The frontend posts its localStorage snapshot for the module, and this
        method checks it against the contract's completion rules.

        Args:
            slug: Module slug
            client_data: Data from the frontend (parsed localStorage content)

        Returns:
            Dict with 'complete' (bool) and 'reason' (str) fields
        """
        metadata = self.module_service.get_module_metadata(slug)
        if not metadata:
            return {"complete": False, "reason": f"Module '{slug}' not found"}

        if metadata.type != "legacy":
            return {"complete": False, "reason": f"Module '{slug}' is not a legacy module"}

        if not metadata.completion:
            return {"complete": False, "reason": "No completion rule defined in contract"}

        completion = metadata.completion
        rule = completion.get("rule", "")

        # For now, check if client_data is non-empty and truthy.
        # Specific rule parsing (e.g. "Array with at least one row where X")
        # will be implemented as adapters mature in Phase 3.
        if not client_data:
            return {"complete": False, "reason": "No data provided"}

        # Basic validation: if data is a list, check it's non-empty
        if isinstance(client_data, list):
            if len(client_data) == 0:
                return {"complete": False, "reason": "Data array is empty"}
            return {"complete": True, "reason": f"Has {len(client_data)} entries"}

        # If data is a dict (e.g. Zustand store), check for non-empty state
        if isinstance(client_data, dict):
            # Check for common state indicators
            state = client_data.get("state", client_data)
            if not state:
                return {"complete": False, "reason": "State is empty"}
            return {"complete": True, "reason": "State data present"}

        return {"complete": True, "reason": "Data present"}

    def list_legacy_modules(self) -> list[dict[str, Any]]:
        """List all legacy modules with their contract summaries."""
        all_modules = self.module_service.list_modules(module_type="legacy")
        contracts = []
        for mod in all_modules:
            contract = self.get_contract(mod.slug)
            if contract:
                contracts.append(contract)
        return contracts


# Singleton
legacy_bridge = LegacyBridge()
