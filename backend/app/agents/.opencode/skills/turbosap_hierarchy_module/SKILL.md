---
name: turbosap_hierarchy_module
description: Use this skill whenever the user wants to inspect or edit TurboSAP hierarchy module definitions. It reads and modifies questions.json files that follow the canonical schema with version, questions array, and metadata. Supports reading existing questions, updating entries, and adding new questions. Use when working with module configurations like bank-details, payroll-area, or other hierarchy configs.
---

# TurboSAP Hierarchy Module Skill

## Overview

TurboSAP hierarchy/config modules (bank details, payroll area, etc.) describe their questions inside `app/data/modules/<module>/questions.json`. These JSON files follow a standardized schema with:

- **version**: Schema version (e.g., "1.0")
- **questions**: Array of question objects with id, text, type, order, and outputMapping
- **metadata**: Creation timestamp, author, and description

This skill loads those JSON files deterministically, exposes question summaries for conversational responses, and safely persists edits that match the schema.

## When to Use This Skill

Use this skill whenever a user asks to:

- Read or list the current questions for a module
- Update the question text of an existing question
- Update the options (for single_select/multi_select questions)
- Add a new question following the same structure already in the module file
- Inspect the full structure of a module's questions.json file

## Quick Start

```python
from turbosap_hierarchy_module import (
    list_module_questions, 
    get_question, 
    update_question, 
    add_question
)

# Inspect
summaries = list_module_questions("bank-details")
first_question = get_question("bank-details", "q_bank_name")

# Edit (only text and options can be changed)
update_question(
    "bank-details",
    "q_bank_name",
    {"text": "What is the full legal name of your banking institution?"},
)

# Add
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
add_question("bank-details", new_question)
```

## Schema Structure

### Root Structure
```json
{
  "version": "1.0",
  "questions": [...],
  "metadata": {
    "createdAt": "2026-01-25T00:00:00Z",
    "createdBy": "system",
    "description": "Module description"
  }
}
```

### Question Object Structure

Every question must include these required fields:

- **id**: Unique identifier (e.g., "q_bank_name")
- **text**: The question text shown to users
- **type**: Question type (text, single_select, multi_select, yes_no)
- **order**: Numeric ordering for display
- **outputMapping**: Maps question to output file/column

Optional fields:

- **helpText**: Additional guidance text
- **options**: Array of option objects (required for select types)
- **showIf**: Conditional display logic

### Question Types

| Type | Purpose | Requires options |
|------|---------|-----------------|
| `text` | Free-form text input | No |
| `single_select` | Choose one option | Yes |
| `multi_select` | Choose multiple options | Yes |
| `yes_no` | Binary yes/no choice | No |

### Option Structure

For single_select and multi_select questions, each option must include:

```json
{
  "value": "checking",
  "label": "Checking",
  "description": "Standard business checking account"
}
```

- **value**: Internal value (required)
- **label**: Display text (required)
- **description**: Additional context (optional)

### Output Mapping Structure

```json
{
  "file": "bank_details.csv",
  "column": "BankName",
  "transform": "direct",
  "valueMap": {}  // Optional: for value_lookup transforms
}
```

**Transform types:**
- `direct`: Use answer as-is
- `yes_no`: Convert yes/no to boolean
- `value_lookup`: Map answer value using valueMap
- `row_per_selected`: Create row for each selected option (multi_select)

### Conditional Display

Questions can be conditionally shown based on other answers:

```json
{
  "showIf": {
    "questionId": "q_direct_deposit",
    "equals": "yes"
  }
}
```

## Key Functions

| Function | Purpose |
|----------|---------|
| `list_module_questions(module)` | Returns lightweight `QuestionSummary` objects (id/text/type/order) for conversational listing |
| `get_question(module, question_id)` | Loads and returns the full JSON payload for a specific question |
| `update_question(module, question_id, updates)` | Updates only the `text` or `options` fields of an existing question |
| `add_question(module, question_payload)` | Validates and appends a new question to the questions array |

### list_module_questions(module)

Returns a list of question summaries for conversational display.

```python
summaries = list_module_questions("bank-details")
# Returns: [QuestionSummary(id="q_bank_name", text="What is...", type="text", order=1), ...]
```

Use this to show users what questions currently exist without overwhelming them with full details.

### get_question(module, question_id)

Retrieves the complete question object for inspection or reference.

```python
question = get_question("bank-details", "q_account_type")
# Returns full question dict with all fields
```

Use this when the user wants to see the full details of a specific question before editing.

### update_question(module, question_id, updates)

Applies partial updates to an existing question. **Only `text` and `options` fields can be modified.**

