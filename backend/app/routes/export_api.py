from __future__ import annotations

import csv
import io
import json
import sqlite3
import zipfile
from dataclasses import dataclass
from datetime import datetime, date, timedelta
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException, Header, Query, Body, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from ..data.ReachNettDataManager import ReachNettDataManager
from datetime import datetime, date, timedelta



router = APIRouter(prefix="/api/export", tags=["Export"])

dataManager = ReachNettDataManager()

API_KEY_NAME = "EXPORT-TURBOSAP-KEY"
VALID_API_KEY = "ts_live_9a72b841fc0246ba91d2977e"


def verify_turbosap_key(api_key: str = Header(None, alias=API_KEY_NAME)):
    """Verifies the custom TurboSAP header against the hardcoded service token."""
    if api_key != VALID_API_KEY:
        raise HTTPException(
            status_code=403, 
            detail="TurboSAP Unauthorized: Invalid EXPORT-TURBOSAP-KEY"
        )
    return api_key



@dataclass(frozen=True)
class SessionRecord:
    session_id: str
    config_state: Dict[str, Any]
    updated_at: datetime


# =========================
# API Models
# =========================

class ExportFileInfo(BaseModel):
    file_id: str
    filename: str
    module: str
    content_type: str = "text/csv"
    row_count: int = 0


class ExportFilesResponse(BaseModel):
    session_id: str
    files: List[ExportFileInfo]


class PersistPaymentRequest(BaseModel):
    methods: List[Dict[str, Any]] = Field(default_factory=list)
    checkRanges: List[Dict[str, Any]] = Field(default_factory=list)
    preNotificationRequired: bool = False

class PersistPayrollRequest(BaseModel):
    payrollAreas: List[Dict[str, Any]] = Field(default_factory=list)



# =========================
# # Helper Utilities
# =========================

SAP_DEFAULTS = {
    "PAYROLL_AREA_TEXT": "McCarthy",
    "RUN_PAYROLL": "X",
    "DATE_MODIFIER": "0",
    "TIME_UNIT": "03",
    "CALENDAR_START_DATE": "1/1/1990",
    "MOLGA": "10",
    "DATE_TYPE": "01",
    "PAY_DATE_ANCHOR": "2025-01-03", # Jan 3, 2025
    "PERIOD_ANCHOR": "2024-12-23",   # Dec 23, 2024
}

PAYDAY_TO_WEEKDAY = {
    "sunday": 0,    
    "monday": 1,    
    "tuesday": 2,
    "wednesday": 3,
    "thursday": 4,
    "friday": 5,
    "saturday": 6,
}


def format_date_padded(d: date) -> str:
    # matches frontend formatDatePadded -> "YYYYMMDD"
    return d.strftime("%Y%m%d")

def _parse_anchor(anchor_str: str) -> date:
    """
    Parses date strings from JSON into Python date objects.
    Handles ISO strings like '2025-01-10T00:00:00Z' or simple '2025-01-10'.
    """
    if not anchor_str:
        return date(2025, 1, 1) # Safe default if UI field was empty
    try:
        # Take only the YYYY-MM-DD portion
        return datetime.strptime(anchor_str[:10], "%Y-%m-%d").date()
    except Exception:
        return date.fromisoformat(anchor_str[:10])



def to_csv_with_labels(rows: List[Dict[str, Any]], columns: List[Tuple[str, str]]) -> str:
    """
    columns: [(key, label)]
    """
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")

    writer.writerow([label for _, label in columns])
    for r in rows:
        writer.writerow([r.get(key, "") for key, _ in columns])
    return buf.getvalue()

def find_closest_weekday(base: date, weekday_name: str) -> date:
    """
    Finds the closest date to 'base' that falls on 'weekday_name'.
    Matches the Sunday=0 convention of the React frontend.
    """
    target = PAYDAY_TO_WEEKDAY.get(weekday_name.lower())
    
    if target is None:
        return base

    # Python's base.weekday() is Monday=0, Tuesday=1 ... Sunday=6
    # We convert it to Sunday=0, Monday=1 ... Saturday=6
    base_dow_sun0 = (base.weekday() + 1) % 7

    # Calculate distance forward and backward
    forward = (target - base_dow_sun0 + 7) % 7
    backward = (base_dow_sun0 - target + 7) % 7

    # If the distance forward is less than or equal to backward, go forward.
    # Otherwise, go backward.
    offset = forward if forward <= backward else -backward

    return base + timedelta(days=offset)

