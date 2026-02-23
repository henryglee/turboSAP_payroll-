"""
Payroll Area Adapter

Transforms localStorage data from the Payroll Area page
(turbosap-config Zustand store, state.payrollAreas) into standardized outputs.

Outputs:
- payroll_areas.csv: All payroll area definitions
"""

import logging
from typing import Any

from .base_adapter import BaseAdapter

logger = logging.getLogger(__name__)


class PayrollAreaAdapter(BaseAdapter):

    def validate(self, client_data: dict[str, Any]) -> tuple[bool, list[str]]:
        errors = []
        state = client_data.get("state", client_data)
        areas = state.get("payrollAreas", [])

        if not areas:
            errors.append("No payroll areas defined")
            return (False, errors)

        schema = self.outputs_schema.get("payrollAreas", {}).get("schema", {})
        errors.extend(self._check_required_fields(areas, schema, "payrollAreas"))

        return (len(errors) == 0, errors)

    def normalize(self, client_data: dict[str, Any]) -> dict[str, Any]:
        state = client_data.get("state", client_data)
        return {
            "payrollAreas": state.get("payrollAreas", []),
        }

    def to_csv(self, normalized: dict[str, Any]) -> dict[str, str]:
        columns = [
            {"key": "code", "label": "Payroll_Area_Code"},
            {"key": "description", "label": "Description"},
            {"key": "frequency", "label": "Frequency"},
            {"key": "calendarId", "label": "Calendar_ID"},
            {"key": "businessUnit", "label": "Business_Unit"},
            {"key": "timeZone", "label": "Time_Zone"},
            {"key": "union", "label": "Union"},
            {"key": "employeeCount", "label": "Employee_Count"},
            {"key": "generatedBy", "label": "Generated_By"},
            {"key": "periodPattern", "label": "Period_Pattern"},
            {"key": "payDay", "label": "Pay_Day"},
            {"key": "region", "label": "Region"},
        ]

        return {
            "payroll_areas.csv": self._dict_rows_to_csv(columns, normalized["payrollAreas"]),
        }