```python
update_question(
    "bank-details",
    "q_bank_name",
    {
        "text": "What is your company's primary banking institution?"
    }
)

# For select-type questions, update options
update_question(
    "bank-details",
    "q_account_type",
    {
        "options": [
            {
                "value": "checking",
                "label": "Checking Account",
                "description": "Standard business checking"
            },
            {
                "value": "savings",
                "label": "Savings Account",
                "description": "Business savings"
            }
        ]
    }
)
```

**Allowed fields:**
- `text`: The question text
- `options`: The options array (for single_select/multi_select questions)

**Constraints:**
- Cannot change: id, type, order, helpText, showIf, outputMapping
- Question ID cannot be changed
- Options must include both value and label
- Validates against schema before writing

### add_question(module, question_payload)

Adds a new question to the module. Must include all required fields.

```python
add_question("bank-details", {
    "id": "q_wire_enabled",
    "text": "Is wire transfer enabled?",
    "type": "yes_no",
    "order": 10,
    "helpText": "Indicates whether this account supports wire transfers",
    "outputMapping": {
        "file": "bank_details.csv",
        "column": "WireEnabled",
        "transform": "yes_no"
    }
})
```

**Requirements:**
- `id` must be unique (not already exist)
- Must include: id, text, type, order, outputMapping
- If type is single_select or multi_select, must include options array
- Each option must have value and label

## Guardrails & Validation

### Module Normalization
- Module slugs are normalized (lowercase, hyphen-separated) before file access
- Missing modules raise `ModuleConfigError`

### Schema Validation
- All writes go through `_validate_question_payload`
- Ensures required keys exist (id, text, type, order, outputMapping)
- Validates options are well-formed (must have value and label)
- Checks outputMapping has required fields (file, column, transform)

### Duplicate Prevention
- Duplicate question IDs raise `QuestionValidationError`
- Prompts user to choose a different identifier

### Intentional Limitations (v1)
These operations are intentionally unsupported:
- Deleting questions
- Reordering the entire questions array
- Editing arbitrary files outside questions.json
- Changing the version field
- Modifying metadata timestamps
- **Modifying helpText, type, order, showIf, or outputMapping fields of existing questions** (only text and options can be changed)

**If users need to modify other fields:** They must delete the old question and add a new one with the desired configuration. However, deletion is not supported in v1, so advise users to manually edit the JSON file or request deletion support in a future version.

## Workflow Guide

### Step 1: Clarify Module & Scope

Always confirm which module the user wants to work with:

- "bank-details" → Bank configuration questions
- "payroll-area" → Payroll area setup questions
- Other module names as they exist in app/data/modules/

Ask the user: "Which module would you like to work with?"

### Step 2: Show Current State

Before making any changes, show the user what currently exists:

```python
# List all questions
summaries = list_module_questions("bank-details")
print(f"Found {len(summaries)} questions in bank-details module:")
for s in summaries:
    print(f"  {s.order}. [{s.type}] {s.text}")

# Or show specific question details
question = get_question("bank-details", "q_bank_name")
print(json.dumps(question, indent=2))
```

This prevents accidental overwrites and helps the user make informed decisions.

### Step 3: Apply Edits

Use the appropriate function based on the user's intent:

**For modifications:**
```python
try:
    update_question("bank-details", "q_bank_name", updates_dict)
    print("✓ Successfully updated question")
except QuestionValidationError as e:
    print(f"✗ Validation error: {e}")
```

**For additions:**
```python
try:
    add_question("bank-details", new_question_dict)
    print("✓ Successfully added new question")
except QuestionValidationError as e:
    print(f"✗ Validation error: {e}")
```

### Step 4: Confirm Changes

After applying edits, show the updated question to confirm:

```python
updated = get_question("bank-details", question_id)
print("Updated question:")
print(json.dumps(updated, indent=2))
```

Echo back the changes so the user can verify the edit was applied correctly.

### Step 5: Error Handling

Catch and explain errors clearly:

```python
try:
    add_question("bank-details", new_question)
except ModuleConfigError:
    print("Module 'bank-details' not found. Available modules: ...")
except QuestionValidationError as e:
    print(f"Cannot add question: {e}")
    print("Required fields: id, text, type, order, outputMapping")
```

Make error messages actionable by explaining what went wrong and what the user needs to fix.

## Example Workflows

### Example 1: Update Question Text

```python
# User: "Make the bank name question more clear"

# Step 1: Show current
question = get_question("bank-details", "q_bank_name")
print(f"Current text: {question['text']}")

# Step 2: Apply update
update_question(
    "bank-details",
    "q_bank_name",
    {"text": "What is the full legal name of your primary banking institution?"}
)

# Step 3: Confirm
updated = get_question("bank-details", "q_bank_name")
print(f"New text: {updated['text']}")
```

### Example 2: Update Options