# =========================
# Extractors: adapt to your config_state structure
# =========================

def extract_payroll_areas(config_state: Dict[str, Any]) -> List[Dict[str, Any]]:
    # Tries nested or flat structure
    pa = config_state.get("payroll_area", config_state)
    areas = pa.get("payrollAreas", [])
    return [a for a in areas if isinstance(a, dict)]



def extract_payment_bundle(config_state: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "methods": config_state.get("payment_methods", []),
        "checkRanges": config_state.get("check_ranges", []),
        "preNotificationRequired": config_state.get("pre_notification_required", False),
    }

def build_payment_methods_from_answers(config_state: Dict[str, Any]) -> List[Dict[str, Any]]:
    answers = config_state.get("answers")
    if not isinstance(answers, dict):
        return []

    # TODO: map your q1_* answers into actual SAP payment methods
    # Example stub:
    methods: List[Dict[str, Any]] = []

    # e.g. if they selected ACH + CHECK in some answer key:
    # if answers.get("payment_types") contains "ACH" -> append row

    return methods





# =========================
# Payroll generators (ported from your TS)
# =========================


def generate_payroll_areas_csv(areas: List[Dict[str, Any]]) -> str:
    cols = [
        ("code", "Code"),
        ("description", "Description"),
        ("frequency", "Frequency"),
        ("periodPattern", "Period Pattern"),
        ("payDay", "Pay Day"),
        ("calendarId", "Calendar ID"),
        ("employeeCount", "Employee Count"),
        ("businessUnit", "Business Unit"),
        ("region", "Region"),
    ]
    return to_csv_with_labels(areas, cols)


def generate_calendar_id_csv(areas: List[Dict[str, Any]]) -> str:
    seen = set()
    rows: List[Dict[str, Any]] = []

    freq_desc = {
        "weekly": "Weekly",
        "biweekly": "Bi-weekly",
        "semimonthly": "Semi-monthly",
        "monthly": "Monthly",
    }

    for a in areas:
        cal_id = str(a.get("calendarId") or "80")
        if cal_id in seen:
            continue
        seen.add(cal_id)

        frequency = str(a.get("frequency") or "")
        desc = str(a.get("description") or "")
        rows.append(
            {
                "period_parameters": cal_id,
                "period_parameter_name": desc or f"{freq_desc.get(frequency, frequency)} Payroll",
                "time_unit": SAP_DEFAULTS["TIME_UNIT"],
                "time_unit_desc": freq_desc.get(frequency, frequency),
                "start_date": SAP_DEFAULTS["CALENDAR_START_DATE"],
            }
        )

    cols = [
        ("period_parameters", "period_parameters"),
        ("period_parameter_name", "period_parameter_name"),
        ("time_unit", "time_unit"),
        ("time_unit_desc", "time_unit_desc"),
        ("start_date", "start_date"),
    ]
    return to_csv_with_labels(rows, cols)


def generate_payroll_area_config_csv(areas: List[Dict[str, Any]]) -> str:
    rows: List[Dict[str, Any]] = []
    for a in areas:
        rows.append(
            {
                "payroll_area": a.get("region") or a.get("code") or "",
                # FIX: Use the 'description' from the payload instead of SAP_DEFAULTS
                "payroll_area_text": SAP_DEFAULTS["PAYROLL_AREA_TEXT"],
                "period_parameters": str(a.get("calendarId") or "80"),
                "run_payroll": SAP_DEFAULTS["RUN_PAYROLL"],
                "date_modifier": SAP_DEFAULTS["DATE_MODIFIER"],
            }
        )
    cols = [
        ("payroll_area", "payroll_area"),
        ("payroll_area_text", "payroll_area_text"),
        ("period_parameters", "period_parameters"),
        ("run_payroll", "run_payroll"),
        ("date_modifier", "date_modifier"),
    ]
    return to_csv_with_labels(rows, cols)


