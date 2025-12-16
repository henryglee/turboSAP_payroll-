from typing import TypedDict, Annotated, List, Optional, Literal
from langgraph.graph import StateGraph, START, END # type: ignore
from langgraph.graph.message import add_messages # type: ignore
import operator

PayFrequency = Literal["weekly", "biweekly", "semi-monthly", "monthly"]

# pay period pattern options
WeeklyPattern = Literal["mon-sun", "sun-sat"]
BiweeklyPattern = Literal["week1_mon-sun", "week2_mon-sun"]
SemiMonthlyPattern = Literal["1-15", "16-end"]
MonthlyPattern = Literal["1-end"]

# create the state
class State(TypedDict, total=False):
    # Inputs populated by the outside "UI" / user answers
    pay_frequency: Optional[PayFrequency]
    period_pattern: Optional[str]   # raw user text like "Mon to Sun", "1 - 15", etc.

    # Outputs / canonical values we commit
    period_pattern_code: Optional[str]  # e.g. "mon-sun", "1-15", "1-end"

    # Transcript; we CONCAT messages so nothing gets overwritten
    messages: Annotated[List[str], add_messages]

# utilities
def norm(s: Optional[str]) -> str:
    return (
        (s or "").strip().lower().replace("\u2192", "-").replace("->", "-").replace("—", "-").replace("–", "-").replace(" to ", "-").replace("  ", " ").replace(" ", ""))


def is_weekly_mon_sun(text: str) -> bool:
    t = norm(text)
    return t in {"mon-sun", "monday-sunday", "monday-sun", "mon-sunday"}

def is_weekly_sun_sat(text: str) -> bool:
    t = norm(text)
    return t in {"sun-sat", "sunday-saturday", "sunday-sat", "sun-saturday"}

def is_biweekly_w1(text: str) -> bool:
    t = norm(text)
    # Accept "week1", "wk1", "w1", optionally with mon-sun
    return t.startswith("week1") or t.startswith("wk1") or t == "w1"

def is_biweekly_w2(text: str) -> bool:
    t = norm(text)
    return t.startswith("week2") or t.startswith("wk2") or t == "w2"

def is_semimonth_1_15(text: str) -> bool:
    t = norm(text)
    return t in {"1-15", "1to15", "1through15", "1..15"}

def is_semimonth_16_end(text: str) -> bool:
    t = norm(text)
    return t in {"16-end", "16toend", "16throughend", "16..end"}

def is_monthly_1_end(text: str) -> bool:
    t = norm(text)
    return t in {"1-end", "1toend", "1throughend", "1..end"}

# create nodes

def intro(state: State) -> State:
    return {"messages": [
        "Q1) What is this employee’s pay frequency? (weekly / biweekly / semi-monthly / monthly)"
    ]}

def route_by_frequency(state: State) -> State:
    # router node (no state mutation)
    return {}

def ask_period_pattern(state: State) -> State:
    freq = (state.get("pay_frequency") or "").lower()
    if freq == "weekly":
        msg = (
            "Q2) For WEEKLY payroll, what is the pay period pattern?\n"
            "- Mon to Sun\n- Sun to Sat"
        )
    elif freq == "biweekly":
        msg = (
            "Q2) For BIWEEKLY payroll, which week pattern applies?\n"
            "- Week1 (Mon to Sun)\n- Week2 (Mon to Sun)"
        )
    elif freq in ("semi-monthly", "semimonthly"):
        msg = (
            "Q2) For SEMI-MONTHLY payroll, choose one:\n"
            "- 1 to 15 (each month)\n- 16 to end (each month)"
        )
    elif freq == "monthly":
        msg = (
            "Q2) For MONTHLY payroll, choose:\n"
            "- 1 to end (each month)"
        )
    else:
        msg = "Please provide a valid pay frequency (weekly / biweekly / semi-monthly / monthly)."
    return {"messages": [msg]}

def route_pattern_by_frequency(state: State) -> State:
    # second-level router: decide which pattern router to use (weekly/biweekly/semi-monthly/monthly)
    return {}

