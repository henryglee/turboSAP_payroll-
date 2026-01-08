from __future__ import annotations

import csv
import io
import json
import sqlite3
import zipfile
from dataclasses import dataclass
from datetime import datetime, date, timedelta
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException, Query, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field


router = APIRouter(prefix="/api/export", tags=["Export"])


DB_PATH = "turbosap.db"  # backend runs from turbosap.db location


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@dataclass(frozen=True)
class SessionRecord:
    session_id: str
    user_id: int
    module: str
    updated_at: datetime
    config_state: Dict[str, Any]


def _parse_sqlite_ts(value: Any) -> datetime:
    if value is None:
        return datetime.utcnow()
    if isinstance(value, datetime):
        return value
    s = str(value)
    try:
        return datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
    except Exception:
        pass
    # ISO fallback
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return datetime.utcnow()


def load_session(session_id: str) -> SessionRecord:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, user_id, module, updated_at, config_state FROM sessions WHERE id=?",
            (session_id,),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        config_state = json.loads(row["config_state"])
        if not isinstance(config_state, dict):
            raise ValueError("config_state must be a JSON object")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invalid config_state JSON: {e}")

    return SessionRecord(
        session_id=row["id"],
        user_id=int(row["user_id"]),
        module=str(row["module"]),
        updated_at=_parse_sqlite_ts(row["updated_at"]),
        config_state=config_state,
    )


def load_latest_session(module: str) -> Optional[SessionRecord]:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT id, user_id, module, updated_at, config_state
            FROM sessions
            WHERE module=?
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            (module,),
        ).fetchone()

    if not row:
        return None

    try:
        config_state = json.loads(row["config_state"])
        if not isinstance(config_state, dict):
            config_state = {}
    except Exception:
        config_state = {}

    return SessionRecord(
        session_id=row["id"],
        user_id=int(row["user_id"]),
        module=str(row["module"]),
        updated_at=_parse_sqlite_ts(row["updated_at"]),
        config_state=config_state,
    )


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


class LatestSessionResponse(BaseModel):
    module: str
    session_id: str
    updated_at: datetime


class LatestAllSessionsResponse(BaseModel):
    payroll: Optional[LatestSessionResponse] = None
    payment: Optional[LatestSessionResponse] = None


# =========================
# CSV helpers (match TS behavior)
# =========================

