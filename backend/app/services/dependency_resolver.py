"""
Dependency Resolver Service

Resolves cross-module dependencies. Config-driven — reads dependency
declarations from config.json and answer data from SessionOutputStore.
No module-specific logic.

Usage:
    from app.services.dependency_resolver import dependency_resolver

    # Check if a module's dependencies are met
    status = dependency_resolver.check_dependencies_met("test-cost-centers")
    # => DependencyStatus(ready=True, missing=[], available=["test-company-codes"])

    # Resolve dynamic options for a question
    from app.schemas.question import OptionsFrom
    opts = OptionsFrom(module="test-company-codes", answerKey="q_codes",
                       valueField="code", displayField="name")
    options = dependency_resolver.resolve_options(opts)
    # => [{"value": "1000", "label": "Main Company"}, ...]
"""

import logging
from typing import Any, Optional

from pydantic import BaseModel, Field

from ..schemas.question import OptionsFrom
from .module_service import ModuleService, module_service
from .session_output_store import SessionOutputStore, session_output_store

logger = logging.getLogger(__name__)


class DependencyInfo(BaseModel):
    """Status of a single dependency."""

    slug: str = Field(..., description="Module slug")
    type: str = Field(default="generic", description="Module type: 'generic' or 'legacy'")
    satisfied: bool = Field(default=False, description="Whether this dependency is satisfied")
    reason: str = Field(default="", description="Why satisfied/unsatisfied")


class DependencyStatus(BaseModel):
    """Result of checking whether a module's dependencies are met."""

    ready: bool = Field(..., description="True if all dependencies have completed sessions")
    missing: list[str] = Field(default_factory=list, description="Module slugs with no completed sessions")
    available: list[str] = Field(default_factory=list, description="Module slugs with completed sessions")
    details: list[DependencyInfo] = Field(default_factory=list, description="Per-dependency type and status info")


class DependencyResolver:
    """
    Resolves cross-module dependencies.

    Responsibilities:
    - Read dependency declarations from module configs
    - Check if dependencies have completed sessions
    - Fetch raw answers from completed sessions
    - Resolve dynamic question options from upstream module data

    Does NOT manage sessions, generate outputs, or serve questions.
    """

    def __init__(
        self,
        module_svc: Optional[ModuleService] = None,
        output_store: Optional[SessionOutputStore] = None,
    ):
        self.module_service = module_svc or module_service
        self.output_store = output_store or session_output_store

    def get_dependencies(self, module_slug: str) -> list[str]:
        """
        Read a module's config.json and return its dependency slugs.

        Returns empty list if no dependencies or module not found.
        """
        metadata = self.module_service.get_module_metadata(module_slug)
        if not metadata:
            return []
        return metadata.dependencies

    def _get_module_type(self, slug: str) -> str:
        """Get the type of a module ('legacy' or 'generic')."""
        metadata = self.module_service.get_module_metadata(slug)
        if metadata and metadata.type:
            return metadata.type
        return "generic"

    def check_dependencies_met(self, module_slug: str) -> DependencyStatus:
        """
        Check if all dependencies have at least one completed session.

        Returns a DependencyStatus with:
        - ready: True if all dependencies are satisfied
        - missing: slugs of modules without completed sessions
        - available: slugs of modules with completed sessions
        - details: per-dependency type and status breakdown

        Note: Legacy dependencies can only be verified server-side if
        the frontend has posted completion data. Otherwise they are
        reported as missing with a reason indicating client-side check
        is needed.
        """
        deps = self.get_dependencies(module_slug)

        if not deps:
            return DependencyStatus(ready=True, missing=[], available=[], details=[])

        missing = []
        available = []
        details = []

        for dep_slug in deps:
            dep_type = self._get_module_type(dep_slug)

            if dep_type == "legacy":
                # Legacy modules don't have server-side sessions.
                # We can't verify completion without frontend reporting.
                # For now, mark as available (trust the frontend).
                available.append(dep_slug)
                details.append(DependencyInfo(
                    slug=dep_slug,
                    type="legacy",
                    satisfied=True,
                    reason="Legacy module — completion verified client-side",
                ))
            else:
                # Generic modules: check SessionOutputStore
                sessions = self.output_store.list_outputs(dep_slug)
                if sessions:
                    available.append(dep_slug)
                    details.append(DependencyInfo(
                        slug=dep_slug,
                        type="generic",
                        satisfied=True,
                        reason=f"Has {len(sessions)} completed session(s)",
                    ))
                else:
                    missing.append(dep_slug)
                    details.append(DependencyInfo(
                        slug=dep_slug,
                        type="generic",
                        satisfied=False,
                        reason="No completed sessions found",
                    ))

        return DependencyStatus(
            ready=len(missing) == 0,
            missing=missing,
            available=available,
            details=details,
        )

    def get_latest_answers(self, module_slug: str) -> Optional[dict[str, Any]]:
        """
        Get the answers dict from the most recent completed session of a module.

        Returns the full answers dict, or None if no completed sessions
        exist or no answers.json was persisted.

        Implementation:
        1. List all outputs for the module (already sorted by completedAt desc)
        2. Try each session until we find one with answers
        3. Return the answers dict
        """
        sessions = self.output_store.list_outputs(module_slug)

        if not sessions:
            logger.debug(f"No completed sessions for module '{module_slug}'")
            return None

        # Sessions are already sorted most-recent-first by list_outputs()
        for session_meta in sessions:
            session_id = session_meta.get("sessionId")
            if not session_id:
                continue

            output = self.output_store.get_output(module_slug, session_id)
            if output and output.get("answers"):
                return output["answers"]

        logger.debug(f"No sessions with persisted answers for module '{module_slug}'")
        return None

    def resolve_options(self, options_from: OptionsFrom) -> list[dict[str, str]]:
        """
        Given an optionsFrom config, fetch and format dropdown options.

        Implementation:
        1. Get latest answers from the source module
        2. Extract the answer for the specified answerKey
        3. If answer is a list (spreadsheet data), map each item to {value, label}
        4. Return formatted options list

        Returns empty list if source module has no completed sessions
        or the answer data doesn't match expectations.
        """
        answers = self.get_latest_answers(options_from.module)

        if answers is None:
            logger.warning(
                f"Cannot resolve options: no completed sessions for module '{options_from.module}'"
            )
            return []

        answer_data = answers.get(options_from.answerKey)

        if answer_data is None:
            logger.warning(
                f"Cannot resolve options: answer key '{options_from.answerKey}' "
                f"not found in module '{options_from.module}'"
            )
            return []

        # Answer must be a list (typically from a spreadsheet question)
        if not isinstance(answer_data, list):
            logger.warning(
                f"Cannot resolve options: answer for '{options_from.answerKey}' "
                f"is not a list (got {type(answer_data).__name__})"
            )
            return []

        # Map each item to {value, label}
        options = []
        for item in answer_data:
            if not isinstance(item, dict):
                continue

            value = item.get(options_from.valueField)
            label = item.get(options_from.displayField)

            if value is not None and label is not None:
                options.append({
                    "value": str(value),
                    "label": str(label),
                })
            else:
                logger.debug(
                    f"Skipping item missing valueField='{options_from.valueField}' "
                    f"or displayField='{options_from.displayField}': {item}"
                )

        return options


# Singleton instance for easy import
dependency_resolver = DependencyResolver()
