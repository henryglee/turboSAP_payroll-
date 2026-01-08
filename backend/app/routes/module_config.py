"""
Module Configuration Routes

Unified API for managing module question configurations.
Supports multiple modules with different file paths and validation rules.

Endpoints:
- GET  /api/config/modules                      - List all available modules
- GET  /api/config/modules/{slug}               - Get module metadata
- PUT  /api/config/modules/{slug}               - Update module metadata (admin only)
- GET  /api/config/modules/{slug}/questions     - Get module questions
- PUT  /api/config/modules/{slug}/questions     - Update module questions (admin only)
- POST /api/config/modules/{slug}/questions/restore - Restore from backup (admin only)
"""

import json
import shutil
from pathlib import Path
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Body

from ..middleware import get_current_user, require_admin

router = APIRouter(prefix="/api/config/modules", tags=["Module Config"])

# Base paths
APP_DIR = Path(__file__).parent.parent
CONFIG_DIR = APP_DIR / "config"
DATA_DIR = APP_DIR / "data"
MODULES_METADATA_PATH = DATA_DIR / "modules_metadata.json"

# File paths registry - maps slugs to question file locations
# Separate from metadata (name/description) which is stored in modules_metadata.json
MODULE_FILES = {
    "payment-method": {
        "current": DATA_DIR / "payment_method_questions.json",
        "backup": DATA_DIR / "payment_method_questions_backup.json",
        "original": None,
    },
    "payroll-area": {
        "current": CONFIG_DIR / "questions_current.json",
        "backup": CONFIG_DIR / "questions_backup.json",
        "original": CONFIG_DIR / "questions_original.json",
    },
}


def _load_modules_metadata() -> Dict[str, Any]:
    """Load module metadata from JSON file."""
    if not MODULES_METADATA_PATH.exists():
        return {"version": "1.0", "modules": {}}
    try:
        with MODULES_METADATA_PATH.open() as f:
            return json.load(f)
    except json.JSONDecodeError:
        return {"version": "1.0", "modules": {}}


def _save_modules_metadata(data: Dict[str, Any]) -> None:
    """Save module metadata to JSON file."""
    MODULES_METADATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    with MODULES_METADATA_PATH.open("w") as f:
        json.dump(data, f, indent=2)


def _get_module_metadata(slug: str) -> Dict[str, Any]:
    """Get metadata for a specific module."""
    metadata = _load_modules_metadata()
    modules = metadata.get("modules", {})

    if slug not in modules and slug not in MODULE_FILES:
        available = ", ".join(set(modules.keys()) | set(MODULE_FILES.keys()))
        raise HTTPException(
            status_code=404,
            detail=f"Module '{slug}' not found. Available modules: {available}"
        )

    # Return metadata or defaults
    return modules.get(slug, {
        "name": slug.replace("-", " ").title(),
        "description": "",
        "icon": "settings",
        "status": "active",
        "order": 999
    })


def _validate_questions_schema(data: Dict[str, Any], module_slug: str) -> None:
    """
    Validate the questions schema.

    Raises HTTPException if validation fails.
    """
    if "questions" not in data:
        raise HTTPException(status_code=400, detail="Payload must contain 'questions' array")

    if not isinstance(data["questions"], list):
        raise HTTPException(status_code=400, detail="'questions' must be an array")

    seen_ids: set[str] = set()

    for i, q in enumerate(data["questions"]):
        if not isinstance(q, dict):
            raise HTTPException(status_code=400, detail=f"Question {i+1} must be an object")

        qid = q.get("id")
        text = q.get("text")
        qtype = q.get("type")

        # Required fields
        if not qid or not isinstance(qid, str):
            raise HTTPException(status_code=400, detail=f"Question {i+1} is missing 'id'")
        if not text or not isinstance(text, str):
            raise HTTPException(status_code=400, detail=f"Question '{qid}' is missing 'text'")
        if not qtype or not isinstance(qtype, str):
            raise HTTPException(status_code=400, detail=f"Question '{qid}' is missing 'type'")

        # Check for duplicate IDs
        if qid in seen_ids:
            raise HTTPException(status_code=400, detail=f"Duplicate question id: {qid}")
        seen_ids.add(qid)

        # Validate options for choice-type questions
        if qtype in ["multiple_choice", "choice", "multiple_select"]:
            options = q.get("options")
            if options is not None:
                if not isinstance(options, list):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Question '{qid}' options must be an array"
                    )
                for j, opt in enumerate(options):
                    if not isinstance(opt, dict):
                        raise HTTPException(
                            status_code=400,
                            detail=f"Question '{qid}', option {j+1} must be an object"
                        )
                    if not opt.get("id"):
                        raise HTTPException(
                            status_code=400,
                            detail=f"Question '{qid}', option {j+1} is missing 'id'"
                        )
                    if not opt.get("label"):
                        raise HTTPException(
                            status_code=400,
                            detail=f"Question '{qid}', option {j+1} is missing 'label'"
                        )


