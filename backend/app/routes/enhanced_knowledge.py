"""Enhanced API routes for knowledge storage with vector search capabilities."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional

from ..middleware import get_current_user
from ..services.enhanced_knowledge import EnhancedKnowledgeService
from ..services.knowledgebase import (
    KnowledgebaseUploadError,
    KnowledgebaseDownloadError,
)

router = APIRouter(prefix="/api/knowledge", tags=["Enhanced Knowledge"])
_knowledge_service = EnhancedKnowledgeService()


class StoreKnowledgeRequest(BaseModel):
    """Request to store knowledge with enhanced metadata."""

    company_code: str = Field(..., description="Company code for S3 organization")
    company_name: str = Field(..., description="Company name")
    content: Dict[str, Any] = Field(..., description="JSON content to store")
    task_name: Optional[str] = Field(None, description="Task/category name")
    title: Optional[str] = Field(None, description="Document title")
    description: Optional[str] = Field(None, description="Document description")
    tags: Optional[List[str]] = Field(default_factory=list, description="Search tags")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class KnowledgeSearchRequest(BaseModel):
    """Request to search knowledge base."""

    query: str = Field(..., description="Search query")
    company_name: Optional[str] = Field(None, description="Filter by company")
    task_name: Optional[str] = Field(None, description="Filter by task")
    tags: Optional[List[str]] = Field(
        default_factory=list, description="Filter by tags"
    )
    limit: int = Field(default=10, ge=1, le=100, description="Result limit")


@router.post("/store")
def store_knowledge(
    request: StoreKnowledgeRequest,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Store knowledge with both S3 and vector indexing."""

    try:
        result = _knowledge_service.store_knowledge(
            company_code=request.company_code,
            company_name=request.company_name,
            content=request.content,
            mime_type="application/json",
            task_name=request.task_name,
            title=request.title,
            description=request.description,
            tags=request.tags,
            metadata=request.metadata,
        )

        return {
            "success": True,
            "message": "Knowledge stored successfully",
            "result": result,
        }

    except KnowledgebaseUploadError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Storage failed: {str(exc)}"
        ) from exc


@router.post("/search")
def search_knowledge(
    request: KnowledgeSearchRequest,
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Search knowledge using vector similarity."""

    try:
        results = _knowledge_service.search_knowledge(
            query=request.query,
            company_name=request.company_name,
            task_name=request.task_name,
            tags=request.tags,
            limit=request.limit,
        )

        return {
            "success": True,
            "query": request.query,
            "results": results,
            "count": len(results),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Search failed: {str(exc)}"
        ) from exc


@router.get("/get")
def get_knowledge(
    company_name: str = Query(..., description="Company name"),
    task_name: str = Query(..., description="Task name"),
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get knowledge by company and task name."""

    try:
        knowledge = _knowledge_service.get_knowledge_by_metadata(
            company_name=company_name,
            task_name=task_name,
        )

        if not knowledge:
            raise HTTPException(
                status_code=404,
                detail=f"No knowledge found for {company_name}/{task_name}",
            )

        return {
            "success": True,
            "knowledge": knowledge,
        }

    except KnowledgebaseDownloadError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Retrieval failed: {str(exc)}"
        ) from exc


@router.get("/status")
def knowledge_status(user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Get the status of the knowledge system."""

    return {
        "success": True,
        "vector_storage_available": _knowledge_service.context_storage is not None,
        "services": {
            "upload_service": "available",
            "download_service": "available",
            "context_storage": "available"
            if _knowledge_service.context_storage
            else "unavailable",
        },
    }


__all__ = ["router"]
