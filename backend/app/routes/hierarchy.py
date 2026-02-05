"""
Hierarchy Routes - Categories and Tasks Management

API for managing the category/task hierarchy that organizes configuration modules.
All operations read from and write to hierarchy.json via HierarchyService.

Endpoints:
- GET    /api/hierarchy                    - Get full hierarchy tree
- POST   /api/hierarchy/categories         - Create category
- PUT    /api/hierarchy/categories/{id}    - Update category
- DELETE /api/hierarchy/categories/{id}    - Delete category
- POST   /api/hierarchy/tasks              - Create task
- PUT    /api/hierarchy/tasks/{id}         - Update task
- DELETE /api/hierarchy/tasks/{id}         - Delete task
- PUT    /api/hierarchy/reorder            - Bulk reorder categories/tasks
"""

from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Any, Dict

from ..middleware import get_current_user, require_admin
from ..services.hierarchy_service import hierarchy_service

router = APIRouter(prefix="/api/hierarchy", tags=["Hierarchy"])


def _to_camel_case(data: Dict[str, Any]) -> Dict[str, Any]:
    """Convert snake_case keys to camelCase for frontend."""
    result = {}
    for key, value in data.items():
        # Convert display_order -> displayOrder, category_id -> categoryId
        parts = key.split("_")
        camel_key = parts[0] + "".join(word.capitalize() for word in parts[1:])
        if isinstance(value, list):
            result[camel_key] = [_to_camel_case(item) if isinstance(item, dict) else item for item in value]
        elif isinstance(value, dict):
            result[camel_key] = _to_camel_case(value)
        else:
            result[camel_key] = value
    return result


def _category_response(cat: dict) -> dict:
    """Format a category for API response (camelCase, with tasks)."""
    return {
        "id": cat["id"],
        "name": cat["name"],
        "displayOrder": cat.get("displayOrder", 0),
        "tasks": [_task_response(t, cat["id"]) for t in cat.get("tasks", [])],
    }


def _task_response(task: dict, category_id: str) -> dict:
    """Format a task for API response (camelCase)."""
    return {
        "id": task["id"],
        "name": task["name"],
        "categoryId": category_id,
        "displayOrder": task.get("displayOrder", 0),
        "originalId": task.get("original_id"),
        "type": task.get("type"),
        "slug": task.get("slug"),
        "route": task.get("route"),
        "relation": task.get("relation", []),
        "stepIds": task.get("step_ids", []),
    }


# ============================================
# Hierarchy Endpoints
# ============================================

@router.get("")
async def get_hierarchy(current_user: dict = Depends(get_current_user)):
    """
    Get the full hierarchy tree: categories with nested tasks.
    """
    hierarchy = hierarchy_service.get_full_hierarchy()
    return {"categories": [_to_camel_case(cat) for cat in hierarchy]}


# ============================================
# Category Endpoints
# ============================================