def _get_module_files(slug: str) -> Dict[str, Any]:
    """Get module file paths or raise 404."""
    if slug not in MODULE_FILES:
        available = ", ".join(MODULE_FILES.keys())
        raise HTTPException(
            status_code=404,
            detail=f"Module '{slug}' not found. Available modules: {available}"
        )
    return MODULE_FILES[slug]


def _read_json(path: Path) -> Dict[str, Any]:
    """Read JSON file or raise appropriate error."""
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Configuration file not found")
    try:
        with path.open() as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Invalid JSON in configuration file: {e}")


def _write_json(path: Path, data: Dict[str, Any]) -> None:
    """Write JSON file, creating parent directories if needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        json.dump(data, f, indent=2)


# ============================================
# Endpoints
# ============================================

@router.get("")
async def list_modules(current_user: dict = Depends(get_current_user)):
    """
    List all available modules and their configuration status.
    Combines metadata from JSON with file status from registry.
    """
    all_metadata = _load_modules_metadata()
    modules_data = all_metadata.get("modules", {})

    modules = []
    # Get all unique slugs from both metadata and file registry
    all_slugs = set(modules_data.keys()) | set(MODULE_FILES.keys())

    for slug in sorted(all_slugs, key=lambda s: modules_data.get(s, {}).get("order", 999)):
        meta = _get_module_metadata(slug)
        files = MODULE_FILES.get(slug, {})

        module_info = {
            "slug": slug,
            "name": meta.get("name", slug.replace("-", " ").title()),
            "description": meta.get("description", ""),
            "icon": meta.get("icon", "settings"),
            "status": meta.get("status", "active"),
            "order": meta.get("order", 999),
            "hasConfig": files.get("current") and files["current"].exists() if files else False,
            "hasBackup": files.get("backup") and files["backup"].exists() if files else False,
            "hasOriginal": files.get("original") and files["original"].exists() if files else False,
        }
        modules.append(module_info)

    return {"modules": modules}


@router.get("/{module_slug}", response_model=None)
async def get_module_metadata(
    module_slug: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get metadata for a specific module (name, description, icon, etc.)
    """
    meta = _get_module_metadata(module_slug)
    files = MODULE_FILES.get(module_slug, {})

    return {
        "slug": module_slug,
        "name": meta.get("name", module_slug.replace("-", " ").title()),
        "description": meta.get("description", ""),
        "icon": meta.get("icon", "settings"),
        "status": meta.get("status", "active"),
        "order": meta.get("order", 999),
        "hasConfig": files.get("current") and files["current"].exists() if files else False,
        "hasBackup": files.get("backup") and files["backup"].exists() if files else False,
        "hasOriginal": files.get("original") and files["original"].exists() if files else False,
    }