```python
# User: "Update the account type options to be more descriptive"

# Step 1: Show current
question = get_question("bank-details", "q_account_type")
print(f"Current options: {question['options']}")

# Step 2: Apply update
update_question(
    "bank-details",
    "q_account_type",
    {
        "options": [
            {
                "value": "checking",
                "label": "Business Checking Account",
                "description": "Primary operating account for daily transactions"
            },
            {
                "value": "savings",
                "label": "Business Savings Account",
                "description": "High-yield savings for reserves"
            },
            {
                "value": "money_market",
                "label": "Money Market Account",
                "description": "Higher interest rate with limited transactions"
            }
        ]
    }
)

# Step 3: Confirm
updated = get_question("bank-details", "q_account_type")
print(f"Updated {len(updated['options'])} options")
```

### Example 3: Add New Question

```python
# User: "Add a question asking if the bank account requires dual authorization"

# Step 1: Show current questions
summaries = list_module_questions("bank-details")
max_order = max(s.order for s in summaries)

# Step 2: Create new question
new_question = {
    "id": "q_dual_auth",
    "text": "Does this account require dual authorization?",
    "type": "yes_no",
    "order": max_order + 1,
    "helpText": "Select Yes if two signatures are required for transactions",
    "outputMapping": {
        "file": "bank_details.csv",
        "column": "DualAuth",
        "transform": "yes_no"
    }
}

# Step 3: Add and confirm
add_question("bank-details", new_question)
print(f"✓ Added question with order {new_question['order']}")
```

### Example 4: Add Single Select Question

```python
# User: "Add a question asking about the bank's primary region"

new_question = {
    "id": "q_bank_region",
    "text": "What is your bank's primary region?",
    "type": "single_select",
    "order": 3,
    "helpText": "Select the geographic region where your bank is headquartered",
    "options": [
        {
            "value": "northeast",
            "label": "Northeast",
            "description": "Maine, Vermont, New Hampshire, Massachusetts, Rhode Island, Connecticut, New York, Pennsylvania, New Jersey"
        },
        {
            "value": "southeast",
            "label": "Southeast", 
            "description": "Delaware, Maryland, Virginia, West Virginia, North Carolina, South Carolina, Georgia, Florida, Alabama, Mississippi, Tennessee, Kentucky, Arkansas, Louisiana"
        },
        {
            "value": "midwest",
            "label": "Midwest",
            "description": "Ohio, Indiana, Illinois, Michigan, Wisconsin, Minnesota, Iowa, Missouri, North Dakota, South Dakota, Nebraska, Kansas"
        },
        {
            "value": "west",
            "label": "West",
            "description": "Montana, Wyoming, Colorado, New Mexico, Idaho, Utah, Arizona, Nevada, Washington, Oregon, California, Alaska, Hawaii"
        }
    ],
    "outputMapping": {
        "file": "bank_details.csv",
        "column": "BankRegion",
        "transform": "value_lookup",
        "valueMap": {
            "northeast": "NE",
            "southeast": "SE",
            "midwest": "MW",
            "west": "W"
        }
    }
}

add_question("bank-details", new_question)
```

## Best Practices

### DO:
- Always show current state before editing
- Validate user input before applying changes
- Echo back changes for user confirmation
- Provide clear error messages with solutions
- Keep question IDs descriptive and prefixed (e.g., "q_")
- Use appropriate transform types for data mapping when adding new questions
- Include helpText for questions that need clarification when adding new questions
- Only modify `text` and `options` fields when updating existing questions

### DON'T:
- Assume module names (ask the user)
- Skip validation before writes
- Change question IDs after creation
- Create duplicate question IDs
- Forget to include options for select-type questions
- Omit required fields (id, text, type, order, outputMapping) when adding questions
- Attempt to modify helpText, order, type, showIf, or outputMapping on existing questions

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `ModuleConfigError` | Module not found | Verify module name, check app/data/modules/ |
| `QuestionValidationError: Duplicate ID` | Question ID already exists | Choose a unique ID |
| `QuestionValidationError: Missing required field` | Incomplete question object | Include all required fields |
| `QuestionValidationError: Options required` | single_select/multi_select without options | Add options array |
| `QuestionValidationError: Option missing value/label` | Malformed option | Ensure each option has value and label |
| `QuestionValidationError: Field not editable` | Attempting to modify helpText, type, order, showIf, or outputMapping | Only text and options can be modified on existing questions |

## Summary

This skill provides safe, validated access to TurboSAP module questions.json files. It ensures all edits maintain schema compliance and provides clear feedback to users. The workflow is always: inspect → validate → edit → confirm.

Following these workflows keeps module configurations deterministic and aligned with TurboSAP's standardized question schema.
