"""
Master LangGraph Orchestrator

This is the top-level graph that routes between different configuration modules:
- Payroll Area Configuration
- Payment Method Configuration
- (Future: Time Management, Benefits, etc.)

Architecture:
    START → Master Router → Module Graphs → END

The master router determines which module should run next based on:
- What modules have been completed
- Module dependencies (future: DAG-based routing)
"""

from typing import TypedDict, Optional
from langgraph.graph import StateGraph, START, END

# Import module graphs - payroll area graph
from .payroll.payroll_area_graph import (
    payroll_graph as payroll_module,
    PayrollState,
    router_node as payroll_router
)

# Import module graphs - payment method graph
from .payments.payment_method_graph import (
    payment_method_graph,
    PaymentMethodState,
    router_node,
)


# ============================================
# Master State
# ============================================

class MasterState(TypedDict, total=False):
    """
    Master state that flows through all modules.

    This extends PayrollState to track module completion.
    """
    # Session metadata
    session_id: str

    # Module tracking
    completed_modules: list[str]  # List of completed module names
    current_module: Optional[str]  # Currently active module

    # Shared data (inherited from PayrollState)
    answers: dict  # All answers across all modules
    current_question_id: Optional[str]
    current_question: Optional[dict]

    # Module-specific outputs
    payroll_areas: list  # From payroll module
    payment_methods: list  # From payment module (future)

    # Overall completion
    done: bool
    message: Optional[str]


# ============================================
# Module Registry
# ============================================

# Define available modules and their order for MVP
# Future: Replace with dependency DAG
MODULE_SEQUENCE = [
    "payroll_area",
    # "payment_method",
    # Future modules:
    # "time_management",
    # "benefits",
]


def get_next_module(state: MasterState) -> Optional[str]:
    """
    Determine which module should run next.

    MVP: Simple sequential flow
    Future: Check dependencies and return available modules

    Returns:
        Module name to run next, or None if all complete
    """
    completed = state.get("completed_modules") or []

    for module_name in MODULE_SEQUENCE:
        if module_name not in completed:
            return module_name

    return None  # All modules complete


# ============================================
# Master Router Node
# ============================================

def master_router(state: MasterState) -> MasterState:
    """
    Master routing logic - determines which module to execute.

    Flow:
    default_code. Check which modules are complete
    2. Route to next module
    3. Execute that module's logic
    4. Mark as complete if done
    5. Repeat or finish
    """
    completed_modules = state.get("completed_modules") or []

    # Determine next module
    next_module = get_next_module(state)

    if next_module is None:
        # All modules complete!
        return {
            **state,
            "done": True,
            "current_module": None,
            "message": "All configuration modules complete!",
        }

    # Route to the appropriate module
    if next_module == "payroll_area":
        # Execute payroll module
        result = payroll_router(state)

        # Check if payroll module is complete
        if result.get("done"):
            # Mark payroll as complete, move to next module
            new_completed = completed_modules + ["payroll_area"]

            # Determine if there are any modules left; if none, stay done
            next_after_payroll = get_next_module({
                **result,
                "completed_modules": new_completed,
            })

            if next_after_payroll is None:
                return {
                    **result,
                    "completed_modules": new_completed,
                    "current_module": None,
                    "done": True,
                }

            # Reset done flag so master can continue to remaining modules
            return {
                **result,
                "completed_modules": new_completed,
                "current_module": next_after_payroll,
                "done": False,  # Master not done yet
            }
        else:
            # Payroll still in progress
            return {
                **result,
                "completed_modules": completed_modules,
                "current_module": next_module,
            }

    elif next_module == "payment_method":
    # Execute payment method module

      result = payment_method_router(state)

      if result.get("done"):
        new_completed = completed_modules + ["payment_method"]
        return {
            **result,
            "completed_modules": new_completed,
            "current_module": next_module,
            "done": False,  # Continue to next module
        }
      else:
        return {
            **result,
            "completed_modules": completed_modules,
            "current_module": next_module,
        }


    # Fallback: unknown module
    return {
        **state,
        "done": True,
        "message": f"Unknown module: {next_module}",
    }


# ============================================
# Create and Compile Master Graph
# ============================================

def create_master_graph() -> StateGraph:
    """
    Create the master orchestration graph.

    Simple for MVP: START → master_router → END

    The master_router handles all module routing internally.
    """
    graph = StateGraph(MasterState)

    # Add the master router node
    graph.add_node("master_router", master_router)

    # Edges
    graph.add_edge(START, "master_router")
    graph.add_edge("master_router", END)

    return graph.compile()


# Create the compiled master graph (singleton)
master_graph = create_master_graph()


# ============================================
# Exports for Backward Compatibility
# ============================================

# For main.py to use - keeps interface consistent
# main.py can still import "payroll_graph" and "PayrollState"
# but now they point to the master orchestrator
payroll_graph = master_graph
PayrollState = MasterState  # Type alias


# ============================================
# Testing
# ============================================

if __name__ == "__main__":
    print("Testing Master Graph with module routing...")
    print("=" * 60)

    # Initial state
    state: MasterState = {
        "session_id": "test",
        "answers": {},
        "completed_modules": [],
    }

    # Run the master graph
    result = master_graph.invoke(state)

    print(f"\ndefault_code. First module: {result.get('current_module')}")
    print(f"   Question: {result.get('current_question_id')}")
    print(f"   Done: {result.get('done')}")

    print("\n" + "=" * 60)
    print("✓ Master graph initialized successfully!")
    print(f"✓ Available modules: {MODULE_SEQUENCE}")
    print(f"✓ First module to run: {get_next_module(state)}")