def generate_pay_period_csv(area: Dict[str, Any], num_years: int = 1) -> str:
    raw_anchor = area.get("periodAnchor") or SAP_DEFAULTS["PERIOD_ANCHOR"]
    anchor = _parse_anchor(raw_anchor)
    frequency = str(area.get("frequency") or "weekly")
    cal_id = str(area.get("calendarId") or "80")

    rows: List[Dict[str, Any]] = []
    payroll_period = 1
    current_year: Optional[int] = None
    prior_counter = 0

    def push_row(begin: date, end: date) -> None:
        nonlocal payroll_period, current_year, prior_counter
        payroll_year = end.year
        prior_year = end.year

        if current_year is None or current_year != prior_year:
            current_year = prior_year
            prior_counter = 1
        else:
            prior_counter += 1

        rows.append(
            {
                "period_parameters": cal_id,
                "payroll_year": str(payroll_year),
                "payroll_period": str(payroll_period).zfill(2),
                "period_begin_date": format_date_padded(begin),
                "period_end_date": format_date_padded(end),
                "prior_period_year": str(prior_year),
                "prior_period_period": str(prior_counter).zfill(2),
            }
        )
        payroll_period += 1

    if frequency == "weekly":
        total = 52 * num_years
        for i in range(total):
            begin = anchor + timedelta(days=i * 7)
            end = begin + timedelta(days=6)
            push_row(begin, end)

    elif frequency == "biweekly":
        total = 26 * num_years
        for i in range(total):
            begin = anchor + timedelta(days=i * 14)
            end = begin + timedelta(days=13)
            push_row(begin, end)

    elif frequency == "semimonthly":
        # 24 periods per year, fixed 1-15 / 16-end
        cursor = anchor
        for _ in range(12 * num_years):
            y, m = cursor.year, cursor.month
            push_row(date(y, m, 1), date(y, m, 15))
            # end of month:
            next_month = date(y, m, 28) + timedelta(days=4)
            last_day = (next_month.replace(day=1) - timedelta(days=1)).day
            push_row(date(y, m, 16), date(y, m, last_day))
            # advance to 1st of next month:
            if m == 12:
                cursor = date(y + 1, 1, 1)
            else:
                cursor = date(y, m + 1, 1)

    elif frequency == "monthly":
        cursor = anchor
        for _ in range(12 * num_years):
            y, m = cursor.year, cursor.month
            # last day of month:
            next_month = date(y, m, 28) + timedelta(days=4)
            last_day = (next_month.replace(day=1) - timedelta(days=1)).day
            push_row(date(y, m, 1), date(y, m, last_day))
            cursor = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)

    else:
        # fallback weekly
        total = 52 * num_years
        for i in range(total):
            begin = anchor + timedelta(days=i * 7)
            end = begin + timedelta(days=6)
            push_row(begin, end)

    cols = [
        ("period_parameters", "period_parameters"),
        ("payroll_year", "payroll_year"),
        ("payroll_period", "payroll_period"),
        ("period_begin_date", "period_begin_date"),
        ("period_end_date", "period_end_date"),
        ("prior_period_year", "prior_period_year"),
        ("prior_period_period", "prior_period_period"),
    ]
    return to_csv_with_labels(rows, cols)


# def generate_pay_date_csv(area: Dict[str, Any], num_years: int = 1) -> str:
#     raw_anchor = area.get("payDateAnchor") or area.get("periodAnchor") or SAP_DEFAULTS["PAY_DATE_ANCHOR"]
#     anchor = _parse_anchor(raw_anchor)

#     frequency = str(area.get("frequency") or "weekly")
#     cal_id = str(area.get("calendarId") or "80")
#     pay_day = str(area.get("payDay") or "friday").lower()


#     rows: List[Dict[str, Any]] = []

#     if frequency in ("weekly", "biweekly"):
#         step = 7 if frequency == "weekly" else 14
#         total = (52 if step == 7 else 26) * num_years
#         first = find_closest_weekday(anchor, pay_day)
#         current = first