@router.post("/categories")
async def create_category(
    payload: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    """
    Create a new category.

    Request body:
        {
            "id": "my-category",
            "name": "My Category",
            "displayOrder": 30  (optional, defaults to 0)
        }
    """
    cat_id = payload.get("id")
    name = payload.get("name")
    display_order = payload.get("displayOrder", 0)

    if not cat_id or not isinstance(cat_id, str):
        raise HTTPException(status_code=400, detail="id is required")
    if not name or not isinstance(name, str):
        raise HTTPException(status_code=400, detail="name is required")

    try:
        cat = hierarchy_service.create_category(cat_id, name.strip(), display_order)
        return {"status": "ok", "category": _category_response(cat)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create category: {str(e)}")


@router.put("/categories/{category_id}")
async def update_category(
    category_id: str,
    payload: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    """
    Update a category.

    Request body (all fields optional):
        {
            "name": "New Name",
            "displayOrder": 20
        }
    """
    name = payload.get("name")
    display_order = payload.get("displayOrder")

    if name is not None:
        name = name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="name cannot be empty")

    if name is None and display_order is None:
        raise HTTPException(status_code=400, detail="No fields to update")

    cat = hierarchy_service.update_category(category_id, name=name, display_order=display_order)
    if not cat:
        raise HTTPException(status_code=404, detail=f"Category '{category_id}' not found")

    return {"status": "ok", "category": _category_response(cat)}


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: str,
    current_user: dict = Depends(require_admin),
):
    """
    Delete a category and all its tasks.
    """
    deleted = hierarchy_service.delete_category(category_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Category '{category_id}' not found")

    return {"status": "ok", "message": f"Category '{category_id}' deleted"}


# ============================================
# Task Endpoints
# ============================================

@router.post("/tasks")
async def create_task(
    payload: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    """
    Create a new task.

    Request body:
        {
            "id": "my-task",
            "name": "My Task",
            "categoryId": "enterprise-structure",
            "displayOrder": 30  (optional, defaults to 0)
        }
    """
    task_id = payload.get("id")
    name = payload.get("name")
    category_id = payload.get("categoryId")
    display_order = payload.get("displayOrder", 0)

    if not task_id or not isinstance(task_id, str):
        raise HTTPException(status_code=400, detail="id is required")
    if not name or not isinstance(name, str):
        raise HTTPException(status_code=400, detail="name is required")
    if not category_id or not isinstance(category_id, str):
        raise HTTPException(status_code=400, detail="categoryId is required")

    try:
        task = hierarchy_service.create_task(task_id, name.strip(), category_id, display_order)
        return {"status": "ok", "task": _task_response(task, category_id)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create task: {str(e)}")


@router.put("/tasks/{task_id}")
async def update_task(
    task_id: str,
    payload: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    """
    Update a task.

    Request body (all fields optional):
        {
            "name": "New Name",
            "categoryId": "new-category",  (move to different category)
            "displayOrder": 20
        }
    """
    name = payload.get("name")
    category_id = payload.get("categoryId")
    display_order = payload.get("displayOrder")

    if name is not None:
        name = name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="name cannot be empty")

    if name is None and category_id is None and display_order is None:
        raise HTTPException(status_code=400, detail="No fields to update")

    try:
        task = hierarchy_service.update_task(
            task_id, name=name, category_id=category_id, display_order=display_order
        )
        if not task:
            raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found")

        # Get the category ID for response
        _, cat_id = hierarchy_service.get_task_by_id(task_id)
        return {"status": "ok", "task": _task_response(task, cat_id or category_id or "")}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: str,
    current_user: dict = Depends(require_admin),
):
    """
    Delete a task.
    """
    deleted = hierarchy_service.delete_task(task_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found")

    return {"status": "ok", "message": f"Task '{task_id}' deleted"}


# ============================================
# Reorder Endpoint
# ============================================

@router.put("/reorder")
async def reorder_hierarchy(
    payload: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    """
    Bulk reorder categories and/or tasks.

    Request body:
        {
            "categories": [
                {"id": "cat-1", "displayOrder": 10},
                {"id": "cat-2", "displayOrder": 20}
            ],
            "tasks": [
                {"id": "task-1", "displayOrder": 10, "categoryId": "cat-1"},
                {"id": "task-2", "displayOrder": 20, "categoryId": "cat-2"}
            ]
        }
    """
    categories = payload.get("categories", [])
    tasks = payload.get("tasks", [])

    errors = []

    # Update categories
    for cat in categories:
        cat_id = cat.get("id")
        if not cat_id:
            continue
        display_order = cat.get("displayOrder")
        if display_order is not None:
            result = hierarchy_service.update_category(cat_id, display_order=display_order)
            if not result:
                errors.append(f"Category '{cat_id}' not found")

    # Update tasks
    for task in tasks:
        task_id = task.get("id")
        if not task_id:
            continue
        display_order = task.get("displayOrder")
        category_id = task.get("categoryId")
        try:
            result = hierarchy_service.update_task(
                task_id, display_order=display_order, category_id=category_id
            )
            if not result:
                errors.append(f"Task '{task_id}' not found")
        except ValueError as e:
            errors.append(str(e))

    if errors:
        return {"status": "partial", "errors": errors}

    return {"status": "ok", "message": "Hierarchy reordered successfully"}