SAP_DEFAULTS = {
    "MOLGA": "10",
    "DATE_MODIFIER": "01",
    "DATE_TYPE": "01",
    "TIME_UNIT": "D",
    "CALENDAR_START_DATE": "19000101",
    # Match your frontend exportUtils:
    # If frontend uses a fixed anchor string like "2024-01-01", replicate here.
    "PERIOD_ANCHOR": "2024-01-01",
    "PAY_DATE_ANCHOR": "2024-01-01",
    "PAYROLL_AREA_TEXT": "Payroll Area",
    "RUN_PAYROLL": "X",
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


# =========================
# Extractors: adapt to your config_state structure
# =========================

def extract_payroll_areas(config_state: Dict[str, Any]) -> List[Dict[str, Any]]:
    # NEW: combined session shape
    if isinstance(config_state.get("payroll_area"), dict):
        pa = config_state["payroll_area"]
        areas = pa.get("payrollAreas")
        if isinstance(areas, list):
            return [a for a in areas if isinstance(a, dict)]

    # Backward compatible: old root shape
    areas = config_state.get("payrollAreas")
    if isinstance(areas, list):
        return [a for a in areas if isinstance(a, dict)]

    return []



def extract_payment_bundle(config_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    pm_list = config_state.get("payment_methods")
    cr_list = config_state.get("check_ranges")
    pre = config_state.get("pre_notification_required")

    if isinstance(pm_list, list) or isinstance(cr_list, list) or isinstance(pre, bool):
        return {
            "methods": [x for x in (pm_list or []) if isinstance(x, dict)],
            "checkRanges": [x for x in (cr_list or []) if isinstance(x, dict)],
            "preNotificationRequired": pre if isinstance(pre, bool) else False,
        }

    # keep your other fallbacks if you want...
    return None


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

def _parse_anchor(s: str) -> date:
    # accept "YYYY-MM-DD"
    y, m, d = s.split("-")
    return date(int(y), int(m), int(d))


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
    anchor = _parse_anchor(SAP_DEFAULTS["PERIOD_ANCHOR"])
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


def generate_pay_date_csv(area: Dict[str, Any], num_years: int = 1) -> str:
    anchor = _parse_anchor(SAP_DEFAULTS["PAY_DATE_ANCHOR"])
    frequency = str(area.get("frequency") or "weekly")
    cal_id = str(area.get("calendarId") or "80")
    pay_day = str(area.get("payDay") or "friday").lower()

    def find_closest_weekday(base: date, weekday_name: str) -> date:
        target = PAYDAY_TO_WEEKDAY.get(weekday_name)
        if target is None:
            return base
        base_dow = base.weekday()  # Monday=0..Sunday=6
        # Our mapping is Sunday=0..Saturday=6; convert:
        # convert base.weekday() to Sunday=0..Saturday=6
        base_dow_sun0 = (base_dow + 1) % 7

        forward = (target - base_dow_sun0 + 7) % 7
        backward = (base_dow_sun0 - target + 7) % 7
        offset = forward if forward <= backward else -backward
        return base + timedelta(days=offset)

    rows: List[Dict[str, Any]] = []

    if frequency in ("weekly", "biweekly"):
        step = 7 if frequency == "weekly" else 14
        total = (52 if step == 7 else 26) * num_years
        first = find_closest_weekday(anchor, pay_day)
        current = first

        current_year: Optional[int] = None
        period_counter = 0

        for _ in range(total):
            y = current.year
            if current_year is None or current_year != y:
                current_year = y
                period_counter = 1
            else:
                period_counter += 1

            rows.append(
                {
                    "molga": SAP_DEFAULTS["MOLGA"],
                    "date_modifier": SAP_DEFAULTS["DATE_MODIFIER"],
                    "period_parameters": cal_id,
                    "payroll_year": str(y),
                    "payroll_period": str(period_counter).zfill(2),
                    "date_type": SAP_DEFAULTS["DATE_TYPE"],
                    "date": format_date_padded(current),
                }
            )
            current = current + timedelta(days=step)

    else:
        # To keep parity with your TS semi/monthly logic, you can port those
        # helper functions too. For now, most clients using weekly/biweekly will work.
        raise HTTPException(
            status_code=400,
            detail="pay-date generation currently implemented for weekly/biweekly only. Port semi/monthly if needed.",
        )

    cols = [
        ("molga", "molga"),
        ("date_modifier", "date_modifier"),
        ("period_parameters", "period_parameters"),
        ("payroll_year", "payroll_year"),
        ("payroll_period", "payroll_period"),
        ("date_type", "date_type"),
        ("date", "date"),
    ]
    return to_csv_with_labels(rows, cols)


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
# File registry (API file ids)
# (match your ExportCenterPage)
# =========================

FILE_DEFS = [
    # payroll
    ("payroll-areas", "payroll_areas.csv", "payroll"),
    ("calendar-id", "calendar_id.csv", "payroll"),
    ("payroll-area-config", "payroll_area_config.csv", "payroll"),
    ("pay-period", "pay_period.csv", "payroll"),
    ("pay-date", "pay_date.csv", "payroll"),
    # payment
    ("payment-method", "payment_method.csv", "payment"),
    ("check-range", "check_range.csv", "payment"),
    ("pre-notification", "pre_notification.csv", "payment"),
]


def build_files_for_session(sess: SessionRecord) -> List[ExportFileInfo]:
    # Determine availability and row counts
    config = sess.config_state
    payroll_areas = extract_payroll_areas(config)
    payment = extract_payment_bundle(config)

    # precompute payment pieces
    payment_methods: List[Dict[str, Any]] = []
    payment_ranges: List[Dict[str, Any]] = []
    pre_note_required: Optional[bool] = None

    if payment:
        pm = payment.get("methods")
        if isinstance(pm, list):
            payment_methods = [x for x in pm if isinstance(x, dict)]
        cr = payment.get("checkRanges")
        if isinstance(cr, list):
            payment_ranges = [x for x in cr if isinstance(x, dict)]
        pnr = payment.get("preNotificationRequired")
        if isinstance(pnr, bool):
            pre_note_required = pnr

    infos: List[ExportFileInfo] = []
    for file_id, filename, module in FILE_DEFS:
        row_count = 0
        if module == "payroll":
            if file_id in ("payroll-areas", "payroll-area-config"):
                row_count = len(payroll_areas)
            elif file_id == "calendar-id":
                row_count = len({str(a.get("calendarId") or "80") for a in payroll_areas})
            elif file_id in ("pay-period", "pay-date"):
                # this is per "first area" like your frontend
                row_count = 52 if payroll_areas else 0
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
    return infos


def generate_file_content(sess: SessionRecord, file_id: str) -> str:
    config = sess.config_state
    payroll_areas = extract_payroll_areas(config)
    payment = extract_payment_bundle(config)

    # Payroll
    if file_id == "payroll-areas":
        return generate_payroll_areas_csv(payroll_areas)

    if file_id == "calendar-id":
        return generate_calendar_id_csv(payroll_areas)

    if file_id == "payroll-area-config":
        return generate_payroll_area_config_csv(payroll_areas)

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

    raise HTTPException(status_code=404, detail="Unknown file_id")


def get_filename(file_id: str) -> str:
    for fid, fname, _ in FILE_DEFS:
        if fid == file_id:
            return fname
    return f"{file_id}.csv"


# =========================
# Routes
# =========================

MODULE_MAP = {
    "payroll": "payroll area",
    "payment": "payment method",
}

def update_session_config_state(session_id: str, patch: Dict[str, Any]) -> None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT config_state FROM sessions WHERE id=?",
            (session_id,),
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Session not found")

        try:
            state = json.loads(row["config_state"]) if row["config_state"] else {}
            if not isinstance(state, dict):
                state = {}
        except Exception:
            state = {}

        # merge patch
        state.update(patch)

        conn.execute(
            "UPDATE sessions SET config_state=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (json.dumps(state), session_id),
        )

@router.post("/sessions/{session_id}/persist-payment")
def persist_payment(session_id: str, req: PersistPaymentRequest):
    # store in the exact keys your export reader expects
    update_session_config_state(
        session_id,
        {
            "payment_methods": req.methods,
            "check_ranges": req.checkRanges,
            "pre_notification_required": req.preNotificationRequired,
        },
    )
    return {"ok": True, "session_id": session_id, "payment_methods_count": len(req.methods)}

@router.post("/sessions/{session_id}/persist-payroll")
def persist_payroll(session_id: str, req: PersistPayrollRequest):
    # store in the exact keys your extract_payroll_areas expects
    update_session_config_state(
        session_id,
        {
            "payrollAreas": req.payrollAreas,  
        },
    )
    return {"ok": True, "session_id": session_id, "payroll_areas_count": len(req.payrollAreas)}

@router.patch("/sessions/{session_id}/state")
def patch_session_state(session_id: str, payload: Dict[str, Any] = Body(...)):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="payload must be a JSON object")

    with get_conn() as conn:
        row = conn.execute(
            "SELECT config_state FROM sessions WHERE id=?",
            (session_id,),
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Session not found")

        state_raw = row["config_state"] or "{}"
        try:
            state = json.loads(state_raw)
        except Exception:
            state = {}

        if not isinstance(state, dict):
            state = {}

        # merge keys
        state.update(payload)

        conn.execute(
            "UPDATE sessions SET config_state=?, updated_at=datetime('now') WHERE id=?",
            (json.dumps(state), session_id),
        )

    return {"ok": True, "updated_keys": list(payload.keys())}


@router.get("/latest", response_model=LatestSessionResponse | LatestAllSessionsResponse)
def latest(module: str = Query(..., description="payroll | payment | all")):

    if module == "all":
        payroll = load_latest_session(MODULE_MAP["payroll"])
        payment = load_latest_session(MODULE_MAP["payment"])
        return LatestAllSessionsResponse(
            payroll=LatestSessionResponse(module="payroll", session_id=payroll.session_id, updated_at=payroll.updated_at) if payroll else None,
            payment=LatestSessionResponse(module="payment", session_id=payment.session_id, updated_at=payment.updated_at) if payment else None,
        )

    if module not in ("payroll", "payment"):
        raise HTTPException(status_code=400, detail="module must be payroll, payment, or all")

    db_module = MODULE_MAP[module]
    sess = load_latest_session(db_module)
    if not sess:
        raise HTTPException(status_code=404, detail="No sessions found for module")

    return LatestSessionResponse(module=module, session_id=sess.session_id, updated_at=sess.updated_at)

def normalize_file_id(file_id: str) -> str:
    return file_id.replace("_", "-").strip().lower()

@router.get(
    "/sessions/{session_id}/files/{file_id}",
    response_class=StreamingResponse,
    responses={
        200: {
            "description": "CSV file",
            "content": {
                "text/csv": {
                    "schema": {"type": "string", "format": "binary"}
                }
            },
        },
        404: {"description": "Not Found"},
    },
)

def download_file(session_id: str, file_id: str, download: bool = Query(True)):
    sess = load_session(session_id)

    normalized_file_id = normalize_file_id(file_id)  
    content = generate_file_content(sess, normalized_file_id)
    filename = get_filename(normalized_file_id)

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"'
        if download
        else f'inline; filename="{filename}"'
    }

    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type="text/csv; charset=utf-8",
        headers=headers,
    )

