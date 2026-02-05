"""
HierarchyService - Loads and persists hierarchy to JSON file.

The hierarchy.json file is the source of truth for categories, tasks,
and their module linkages (type, slug, route, relation).
"""

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

HIERARCHY_PATH = Path(__file__).parent.parent / "data" / "hierarchy.json"


class HierarchyService:
    """
    Hierarchy service backed by hierarchy.json.

    Loads the JSON file on first access and caches in memory.
    All CRUD operations write back to the JSON file.
    """

    def __init__(self, path: Path | None = None):
        self._path = path or HIERARCHY_PATH
        self._data: dict[str, Any] | None = None

    def _load(self) -> None:
        """Load hierarchy.json from disk."""
        try:
            with open(self._path, encoding="utf-8") as f:
                self._data = json.load(f)
            logger.info(
                "Loaded hierarchy: %d categories, %d tasks",
                self._data.get("total_categories", 0),
                self._data.get("total_tasks", 0),
            )
        except (FileNotFoundError, json.JSONDecodeError) as e:
            logger.error("Failed to load hierarchy.json: %s", e)
            self._data = {"categories": [], "total_categories": 0, "total_tasks": 0}

    def _save(self) -> None:
        """Write hierarchy.json to disk."""
        if self._data is None:
            return
        # Update totals
        self._data["total_categories"] = len(self._data.get("categories", []))
        self._data["total_tasks"] = sum(
            len(cat.get("tasks", [])) for cat in self._data.get("categories", [])
        )
        try:
            with open(self._path, "w", encoding="utf-8") as f:
                json.dump(self._data, f, indent=2, ensure_ascii=False)
            logger.info("Saved hierarchy.json")
        except Exception as e:
            logger.error("Failed to save hierarchy.json: %s", e)
            raise

    @property
    def data(self) -> dict[str, Any]:
        if self._data is None:
            self._load()
        return self._data

    def reload(self) -> None:
        """Force reload from disk (useful after external edits)."""
        self._data = None
        _ = self.data

    # ============================================
    # Read Operations
    # ============================================

    def get_full_hierarchy(self) -> list[dict[str, Any]]:
        """
        Return categories with nested tasks.

        Output shape matches what routes/hierarchy.py expects
        (compatible with the _to_camel_case helper).
        """
        categories = []
        for cat in self.data.get("categories", []):
            category = {
                "id": cat["id"],
                "name": cat["name"],
                "display_order": cat.get("displayOrder", 0),
                "tasks": [],
            }
            for task in cat.get("tasks", []):
                category["tasks"].append({
                    "id": task["id"],
                    "name": task["name"],
                    "category_id": cat["id"],
                    "display_order": task.get("displayOrder", 0),
                    "original_id": task.get("original_id"),
                    "type": task.get("type"),
                    "slug": task.get("slug"),
                    "route": task.get("route"),
                    "relation": task.get("relation", []),
                    "step_ids": task.get("step_ids", []),
                })
            categories.append(category)
        return categories

    def get_category_by_id(self, category_id: str) -> dict[str, Any] | None:
        """Find a category by ID. Returns raw JSON shape."""
        for cat in self.data.get("categories", []):
            if cat["id"] == category_id:
                return cat
        return None

    def get_task_by_id(self, task_id: str) -> tuple[dict[str, Any] | None, str | None]:
        """Find a task by ID. Returns (task, category_id) or (None, None)."""
        for cat in self.data.get("categories", []):
            for task in cat.get("tasks", []):
                if task["id"] == task_id:
                    return task, cat["id"]
        return None, None

    # ============================================
    # Category CRUD
    # ============================================

    def create_category(
        self, category_id: str, name: str, display_order: int = 0
    ) -> dict[str, Any]:
        """Create a new category."""
        if self.get_category_by_id(category_id):
            raise ValueError(f"Category '{category_id}' already exists")

        new_cat = {
            "id": category_id,
            "name": name,
            "displayOrder": display_order,
            "tasks": [],
        }
        self.data["categories"].append(new_cat)
        # Sort by displayOrder
        self.data["categories"].sort(key=lambda c: c.get("displayOrder", 0))
        self._save()
        return new_cat

    def update_category(
        self,
        category_id: str,
        name: str | None = None,
        display_order: int | None = None,
    ) -> dict[str, Any] | None:
        """Update a category. Returns updated category or None if not found."""
        cat = self.get_category_by_id(category_id)
        if not cat:
            return None

        if name is not None:
            cat["name"] = name
        if display_order is not None:
            cat["displayOrder"] = display_order
            # Re-sort
            self.data["categories"].sort(key=lambda c: c.get("displayOrder", 0))

        self._save()
        return cat

    def delete_category(self, category_id: str) -> bool:
        """Delete a category and all its tasks. Returns True if deleted."""
        categories = self.data.get("categories", [])
        for i, cat in enumerate(categories):
            if cat["id"] == category_id:
                categories.pop(i)
                self._save()
                return True
        return False

    # ============================================
    # Task CRUD
    # ============================================

    def create_task(
        self,
        task_id: str,
        name: str,
        category_id: str,
        display_order: int = 0,
    ) -> dict[str, Any]:
        """Create a new task in a category."""
        existing, _ = self.get_task_by_id(task_id)
        if existing:
            raise ValueError(f"Task '{task_id}' already exists")

        cat = self.get_category_by_id(category_id)
        if not cat:
            raise ValueError(f"Category '{category_id}' not found")

        new_task = {
            "id": task_id,
            "name": name,
            "displayOrder": display_order,
            "original_id": None,
            "step_ids": [],
            "type": None,
            "slug": None,
            "route": None,
            "relation": [],
        }
        cat["tasks"].append(new_task)
        # Sort tasks by displayOrder
        cat["tasks"].sort(key=lambda t: t.get("displayOrder", 0))
        self._save()
        return new_task

    def update_task(
        self,
        task_id: str,
        name: str | None = None,
        category_id: str | None = None,
        display_order: int | None = None,
    ) -> dict[str, Any] | None:
        """Update a task. Returns updated task or None if not found."""
        task, current_cat_id = self.get_task_by_id(task_id)
        if not task or not current_cat_id:
            return None

        if name is not None:
            task["name"] = name
        if display_order is not None:
            task["displayOrder"] = display_order

        # Move to different category if requested
        if category_id is not None and category_id != current_cat_id:
            new_cat = self.get_category_by_id(category_id)
            if not new_cat:
                raise ValueError(f"Category '{category_id}' not found")
            # Remove from old category
            old_cat = self.get_category_by_id(current_cat_id)
            if old_cat:
                old_cat["tasks"] = [t for t in old_cat["tasks"] if t["id"] != task_id]
            # Add to new category
            new_cat["tasks"].append(task)
            new_cat["tasks"].sort(key=lambda t: t.get("displayOrder", 0))
        else:
            # Re-sort current category
            cat = self.get_category_by_id(current_cat_id)
            if cat:
                cat["tasks"].sort(key=lambda t: t.get("displayOrder", 0))

        self._save()
        return task

    def delete_task(self, task_id: str) -> bool:
        """Delete a task. Returns True if deleted."""
        task, cat_id = self.get_task_by_id(task_id)
        if not task or not cat_id:
            return False

        cat = self.get_category_by_id(cat_id)
        if cat:
            cat["tasks"] = [t for t in cat["tasks"] if t["id"] != task_id]
            self._save()
            return True
        return False


# Singleton
hierarchy_service = HierarchyService()
