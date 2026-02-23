"""
Legacy Module Adapter Registry

Maps adapter names (from config.json dataAccess.adapter) to their
implementing classes. Use get_adapter() to instantiate.
"""

from typing import Any

from .base_adapter import BaseAdapter


def get_adapter(contract: dict[str, Any]) -> BaseAdapter:
    """
    Instantiate the correct adapter for a legacy module contract.

    Args:
        contract: Full contract dict (from legacy_bridge.get_contract())

    Returns:
        Adapter instance

    Raises:
        ValueError: If adapter name not found or dataAccess missing
    """
    data_access = contract.get("dataAccess")
    if not data_access:
        raise ValueError(f"Module '{contract.get('slug')}' has no dataAccess config")

    adapter_name = data_access.get("adapter")
    if not adapter_name:
        raise ValueError(f"Module '{contract.get('slug')}' has no adapter specified")

    # Lazy imports to avoid circular dependencies
    if adapter_name == "EmployeeGroupAdapter":
        from .employee_group_adapter import EmployeeGroupAdapter
        return EmployeeGroupAdapter(contract)
    elif adapter_name == "PayrollAreaAdapter":
        from .payroll_area_adapter import PayrollAreaAdapter
        return PayrollAreaAdapter(contract)
    elif adapter_name == "PersonnelAreaAdapter":
        from .personnel_area_adapter import PersonnelAreaAdapter
        return PersonnelAreaAdapter(contract)
    else:
        raise ValueError(f"Unknown adapter: '{adapter_name}'")


__all__ = ["BaseAdapter", "get_adapter"]
