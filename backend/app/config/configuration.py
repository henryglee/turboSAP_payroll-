"""
Configuration management for questions.

Note: Admins can directly edit these JSON files:
- CURRENT_PATH: backend/app/config/questions_current.json (current active config)
- ORIGINAL_PATH: backend/app/config/questions_original.json (backup/reference)

UI focus is on client users. Admins can edit JSON files directly or use API endpoints.
"""
import json
from pathlib import Path
from typing import Any, Dict

BASE_DIR = Path(__file__).parent
FRONTEND_QUESTIONS_PATH = BASE_DIR.parent / "data" / "questions_current.json"

ORIGINAL_PATH = BASE_DIR / "questions_original.json"
CURRENT_PATH = BASE_DIR / "questions_current.json"


class ConfigValidationError(ValueError):
    pass


def _validate_questions_schema(data: Dict[str, Any]) -> None:
    if "questions" not in data or not isinstance(data["questions"], list):
        raise ConfigValidationError("Root must contain 'questions' as a list")

    seen_ids: set[str] = set()
    for q in data["questions"]:
        if not isinstance(q, dict):
            raise ConfigValidationError("Each question must be an object")

        qid = q.get("id")
        text = q.get("text")

        if not qid or not isinstance(qid, str):
            raise ConfigValidationError("Each question must have a string 'id'")
        if not text or not isinstance(text, str):
            raise ConfigValidationError(f"Question {qid!r} must have string 'text'")

        if qid in seen_ids:
            raise ConfigValidationError(f"Duplicate question id: {qid}")
        seen_ids.add(qid)

        qtype = q.get("type")
        '''
        if qtype == "multiple_choice":
            choices = q.get("choices")
            if not isinstance(choices, list) or not choices:
                raise ConfigValidationError(
                    f"Multiple choice question {qid} must have non-empty 'choices' list"
                )
        '''
        if qtype == "multiple_choice":
            choices = q.get("choices")
            if choices is not None and not isinstance(choices, list):
                raise ConfigValidationError(
                    f"Multiple select question {qid} must have 'choices' as a list if present"
                )
        # Allow empty or missing choices; UI can add them later


def _read_json(path: Path) -> Dict[str, Any]:
    with path.open() as f:
        return json.load(f)


def _write_json(path: Path, data: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        json.dump(data, f, indent=2)


def _bootstrap_from_frontend() -> Dict[str, Any]:
    if not FRONTEND_QUESTIONS_PATH.exists():
        raise FileNotFoundError(
            f"Frontend questions file not found at {FRONTEND_QUESTIONS_PATH}"
        )
    data = _read_json(FRONTEND_QUESTIONS_PATH)
    _validate_questions_schema(data)
    _write_json(ORIGINAL_PATH, data)
    _write_json(CURRENT_PATH, data)
    return data


def ensure_initialized() -> None:
    if ORIGINAL_PATH.exists() and CURRENT_PATH.exists():
        return
    _bootstrap_from_frontend()


def load_original_questions() -> Dict[str, Any]:
    ensure_initialized()
    data = _read_json(ORIGINAL_PATH)
    _validate_questions_schema(data)
    return data


def load_current_questions() -> Dict[str, Any]:
    ensure_initialized()
    data = _read_json(CURRENT_PATH)
    _validate_questions_schema(data)
    return data


def save_current_questions(data: Dict[str, Any]) -> None:
    _validate_questions_schema(data)
    _write_json(CURRENT_PATH, data)


def init_from_upload(uploaded: Dict[str, Any]) -> None:
    _validate_questions_schema(uploaded)
    _write_json(ORIGINAL_PATH, uploaded)
    _write_json(CURRENT_PATH, uploaded)


def restore_original() -> None:
    data = load_original_questions()
    _write_json(CURRENT_PATH, data)