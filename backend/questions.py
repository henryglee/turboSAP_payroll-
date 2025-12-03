"""
Question loader - reads from the shared questions.json file.

Single source of truth: ../src/data/questions.json
"""

import json
import configuration
from pathlib import Path

# Path to the shared questions JSON
QUESTIONS_PATH = Path(__file__).parent.parent / "src" / "data" / "questions.json"


def load_questions() -> dict:
    """Load questions from JSON and index by ID."""
    #with open(QUESTIONS_PATH) as f:
    #    data = json.load(f)

    data = configuration.load_current_questions()
    return {q["id"]: q for q in data["questions"]}


# Load once at module import
QUESTIONS = load_questions()


def get_question(question_id: str) -> dict | None:
    """Get a question by its ID."""
    questions = load_questions()
    return questions.get(question_id)


def get_first_question() -> dict:
    """Get the first question in the flow."""
    questions = load_questions()
    return questions["q1_frequencies"]
