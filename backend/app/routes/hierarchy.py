"""
Hierarchy Routes - Categories and Tasks Management

API for managing the category/task hierarchy that organizes configuration modules.

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
from typing import Any, Dict, List, Optional

from ..middleware import get_current_user, require_admin
from ..database import (
    get_full_hierarchy,
    get_category_by_id,
    create_category as db_create_category,
    update_category as db_update_category,
    delete_category as db_delete_category,
    get_task_by_id,
    create_task as db_create_task,
    update_task as db_update_task,
    delete_task as db_delete_task,
)

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


# ============================================
# Hierarchy Endpoints
# ============================================

@router.get("")
async def get_hierarchy(current_user: dict = Depends(get_current_user)):
    """
    Get the full hierarchy tree: categories with nested tasks.

    Returns:
        {
            "categories": [
                {
                    "id": "enterprise-structure",
                    "name": "Enterprise Structure",
                    "displayOrder": 10,
                    "tasks": [
                        {"id": "payroll-area", "name": "Payroll Area", "categoryId": "...", "displayOrder": 10}
                    ]
                }
            ]
        }
    """
    hierarchy = get_full_hierarchy()
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

    # Check if category already exists
    if get_category_by_id(cat_id):
        raise HTTPException(status_code=400, detail=f"Category '{cat_id}' already exists")

    try:
        db_create_category(cat_id, name.strip(), display_order)
        category = get_category_by_id(cat_id)
        return {"status": "ok", "category": _to_camel_case(category)}
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
    # Check if category exists
    if not get_category_by_id(category_id):
        raise HTTPException(status_code=404, detail=f"Category '{category_id}' not found")

    name = payload.get("name")
    display_order = payload.get("displayOrder")

    if name is not None:
        name = name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="name cannot be empty")

    updated = db_update_category(category_id, name=name, display_order=display_order)
    if not updated and name is None and display_order is None:
        raise HTTPException(status_code=400, detail="No fields to update")

    category = get_category_by_id(category_id)
    return {"status": "ok", "category": _to_camel_case(category)}


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: str,
    current_user: dict = Depends(require_admin),
):
    """
    Delete a category and all its tasks.
    """
    if not get_category_by_id(category_id):
        raise HTTPException(status_code=404, detail=f"Category '{category_id}' not found")

    deleted = db_delete_category(category_id)
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete category")

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

    # Check if category exists
    if not get_category_by_id(category_id):
        raise HTTPException(status_code=404, detail=f"Category '{category_id}' not found")

    # Check if task already exists
    if get_task_by_id(task_id):
        raise HTTPException(status_code=400, detail=f"Task '{task_id}' already exists")

    try:
        db_create_task(task_id, name.strip(), category_id, display_order)
        task = get_task_by_id(task_id)
        return {"status": "ok", "task": _to_camel_case(task)}
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
    # Check if task exists
    if not get_task_by_id(task_id):
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found")

    name = payload.get("name")
    category_id = payload.get("categoryId")
    display_order = payload.get("displayOrder")

    if name is not None:
        name = name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="name cannot be empty")

    # If moving to new category, verify it exists
    if category_id is not None and not get_category_by_id(category_id):
        raise HTTPException(status_code=404, detail=f"Category '{category_id}' not found")

    updated = db_update_task(task_id, name=name, category_id=category_id, display_order=display_order)
    if not updated and name is None and category_id is None and display_order is None:
        raise HTTPException(status_code=400, detail="No fields to update")

    task = get_task_by_id(task_id)
    return {"status": "ok", "task": _to_camel_case(task)}


@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: str,
    current_user: dict = Depends(require_admin),
):
    """
    Delete a task.
    """
    if not get_task_by_id(task_id):
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found")

    deleted = db_delete_task(task_id)
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete task")

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
            if not get_category_by_id(cat_id):
                errors.append(f"Category '{cat_id}' not found")
            else:
                db_update_category(cat_id, display_order=display_order)

    # Update tasks
    for task in tasks:
        task_id = task.get("id")
        if not task_id:
            continue
        display_order = task.get("displayOrder")
        category_id = task.get("categoryId")
        if not get_task_by_id(task_id):
            errors.append(f"Task '{task_id}' not found")
        else:
            if category_id and not get_category_by_id(category_id):
                errors.append(f"Category '{category_id}' not found for task '{task_id}'")
            else:
                db_update_task(task_id, display_order=display_order, category_id=category_id)

    if errors:
        return {"status": "partial", "errors": errors}

    return {"status": "ok", "message": "Hierarchy reordered successfully"}