@router.put("/{module_slug}", response_model=None)
async def update_module_metadata(
    module_slug: str,
    payload: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    """
    Update metadata for a specific module (name, description). Admin only.
    """
    # Validate the module exists
    if module_slug not in MODULE_FILES:
        all_metadata = _load_modules_metadata()
        if module_slug not in all_metadata.get("modules", {}):
            raise HTTPException(status_code=404, detail=f"Module '{module_slug}' not found")

    # Load current metadata
    all_metadata = _load_modules_metadata()
    if "modules" not in all_metadata:
        all_metadata["modules"] = {}

    # Get existing or create new
    current = all_metadata["modules"].get(module_slug, {})

    # Update allowed fields
    if "name" in payload:
        current["name"] = str(payload["name"]).strip()
    if "description" in payload:
        current["description"] = str(payload["description"]).strip()
    if "icon" in payload:
        current["icon"] = str(payload["icon"]).strip()
    if "status" in payload and payload["status"] in ["active", "inactive", "draft"]:
        current["status"] = payload["status"]
    if "order" in payload:
        current["order"] = int(payload["order"])

    # Save
    all_metadata["modules"][module_slug] = current
    _save_modules_metadata(all_metadata)

    return {
        "status": "ok",
        "message": f"Module '{module_slug}' metadata updated",
        "module": {
            "slug": module_slug,
            **current
        }
    }


@router.get("/{module_slug}/questions")
async def get_module_questions(
    module_slug: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the current questions configuration for a module.
    """
    files = _get_module_files(module_slug)
    meta = _get_module_metadata(module_slug)
    data = _read_json(files["current"])

    # Add metadata
    data["_meta"] = {
        "module": module_slug,
        "moduleName": meta.get("name", module_slug.replace("-", " ").title()),
        "moduleDescription": meta.get("description", ""),
        "hasBackup": files["backup"].exists() if files["backup"] else False,
        "hasOriginal": files["original"].exists() if files["original"] else False,
    }

    return data


@router.put("/{module_slug}/questions")
async def update_module_questions(
    module_slug: str,
    payload: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    """
    Update the questions configuration for a module. Admin only.

    Creates a backup of the current file before saving.
    Validates that the payload has the required structure.
    """
    files = _get_module_files(module_slug)
    meta = _get_module_metadata(module_slug)

    # Remove metadata if present (frontend might send it back)
    payload.pop("_meta", None)

    # Validate schema
    _validate_questions_schema(payload, module_slug)

    try:
        # Create backup of current file if it exists
        if files["current"].exists() and files["backup"]:
            shutil.copy(files["current"], files["backup"])

        # Ensure version is preserved or set
        if "version" not in payload:
            payload["version"] = "1.0"

        # Save new configuration
        _write_json(files["current"], payload)

        module_name = meta.get("name", module_slug.replace("-", " ").title())
        return {
            "status": "ok",
            "message": f"{module_name} configuration updated successfully",
            "questionCount": len(payload.get("questions", []))
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save configuration: {str(e)}")


@router.post("/{module_slug}/questions/restore")
async def restore_module_questions(
    module_slug: str,
    source: str = "backup",  # "backup" or "original"
    current_user: dict = Depends(require_admin),
):
    """
    Restore questions configuration from backup or original. Admin only.

    Query params:
        source: "backup" (default) or "original"
    """
    files = _get_module_files(module_slug)
    meta = _get_module_metadata(module_slug)

    if source == "original":
        if not files["original"]:
            raise HTTPException(
                status_code=400,
                detail=f"Module '{module_slug}' does not have an original file"
            )
        source_path = files["original"]
        source_name = "original"
    else:
        if not files["backup"]:
            raise HTTPException(
                status_code=400,
                detail=f"Module '{module_slug}' does not have a backup file"
            )
        source_path = files["backup"]
        source_name = "backup"

    if not source_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"No {source_name} file found for module '{module_slug}'"
        )

    try:
        # Read and validate source
        data = _read_json(source_path)
        _validate_questions_schema(data, module_slug)

        # Save to current
        _write_json(files["current"], data)

        module_name = meta.get("name", module_slug.replace("-", " ").title())
        return {
            "status": "ok",
            "message": f"{module_name} configuration restored from {source_name}",
            "questionCount": len(data.get("questions", []))
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to restore: {str(e)}")


@router.get("/{module_slug}/questions/original")
async def get_module_original_questions(
    module_slug: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the original (default) questions configuration for a module.
    Only available for modules that have an original file.
    """
    files = _get_module_files(module_slug)

    if not files["original"]:
        raise HTTPException(
            status_code=400,
            detail=f"Module '{module_slug}' does not have an original configuration"
        )

    if not files["original"].exists():
        raise HTTPException(
            status_code=404,
            detail=f"Original configuration file not found for module '{module_slug}'"
        )

    return _read_json(files["original"])
