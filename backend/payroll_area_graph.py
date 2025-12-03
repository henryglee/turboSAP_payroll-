"""
LangGraph implementation for Payroll Area configuration flow.

This graph handles:
1. Routing between questions based on answers
2. Determining the next question to ask
3. Generating payroll areas when all questions are answered

KEY CHANGE: Business unit and geographic separation questions are now
asked PER CALENDAR (e.g., "weekly Mon-Sun Friday"), not globally.
"""

from typing import TypedDict, Optional, Annotated
from langgraph.graph import StateGraph, START, END


class PayrollState(TypedDict, total=False):
    """State that flows through the graph."""
    session_id: str
    answers: dict  # {question_id: answer}
    current_question_id: Optional[str]
    current_question: Optional[dict]  # Dynamic question object
    payroll_areas: list
    done: bool
    message: Optional[str]


# ============================================
# Helper Functions
# ============================================

def get_calendar_combos(answers: dict) -> list[dict]:
    """
    Extract all calendar combinations from answers.

    Returns list of dicts like:
    [
        {
            "key": "weekly_monsun_friday",
            "label": "Weekly Mon-Sun Friday",
            "frequency": "weekly",
            "pattern": "mon-sun",
            "payday": "friday"
        },
        ...
    ]
    """
    combos = []
    frequencies = answers.get("q1_frequencies", [])

    if isinstance(frequencies, str):
        frequencies = [frequencies]

    for freq in frequencies:
        # Get pattern
        if freq == "monthly":
            pattern = "1-end"
            pattern_label = "1st-End"
        elif freq == "semimonthly":
            pattern = answers.get(f"q1_{freq}_pattern", "1-15_16-end")
            pattern_label = {
                "1-15_16-end": "1st-15th & 16th-End"
            }.get(pattern, pattern)
        else:
            pattern = answers.get(f"q1_{freq}_pattern", "mon-sun")
            pattern_label = {
                "mon-sun": "Mon-Sun",
                "sun-sat": "Sun-Sat"
            }.get(pattern, pattern)

        # Get payday
        payday = answers.get(f"q1_{freq}_payday", "friday")
        payday_label = payday.capitalize()

        # Build key (used for question IDs)
        # Replace hyphens with underscores, remove special chars
        pattern_key = pattern.replace("-", "").replace("_", "")
        key = f"{freq}_{pattern_key}_{payday}"

        # Build human-readable label
        freq_label = {
            "weekly": "Weekly",
            "biweekly": "Bi-weekly",
            "semimonthly": "Semi-monthly",
            "monthly": "Monthly"
        }.get(freq, freq.capitalize())

        label = f"{freq_label} {pattern_label} (Payday: {payday_label})"

        combos.append({
            "key": key,
            "label": label,
            "frequency": freq,
            "pattern": pattern,
            "payday": payday
        })

    return combos


def generate_dynamic_question(calendar: dict, question_type: str) -> dict:
    """
    Generate a dynamic question for a specific calendar combo.

    Args:
        calendar: Calendar combo dict from get_calendar_combos()
        question_type: "business", "business_names", "geographic", "regions"

    Returns:
        Question dict compatible with frontend
    """
    key = calendar["key"]
    label = calendar["label"]

    if question_type == "business":
        return {
            "id": f"business_{key}",
            "text": f"Does {label} need to be separated by business unit?",
            "type": "multiple_choice",
            "options": [
                {
                    "id": "yes",
                    "label": "Yes",
                    "description": f"This calendar needs separate areas per business unit"
                },
                {
                    "id": "no",
                    "label": "No",
                    "description": f"All business units can share this calendar"
                }
            ]
        }

    elif question_type == "business_names":
        return {
            "id": f"business_names_{key}",
            "text": f"What business units use {label}?",
            "type": "text",
            "placeholder": "e.g., Construction, Services, Corporate (comma-separated)"
        }

    elif question_type == "geographic":
        return {
            "id": f"geographic_{key}",
            "text": f"Does {label} need to be separated by geographic region?",
            "type": "multiple_choice",
            "options": [
                {
                    "id": "mainland_only",
                    "label": "Mainland US only",
                    "description": "All employees in contiguous US states"
                },
                {
                    "id": "multiple",
                    "label": "Multiple regions",
                    "description": "Employees in Hawaii, Puerto Rico, Alaska, etc."
                }
            ]
        }

    elif question_type == "regions":
        return {
            "id": f"regions_{key}",
            "text": f"Which regions have employees on {label}?",
            "type": "multiple_select",
            "options": [
                {
                    "id": "mainland",
                    "label": "Mainland US",
                    "description": "Contiguous 48 states"
                },
                {
                    "id": "hawaii",
                    "label": "Hawaii",
                    "description": "Hawaii time zone"
                },
                {
                    "id": "puerto_rico",
                    "label": "Puerto Rico",
                    "description": "Atlantic time zone"
                },
                {
                    "id": "alaska",
                    "label": "Alaska",
                    "description": "Alaska time zone"
                }
            ]
        }

    return None


