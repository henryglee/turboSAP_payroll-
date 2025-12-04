"""
Payment Method Configuration Module (Skeleton)

This module handles the configuration of SAP payment methods.
It follows the same pattern as payroll_area_graph.py.

TODO for full implementation:
1. Define payment method questions in src/data/payment_method_questions.json
2. Implement determine_next_question() logic
3. Implement generate_payment_methods() logic
4. Add dynamic question generation if needed
"""

from typing import TypedDict, Optional
from langgraph.graph import StateGraph, START, END


# ============================================
# State Definition
# ============================================

class PaymentMethodState(TypedDict, total=False):
    """State for payment method configuration flow."""
    session_id: str
    answers: dict
    current_question_id: Optional[str]
    current_question: Optional[dict]
    payment_methods: list  # Generated payment method configurations
    done: bool
    message: Optional[str]


# ============================================
# Question Logic (TODO)
# ============================================

def determine_next_question(answers: dict) -> tuple[Optional[str], Optional[dict]]:
    """
    Determine the next question based on answers.

    TODO: Implement actual question routing logic

    Example questions:
    - "What payment methods do you use?" (Check, ACH, Wire, etc.)
    - "Which bank accounts?" (Per payment method)
    - "Payment run schedule?" (Weekly, biweekly, etc.)
    - "Approval workflow?" (Single, multi-level)

    Returns:
        (question_id, question_object) tuple
    """
    # Skeleton: Just return completion
    return (None, None)


def generate_payment_methods(answers: dict) -> list[dict]:
    """
    Generate payment method configurations from collected answers.

    TODO: Implement actual generation logic

    Example output structure:
    [
        {
            "code": "C",  # Check
            "description": "Check Payment",
            "bank_account": "1234567890",
            "payment_run": "weekly",
            "approval_levels": 1,
            "reasoning": ["..."]
        },
        ...
    ]

    Returns:
        List of payment method configuration dicts
    """
    # Skeleton: Return empty list
    return []


# ============================================
# Router Node
# ============================================

def payment_method_router(state: PaymentMethodState) -> PaymentMethodState:
    """
    Main router for payment method configuration.

    Follows the same pattern as payroll_area_graph.py:
    1. Determine next question
    2. If no more questions, generate configurations
    3. Return updated state
    """
    answers = state.get("answers", {})

    # Find next question
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

    # Return next question
    return {
        **state,
        "current_question_id": next_question_id,
        "current_question": question_obj,
        "done": False,
    }


# ============================================
# Create Graph
# ============================================

def create_payment_method_graph() -> StateGraph:
    """
    Create and compile the payment method graph.

    Simple architecture: START → router → END
    """
    graph = StateGraph(PaymentMethodState)

    # Add router node
    graph.add_node("router", payment_method_router)

    # Edges
    graph.add_edge(START, "router")
    graph.add_edge("router", END)

    return graph.compile()


# Create the compiled graph (singleton)
payment_method_graph = create_payment_method_graph()


# ============================================
# Testing
# ============================================

if __name__ == "__main__":
    print("Testing Payment Method Graph (Skeleton)...")
    print("=" * 60)

    # Initial state
    state: PaymentMethodState = {
        "session_id": "test",
        "answers": {},
    }

    # Run the graph
    result = payment_method_graph.invoke(state)

    print(f"\nResult:")
    print(f"  Done: {result.get('done')}")
    print(f"  Payment Methods: {len(result.get('payment_methods', []))}")
    print(f"  Message: {result.get('message')}")

    print("\n" + "=" * 60)
    print("✓ Payment method graph skeleton created!")
    print("✓ Ready for full implementation")