#         current_year: Optional[int] = None
#         period_counter = 0

#         for _ in range(total):
#             y = current.year
#             if current_year is None or current_year != y:
#                 current_year = y
#                 period_counter = 1
#             else:
#                 period_counter += 1

#             rows.append(
#                 {
#                     "molga": SAP_DEFAULTS["MOLGA"],
#                     "date_modifier": SAP_DEFAULTS["DATE_MODIFIER"],
#                     "period_parameters": cal_id,
#                     "payroll_year": str(y),
#                     "payroll_period": str(period_counter).zfill(2),
#                     "date_type": SAP_DEFAULTS["DATE_TYPE"],
#                     "date": format_date_padded(current),
#                 }
#             )
#             current = current + timedelta(days=step)

#     else:
#         # To keep parity with your TS semi/monthly logic, you can port those
#         # helper functions too. For now, most clients using weekly/biweekly will work.
#         raise HTTPException(
#             status_code=400,
#             detail="pay-date generation currently implemented for weekly/biweekly only. Port semi/monthly if needed.",
#         )

#     cols = [
#         ("molga", "molga"),
#         ("date_modifier", "date_modifier"),
#         ("period_parameters", "period_parameters"),
#         ("payroll_year", "payroll_year"),
#         ("payroll_period", "payroll_period"),
#         ("date_type", "date_type"),
#         ("date", "date"),
#     ]
#     return to_csv_with_labels(rows, cols)

def generate_pay_date_csv(area: Dict[str, Any], num_years: int = 1) -> str:
    """
    Generates Payroll Date Configuration CSV.
    Matches the logic in PayrollResultCard.tsx handleExportPayDateConfigCSV.
    """
    # 1. Extraction from Payload
    raw_anchor = area.get("payDateAnchor") or SAP_DEFAULTS["PAY_DATE_ANCHOR"]
    anchor = _parse_anchor(raw_anchor)
    
    frequency = str(area.get("frequency") or "weekly").lower()
    cal_id = str(area.get("calendarId") or "80")
    pay_day_input = str(area.get("payDay") or "friday").lower()

    rows = []
    current_date = None
    num_rows = 0
    step_days = 7
    use_simple_step = False

    # 2. Determine Initial Date and Iteration Count (Matching React logic)
    if frequency in ("weekly", "biweekly"):
        first_pay_date = find_closest_weekday(anchor, pay_day_input)
        current_date = first_pay_date
        use_simple_step = True
        if frequency == "weekly":
            step_days = 7
            num_rows = 52 * num_years
        else:
            step_days = 14
            num_rows = 26 * num_years
            
    elif frequency == "semimonthly":
        # Note: If implementing Semi-monthly/Monthly, follow the logic 
        # from getFirstSemiMonthlyPayDate in your React file.
        # Fallback to simple logic for now or raise 400.
        num_rows = 24 * num_years
        current_date = anchor # Simplified fallback
        
    else:
        # Fallback to weekly
        current_date = find_closest_weekday(anchor, "friday")
        use_simple_step = True
        step_days = 7
        num_rows = 52 * num_years

    # 3. Generation Loop
    current_year_tracker = None
    payroll_period_counter = 0

    for _ in range(num_rows):
        y = current_date.year
        
        # Reset period counter when year changes
        if current_year_tracker is None or current_year_tracker != y:
            current_year_tracker = y
            payroll_period_counter = 1
        else:
            payroll_period_counter += 1

        rows.append({
            "molga": SAP_DEFAULTS["MOLGA"],
            "date_modifier": SAP_DEFAULTS["DATE_MODIFIER"],
            "period_parameters": cal_id,
            "payroll_year": str(y),
            "payroll_period": str(payroll_period_counter).zfill(2),
            "date_type": SAP_DEFAULTS["DATE_TYPE"],
            "date": format_date_padded(current_date),
        })

        if use_simple_step:
            current_date += timedelta(days=step_days)
        else:
            # Placeholder for Semi-monthly logic increment
            current_date += timedelta(days=15) 

    # 4. CSV Formatting
    output = io.StringIO()
    # Write headers exactly as they appear in the UI
    headers = ["molga", "date_modifier", "period_parameters", "payroll_year", "payroll_period", "date_type", "date"]
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    writer.writerows(rows)
    
    return output.getvalue()


