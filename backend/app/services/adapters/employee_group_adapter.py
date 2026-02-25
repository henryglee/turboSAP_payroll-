"""
Employee Group Adapter

Transforms localStorage data from the Employee Group wizard
(turbosap-employee-group Zustand store) into standardized outputs.

Outputs:
- employee_group_subgroup.csv: Joined EG-ESG combinations
"""

import logging
from typing import Any

from .base_adapter import BaseAdapter

logger = logging.getLogger(__name__)


class EmployeeGroupAdapter(BaseAdapter):

    def validate(self, client_data: dict[str, Any]) -> tuple[bool, list[str]]:
        errors = []
        state = client_data.get("state", client_data)

        groups = state.get("employeeGroups", [])
        subgroups = state.get("employeeSubgroups", [])
        combos = state.get("validCombinations", [])

        if not groups:
            errors.append("No employee groups defined")
        if not subgroups:
            errors.append("No employee subgroups defined")
        if not combos:
            errors.append("No valid combinations defined")

        # Check required fields
        eg_schema = self.outputs_schema.get("employeeGroups", {}).get("schema", {})
        esg_schema = self.outputs_schema.get("employeeSubgroups", {}).get("schema", {})

        errors.extend(self._check_required_fields(groups, eg_schema, "employeeGroups"))
        errors.extend(self._check_required_fields(subgroups, esg_schema, "employeeSubgroups"))

        # Validate combination references
        eg_codes = {g["code"] for g in groups if g.get("code")}
        esg_codes = {s["code"] for s in subgroups if s.get("code")}
        for i, combo in enumerate(combos):
            if combo.get("egCode") not in eg_codes:
                errors.append(f"validCombinations[{i}]: egCode '{combo.get('egCode')}' not found in groups")
            if combo.get("esgCode") not in esg_codes:
                errors.append(f"validCombinations[{i}]: esgCode '{combo.get('esgCode')}' not found in subgroups")

        return (len(errors) == 0, errors)

    def normalize(self, client_data: dict[str, Any]) -> dict[str, Any]:
        state = client_data.get("state", client_data)
        return {
            "employeeGroups": state.get("employeeGroups", []),
            "employeeSubgroups": state.get("employeeSubgroups", []),
            "validCombinations": state.get("validCombinations", []),
            "dimensions": state.get("dimensions", {}),
        }

    def to_csv(self, normalized: dict[str, Any]) -> dict[str, str]:
        groups_by_code = {g["code"]: g for g in normalized["employeeGroups"]}
        subs_by_code = {s["code"]: s for s in normalized["employeeSubgroups"]}

        rows = []
        for combo in normalized["validCombinations"]:
            eg = groups_by_code.get(combo["egCode"], {})
            esg = subs_by_code.get(combo["esgCode"], {})
            rows.append({
                "eg_code": eg.get("code", ""),
                "eg_description": eg.get("description", ""),
                "esg_code": esg.get("code", ""),
                "esg_description": esg.get("description", ""),
            })

        columns = [
            {"key": "eg_code", "label": "Employee_Group"},
            {"key": "eg_description", "label": "EG_Description"},
            {"key": "esg_code", "label": "Employee_Subgroup"},
            {"key": "esg_description", "label": "ESG_Description"},
        ]

        return {
            "employee_group_subgroup.csv": self._dict_rows_to_csv(columns, rows),
        }