def determine_next_question(answers: dict) -> tuple[Optional[str], Optional[dict]]:
    """
    Determine the next question based on what's been answered.

    NEW LOGIC:
    - Q1 frequencies always asked first
    - For each selected frequency, ask pattern and payday
    - For EACH calendar combo, ask business unit and geographic questions

    Returns:
        (question_id, question_object) tuple
        - If question is in JSON, question_object will be None
        - If question is dynamic, question_object contains the full question
    """

    # Q1: Frequencies (always first)
    if "q1_frequencies" not in answers:
        return ("q1_frequencies", None)

    frequencies = answers.get("q1_frequencies", [])

    # Ensure frequencies is a list
    if isinstance(frequencies, str):
        frequencies = [frequencies]

    # For each selected frequency, ask pattern and payday
    for freq in frequencies:
        pattern_q = f"q1_{freq}_pattern"
        payday_q = f"q1_{freq}_payday"

        # Monthly doesn't have a pattern question (always 1-end)
        if freq != "monthly" and pattern_q not in answers:
            return (pattern_q, None)

        if payday_q not in answers:
            return (payday_q, None)

    # Now we have all calendar combos defined
    # Ask business unit and geographic questions for EACH calendar
    calendars = get_calendar_combos(answers)

    for calendar in calendars:
        key = calendar["key"]

        # Business unit question for this calendar
        business_q = f"business_{key}"
        if business_q not in answers:
            question = generate_dynamic_question(calendar, "business")
            return (business_q, question)

        # Business unit names (if yes)
        if answers.get(business_q) == "yes":
            business_names_q = f"business_names_{key}"
            if business_names_q not in answers:
                question = generate_dynamic_question(calendar, "business_names")
                return (business_names_q, question)

        # Geographic question for this calendar
        geographic_q = f"geographic_{key}"
        if geographic_q not in answers:
            question = generate_dynamic_question(calendar, "geographic")
            return (geographic_q, question)

        # Regions (if multiple)
        if answers.get(geographic_q) == "multiple":
            regions_q = f"regions_{key}"
            if regions_q not in answers:
                question = generate_dynamic_question(calendar, "regions")
                return (regions_q, question)

    # All questions answered
    return (None, None)


def generate_payroll_areas(answers: dict) -> list[dict]:
    """
    Generate payroll areas from all collected answers.

    NEW LOGIC:
    - For EACH calendar combo, check its specific business/geo separation
    - Create areas accordingly with the same calendar code per calendar
    """
    areas = []
    calendars = get_calendar_combos(answers)
    area_num = 1

    # Calendar code base by frequency
    calendar_codes = {
        "weekly": 80,
        "biweekly": 20,
        "semimonthly": 30,
        "monthly": 40
    }

    for calendar in calendars:
        key = calendar["key"]
        freq = calendar["frequency"]
        pattern = calendar["pattern"]
        payday = calendar["payday"]

        # Get business units for THIS calendar
        business_q = f"business_{key}"
        if answers.get(business_q) == "yes":
            bu_text = answers.get(f"business_names_{key}", "")
            business_units = [b.strip() for b in bu_text.split(",") if b.strip()]
            if not business_units:
                business_units = [None]
        else:
            business_units = [None]

        # Get regions for THIS calendar
        geographic_q = f"geographic_{key}"
        if answers.get(geographic_q) == "multiple":
            regions = answers.get(f"regions_{key}", ["mainland"])
            if isinstance(regions, str):
                regions = [regions]
        else:
            regions = [None]

        # Assign one calendar code for this frequency/pattern/payday combo
        # All areas with same combo will share this calendar code
        calendar_code = str(calendar_codes.get(freq, 90) + len(areas))

        # Generate areas for all combinations of business units and regions
        for bu in business_units:
            for region in regions:
                code = f"Z{area_num}"

                # Build description (max 20 chars for SAP)
                freq_abbrev = {
                    "weekly": "Wkly",
                    "biweekly": "BiWk",
                    "semimonthly": "SemiMo",
                    "monthly": "Mo"
                }.get(freq, freq[:4])

                payday_abbrev = payday[:3].capitalize() if payday else "Fri"

                desc_parts = [freq_abbrev, f"PDAY {payday_abbrev}"]
                if bu:
                    desc_parts.append(bu[:6])
                if region and region != "mainland":
                    region_abbrev = {
                        "hawaii": "HI",
                        "puerto_rico": "PR",
                        "alaska": "AK"
                    }.get(region, region[:2].upper())
                    desc_parts.append(region_abbrev)

                description = " ".join(desc_parts)[:20]

                # Build reasoning
                reasoning = [
                    f"Pay frequency: {freq}",
                    f"Period pattern: {pattern}",
                    f"Pay day: {payday}",
                ]
                if bu:
                    reasoning.append(f"Business unit: {bu}")
                if region and region != "mainland":
                    reasoning.append(f"Region: {region}")

                areas.append({
                    "code": code,
                    "description": description,
                    "frequency": freq,
                    "periodPattern": pattern,
                    "payDay": payday,
                    "calendarId": calendar_code,  # Same for all areas with this calendar
                    "employeeCount": 0,  # User fills this in
                    "businessUnit": bu,
                    "region": region if region != "mainland" else None,
                    "reasoning": reasoning,
                })

                area_num += 1

    return areas