# weekly leaves

def weekly_mon_sun(state: State) -> State:
    return {
        "period_pattern_code": "mon-sun",
        "messages": ["Recorded pattern: Weekly Mon to Sun"]
    }

def weekly_sun_sat(state: State) -> State:
    return {
        "period_pattern_code": "sun-sat",
        "messages": ["Recorded pattern: Weekly Sun to Sat"]
    }

# biweekly leaves

def biweekly_week1(state: State) -> State:
    return {
        "period_pattern_code": "week1_mon-sun",
        "messages": ["Recorded pattern: Biweekly Week 1 (Mon to Sun)"]
    }

def biweekly_week2(state: State) -> State:
    return {
        "period_pattern_code": "week2_mon-sun",
        "messages": ["Recorded pattern: Biweekly Week 2 (Mon to Sun)"]
    }

# Semi-monthly leaves

def semimonth_1_15(state: State) -> State:
    return {
        "period_pattern_code": "1-15",
        "messages": ["Recorded pattern: Semi-monthly 1 to 15"]
    }

def semimonth_16_end(state: State) -> State:
    return {
        "period_pattern_code": "16-end",
        "messages": ["Recorded pattern: Semi-monthly 16 to end"]
    }

# monthly leaves

def monthly_1_end(state: State) -> State:
    return {
        "period_pattern_code": "1-end",
        "messages": ["Recorded pattern: Monthly 1 to end"]
    }

# build the graph

g = StateGraph(State)

# nodes
g.add_node("intro", intro)
g.add_node("route_by_frequency", route_by_frequency)
g.add_node("ask_period_pattern", ask_period_pattern)
g.add_node("route_pattern_by_frequency", route_pattern_by_frequency)

# leaves
g.add_node("weekly_mon_sun", weekly_mon_sun)
g.add_node("weekly_sun_sat", weekly_sun_sat)

g.add_node("biweekly_week1", biweekly_week1)
g.add_node("biweekly_week2", biweekly_week2)

g.add_node("semimonth_1_15", semimonth_1_15)
g.add_node("semimonth_16_end", semimonth_16_end)

g.add_node("monthly_1_end", monthly_1_end)

# static edges
g.add_edge(START, "intro")
g.add_edge("intro", "route_by_frequency")
g.add_edge("ask_period_pattern", "route_pattern_by_frequency")

# Conditional edges (1st router: by pay_frequency)
def route_freq_fn(state: State) -> str:
    pf = (state.get("pay_frequency") or "").lower().strip()
    if pf in {"weekly"}:
        return "ask_period_pattern"
    if pf in {"biweekly"}:
        return "ask_period_pattern"
    if pf in {"semi-monthly", "semimonthly"}:
        return "ask_period_pattern"
    if pf in {"monthly"}:
        return "ask_period_pattern"
    return END

g.add_conditional_edges(
    "route_by_frequency",
    route_freq_fn,
    {
        "ask_period_pattern": "ask_period_pattern",
        END: END,
    },
)

# Conditional edges (2nd router: choose the frequency-specific pattern router)
def route_pattern_router_fn(state: State) -> str:
    pf = (state.get("pay_frequency") or "").lower().strip()
    # jump directly into the corresponding pattern evaluation node
    # by returning a sentinel that our mapping (below) translates.
    if pf == "weekly":
        return "route_weekly"
    if pf == "biweekly":
        return "route_biweekly"
    if pf in {"semi-monthly", "semimonthly"}:
        return "route_semimonthly"
    if pf == "monthly":
        return "route_monthly"
    return END

g.add_conditional_edges(
    "route_pattern_by_frequency",
    route_pattern_router_fn,
    {
        # We will chain immediately into the frequency-specific routers using another set of conditional mappings below.
        # These are not graph nodes; they are keys we handle just to keep the mapping readable.
        "route_weekly": "route_pattern_by_frequency_weekly",
        "route_biweekly": "route_pattern_by_frequency_biweekly",
        "route_semimonthly": "route_pattern_by_frequency_semimonthly",
        "route_monthly": "route_pattern_by_frequency_monthly",
        END: END,
    },
)

