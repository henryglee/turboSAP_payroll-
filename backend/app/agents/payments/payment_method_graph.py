"""
Payment Method Configuration Module (Skeleton)

This module handles the configuration of SAP payment methods.
It follows the same pattern as payroll_area_graph.py.

TODO for full implementation:
1. Define payment method questions in src/data/payment_method_questions.json  (done)
2. Implement determine_next_question() logic. 
3. Implement generate_payment_methods() logic
4. Add dynamic question generation if needed
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TypedDict, Optional, Dict, Any, List, Tuple

from langgraph.graph import StateGraph, START, END  # type: ignore

# ============================================
# Load payment_method_question.json
# ============================================

BASE_DIR = Path(__file__).resolve().parent

# File lives in: backend/app/data/payment_method_questions.json
QUESTIONS_PATH = (
    BASE_DIR.parent.parent / "data" / "payment_method_questions.json"
)

# Debug print (optional)
print("Looking for payment questions at:", QUESTIONS_PATH)

# Fallback: same directory as this file
if not QUESTIONS_PATH.exists():
    QUESTIONS_PATH = BASE_DIR / "payment_method_questions.json"
    print("Fallback path used:", QUESTIONS_PATH)

# Load JSON file
with QUESTIONS_PATH.open("r", encoding="utf-8") as f:
    QUESTIONS_SPEC: Dict[str, Any] = json.load(f)

QUESTIONS: List[Dict[str, Any]] = QUESTIONS_SPEC.get("questions", [])
QUESTIONS_BY_ID: Dict[str, Dict[str, Any]] = {q["id"]: q for q in QUESTIONS}



# ============================================
# State
# ============================================

class PaymentMethodState(TypedDict, total=False):
    """State for payment method configuration flow."""
    session_id: str
    answers: Dict[str, Any]
    current_question_id: Optional[str]
    current_question: Optional[Dict[str, Any]]
    payment_methods: List[Dict[str, Any]]  # Generated payment method configurations
    done: bool
    message: Optional[str]


# ============================================
# Question Logic
# ============================================

def _condition_satisfied(show_if: Dict[str, Any], answers: Dict[str, Any]) -> bool:
    """
    Evaluate a simple `showIf` condition from the JSON spec.
    Currently supports:
        { "questionId": "...", "answerId": "..." }
    """
    parent_id = show_if.get("questionId")
    required_answer = show_if.get("answerId")
    if not parent_id:
        return True
    return answers.get(parent_id) == required_answer


def determine_next_question(answers: Dict[str, Any]) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
    """
    Determine the next question based on the current answers.

    Logic:
    - Iterate through questions in JSON order.
    - For each question:
      - If it has a `showIf` condition, only consider it when that condition is met.
      - Skip questions that already have an answer in `answers`.
      - The first remaining eligible question is the "next question".
    - If none remain, return (None, None) to indicate completion.
    """
    for q in QUESTIONS:
        qid = q["id"]

        # Skip if already answered
        if qid in answers:
            continue

        # Check showIf condition (if present)
        show_if = q.get("showIf")
        if show_if and not _condition_satisfied(show_if, answers):
            continue

        # This is the next question
        return qid, q

    # No more questions
    return None, None


def generate_payment_methods(answers: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Generate payment method configurations from collected answers.

    Uses the specific structure of your payment_method_questions.json:

    - q1_payment_method_p       (yes/no)
      - q1_p_house_banks        (free text)
      - q1_p_ach_spec           (free text)

    - q2_payment_method_q       (yes/no)
      - q2_q_volume             (free text)
      - q2_q_check_range        (free text)

    - q3_payment_method_k       (yes/no)
    - q4_payment_method_m       (yes/no)
    - q5_pre_note_confirmation  (agree / disagree)
    """
    methods: List[Dict[str, Any]] = []

    # --- P: Direct Deposit ACH ---
    p_answer = answers.get("q1_payment_method_p")
    if p_answer in {"yes", True}:
        methods.append(
            {
                "code": "P",
                "description": "Direct Deposit ACH",
                "used": True,
                "house_banks": answers.get("q1_p_house_banks"),
                "ach_file_spec": answers.get("q1_p_ach_spec"),
                "reasoning": [
                    "Customer confirmed P - Direct Deposit ACH is used.",
                    "Collected house bank names and ACH file specification.",
                ],
            }
        )
    elif p_answer == "no":
        methods.append(
            {
                "code": "P",
                "description": "Direct Deposit ACH",
                "used": False,
                "reasoning": [
                    "Customer confirmed P - Direct Deposit ACH is not used."
                ],
            }
        )

    # --- Q: Physical Check ---
    q_answer = answers.get("q2_payment_method_q")
    if q_answer in {"yes", True}:
        methods.append(
            {
                "code": "Q",
                "description": "Physical Check",
                "used": True,
                "check_volume": answers.get("q2_q_volume"),
                "check_number_range": answers.get("q2_q_check_range"),
                "reasoning": [
                    "Customer confirmed Q - Physical Check is used.",
                    "Collected volume and check number range details.",
                ],
            }
        )
    elif q_answer == "no":
        methods.append(
            {
                "code": "Q",
                "description": "Physical Check",
                "used": False,
                "reasoning": [
                    "Customer confirmed Q - Physical Check is not used."
                ],
            }
        )

    # --- K: Pay Card (Debit Card) ---
    k_answer = answers.get("q3_payment_method_k")
    if k_answer in {"yes", True}:
        methods.append(
            {
                "code": "K",
                "description": "Pay Card / Debit Card",
                "used": True,
                "reasoning": [
                    "Customer confirmed K - Pay Card (Debit Card) is used."
                ],
            }
        )
    elif k_answer == "no":
        methods.append(
            {
                "code": "K",
                "description": "Pay Card / Debit Card",
                "used": False,
                "reasoning": [
                    "Customer confirmed K - Pay Card (Debit Card) is not used."
                ],
            }
        )

    # --- M: Manual / Off-cycle Check ---
    m_answer = answers.get("q4_payment_method_m")
    if m_answer in {"yes", True}:
        methods.append(
            {
                "code": "M",
                "description": "Manual / Off-cycle Check",
                "used": True,
                "reasoning": [
                    "Customer confirmed M - Manual / Off-cycle Check is used."
                ],
            }
        )
    elif m_answer == "no":
        methods.append(
            {
                "code": "M",
                "description": "Manual / Off-cycle Check",
                "used": False,
                "reasoning": [
                    "Customer confirmed M - Manual / Off-cycle Check is not used."
                ],
            }
        )

    # --- Pre-note preference (not a payment method, but global setting) ---
    pre_note = answers.get("q5_pre_note_confirmation")
    if pre_note is not None:
        methods.append(
            {
                "code": "PRE_NOTE",
                "description": "Pre-note process preference",
                "agree_no_pre_note": pre_note == "agree",
                "raw_answer": pre_note,
                "reasoning": [
                    "Customer responded to recommendation to NOT use pre-note "
                    "and rely on check replacement for failed transfers."
                ],
            }
        )

    return methods