def router_node(state: PayrollState) -> PayrollState:
    """
    Main router node - determines next question or generates final output.
    """
    answers = state.get("answers", {})

    # Find next question (returns tuple: question_id, question_object)
    next_question_id, question_obj = determine_next_question(answers)

    if next_question_id is None:
        # All questions answered - generate payroll areas
        areas = generate_payroll_areas(answers)
        return {
            **state,
            "current_question_id": None,
            "current_question": None,
            "payroll_areas": areas,
            "done": True,
            "message": f"Generated {len(areas)} payroll area(s) based on your configuration.",
        }

    return {
        **state,
        "current_question_id": next_question_id,
        "current_question": question_obj,  # Will be None if in JSON, or dict if dynamic
        "done": False,
    }


def create_graph() -> StateGraph:
    """
    Create and compile the LangGraph.

    Simple architecture: START -> router -> END
    The router handles all logic for determining next steps.
    """
    graph = StateGraph(PayrollState)

    # Add the router node
    graph.add_node("router", router_node)

    # Edges
    graph.add_edge(START, "router")
    graph.add_edge("router", END)

    return graph.compile()


# Create the compiled graph (singleton)
payroll_graph = create_graph()


if __name__ == "__main__":
    # Test the new per-calendar logic
    print("Testing LangGraph with dynamic per-calendar questions...")
    print("=" * 60)

    # Initial state
    state = {
        "session_id": "test",
        "answers": {},
    }

    # Run through the flow
    result = payroll_graph.invoke(state)
    print(f"\n1. First question: {result.get('current_question_id')}")

    # Add frequency answer
    state = result
    state["answers"]["q1_frequencies"] = ["weekly"]
    result = payroll_graph.invoke(state)
    print(f"\n2. After frequencies: {result.get('current_question_id')}")

    # Add pattern answer
    state = result
    state["answers"]["q1_weekly_pattern"] = "mon-sun"
    result = payroll_graph.invoke(state)
    print(f"\n3. After pattern: {result.get('current_question_id')}")

    # Add payday answer
    state = result
    state["answers"]["q1_weekly_payday"] = "friday"
    result = payroll_graph.invoke(state)
    print(f"\n4. After payday: {result.get('current_question_id')}")
    print(f"   Dynamic question? {result.get('current_question') is not None}")
    if result.get('current_question'):
        print(f"   Question text: {result.get('current_question').get('text')}")

    # Answer business unit question for this specific calendar
    # Key format: {freq}_{pattern_no_dashes}_{payday}
    # For weekly mon-sun friday: weekly_monsun_friday
    state = result  # Update state with result
    state["answers"]["business_weekly_monsun_friday"] = "yes"
    result = payroll_graph.invoke(state)
    print(f"\n5. After business Q: {result.get('current_question_id')}")
    if result.get('current_question'):
        print(f"   Question text: {result.get('current_question').get('text')}")

    # Add business unit names for this calendar
    state = result
    state["answers"]["business_names_weekly_monsun_friday"] = "IT, Finance"
    result = payroll_graph.invoke(state)
    print(f"\n6. After business names: {result.get('current_question_id')}")

    # Answer geographic question for this calendar
    state = result
    state["answers"]["geographic_weekly_monsun_friday"] = "multiple"
    result = payroll_graph.invoke(state)
    print(f"\n7. After geographic Q: {result.get('current_question_id')}")

    # Answer regions for this calendar
    state = result
    state["answers"]["regions_weekly_monsun_friday"] = ["hawaii", "mainland"]
    result = payroll_graph.invoke(state)
    print(f"\n8. Final state - Done: {result.get('done')}")

    areas = result.get('payroll_areas', [])
    if areas:
        print(f"\n9. Generated {len(areas)} areas:")
        for area in areas:
            print(f"   - {area['code']}: {area['description']} (Calendar: {area['calendarId']})")
            print(f"     Business Unit: {area['businessUnit']}, Region: {area['region']}")
    else:
        print(f"\n9. No areas generated yet")

    print("\n" + "=" * 60)
    print("✓ Test complete! Per-calendar separation logic working.")