# =========================
# Payment generators (ported)
# =========================

def generate_payment_method_csv(methods: List[Dict[str, Any]]) -> str:
    cols = [
        ("payment_method", "Payment_Method"),
        ("description", "Description"),
        ("used", "Used"),
    ]
    return to_csv_with_labels(methods, cols)


def generate_check_range_csv(ranges: List[Dict[str, Any]]) -> str:
    cols = [
        ("company_code", "Company_Code"),
        ("bank_account", "Bank_Account"),
        ("check_number_range", "Check_Number_Range"),
    ]
    return to_csv_with_labels(ranges, cols)


def generate_pre_notification_csv(required: bool) -> str:
    cols = [("pre_notification_required", "Pre_Notification_Required")]
    row = {"pre_notification_required": "Yes" if required else "No"}
    return to_csv_with_labels([row], cols)

# =========================
# company code generators 
# =========================

def generate_company_code_csv(codes: list) -> str:
    """
    Generates CSV content for Company Codes.
    Matches the schema defined in the TypeScript CompanyCodeRow interface.
    """
    # Define headers exactly as they appear in your TS Export logic
    headers = [
        "Company_Code", "Company_Name", "Short_Name", "Currency", "Language",
        "Street", "City", "State", "Zip_Code", "Country", "PO_Box",
        "Chart_of_Accounts", "Fiscal_Year_Variant", "VAT_Registration_Number",
        "Credit_Control_Area", "Tax_Jurisdiction_Code"
    ]
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)

    for c in codes:
        # We use .get() to avoid KeyErrors if a field is missing in the JSON
        writer.writerow([
            c.get("companyCode", ""),
            c.get("companyName", ""),
            c.get("shortName", ""),
            c.get("currency", ""),
            c.get("language", ""),
            c.get("street", ""),
            c.get("city", ""),
            c.get("state", ""),
            c.get("zipCode", ""),
            c.get("country", ""),
            c.get("poBox", ""),
            c.get("chartOfAccounts", ""),
            c.get("fiscalYearVariant", ""),
            c.get("vatRegistrationNumber", ""),
            c.get("creditControlArea", ""),
            c.get("taxJurisdictionCode", "")
        ])

    return output.getvalue()


# =========================
# File registry (API file ids)
# (match your ExportCenterPage)
# =========================

# Static file definitions (non-calendar-specific)
FILE_DEFS = [
    # payroll (static files)
    ("payroll-areas", "payroll_areas.csv", "payroll"),
    ("calendar-id", "calendar_id.csv", "payroll"),
    ("payroll-area-config", "payroll_area_config.csv", "payroll"),
    # NOTE: pay-period and pay-date are now dynamic per-calendar, see build_files_for_session()
    # payment
    ("payment-method", "payment_method.csv", "payment"),
    ("check-range", "check_range.csv", "payment"),
    ("pre-notification", "pre_notification.csv", "payment"),
]


