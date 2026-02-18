import json
import shutil
import sys
from pathlib import Path

import pytest

SKILL_DIR = (
    Path(__file__).resolve().parents[1]
    / "app"
    / "agents"
    / ".opencode"
    / "skills"
    / "turbosap_module"
)
if str(SKILL_DIR) not in sys.path:
    sys.path.append(str(SKILL_DIR))

from config_module_skill import (  # noqa: E402
    QuestionValidationError,
    add_question,
    get_question,
    list_module_questions,
    update_question,
)


@pytest.fixture()
def temp_modules_root(tmp_path):
    src = Path("app/data/modules")
    dst = tmp_path / "modules"
    shutil.copytree(src, dst)
    return dst


def test_list_and_get_questions(temp_modules_root):
    summaries = list_module_questions("bank-details", modules_root=temp_modules_root)
    assert summaries, "expected bank-details module to contain questions"
    assert summaries[0].id == "q_bank_name"

    question = get_question("bank-details", "q_bank_name", modules_root=temp_modules_root)
    assert question is not None
    assert question["text"].startswith("What is your company's primary bank")


def test_update_question_persists_changes(temp_modules_root):
    updated = update_question(
        "bank-details",
        "q_bank_name",
        {"helpText": "Provide the legal banking entity name."},
        modules_root=temp_modules_root,
    )
    assert updated["helpText"] == "Provide the legal banking entity name."

    path = temp_modules_root / "bank-details" / "questions.json"
    payload = json.loads(path.read_text())
    match = next(q for q in payload["questions"] if q["id"] == "q_bank_name")
    assert match["helpText"] == "Provide the legal banking entity name."


def test_add_question_appends_entry(temp_modules_root):
    new_question = {
        "id": "q_new_requirement",
        "text": "Describe any special treasury requirements",
        "type": "text",
        "order": 99,
        "helpText": "One requirement per line",
        "outputMapping": {
            "file": "bank_details.csv",
            "column": "SpecialRequirements",
            "transform": "direct",
        },
    }

    result = add_question("bank-details", new_question, modules_root=temp_modules_root)
    assert result["id"] == "q_new_requirement"

    path = temp_modules_root / "bank-details" / "questions.json"
    payload = json.loads(path.read_text())
    ids = [q["id"] for q in payload["questions"]]
    assert "q_new_requirement" in ids


def test_validation_blocks_invalid_question(temp_modules_root):
    with pytest.raises(QuestionValidationError):
        add_question(
            "bank-details",
            {
                "id": "q_bad",
                "text": "Missing required fields",
                "type": "text",
                "order": "not-int",
                # outputMapping intentionally missing
            },
            modules_root=temp_modules_root,
        )
