"""Routes for ReachNett knowledgebase uploads."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..middleware import get_current_user
from ..services.knowledgebase_upload import (
    KnowledgebaseUploadError,
    KnowledgebaseUploadService,
)

router = APIRouter(prefix="/api/knowledgebase", tags=["Knowledgebase"])
_upload_service = KnowledgebaseUploadService()


class PresignRequest(BaseModel):
    companyName: str = Field(..., min_length=1, description="ReachNett company name")
    companyCode: str = Field(..., min_length=1, description="ReachNett company code")
    contentType: str = Field(
        ...,
        min_length=1,
        description="Knowledgebase document type (docs, words, ppt, xlxs)",
    )


@router.post("/presign")
def request_presigned_upload(
    payload: PresignRequest,
    _user: dict = Depends(get_current_user),
) -> dict:
    """Return a presigned URL a client can use to upload a knowledgebase document."""

    try:
        presigned = _upload_service.request_presigned_upload(
            company_code=payload.companyCode,
            company_name=payload.companyName,
            content_type=payload.contentType,
        )
    except KnowledgebaseUploadError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "uploadUrl": presigned.upload_url,
        "rawResponse": presigned.raw_response,
    }
