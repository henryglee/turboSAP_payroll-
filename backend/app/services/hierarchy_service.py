"""
HierarchyService - Loads and persists hierarchy with S3 sync.

Uses ReachNettDataManager for S3 operations.
Local file serves as cache/fallback.

S3 structure:
  {company_name}/{company_code}/hierarchy.json (working version)
"""

import json
import logging
from pathlib import Path
from typing import Any, Optional

from ..data.ReachNettDataManager import ReachNettDataManager
from ..services.knowledgebase import MimeType

logger = logging.getLogger(__name__)

HIERARCHY_PATH = Path(__file__).parent.parent / "data" / "hierarchy.json"

# Default company info for hierarchy (can be overridden)
DEFAULT_COMPANY_NAME = "turbosap"
DEFAULT_COMPANY_CODE = "global"
HIERARCHY_TASK_NAME = "hierarchy"


class HierarchyService:
    """
    Hierarchy service backed by S3 + local cache.

    - On first access: Try S3, fall back to local file
    - On write: Update local + sync to S3
    """

    def __init__(
        self,
        path: Path | None = None,
        company_name: str = DEFAULT_COMPANY_NAME,
        company_code: str = DEFAULT_COMPANY_CODE,
        data_manager: Optional[ReachNettDataManager] = None,
        enable_s3: bool = True,
    ):
        self._path = path or HIERARCHY_PATH
        self._company_name = company_name
        self._company_code = company_code
        self._data_manager = data_manager or ReachNettDataManager()
        self._enable_s3 = enable_s3
        self._data: dict[str, Any] | None = None

    def _load_from_s3(self) -> dict[str, Any] | None:
        """Try to load hierarchy from S3."""
        if not self._enable_s3:
            return None
        try:
            data = self._data_manager.load_task(
                company_name=self._company_name,
                company_code=self._company_code,
                task_name=HIERARCHY_TASK_NAME,
            )
            if data and "categories" in data:
                logger.info(
                    "Loaded hierarchy from S3: %d categories",
                    len(data.get("categories", [])),
                )
                return data
        except Exception as e:
            logger.warning("Failed to load hierarchy from S3: %s", e)
        return None

    def _load_from_local(self) -> dict[str, Any]:
        """Load hierarchy from local file."""
        try:
            with open(self._path, encoding="utf-8") as f:
                data = json.load(f)
            logger.info(
                "Loaded hierarchy from local: %d categories, %d tasks",
                data.get("total_categories", 0),
                data.get("total_tasks", 0),
            )
            return data
        except (FileNotFoundError, json.JSONDecodeError) as e:
            logger.error("Failed to load local hierarchy.json: %s", e)
            return {"categories": [], "total_categories": 0, "total_tasks": 0}

    def _load(self) -> None:
        """Load hierarchy: try S3 first, fall back to local."""
        # Try S3 first
        s3_data = self._load_from_s3()
        if s3_data:
            self._data = s3_data
            # Update local cache
            self._save_local()
            return

        # Fall back to local
        self._data = self._load_from_local()

    def _save_local(self) -> None:
        """Write hierarchy to local file."""
        if self._data is None:
            return
        try:
            with open(self._path, "w", encoding="utf-8") as f:
                json.dump(self._data, f, indent=2, ensure_ascii=False)
            logger.info("Saved hierarchy to local file")
        except Exception as e:
            logger.error("Failed to save local hierarchy.json: %s", e)

    def _save_to_s3(self) -> None:
        """Upload hierarchy to S3."""
        if not self._enable_s3 or self._data is None:
            return
        try:
            self._data_manager.save_task(
                company_name=self._company_name,
                company_code=self._company_code,
                task_name=HIERARCHY_TASK_NAME,
                data=self._data,
                mime_type=MimeType.JSON,
            )
            logger.info("Saved hierarchy to S3")
        except Exception as e:
            logger.error("Failed to save hierarchy to S3: %s", e)
            # Don't raise - local save succeeded

    def _save(self) -> None:
        """Save hierarchy to local + S3."""
        if self._data is None:
            return
        # Update totals
        self._data["total_categories"] = len(self._data.get("categories", []))
        self._data["total_tasks"] = sum(
            len(cat.get("tasks", [])) for cat in self._data.get("categories", [])
        )
        # Save locally first (fast, reliable)
        self._save_local()
        # Then sync to S3 (async-friendly, may fail)
        self._save_to_s3()

    @property
    def data(self) -> dict[str, Any]:
        if self._data is None:
            self._load()
        return self._data

    def reload(self) -> None:
        """Force reload from S3/disk."""
        self._data = None
        _ = self.data

    def sync_from_s3(self) -> bool:
        """Explicitly pull latest from S3. Returns True if successful."""
        s3_data = self._load_from_s3()
        if s3_data:
            self._data = s3_data
            self._save_local()
            return True
        return False

    def sync_to_s3(self) -> bool:
        """Explicitly push current state to S3. Returns True if successful."""
        if self._data is None:
            return False
        try:
            self._save_to_s3()
            return True
        except Exception:
            return False

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


# Singleton with S3 enabled by default
hierarchy_service = HierarchyService()