# ============================================
# Router Node
# ============================================

def payment_method_router(state: PaymentMethodState) -> PaymentMethodState:
    """
    Main router for payment method configuration.

    Pattern:
    1. Look at existing `answers` in state.
    2. Determine the next question from the JSON spec.
    3. If no more questions, generate configurations and mark `done = True`.
    """
    answers = state.get("answers", {})

    # Find next question based on what we already know
    next_question_id, question_obj = determine_next_question(answers)

    if next_question_id is None:
        # All questions answered - generate payment methods
        methods = generate_payment_methods(answers)
        return {
            **state,
            "current_question_id": None,
            "current_question": None,
            "payment_methods": methods,
            "done": True,
            "message": f"Generated {len(methods)} payment method(s).",
        }

    # Still more questions to ask
    return {
        **state,
        "current_question_id": next_question_id,
        "current_question": question_obj,
        "done": False,
        "message": None,
    }


# ============================================
# Create Graph
# ============================================

def create_payment_method_graph():
    """
    Create and compile the payment method graph.

    Simple architecture: START → router → END
    (front-end is responsible for updating `answers` between calls)
    """
    graph = StateGraph(PaymentMethodState)
    graph.add_node("router", payment_method_router)
    graph.add_edge(START, "router")
    graph.add_edge("router", END)
    return graph.compile()


# Singleton compiled graph
payment_method_graph = create_payment_method_graph()

# Convenience exports for FastAPI / master graph
router_node = payment_method_router


# ============================================
# Pretty-print utility (no quotes in output)
# ============================================
def pretty_print_methods(methods: list[dict]):
    """Print payment method configs without quotes around keys."""
    for m in methods:
        print("{")
        for key, val in m.items():
            # If list → print comma-separated
            if isinstance(val, list):
                val = ", ".join(str(v) for v in val)

            # Just print key: value without quotes
            print(f"  {key}: {val}")
        print("}\n")


# ============================================
# Manual Testing
# ============================================

if __name__ == "__main__":
    print("Testing Payment Method Graph...")
    print("=" * 60)

    # Initial state
    state: PaymentMethodState = {
        "session_id": "test-session",
        "answers": {
            "q1_payment_method_p": "yes",
            "q1_p_house_banks": "Bank A, Bank B",
            "q1_p_ach_spec": "NACHA standard file",

            "q2_payment_method_q": "yes",
            "q2_q_volume": "200 checks per pay period",
            "q2_q_check_range": "100000–199999",

            "q3_payment_method_k": "no",

            "q4_payment_method_m": "yes",

            "q5_pre_note_confirmation": "agree"
        }
    }

    result = payment_method_graph.invoke(state)

    print("\nPayment methods:")
    pretty_print_methods(result.get("payment_methods", []))

    print("Done:", result.get("done"))
    print("Message:", result.get("message"))

