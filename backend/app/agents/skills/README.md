# Agent Skills

Reusable agent skills for LangGraph workflows and autonomous agents.

## Overview

Agent skills are self-contained, composable modules that provide specific capabilities for agents. Each skill includes:

- **Core Implementation**: Main functionality with proper error handling
- **LangGraph Integration**: Factories to create nodes and routers
- **Standalone Usage**: Can be used independently of LangGraph
- **Documentation**: Clear instructions and API reference
- **Examples**: Real-world usage patterns
- **Metadata**: Schema definitions and configuration

## Available Skills

### PPT Content Extractor

Extract and retrieve PowerPoint content from AWS S3.

**Location**: `ppt_content_extractor/`

**Quick Start**:
```python
from app.agents.skills.ppt_content_extractor import get_ppt_content

content = get_ppt_content("company_name/company_code/presentation.pptx")
print(f"Slides: {content['slide_count']}")
print(f"Text: {content['full_text']}")
```

**Key Features**:
- Extract text, metadata, and slide information
- Process multiple files in batch
- Integrate as LangGraph nodes
- Reuses ReachNett S3 infrastructure

**Files**:
- `INSTRUCTIONS.md`: Detailed documentation
- `get_ppt_content.py`: Main implementation
- `metadata.json`: Schema and configuration
- `examples.py`: Usage examples
- `__init__.py`: Package interface

See `ppt_content_extractor/INSTRUCTIONS.md` for full documentation.

## Skill Architecture

Each skill follows this pattern:

```
skill_name/
├── INSTRUCTIONS.md          # Comprehensive documentation
├── get_*.py                 # Main implementation(s)
├── metadata.json            # Schema and integration points
├── examples.py              # Usage examples
├── __init__.py              # Public API
└── tests/                   # Unit tests (optional)
```

## Integration with LangGraph

Skills provide factory functions to create graph nodes:

```python
from langgraph.graph import StateGraph

from app.agents.skills.ppt_content_extractor import create_ppt_content_node

builder = StateGraph(MyState)
builder.add_node("extract_ppt", create_ppt_content_node())
```

## Integration with ReachNett Data Manager

Skills reuse the existing ReachNett infrastructure:

```python
from app.agents.skills.ppt_content_extractor import get_ppt_content
from app.data import ReachNettDataManager

# Skills automatically use the shared data manager
content = get_ppt_content("company/code/file.pptx")
```

## Creating New Skills

To create a new skill:

1. Create a directory under `skills/` with your skill name
2. Implement the main functionality in a module (e.g., `get_*.py`)
3. Write `INSTRUCTIONS.md` with comprehensive documentation
4. Create `metadata.json` with schema definitions
5. Add examples in `examples.py`
6. Export public API in `__init__.py`
7. Add unit tests in `tests/` (optional)

Template:
```python
# get_my_skill.py
from typing import Dict, Any, Optional

class MySkillError(Exception):
    """Raised when skill operation fails."""
    pass

def do_something(param: str) -> Dict[str, Any]:
    """Main skill function."""
    # Implementation
    return {"result": "value"}

def create_my_skill_node():
    """Factory for LangGraph node."""
    def node(state: Dict[str, Any]) -> Dict[str, Any]:
        # Node implementation
        return state
    return node
```

## Metadata Convention

Each skill's `metadata.json` should include:

- **skill**: Name, version, description
- **capabilities**: Supported operations and file types
- **dependencies**: Required packages and internal modules
- **input_schema**: JSON Schema for inputs
- **output_schema**: JSON Schema for outputs
- **integration_points**: LangGraph and standalone usage
- **error_handling**: Expected exceptions and recovery
- **performance**: Performance considerations
- **examples**: Code examples for each use case

See `ppt_content_extractor/metadata.json` for a complete example.

## Best Practices

1. **Reuse Infrastructure**: Use existing data managers and download services
2. **Clear Documentation**: INSTRUCTIONS.md should be comprehensive
3. **Error Handling**: Define custom exceptions and handle gracefully
4. **Type Hints**: Use proper Python type hints throughout
5. **Examples**: Provide realistic, runnable examples
6. **Testing**: Include unit tests for core functions
7. **Lazy Initialization**: Use lazy loading for expensive resources
8. **Batch Support**: When possible, support batch processing
9. **State Integration**: Make nodes easy to integrate with LangGraph

## Dependencies

All skills should document:
- Required Python packages (pip install)
- Internal module dependencies
- External service requirements (e.g., S3 access)

Install skill dependencies:
```bash
pip install python-pptx
```

## Error Handling

Define custom exceptions for your skill:

```python
class MySkillError(Exception):
    """Base exception for skill operations."""

class ValidationError(MySkillError):
    """Raised when input validation fails."""

class ExternalServiceError(MySkillError):
    """Raised when external service fails."""
```

## Testing

Skills should include unit tests:

```bash
pytest backend/app/agents/skills/ppt_content_extractor/tests/
```

## Future Skills

Planned skills for implementation:

- **Document Summarizer**: Summarize long documents using LLMs
- **Data Validator**: Validate data against schemas
- **Report Generator**: Generate formatted reports from data
- **Knowledge Graph Builder**: Build knowledge graphs from text
- **Time Series Analyzer**: Analyze temporal data patterns