# @router.get("/sessions/{session_id}/debug-payment")
# def debug_payment(session_id: str):
#     sess = load_session(session_id)
#     s = sess.config_state

#     def _len(x):
#         return len(x) if isinstance(x, list) else None

#     answers = s.get("answers") if isinstance(s.get("answers"), dict) else {}

#     return {
#         "session_module": sess.module,
#         "root_keys": list(s.keys()),

#         # root
#         "payment_methods_root_count": _len(s.get("payment_methods")),
#         "payment_methods_root_sample": (s.get("payment_methods") or [None])[0] if isinstance(s.get("payment_methods"), list) else None,

#         # answers.*
#         "answers_keys": list(answers.keys()) if isinstance(answers, dict) else None,
#         "answers_payment_methods_count": _len(answers.get("payment_methods")),
#         "answers_paymentMethods_count": _len(answers.get("paymentMethods")),

#         # nested objects people often use
#         "payment_method_obj_keys": list(s.get("payment_method").keys()) if isinstance(s.get("payment_method"), dict) else None,
#         "payment_method_obj_methods_count": _len(s.get("payment_method", {}).get("methods")) if isinstance(s.get("payment_method"), dict) else None,

#         "paymentData_keys": list(s.get("paymentData").keys()) if isinstance(s.get("paymentData"), dict) else None,
#         "paymentData_methods_count": _len(s.get("paymentData", {}).get("methods")) if isinstance(s.get("paymentData"), dict) else None,
#     }

class PersistPaymentRequest(BaseModel):
    methods: List[Dict[str, Any]] = Field(default_factory=list)
    checkRanges: List[Dict[str, Any]] = Field(default_factory=list)
    preNotificationRequired: bool = False

class PersistPayrollRequest(BaseModel):
    payrollAreas: List[Dict[str, Any]] = Field(default_factory=list)