# Implement the four frequency-specific routers as tiny pass-through nodes,
# so we can attach the relevant conditional edges cleanly.
def _router_stub(state: State) -> State:
    return {}

g.add_node("route_pattern_by_frequency_weekly", _router_stub)
g.add_node("route_pattern_by_frequency_biweekly", _router_stub)
g.add_node("route_pattern_by_frequency_semimonthly", _router_stub)
g.add_node("route_pattern_by_frequency_monthly", _router_stub)

# Weekly pattern conditional edges
def weekly_pattern_fn(state: State) -> str:
    p = state.get("period_pattern") or ""
    if is_weekly_mon_sun(p):
        return "weekly_mon_sun"
    if is_weekly_sun_sat(p):
        return "weekly_sun_sat"
    return END 

g.add_conditional_edges(
    "route_pattern_by_frequency_weekly",
    weekly_pattern_fn,
    {
        "weekly_mon_sun": "weekly_mon_sun",
        "weekly_sun_sat": "weekly_sun_sat",
        END: END,
    },
)

# Biweekly pattern conditional edges
def biweekly_pattern_fn(state: State) -> str:
    p = state.get("period_pattern") or ""
    if is_biweekly_w1(p):
        return "biweekly_week1"
    if is_biweekly_w2(p):
        return "biweekly_week2"
    return END

g.add_conditional_edges(
    "route_pattern_by_frequency_biweekly",
    biweekly_pattern_fn,
    {
        "biweekly_week1": "biweekly_week1",
        "biweekly_week2": "biweekly_week2",
        END: END,
    },
)
# Semi-monthly pattern conditional edges
def semimonthly_pattern_fn(state: State) -> str:
    p = state.get("period_pattern") or ""
    if is_semimonth_1_15(p):
        return "semimonth_1_15"
    if is_semimonth_16_end(p):
        return "semimonth_16_end"
    return END

g.add_conditional_edges(
    "route_pattern_by_frequency_semimonthly",
    semimonthly_pattern_fn,
    {
        "semimonth_1_15": "semimonth_1_15",
        "semimonth_16_end": "semimonth_16_end",
        END: END,
    },
)

# Monthly pattern conditional edges
def monthly_pattern_fn(state: State) -> str:
    p = state.get("period_pattern") or ""
    if is_monthly_1_end(p):
        return "monthly_1_end"
    return END

g.add_conditional_edges(
    "route_pattern_by_frequency_monthly",
    monthly_pattern_fn,
    {
        "monthly_1_end": "monthly_1_end",
        END: END,
    },
)
# ----- Finish leaves -----
g.add_edge("weekly_mon_sun", END)
g.add_edge("weekly_sun_sat", END)

g.add_edge("biweekly_week1", END)
g.add_edge("biweekly_week2", END)

g.add_edge("semimonth_1_15", END)
g.add_edge("semimonth_16_end", END)

g.add_edge("monthly_1_end", END)

graph = g.compile()


if __name__ == "__main__":
    state: State = {"messages": []}

    # Q1
    out = graph.invoke(state)
    print(out["messages"][-1].content)
    state["pay_frequency"] = input("> ").strip().lower()

    # Q2
    out = graph.invoke(state)
    print(out["messages"][-1].content)

    # Keep asking for the pattern until we get a code
    while True:
        state["period_pattern"] = input("> ").strip()
        out = graph.invoke(state)
        if out.get("period_pattern_code"):
            print(out["messages"][-1].content)
            print("period_pattern_code =", out["period_pattern_code"])
            break
        else:
            print("Sorry, I didn't catch that. Please try again")
            # re-show the Q2 prompt for clarity
            print(graph.invoke({"messages": [], "pay_frequency": state["pay_frequency"]})["messages"][-1].content)






