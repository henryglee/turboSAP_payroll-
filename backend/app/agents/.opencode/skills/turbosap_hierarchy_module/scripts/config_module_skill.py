"""Skill helpers for inspecting and editing module question configs."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

MODULES_ROOT = Path(__file__).resolve().parents[5] / "data" / "modules"


class ModuleConfigError(RuntimeError):
    """Raised when a module definition cannot be read or validated."""


class QuestionValidationError(ValueError):
    """Raised when a question payload is missing required fields."""


@dataclass(frozen=True)
class QuestionSummary:
    id: str
    text: str
    type: str
    order: int


def _normalize_module_slug(module_name: str) -> str:
    slug = (module_name or "").strip().lower()
    slug = re.sub(r"[^a-z0-9-]+", "-", slug)
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    if not slug:
        raise ModuleConfigError("Module name must not be empty")
    return slug


def _resolve_questions_path(
    module_name: str, *, modules_root: Optional[Path] = None
) -> Path:
    slug = _normalize_module_slug(module_name)
    root = Path(modules_root) if modules_root else MODULES_ROOT
    questions_path = root / slug / "questions.json"
    if not questions_path.exists():
        raise ModuleConfigError(f"questions.json not found for module '{slug}'")
    return questions_path


def _load_questions_payload(path: Path) -> Dict[str, Any]:
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        raise ModuleConfigError(f"Unable to parse {path}: {exc}") from exc


def _write_questions_payload(path: Path, payload: Dict[str, Any]) -> None:
    serialized = json.dumps(payload, indent=2, ensure_ascii=False)
    path.write_text(serialized + "\n")


def _validate_question_payload(question: Dict[str, Any]) -> None:
    required_fields = ("id", "text", "type", "order", "outputMapping")
    missing = [field for field in required_fields if field not in question]
    if missing:
        raise QuestionValidationError(
            f"Question missing required fields: {', '.join(missing)}"
        )

    if not isinstance(question.get("id"), str) or not question["id"].strip():
        raise QuestionValidationError("Question id must be a non-empty string")
    if not isinstance(question.get("text"), str):
        raise QuestionValidationError("Question text must be a string")
    if not isinstance(question.get("type"), str):
        raise QuestionValidationError("Question type must be a string")
    if not isinstance(question.get("order"), int):
        raise QuestionValidationError("Question order must be an integer")
    if not isinstance(question.get("outputMapping"), dict):
        raise QuestionValidationError("outputMapping must be a mapping")

    options = question.get("options")
    if options is not None:
        if not isinstance(options, list):
            raise QuestionValidationError("options must be a list when provided")
        for option in options:
            if not isinstance(option, dict):
                raise QuestionValidationError("Each option must be a mapping")
            if "value" not in option or "label" not in option:
                raise QuestionValidationError(
                    "Options must contain 'value' and 'label'"
                )


def list_module_questions(
    module_name: str,
    *,
    modules_root: Optional[Path] = None,
) -> List[QuestionSummary]:
    """Return lightweight metadata for each question in the module."""

    path = _resolve_questions_path(module_name, modules_root=modules_root)
    payload = _load_questions_payload(path)
    questions = payload.get("questions")
    if not isinstance(questions, list):
        raise ModuleConfigError("questions payload must be a list")

    summaries = []
    for entry in questions:
        if not isinstance(entry, dict):
            continue
        try:
            summaries.append(
                QuestionSummary(
                    id=str(entry.get("id", "")),
                    text=str(entry.get("text", "")),
                    type=str(entry.get("type", "")),
                    order=int(entry.get("order", 0)),
                )
            )
        except Exception as exc:  # pragma: no cover - defensive
            raise ModuleConfigError(f"Invalid question entry: {exc}") from exc
    return summaries


def get_question(
    module_name: str,
    question_id: str,
    *,
    modules_root: Optional[Path] = None,
) -> Optional[Dict[str, Any]]:
    """Return a deep copy of a question by id."""

    path = _resolve_questions_path(module_name, modules_root=modules_root)
    payload = _load_questions_payload(path)
    for entry in payload.get("questions", []):
        if isinstance(entry, dict) and entry.get("id") == question_id:
            return json.loads(json.dumps(entry))
    return None


def update_question(
    module_name: str,
    question_id: str,
    updates: Dict[str, Any],
    *,
    modules_root: Optional[Path] = None,
) -> Dict[str, Any]:
    """Update an existing question with the provided fields."""

    if "id" in updates and updates["id"] != question_id:
        raise QuestionValidationError("Question id cannot be changed")

    path = _resolve_questions_path(module_name, modules_root=modules_root)
    payload = _load_questions_payload(path)
    questions = payload.get("questions")
    if not isinstance(questions, list):
        raise ModuleConfigError("questions payload must be a list")

    for idx, entry in enumerate(questions):
        if isinstance(entry, dict) and entry.get("id") == question_id:
            updated = {**entry, **updates}
            _validate_question_payload(updated)
            questions[idx] = updated
            _write_questions_payload(path, payload)
            return updated

    raise ModuleConfigError(
        f"Question '{question_id}' not found in module '{module_name}'"
    )


def add_question(
    module_name: str,
    question: Dict[str, Any],
    *,
    modules_root: Optional[Path] = None,
) -> Dict[str, Any]:
    """Append a new question to the module using the canonical structure."""

    _validate_question_payload(question)

    path = _resolve_questions_path(module_name, modules_root=modules_root)
    payload = _load_questions_payload(path)
    questions = payload.setdefault("questions", [])
    if not isinstance(questions, list):
        raise ModuleConfigError("questions payload must be a list")

    if any(
        entry.get("id") == question["id"]
        for entry in questions
        if isinstance(entry, dict)
    ):
        raise QuestionValidationError(f"Question id '{question['id']}' already exists")

    questions.append(question)
    questions.sort(key=lambda item: item.get("order", 0))
    _write_questions_payload(path, payload)
    return question


__all__ = [
    "MODULES_ROOT",
    "ModuleConfigError",
    "QuestionValidationError",
    "QuestionSummary",
    "list_module_questions",
    "get_question",
    "update_question",
    "add_question",
]
