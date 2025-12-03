"""
Shared question loader - loads module-specific questions from JSON files.

Module questions are stored in: ../src/data/{module_name}_questions.json

Usage:
    payroll_questions = load_questions("payroll_area")
    payment_questions = load_questions("payment_method")
"""

import json
from pathlib import Path


def load_questions(module_name: str = "payroll_area") -> dict:
    """
    Load questions for a specific module and index by ID.

    Args:
        module_name: Name of the module (e.g., "payroll_area", "payment_method")
                    Defaults to "payroll_area" for backward compatibility

    Returns:
        Dict mapping question IDs to question objects
    """
    questions_path = Path(__file__).parent.parent / "src" / "data" / f"{module_name}_questions.json"

    with open(questions_path) as f:
        data = json.load(f)

    return {q["id"]: q for q in data["questions"]}


# Load payroll questions once at module import (backward compatibility)
QUESTIONS = load_questions("payroll_area")


def get_question(question_id: str, module_name: str = "payroll_area") -> dict | None:
    """
    Get a question by its ID from a specific module.

    Args:
        question_id: The question ID to retrieve
        module_name: Module to load from (defaults to payroll_area for backward compat)

    Returns:
        Question dict or None if not found
    """
    questions = load_questions(module_name)
    return questions.get(question_id)


def get_first_question(module_name: str = "payroll_area") -> dict:
    """
    Get the first question for a module's flow.

    Args:
        module_name: Module to get first question from

    Returns:
        First question dict (assumes q1_frequencies for now)
    """
    questions = load_questions(module_name)
    # TODO: Make this configurable per module
    return questions.get("q1_frequencies") or list(questions.values())[0]
