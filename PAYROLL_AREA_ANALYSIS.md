# Payroll Area Module: Deep Technical Analysis

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current Implementation Walkthrough](#current-implementation-walkthrough)
3. [The Question Tree](#the-question-tree)
4. [Hardcoded Elements Inventory](#hardcoded-elements-inventory)
5. [The Combinatoric Problem](#the-combinatoric-problem)
6. [JSON Migration Feasibility](#json-migration-feasibility)
7. [Three Migration Approaches](#three-migration-approaches)
8. [What's Admin-Editable Today](#whats-admin-editable-today)
9. [Recommended Path Forward](#recommended-path-forward)

---

## Executive Summary

The payroll area module has a **two-layer question system**:

| Layer | Source | Questions | Editable? |
|-------|--------|-----------|-----------|
| **Static** | `questions_current.json` | 8 questions (frequencies, patterns, paydays) | Yes, via admin UI |
| **Dynamic** | Python code | N questions (business, geographic per calendar) | No, requires code |

**The Problem:** The JSON file is only *partially* used. The routing logic in Python doesn't evaluate `showIf` from JSON—it has its own hardcoded rules. And the per-calendar questions are generated entirely in Python.

**Key Insight:** The module is already "half JSON." The migration isn't starting from scratch—it's completing what was started.

---

## Current Implementation Walkthrough

### File: `payroll_area_graph.py`

#### 1. State Structure (lines 17-25)

```python
class PayrollState(TypedDict, total=False):
    session_id: str
    answers: dict              # {question_id: answer}
    current_question_id: Optional[str]
    current_question: Optional[dict]  # Dynamic question object
    payroll_areas: list
    done: bool
    message: Optional[str]
```

**Key:** `answers` is the only state that grows. The routing logic reads `answers` to decide what's next.

---

#### 2. `determine_next_question()` - The Router (lines 218-344)

This is the brain. Let me annotate it section by section:

```python
def determine_next_question(answers: dict) -> tuple[Optional[str], Optional[dict]]:
    """
    Returns (question_id, question_object)
    - question_object is None if question is in JSON
    - question_object is dict if dynamically generated
    """
```

**Section A: Frequencies (lines 233-241)**
```python
    # ALWAYS first - hardcoded priority
    if "q1_frequencies" not in answers:
        return ("q1_frequencies", None)  # None = fetch from JSON

    frequencies = answers.get("q1_frequencies", [])
    if isinstance(frequencies, str):
        frequencies = [frequencies]  # Normalize to list
```

**Section B: Pattern & Payday per Frequency (lines 244-308)**
```python
    for freq in frequencies:  # Iterate selected frequencies
        pattern_q = f"q1_{freq}_pattern"

        if freq != "monthly":  # Monthly skips pattern (hardcoded exception)
            if pattern_q not in answers:
                return (pattern_q, None)  # Fetch from JSON

            patterns = answers.get(pattern_q, [])

            # For EACH pattern, ask payday (this creates dynamic questions)
            for pattern in patterns:
                pattern_key = pattern.replace("-", "").replace("_", "")
                payday_q = f"q1_{freq}_{pattern_key}_payday"

                if payday_q not in answers:
                    # DYNAMIC QUESTION - generated here, not from JSON
                    question = {
                        "id": payday_q,
                        "text": f"For {freq_label} payroll with {pattern_label}...",
                        "type": "multiple_select",
                        "options": payday_options  # Also hardcoded below
                    }
                    return (payday_q, question)
        else:
            # Monthly: direct payday question
            payday_q = f"q1_{freq}_payday"
            if payday_q not in answers:
                return (payday_q, None)  # From JSON
```

**The Payday Options Are Hardcoded (lines 280-295):**
```python
    if freq == "weekly":
        payday_options = [
            {"id": "friday", "label": "Friday", ...},
            {"id": "thursday", "label": "Thursday", ...},
            {"id": "wednesday", "label": "Wednesday", ...}
        ]
    elif freq == "biweekly":
        payday_options = [
            {"id": "friday", ...},
            {"id": "thursday", ...}
        ]
    else:  # semimonthly
        payday_options = [
            {"id": "15-last", ...},
            {"id": "15-30", ...}
        ]
```

**Section C: Per-Calendar Questions (lines 310-341)**
```python
    # Generate all calendar combos from answers so far
    calendars = get_calendar_combos(answers)

    for calendar in calendars:
        key = calendar["key"]  # e.g., "weekly_monsun_friday"

        # Business unit question
        business_q = f"business_{key}"
        if business_q not in answers:
            question = generate_dynamic_question(calendar, "business")
            return (business_q, question)

        # Business names (conditional on "yes")
        if answers.get(business_q) == "yes":
            business_names_q = f"business_names_{key}"
            if business_names_q not in answers:
                question = generate_dynamic_question(calendar, "business_names")
                return (business_names_q, question)

        # Geographic question
        geographic_q = f"geographic_{key}"
        if geographic_q not in answers:
            question = generate_dynamic_question(calendar, "geographic")
            return (geographic_q, question)

        # Regions (conditional on "multiple")
        if answers.get(geographic_q) == "multiple":
            regions_q = f"regions_{key}"
            if regions_q not in answers:
                question = generate_dynamic_question(calendar, "regions")
                return (regions_q, question)

    return (None, None)  # All done
```

---

#### 3. `get_calendar_combos()` - Calendar Key Generator (lines 32-123)

This function computes all unique calendars based on answers so far:

```python
def get_calendar_combos(answers: dict) -> list[dict]:
    """
    Returns: [
        {"key": "weekly_monsun_friday", "label": "Weekly Mon-Sun Friday",
         "frequency": "weekly", "pattern": "mon-sun", "payday": "friday"},
        ...
    ]
    """
    combos = []
    frequencies = answers.get("q1_frequencies", [])

    for freq in frequencies:
        # Get patterns for this frequency
        if freq == "monthly":
            patterns = ["1-end"]  # Hardcoded default
        else:
            patterns = answers.get(f"q1_{freq}_pattern", [])

        for pattern in patterns:
            pattern_key = pattern.replace("-", "").replace("_", "")

            # Get paydays for this specific pattern
            if freq == "monthly":
                paydays = answers.get(f"q1_{freq}_payday", [])
            else:
                payday_q = f"q1_{freq}_{pattern_key}_payday"
                paydays = answers.get(payday_q, [])

            for payday in paydays:
                key = f"{freq}_{pattern_key}_{payday}"
                combos.append({
                    "key": key,
                    "label": f"{freq_label} {pattern_label} {payday_label}",
                    "frequency": freq,
                    "pattern": pattern,
                    "payday": payday
                })

    return combos
```

**Key Insight:** This is the *expansion point*. The number of calendars is:
```
Σ (patterns_per_freq × paydays_per_pattern) for each selected frequency
```

---

#### 4. `generate_dynamic_question()` - Template System (lines 126-215)

Four question templates, hardcoded in Python:

```python
def generate_dynamic_question(calendar: dict, question_type: str) -> dict:
    key = calendar["key"]
    label = calendar["label"]

    if question_type == "business":
        return {
            "id": f"business_{key}",
            "text": f"Does {label} need to be separated by business unit?",
            "type": "choice",
            "options": [
                {"id": "yes", "label": "Yes", "description": "..."},
                {"id": "no", "label": "No", "description": "..."}
            ]
        }
    elif question_type == "business_names":
        return {
            "id": f"business_names_{key}",
            "text": f"What business units use {label}?",
            "type": "text",
            "placeholder": "e.g., Construction, Services, Corporate"
        }
    elif question_type == "geographic":
        return {
            "id": f"geographic_{key}",
            "text": f"Does {label} need to be separated by geographic region?",
            "type": "choice",
            "options": [
                {"id": "mainland_only", "label": "Mainland US only", ...},
                {"id": "multiple", "label": "Multiple regions", ...}
            ]
        }
    elif question_type == "regions":
        return {
            "id": f"regions_{key}",
            "text": f"Which regions have employees on {label}?",
            "type": "multiple_select",
            "options": [
                {"id": "mainland", "label": "Mainland US", ...},
                {"id": "hawaii", "label": "Hawaii", ...},
                {"id": "puerto_rico", "label": "Puerto Rico", ...},
                {"id": "alaska", "label": "Alaska", ...}
            ]
        }
```

---

## The Question Tree

### Visual Map

```
START
  │
  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ q1_frequencies [FROM JSON]                                               │
│ "What pay frequencies does your company use?"                            │
│ Type: multiple_select                                                    │
│ Options: weekly, biweekly, semimonthly, monthly                         │
└─────────────────────────────────────────────────────────────────────────┘
  │
  │ FOR EACH selected frequency:
  │
  ├─── freq == "weekly" ──────────────────────────────────────────────────┐
  │     │                                                                  │
  │     ▼                                                                  │
  │   ┌─────────────────────────────────────────────────────────────────┐ │
  │   │ q1_weekly_pattern [FROM JSON]                                   │ │
  │   │ Options: mon-sun, sun-sat                                       │ │
  │   └─────────────────────────────────────────────────────────────────┘ │
  │     │                                                                  │
  │     │ FOR EACH selected pattern:                                       │
  │     │                                                                  │
  │     ├─── pattern == "mon-sun" ────────────────────────────────────┐   │
  │     │     │                                                        │   │
  │     │     ▼                                                        │   │
  │     │   ┌──────────────────────────────────────────────────────┐  │   │
  │     │   │ q1_weekly_monsun_payday [DYNAMIC - generated]        │  │   │
  │     │   │ Options: friday, thursday, wednesday (HARDCODED)     │  │   │
  │     │   └──────────────────────────────────────────────────────┘  │   │
  │     │     │                                                        │   │
  │     │     │ FOR EACH selected payday → creates CALENDAR:           │   │
  │     │     │   weekly_monsun_friday, weekly_monsun_thursday, etc.   │   │
  │     │                                                              │   │
  │     └─── pattern == "sun-sat" ────────────────────────────────────┘   │
  │           │                                                            │
  │           ▼                                                            │
  │         ┌──────────────────────────────────────────────────────┐      │
  │         │ q1_weekly_sunsat_payday [DYNAMIC]                    │      │
  │         │ Options: friday, thursday, wednesday (HARDCODED)     │      │
  │         └──────────────────────────────────────────────────────┘      │
  │                                                                        │
  ├─── freq == "biweekly" ────────────────────────────────────────────────┤
  │     (same structure as weekly)                                         │
  │                                                                        │
  ├─── freq == "semimonthly" ─────────────────────────────────────────────┤
  │     (same structure as weekly)                                         │
  │                                                                        │
  └─── freq == "monthly" ─────────────────────────────────────────────────┤
        │                                                                  │
        ▼                                                                  │
      ┌──────────────────────────────────────────────────────────────────┐│
      │ q1_monthly_payday [FROM JSON] - NO pattern question              ││
      │ Options: last, 15, 1                                             ││
      └──────────────────────────────────────────────────────────────────┘│
                                                                           │
═══════════════════════════════════════════════════════════════════════════╛

THEN, FOR EACH CALENDAR GENERATED:
═══════════════════════════════════════════════════════════════════════════

Calendar: weekly_monsun_friday
  │
  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ business_weekly_monsun_friday [DYNAMIC]                                  │
│ "Does Weekly Mon-Sun Friday need to be separated by business unit?"     │
│ Options: yes, no                                                         │
└─────────────────────────────────────────────────────────────────────────┘
  │
  ├─── answer == "yes" ───────────────────────────────────────────────────┐
  │     │                                                                  │
  │     ▼                                                                  │
  │   ┌─────────────────────────────────────────────────────────────────┐ │
  │   │ business_names_weekly_monsun_friday [DYNAMIC]                   │ │
  │   │ "What business units use Weekly Mon-Sun Friday?"                │ │
  │   │ Type: text (comma-separated)                                    │ │
  │   └─────────────────────────────────────────────────────────────────┘ │
  │                                                                        │
  └─── answer == "no" ─────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ geographic_weekly_monsun_friday [DYNAMIC]                                │
│ "Does Weekly Mon-Sun Friday need geographic separation?"                │
│ Options: mainland_only, multiple                                        │
└─────────────────────────────────────────────────────────────────────────┘
  │
  ├─── answer == "multiple" ──────────────────────────────────────────────┐
  │     │                                                                  │
  │     ▼                                                                  │
  │   ┌─────────────────────────────────────────────────────────────────┐ │
  │   │ regions_weekly_monsun_friday [DYNAMIC]                          │ │
  │   │ "Which regions have employees on Weekly Mon-Sun Friday?"        │ │
  │   │ Options: mainland, hawaii, puerto_rico, alaska (HARDCODED)      │ │
  │   └─────────────────────────────────────────────────────────────────┘ │
  │                                                                        │
  └─── answer == "mainland_only" ──────────────────────────────────────────┘

THEN: Repeat for next calendar (weekly_monsun_thursday, etc.)

END: When all calendars have been asked about → generate_payroll_areas()
```

---

## Hardcoded Elements Inventory

### Category 1: Frequency Definitions

| Location | What | Lines |
|----------|------|-------|
| `questions_current.json` | Frequency options (weekly, biweekly, semimonthly, monthly) | 8-29 |
| `determine_next_question()` | Special case for monthly (no pattern) | 247-248, 304-308 |
| `get_calendar_combos()` | Default pattern for monthly ("1-end") | 56-57 |
| `generate_payroll_areas()` | Calendar code bases by frequency | 359-365 |

**To add "quarterly":** Requires changes in 4+ places.

### Category 2: Pattern Definitions

| Location | What | Lines |
|----------|------|-------|
| `questions_current.json` | Pattern options per frequency | 31-97 |
| `determine_next_question()` | Pattern labels dict | 265-269 |
| `get_calendar_combos()` | Pattern labels dict | 68-73 |

### Category 3: Payday Options

| Location | What | Lines |
|----------|------|-------|
| `questions_current.json` | Static payday questions (NOT used for per-pattern) | 52-77, 99-118, 136-155, 157-182 |
| `determine_next_question()` | **Hardcoded payday options per frequency** | 280-295 |

**Critical:** The JSON has payday questions, but they're NOT used. The code generates its own.

### Category 4: Per-Calendar Question Templates

| Location | What | Lines |
|----------|------|-------|
| `generate_dynamic_question()` | Business unit question template | 140-157 |
| `generate_dynamic_question()` | Business names question template | 159-165 |
| `generate_dynamic_question()` | Geographic question template | 167-184 |
| `generate_dynamic_question()` | Regions question template | 186-213 |

### Category 5: Routing Logic

| Location | What | Lines |
|----------|------|-------|
| `determine_next_question()` | Priority: frequencies → patterns → paydays → per-calendar | 233-341 |
| `determine_next_question()` | Condition: business_names only if business == "yes" | 323-328 |
| `determine_next_question()` | Condition: regions only if geographic == "multiple" | 337-341 |

### Category 6: Output Generation

| Location | What | Lines |
|----------|------|-------|
| `generate_payroll_areas()` | Calendar code bases | 359-365 |
| `generate_payroll_areas()` | Frequency abbreviations | 402-407 |
| `generate_payroll_areas()` | Region abbreviations | 415-419 |
| `generate_payroll_areas()` | Description format (20 char max) | 411-422 |
| `generate_payroll_areas()` | Output field names | 435-446 |

---

## The Combinatoric Problem

### How Expansion Works

```
User selects: [weekly, biweekly]
                │
                ▼
         ┌──────────────────────────────────────────────────────┐
         │ weekly patterns: [mon-sun, sun-sat] (user selects 2) │
         │ biweekly patterns: [mon-sun] (user selects 1)        │
         └──────────────────────────────────────────────────────┘
                │
                ▼
         ┌──────────────────────────────────────────────────────┐
         │ weekly mon-sun paydays: [friday, thursday] (2)       │
         │ weekly sun-sat paydays: [friday] (1)                 │
         │ biweekly mon-sun paydays: [friday, thursday] (2)     │
         └──────────────────────────────────────────────────────┘
                │
                ▼
         ┌──────────────────────────────────────────────────────┐
         │ CALENDARS GENERATED:                                 │
         │   1. weekly_monsun_friday                            │
         │   2. weekly_monsun_thursday                          │
         │   3. weekly_sunsat_friday                            │
         │   4. biweekly_monsun_friday                          │
         │   5. biweekly_monsun_thursday                        │
         │                                                      │
         │ = 5 calendars                                        │
         └──────────────────────────────────────────────────────┘
                │
                ▼
         ┌──────────────────────────────────────────────────────┐
         │ PER-CALENDAR QUESTIONS:                              │
         │   Each calendar needs 2-4 questions:                 │
         │   - business (always)                                │
         │   - business_names (if business == "yes")            │
         │   - geographic (always)                              │
         │   - regions (if geographic == "multiple")            │
         │                                                      │
         │ = 5 × (2 to 4) = 10-20 additional questions          │
         └──────────────────────────────────────────────────────┘
```

### Tracking "Asked About Calendar X But Not Y"

The code doesn't maintain a separate "asked" set. It recalculates from scratch each time:

```python
def determine_next_question(answers: dict):
    # Recalculate all calendars from answers
    calendars = get_calendar_combos(answers)

    # For each calendar, check if all 4 questions are answered
    for calendar in calendars:
        key = calendar["key"]

        if f"business_{key}" not in answers:
            return ask_business(calendar)

        if answers.get(f"business_{key}") == "yes":
            if f"business_names_{key}" not in answers:
                return ask_business_names(calendar)

        if f"geographic_{key}" not in answers:
            return ask_geographic(calendar)

        if answers.get(f"geographic_{key}") == "multiple":
            if f"regions_{key}" not in answers:
                return ask_regions(calendar)

    # All calendars complete
    return (None, None)
```

**Key Insight:** The `answers` dict IS the tracker. A calendar's questions are "done" when all 4 keys exist.

### Worst Case Expansion

```
4 frequencies × 2 patterns × 3 paydays = 24 calendars
24 calendars × 4 questions = 96 per-calendar questions
+ 8 static questions
= 104 total questions (worst case)
```

---

## JSON Migration Feasibility

### What `payment_method_questions.json` Supports

```json
{
  "questions": [
    {
      "id": "q1_payment_method_p",
      "text": "Is your enterprise payment method P - Direct Deposit ACH?",
      "type": "multiple_choice",
      "options": [...]
    },
    {
      "id": "q1_p_house_banks",
      "text": "Please list the house bank names...",
      "type": "free_text",
      "showIf": {
        "questionId": "q1_payment_method_p",
        "answerId": "yes"
      }
    }
  ]
}
```

**Supports:**
- Static question list
- Simple `showIf` conditions (equals check)
- Basic types: choice, multiple_choice, free_text

**Does NOT Support:**
- Dynamic question generation (`forEach calendar`)
- Template variables (`{calendar_label}`)
- Complex conditions (`contains`, `and`, `or`)
- Computed question IDs

### Required New Constructs for Payroll Area

#### Construct 1: `forEach` - Iterate Over Dynamic Set

```json
{
  "dynamicQuestions": {
    "calendars": {
      "forEach": "calendar",
      "in": "computed:calendars",
      "questions": [
        {
          "id": "business_{calendar.key}",
          "text": "Does {calendar.label} need to be separated by business unit?",
          "type": "choice",
          "options": [...]
        }
      ]
    }
  }
}
```

#### Construct 2: `showIf` with `contains` for Multi-Select

```json
{
  "showIf": {
    "questionId": "q1_frequencies",
    "contains": "weekly"
  }
}
```

#### Construct 3: Template Variables

```json
{
  "text": "For {frequency.label} payroll with {pattern.label} period, what pay days?",
  "id": "q1_{frequency.id}_{pattern.key}_payday"
}
```

#### Construct 4: Computed Values

```json
{
  "computed": {
    "calendars": {
      "type": "cartesian_product",
      "sources": ["q1_frequencies", "patterns", "paydays"],
      "keyTemplate": "{frequency}_{patternKey}_{payday}"
    }
  }
}
```

### Proposed JSON Schema

```json
{
  "version": "2.0",
  "module": "payroll_area",

  "staticQuestions": [
    {
      "id": "q1_frequencies",
      "text": "What pay frequencies does your company use?",
      "type": "multiple_select",
      "options": [
        {"id": "weekly", "label": "Weekly", "description": "..."},
        {"id": "biweekly", "label": "Bi-weekly", "description": "..."},
        {"id": "semimonthly", "label": "Semi-monthly", "description": "..."},
        {"id": "monthly", "label": "Monthly", "description": "..."}
      ]
    },
    {
      "id": "q1_{freq}_pattern",
      "text": "For {freq.label} payroll, what pay periods?",
      "type": "multiple_select",
      "forEach": {"var": "freq", "in": "answers.q1_frequencies"},
      "skipIf": {"var": "freq", "equals": "monthly"},
      "optionsPerFrequency": {
        "weekly": [
          {"id": "mon-sun", "label": "Monday to Sunday"},
          {"id": "sun-sat", "label": "Sunday to Saturday"}
        ],
        "biweekly": [
          {"id": "mon-sun", "label": "Monday to Sunday"},
          {"id": "sun-sat", "label": "Sunday to Saturday"}
        ],
        "semimonthly": [
          {"id": "1-15_16-end", "label": "1st-15th and 16th-End"}
        ]
      }
    }
  ],

  "dynamicQuestionTemplates": {
    "payday": {
      "id": "q1_{freq}_{patternKey}_payday",
      "text": "For {freq.label} payroll with {pattern.label} period, what pay days?",
      "type": "multiple_select",
      "forEach": {"var": "pattern", "in": "answers.q1_{freq}_pattern"},
      "optionsPerFrequency": {
        "weekly": [
          {"id": "friday", "label": "Friday"},
          {"id": "thursday", "label": "Thursday"},
          {"id": "wednesday", "label": "Wednesday"}
        ],
        "biweekly": [
          {"id": "friday", "label": "Friday"},
          {"id": "thursday", "label": "Thursday"}
        ],
        "semimonthly": [
          {"id": "15-last", "label": "15th and Last day"},
          {"id": "15-30", "label": "15th and 30th"}
        ]
      }
    },

    "perCalendar": {
      "iterateOver": "computed.calendars",
      "questions": [
        {
          "id": "business_{calendar.key}",
          "text": "Does {calendar.label} need to be separated by business unit?",
          "type": "choice",
          "options": [
            {"id": "yes", "label": "Yes"},
            {"id": "no", "label": "No"}
          ]
        },
        {
          "id": "business_names_{calendar.key}",
          "text": "What business units use {calendar.label}?",
          "type": "text",
          "showIf": {"questionId": "business_{calendar.key}", "equals": "yes"}
        },
        {
          "id": "geographic_{calendar.key}",
          "text": "Does {calendar.label} need geographic separation?",
          "type": "choice",
          "options": [
            {"id": "mainland_only", "label": "Mainland US only"},
            {"id": "multiple", "label": "Multiple regions"}
          ]
        },
        {
          "id": "regions_{calendar.key}",
          "text": "Which regions have employees on {calendar.label}?",
          "type": "multiple_select",
          "showIf": {"questionId": "geographic_{calendar.key}", "equals": "multiple"},
          "options": [
            {"id": "mainland", "label": "Mainland US"},
            {"id": "hawaii", "label": "Hawaii"},
            {"id": "puerto_rico", "label": "Puerto Rico"},
            {"id": "alaska", "label": "Alaska"}
          ]
        }
      ]
    }
  },

  "computed": {
    "calendars": {
      "description": "Cartesian product of frequency × pattern × payday",
      "generator": "calendar_combos"
    }
  },

  "outputs": {
    "payrollArea": {
      "codePattern": "Z{index}",
      "descriptionTemplate": "{freq_abbrev} PDAY {payday_abbrev} {bu?} {region?}",
      "abbreviations": {
        "frequency": {"weekly": "Wkly", "biweekly": "BiWk", ...},
        "region": {"hawaii": "HI", "puerto_rico": "PR", ...}
      }
    }
  }
}
```

### Migration Effort Estimate

| Task | Effort | Risk |
|------|--------|------|
| Define JSON schema spec | 2-3 days | Low |
| Build JSON parser/executor | 3-4 days | Medium |
| Build `forEach` evaluator | 2 days | Medium |
| Build template variable resolver | 1-2 days | Low |
| Build condition evaluator | 1 day | Low |
| Migrate existing questions to JSON | 1 day | Low |
| Test all combinations | 2-3 days | High |
| **Total** | **12-16 days** | Medium |

---

## Three Migration Approaches

### Option A: Keep Python, Extract Config

**Approach:** Keep routing in Python, but move all hardcoded data to config files.

```python
# config/payroll_area_config.json
{
  "frequencies": {
    "weekly": {"label": "Weekly", "hasPattern": true, "calendarCodeBase": 80},
    "biweekly": {"label": "Bi-weekly", "hasPattern": true, "calendarCodeBase": 20},
    "semimonthly": {"label": "Semi-monthly", "hasPattern": true, "calendarCodeBase": 30},
    "monthly": {"label": "Monthly", "hasPattern": false, "calendarCodeBase": 40}
  },
  "patterns": {
    "weekly": [{"id": "mon-sun", "label": "Mon-Sun"}, {"id": "sun-sat", "label": "Sun-Sat"}],
    "biweekly": [...],
    ...
  },
  "paydays": {
    "weekly": [{"id": "friday", "label": "Friday"}, ...],
    ...
  },
  "regions": [
    {"id": "mainland", "label": "Mainland US"},
    {"id": "hawaii", "label": "Hawaii"},
    ...
  ]
}
```

```python
# payroll_area_graph.py (simplified)
CONFIG = load_config("payroll_area_config.json")

def determine_next_question(answers):
    if "q1_frequencies" not in answers:
        return ("q1_frequencies", None)

    for freq_id in answers["q1_frequencies"]:
        freq = CONFIG["frequencies"][freq_id]

        if freq["hasPattern"]:
            pattern_q = f"q1_{freq_id}_pattern"
            if pattern_q not in answers:
                return (pattern_q, None)
            # ... rest of logic using CONFIG
```

**Pros:**
- Least risky
- Quick to implement (3-4 days)
- Admin can edit options without code changes

**Cons:**
- Routing logic still in Python
- Adding a new frequency still requires reviewing Python
- Not truly admin-editable

**Admin Can Edit:**
- Frequency labels and descriptions
- Pattern options
- Payday options
- Region options
- Output abbreviations

---

### Option B: Full JSON-Driven with DSL

**Approach:** Everything in JSON, build an interpreter.

```python
# generic_module_executor.py
class ModuleExecutor:
    def __init__(self, module_config: dict):
        self.config = module_config
        self.static_questions = config["staticQuestions"]
        self.dynamic_templates = config["dynamicQuestionTemplates"]

    def next_question(self, answers: dict):
        # Check static questions
        for q in self.static_questions:
            if q["id"] in answers:
                continue
            if not self.evaluate_condition(q.get("showIf"), answers):
                continue
            if self.should_skip(q.get("skipIf"), answers):
                continue
            return self.expand_template(q, answers)

        # Check dynamic templates
        for template in self.dynamic_templates:
            for instance in self.expand_foreach(template, answers):
                if instance["id"] not in answers:
                    return instance

        return None
```

**Pros:**
- Truly admin-editable (no code for new modules)
- Consistent with payment_method approach
- Can be used for all 200-400 modules

**Cons:**
- Significant development effort (12-16 days)
- Complex DSL to design and document
- Risk of edge cases in interpreter

**Admin Can Edit:**
- Everything (questions, conditions, templates, options)
- Add new frequencies without code
- Add new per-calendar question types

---

### Option C: Hybrid — Static JSON + Python Generation

**Approach:** Use JSON for simple questions, keep Python for calendar expansion.

```json
// questions_payroll_area.json
{
  "staticQuestions": [
    {"id": "q1_frequencies", ...},
    {"id": "q1_weekly_pattern", "showIf": {...}, ...},
    // ... all the pattern/payday questions
  ],

  "perCalendarQuestions": [
    {
      "id_template": "business_{key}",
      "text_template": "Does {label} need business unit separation?",
      "type": "choice",
      "options": [
        {"id": "yes", "label": "Yes"},
        {"id": "no", "label": "No"}
      ]
    },
    {
      "id_template": "business_names_{key}",
      "text_template": "What business units use {label}?",
      "type": "text",
      "showIf_template": {"questionId": "business_{key}", "equals": "yes"}
    },
    // ...
  ]
}
```

```python
# payroll_area_graph.py (hybrid)
def determine_next_question(answers):
    config = load_config()

    # Phase 1: Static questions (same as payment_method)
    for q in config["staticQuestions"]:
        if q["id"] in answers:
            continue
        if not evaluate_showif(q.get("showIf"), answers):
            continue
        return (q["id"], q)

    # Phase 2: Per-calendar questions (Python handles expansion)
    calendars = compute_calendars(answers, config)  # Still Python

    for calendar in calendars:
        for template in config["perCalendarQuestions"]:
            question = expand_template(template, calendar)
            if question["id"] not in answers:
                if evaluate_showif(question.get("showIf"), answers):
                    return (question["id"], question)

    return (None, None)

def compute_calendars(answers, config):
    # This stays in Python - it's the complex part
    # But it reads frequency/pattern/payday definitions from config
    ...
```

**Pros:**
- Moderate effort (5-7 days)
- Admin can edit question text, options, conditions
- Calendar generation logic stays robust (Python)
- Easy to understand and debug

**Cons:**
- Not fully config-driven
- Adding new calendar axes (beyond business/geographic) needs Python

**Admin Can Edit:**
- All question text and descriptions
- All option labels
- Per-calendar question templates
- Conditions (showIf)

---

## What's Admin-Editable Today

### Safely Editable (via `questions_current.json`)

| Element | Risk | Notes |
|---------|------|-------|
| `q1_frequencies` options | Low | Can add/remove frequencies, but code may not handle new ones |
| `q1_*_pattern` options | Low | Can modify pattern labels and descriptions |
| `q1_*_payday` options | **None** | These are IGNORED - code generates its own |
| Question text | Low | Safe to modify |
| Question descriptions | Low | Safe to modify |

### NOT Editable Without Code Changes

| Element | Why |
|---------|-----|
| Adding new frequency (e.g., "quarterly") | Python has hardcoded handling |
| Per-pattern payday options | Hardcoded in `determine_next_question()` |
| Per-calendar question types (business, geographic) | Hardcoded templates |
| Regions list | Hardcoded in `generate_dynamic_question()` |
| Routing priority | Hardcoded in `determine_next_question()` |
| Output generation | Hardcoded in `generate_payroll_areas()` |

### The Irony

The `questions_current.json` file has 8 questions, but:
- 4 of them (`q1_*_payday`) are **completely ignored**
- The Python code regenerates payday questions dynamically
- The JSON `showIf` conditions are **also ignored** (Python has its own logic)

---

## Recommended Path Forward

### For Quick Win (1-2 weeks): Option A + Fixes

**Week 1:**
1. Extract all hardcoded data to `payroll_area_config.json`
2. Make Python read frequencies, patterns, paydays from config
3. Make `generate_dynamic_question()` read templates from config
4. Test thoroughly

**Week 2:**
1. Update admin UI to edit `payroll_area_config.json`
2. Add validation (can't break required fields)
3. Add "preview flow" feature

**Result:**
- Admin can edit labels, options, descriptions
- Admin can add payday options per frequency
- Admin can modify region list
- Admin CANNOT add new frequencies (still requires logic review)

### For Full Solution (4-6 weeks): Option C (Hybrid)

**Weeks 1-2:**
- Define JSON schema for hybrid approach
- Build template expander and condition evaluator
- Migrate existing questions to new format

**Weeks 3-4:**
- Build calendar computation that reads from config
- Build output generator that reads from config
- Test all combinations

**Weeks 5-6:**
- Build admin UI for editing
- Add flow preview/testing
- Document the system

**Result:**
- Admin can edit everything except calendar computation logic
- Adding new frequencies works if they follow existing patterns
- Adding completely new axes (beyond business/geographic) needs code

### My Recommendation

**Start with Option A** (quick win, 1-2 weeks), then **evolve to Option C** (next sprint).

Why:
1. Option A gives you something to show clients NOW
2. Option A's config file becomes the foundation for Option C
3. You learn what admins actually want to edit
4. You don't over-engineer before understanding the 200-400 module picture

---

## Appendix: Quick Reference

### Question ID Patterns

| Pattern | Example | Source |
|---------|---------|--------|
| `q1_frequencies` | `q1_frequencies` | JSON |
| `q1_{freq}_pattern` | `q1_weekly_pattern` | JSON |
| `q1_{freq}_{patternKey}_payday` | `q1_weekly_monsun_payday` | Dynamic |
| `business_{calendarKey}` | `business_weekly_monsun_friday` | Dynamic |
| `business_names_{calendarKey}` | `business_names_weekly_monsun_friday` | Dynamic |
| `geographic_{calendarKey}` | `geographic_weekly_monsun_friday` | Dynamic |
| `regions_{calendarKey}` | `regions_weekly_monsun_friday` | Dynamic |

### Calendar Key Format

```
{frequency}_{patternKey}_{payday}

patternKey = pattern.replace("-", "").replace("_", "")

Examples:
- weekly_monsun_friday
- biweekly_sunsat_thursday
- semimonthly_11516end_15last
- monthly_1end_last
```

### Files to Modify for Option A

```
backend/app/
├── config/
│   ├── payroll_area_config.json   [NEW] - extracted data
│   └── questions_current.json     [KEEP] - static questions
└── agents/
    └── payroll/
        └── payroll_area_graph.py  [MODIFY] - read from config
```