def get_unique_calendars(payroll_areas: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """
    Get unique calendar IDs mapped to their representative payroll area.
    Returns {calendar_id: area_dict} for the first area with each calendar.
    """
    calendar_map: Dict[str, Dict[str, Any]] = {}
    for area in payroll_areas:
        cal_id = str(area.get("calendarId") or "80")
        if cal_id not in calendar_map:
            calendar_map[cal_id] = area
    return calendar_map


def build_files_for_session(sess: SessionRecord) -> List[ExportFileInfo]:
    """
    Build list of available export files for a session.
    Now includes dynamic per-calendar pay-period and pay-date files.
    """
    config = sess.config_state
    payroll_areas = extract_payroll_areas(config)
    payment = extract_payment_bundle(config)

    # precompute payment pieces
    payment_methods: List[Dict[str, Any]] = []
    payment_ranges: List[Dict[str, Any]] = []

    if payment:
        pm = payment.get("methods")
        if isinstance(pm, list):
            payment_methods = [x for x in pm if isinstance(x, dict)]
        cr = payment.get("checkRanges")
        if isinstance(cr, list):
            payment_ranges = [x for x in cr if isinstance(x, dict)]

    infos: List[ExportFileInfo] = []

    # Add static files from FILE_DEFS
    for file_id, filename, module in FILE_DEFS:
        row_count = 0
        if module == "payroll":
            if file_id in ("payroll-areas", "payroll-area-config"):
                row_count = len(payroll_areas)
            elif file_id == "calendar-id":
                row_count = len({str(a.get("calendarId") or "80") for a in payroll_areas})
        else:
            if file_id == "payment-method":
                row_count = len(payment_methods)
            elif file_id == "check-range":
                row_count = len(payment_ranges)
            elif file_id == "pre-notification":
                row_count = 1 if payment is not None else 0

        infos.append(
            ExportFileInfo(
                file_id=file_id,
                filename=filename,
                module=module,
                row_count=row_count,
            )
        )

    # Add dynamic per-calendar pay-period and pay-date files
    calendar_map = get_unique_calendars(payroll_areas)
    for cal_id, area in calendar_map.items():
        frequency = str(area.get("frequency") or "weekly").lower()

        # Estimate row count based on frequency (1 year of periods)
        freq_to_periods = {
            "weekly": 52,
            "biweekly": 26,
            "semimonthly": 24,
            "monthly": 12,
        }
        estimated_rows = freq_to_periods.get(frequency, 52)

        # Add pay-period file for this calendar
        infos.append(
            ExportFileInfo(
                file_id=f"pay-period-{cal_id}",
                filename=f"pay_period_{cal_id}.csv",
                module="payroll",
                row_count=estimated_rows,
            )
        )

        # Add pay-date file for this calendar
        infos.append(
            ExportFileInfo(
                file_id=f"pay-date-{cal_id}",
                filename=f"pay_date_{cal_id}.csv",
                module="payroll",
                row_count=estimated_rows,
            )
        )

    return infos


def generate_file_content(sess: SessionRecord, file_id: str) -> str:
    config = sess.config_state
    # payroll_areas = config.get("payroll_areas") or extract_payroll_areas(config)
    payroll_areas = config.get("payroll_areas", [])
    if not payroll_areas and "payroll_area" in config:
        payroll_areas = config["payroll_area"].get("payrollAreas", [])

    payment = extract_payment_bundle(config)

    # Payroll static files
    if file_id == "payroll-areas":
        return generate_payroll_areas_csv(payroll_areas)

    if file_id == "calendar-id":
        return generate_calendar_id_csv(payroll_areas)

    if file_id == "payroll-area-config":
        return generate_payroll_area_config_csv(payroll_areas)
    
    print(11111111)

    # Dynamic per-calendar pay-period files (e.g., pay-period-80, pay-period-81)
    if file_id.startswith("pay-period-"):
        calendar_id = file_id.replace("pay-period-", "")
        calendar_map = get_unique_calendars(payroll_areas)
        area = calendar_map.get(calendar_id)
        if not area:
            raise HTTPException(status_code=404, detail=f"No payroll area found with calendar ID: {calendar_id}")
        return generate_pay_period_csv(area)

    # Dynamic per-calendar pay-date files (e.g., pay-date-80, pay-date-81)
    if file_id.startswith("pay-date-"):
        print(222222222)
        calendar_id = file_id.replace("pay-date-", "")
        calendar_map = get_unique_calendars(payroll_areas)
        area = calendar_map.get(calendar_id)
        if not area:
            raise HTTPException(status_code=404, detail=f"No payroll area found with calendar ID: {calendar_id}")
        return generate_pay_date_csv(area)

    # Backward compatibility: legacy pay-period/pay-date (uses first area)
    if file_id == "pay-period":
        if not payroll_areas:
            return ""
        return generate_pay_period_csv(payroll_areas[0])

    if file_id == "pay-date":
        if not payroll_areas:
            return ""
        return generate_pay_date_csv(payroll_areas[0])

    # Payment
    if file_id == "payment-method":
    # 1) preferred: already stored
       pm_list = config.get("payment_methods")
       if isinstance(pm_list, list) and pm_list:
          return generate_payment_method_csv([m for m in pm_list if isinstance(m, dict)])

    # 2) fallback: derive from answers
       derived = build_payment_methods_from_answers(config)
       return generate_payment_method_csv(derived)
    
    if file_id == "check-range":
        if not payment:
            return ""
        ranges = payment.get("checkRanges") if isinstance(payment.get("checkRanges"), list) else []
        ranges = [r for r in ranges if isinstance(r, dict)]
        return generate_check_range_csv(ranges)

    if file_id == "pre-notification":
        if not payment:
            return ""
        required = payment.get("preNotificationRequired")
        if not isinstance(required, bool):
            required = True
        return generate_pre_notification_csv(required)


    # Company code config
    if file_id == "company-code":
        # Look for the 'company_codes' key you defined in useExportData.ts
        company_codes = config.get("company_codes", [])
        if not company_codes:
            # Fallback check for the singular version if needed
            company_codes = config.get("company_code", [])
        return generate_company_code_csv(company_codes)


    raise HTTPException(status_code=404, detail="Unknown file_id")


def get_filename(file_id: str) -> str:
    """
    Get the filename for a given file_id.
    Handles both static FILE_DEFS and dynamic per-calendar files.
    """
    # Check static file definitions first
    for fid, fname, _ in FILE_DEFS:
        if fid == file_id:
            return fname

    # Handle dynamic per-calendar filenames
    if file_id.startswith("pay-period-"):
        calendar_id = file_id.replace("pay-period-", "")
        return f"pay_period_{calendar_id}.csv"

    if file_id.startswith("pay-date-"):
        calendar_id = file_id.replace("pay-date-", "")
        return f"pay_date_{calendar_id}.csv"

    # Backward compatibility for legacy file IDs
    if file_id == "pay-period":
        return "pay_period.csv"
    if file_id == "pay-date":
        return "pay_date.csv"

    return f"{file_id}.csv"


# =========================
# Routes
# =========================

MODULE_MAP = {
    "payroll": "payroll area",
    "payment": "payment method",
}

def normalize_file_id(file_id: str) -> str:
    return file_id.replace("_", "-").strip().lower()

@router.post("/publish/{company_name}/{company_code}")
async def publish_configuration(
    company_name: str,
    company_code: str,
    payload: Dict[str, Any] = Body(...),
    api_key: str = Depends(verify_turbosap_key)
):
    """Saves the combined frontend state into S3 as the canonical 'export_config'."""
    try:
        # dataManager uses KnowledgebaseUploadService under the hood
        object_key = dataManager.save_task(
            company_name=company_name,
            company_code=company_code,
            task_name="export_config",
            data=payload
        )

        
        return {"status": "success", "published_to": object_key}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"S3 Upload Failed: {str(e)}")

@router.get("/download/")
def download_published_file(
    company_name: str = Query(..., alias="company_name"),
    company_code: str = Query(..., alias="company_code"),
    file_id: str = Query(..., alias="file_id"),
    api_key: str = Depends(verify_turbosap_key)
):
    """
    Uses DataManager to load the 'export_config' task from S3,
    then generates the CSV on-the-fly.
    """
    TASK_NAME = "export_config"
    
    # 1. Load the latest JSON task from S3
    config_state = dataManager.load_task(company_name, company_code, TASK_NAME)    
    if not config_state:
        raise HTTPException(
            status_code=404, 
            detail=f"No published configuration found for {company_name}"
        )

        # 2. Wrap the state in a SessionRecord for your existing generators
    sess = SessionRecord(
        session_id=f"{company_name}_{company_code}",
        updated_at=datetime.utcnow(),
        config_state=config_state
    )

    # 3. Generate content using your existing formatting logic
    normalized_file_id = normalize_file_id(file_id)  
    content = generate_file_content(sess, normalized_file_id)
    filename = get_filename(normalized_file_id)

    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )