"""
Personnel Area Adapter

Transforms localStorage data from the Personnel Area V2 wizard
(turbosap-personnel-area-v2 Zustand store) into standardized outputs.

Outputs:
- personnel_areas_t500p.csv: Personnel areas (SAP T500P format: PERSA, NAME1, BUKRS)
- personnel_subareas_t001p.csv: Personnel subareas (SAP T001P format: WERKS, BTRTL, BTEXT)
"""

import logging
from typing import Any

from .base_adapter import BaseAdapter

logger = logging.getLogger(__name__)


class PersonnelAreaAdapter(BaseAdapter):

    def validate(self, client_data: dict[str, Any]) -> tuple[bool, list[str]]:
        errors = []
        state = client_data.get("state", client_data)

        regions = state.get("regions", [])
        if not regions:
            errors.append("No regions (personnel areas) defined")
            return (False, errors)

        # Validate region fields
        region_schema = self.outputs_schema.get("regions", {}).get("schema", {})
        errors.extend(self._check_required_fields(regions, region_schema, "regions"))

        # Validate subareas for regions that need them
        subareas = state.get("subareas", [])
        subarea_schema = self.outputs_schema.get("subareas", {}).get("schema", {})
        errors.extend(self._check_required_fields(subareas, subarea_schema, "subareas"))

        # Validate company code assignment
        cc_mode = state.get("companyCodeMode", "same")
        if cc_mode == "same" and not state.get("globalCompanyCode"):
            errors.append("companyCodeMode is 'same' but no globalCompanyCode set")
        elif cc_mode == "individual":
            region_ccs = state.get("regionCompanyCodes", {})
            for region in regions:
                if region["id"] not in region_ccs:
                    errors.append(f"Region '{region.get('name', region['id'])}' has no company code assigned")

        return (len(errors) == 0, errors)

    def normalize(self, client_data: dict[str, Any]) -> dict[str, Any]:
        state = client_data.get("state", client_data)
        return {
            "regions": state.get("regions", []),
            "subareas": state.get("subareas", []),
            "companyCodeAssignment": {
                "companyCodeMode": state.get("companyCodeMode", "same"),
                "globalCompanyCode": state.get("globalCompanyCode", ""),
                "regionCompanyCodes": state.get("regionCompanyCodes", {}),
            },
            "orgType": state.get("orgType"),
            "differenceFactors": state.get("differenceFactors", []),
        }

    def _get_company_code(self, normalized: dict[str, Any], region_id: str) -> str:
        """Resolve the company code for a region."""
        assignment = normalized["companyCodeAssignment"]
        if assignment["companyCodeMode"] == "same":
            return assignment.get("globalCompanyCode", "")
        return assignment.get("regionCompanyCodes", {}).get(region_id, "")

    def to_csv(self, normalized: dict[str, Any]) -> dict[str, str]:
        regions = normalized["regions"]
        subareas = normalized["subareas"]

        # T500P: Personnel Areas
        t500p_rows = []
        for region in regions:
            t500p_rows.append({
                "persa": region.get("code", ""),
                "name1": region.get("name", ""),
                "bukrs": self._get_company_code(normalized, region["id"]),
            })

        t500p_columns = [
            {"key": "persa", "label": "PERSA"},
            {"key": "name1", "label": "NAME1"},
            {"key": "bukrs", "label": "BUKRS"},
        ]

        # T001P: Personnel Subareas
        t001p_rows = []
        regions_by_id = {r["id"]: r for r in regions}

        for subarea in subareas:
            region = regions_by_id.get(subarea.get("regionId"), {})
            t001p_rows.append({
                "werks": region.get("code", ""),
                "btrtl": subarea.get("code", ""),
                "btext": subarea.get("description", ""),
            })

        # If a region has needsSubareas but no subareas, add a default
        subarea_region_ids = {s.get("regionId") for s in subareas}
        for region in regions:
            if region.get("needsSubareas") and region["id"] not in subarea_region_ids:
                t001p_rows.append({
                    "werks": region.get("code", ""),
                    "btrtl": "9999",
                    "btext": "General",
                })

        t001p_columns = [
            {"key": "werks", "label": "WERKS"},
            {"key": "btrtl", "label": "BTRTL"},
            {"key": "btext", "label": "BTEXT"},
        ]

        return {
            "personnel_areas_t500p.csv": self._dict_rows_to_csv(t500p_columns, t500p_rows),
            "personnel_subareas_t001p.csv": self._dict_rows_to_csv(t001p_columns, t001p_rows),
        }
