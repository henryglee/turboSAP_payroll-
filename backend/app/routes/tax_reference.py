from pathlib import Path

from fastapi import APIRouter, HTTPException


router = APIRouter(prefix="/api", tags=["tax-reference"])


@router.get("/tax-reference")
async def get_tax_reference():
    """Return state and federal tax reference data for Tax ID module."""
    data_path = Path(__file__).parent.parent / "data" / "state_tax_reference.json"
    try:
        contents = data_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="Tax reference file not found")
    except Exception as exc:  # pragma: no cover - generic file error
        raise HTTPException(status_code=500, detail=f"Error reading tax reference file: {exc}")

    import json

    try:
        return json.loads(contents)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Tax reference file is invalid JSON")
