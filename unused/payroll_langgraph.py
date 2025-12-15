from langgraph.graph import StateGraph, END
from typing import TypedDict, Optional, Dict, Any
import re, json

with open("/Users/henrylee/Projects-DaveClassJuly/turboSAP/TurboSAP_questions.json") as f:
    TREE = json.load(f)

# ---- State ----
class WizardState(TypedDict, total=False):
    current: str
    answers: Dict[str, Any]
    user_input: Optional[str]

# ---- Helpers ----
def extract_choices(prompt):
    match = re.search(r"\((.*?)\)", prompt)
    if not match:
        return []
    return [c.strip() for c in match.group(1).split("/")]

def normalize(text):
    if text is None:
        return ""
    return str(text).strip().lower()

def route_to_next_node(routes, user_answer):
    for pattern, target in routes.items():
        if pattern == "*":
            continue
        if re.search(pattern, user_answer, re.IGNORECASE):
            return target
    return routes.get("*")

# ---- Node Handlers ----
def ask_node(state: WizardState):
    node = TREE["nodes"][state["current"]]
    prompt = node["prompt"]
    choices = extract_choices(prompt)

    while True:  # Keep asking until we get valid input
        print(f"\n{prompt}")
        if "choices" in choices:
            print(f"Choices: {', '.join(content['choices'])}")
        
        user_input = input("Your answer: ").strip()
        if user_input:  # Only process non-empty input
            if user_input in choices: # Check if the input matches any of the choices
                state["user_input"] = user_input
                break
           
        print("Please provide a valid answer.")  


    # Produce a message for the user
    return state


def handle_answer(state: WizardState):
    node = TREE["nodes"][state["current"]]
    answer = normalize(state["user_input"])

    # Save answer
    write_to = node["write_to"]
    if "answers" not in state:
        state["answers"] = {}

    if write_to in state["answers"]:
        print(f"Warning: Overwriting existing answer for {write_to}")
    state["answers"][node["write_to"]] = answer

    # Branch
    next_node = route_to_next_node(node["routes"], answer)
    state["current"] = next_node
    state["user_input"] = None  # Reset user_input after processing
    return state

def commit_node(state: WizardState):
    node = TREE["nodes"][state["current"]]

    # Write commits
    for k, v in node["set"].items():
        state["answers"][k] = v

    print(node["message"])
    state["current"] = node["next"]
    return state

def end_node(state: WizardState):
    return {
        "final": state["answers"]
    }

def route_to_next_node(routes, user_answer):
    print(f"Debug - routes: {routes}")  # Debug print
    print(f"Debug - user_answer: '{user_answer}'")  # Debug print
    
    # First, try exact match (case-insensitive)
    for pattern, target in routes.items():
        if pattern == "*":
            continue
        # Split the pattern by | to handle alternatives
        alternatives = [p.strip() for p in pattern.split('|')]
        print(f"Debug - testing pattern alternatives: {alternatives}")  # Debug print
        if any(user_answer.lower() == alt.lower() for alt in alternatives):
            print(f"Debug - exact match found for pattern '{pattern}'")  # Debug print
            return target
    
    # If no exact match, try regex search (for backward compatibility)
    for pattern, target in routes.items():
        if pattern == "*":
            continue
        if re.search(pattern, user_answer, re.IGNORECASE):
            print(f"Debug - regex matched pattern '{pattern}' to target '{target}'")  # Debug print
            return target
    
    print("Debug - no pattern matched, using default")  # Debug print
    return routes.get("*")

# ---- Build Graph ----
graph = StateGraph(WizardState)

# Router logic
def router(state: WizardState):
    node = TREE["nodes"][state["current"]]
    if node["type"] == "question":
        if state.get("user_input") is None:
            return "ask"              # show the question
        return "handle_answer"        # we have input; process it
    elif node["type"] == "commit":
        return "commit"
    return "end"

# Add all nodes with consistent names
graph.add_node("ask_node", ask_node)
graph.add_node("handle_answer_node", handle_answer)
graph.add_node("commit_node", commit_node)
graph.add_node("end_node", end_node)

graph.set_entry_point("ask_node")


# From the ask node, route based on router output
graph.add_conditional_edges(
    "ask_node",
    router,
    {
        "handle_answer": "handle_answer_node",
        "commit": "commit_node",
        "end": "end_node",
    }
)

graph.add_conditional_edges(
    "handle_answer_node",
    router,
    {
        "ask": "ask_node",
        "commit": "commit_node",
        "end": "end_node",
    }
)

graph.add_conditional_edges(
    "commit_node",
    router,
    {
        "ask": "ask_node",
        "end": "end_node",
    }
)

graph.add_edge("end_node", END)

wizard = graph.compile()

if __name__ == "__main__":
    state = {
        "current": TREE["start"],
        "answers": {},
        "user_input": None
    }

    try:
        response = {"current": TREE["start"]}

        while True:
            response = wizard.invoke(response)
            if response["current"] == "end":
                print("\nThank you! Here's what we've collected:")
                for key, value in response["answers"].items():
                    print(f"{key}: {value}")
                break
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.")
    except Exception as e:
        print(f"An error occurred: {e}")