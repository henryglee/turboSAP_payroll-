# Domain Configuration Retriever Skill

Retrieves JSON domain configurations for specific tasks and companies from the knowledge base.

## Overview

This skill implements a **two-step retrieval process**:

1. **Metadata Lookup**: Query the `KnowledgeBaseMetaData` table to find the S3 object key for a task
2. **File Download**: Download the JSON configuration from S3 using `KnowledgebaseDownloadService`

This allows agents to quickly find and load domain configurations without manual object key management.

## Features

- ✅ Query-based retrieval (task + company → config)
- ✅ Direct retrieval by object key
- ✅ List all configs for a company
- ✅ JSON parsing and validation
- ✅ LangGraph integration ready
- ✅ Error handling with detailed messages

## Database Schema

Uses the existing `KnowledgeBaseMetaData` table:

```sql
CREATE TABLE KnowledgeBaseMetaData (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    object_key TEXT NOT NULL,           -- S3 path
    company_name TEXT NOT NULL,         -- Company identifier
    content_type TEXT NOT NULL,         -- application/json for configs
    task_name TEXT,                     -- payment_method, payroll_area, etc.
    created_at TIMESTAMP DEFAULT NOW    -- Upload timestamp
)
```

## Core Functions

### `get_domain_config(task_name, company_name)`

Retrieve configuration by task and company (primary use case).

```python
from app.agents.skills.get_domain_configuration import get_domain_config

result = get_domain_config(
    task_name="payment_method",
    company_name="Acme Corp"
)

if result['success']:
    config = result['configuration']
    print(f"Methods: {config['methods']}")
    print(f"Size: {result['file_size']} bytes")
else:
    print(f"Error: {result['error']}")
```

**Return Value:**
```python
{
    "success": True,
    "task_name": "payment_method",
    "company_name": "Acme Corp",
    "configuration": {
        "methods": ["direct_deposit", "check", "wire_transfer"],
        "default": "direct_deposit"
    },
    "metadata": {
        "object_key": "Acme Corp/ACME001/payment_method.json",
        "content_type": "application/json",
        "created_at": "2026-01-29T10:30:00"
    },
    "file_size": 524,
    "downloaded_at": "2026-01-29T10:35:45.123456",
    "error": None
}
```

### `find_config_by_task(task_name, company_name)`

Only perform metadata lookup (don't download file).

```python
from app.agents.skills.get_domain_configuration import find_config_by_task

metadata = find_config_by_task("payment_method", "Acme Corp")
if metadata:
    print(f"Object key: {metadata['object_key']}")
    print(f"Created: {metadata['created_at']}")
else:
    print("Configuration not found")
```

### `get_domain_config_by_object_key(object_key)`

Direct retrieval when object key is already known.

```python
from app.agents.skills.get_domain_configuration import get_domain_config_by_object_key

result = get_domain_config_by_object_key("Acme Corp/ACME001/payment_method.json")
config = result['configuration']
```

### `list_configs_by_company(company_name)`

List all available configurations for a company.

```python
from app.agents.skills.get_domain_configuration import list_configs_by_company

configs = list_configs_by_company("Acme Corp")
for cfg in configs:
    print(f"{cfg['task_name']}: {cfg['object_key']} ({cfg['created_at']})")
```

## LangGraph Integration

### Using with LangGraph

```python
from langgraph.graph import StateGraph
from app.agents.skills.get_domain_configuration import create_domain_config_node

# Create graph
graph_builder = StateGraph(dict)

# Add config retrieval node
graph_builder.add_node("get_config", create_domain_config_node())

# Use in state
state = {
    "task_name": "payment_method",
    "company_name": "Acme Corp"
}

# After execution:
# state["domain_config"] = {...}
# state["domain_config_error"] = None or error message
```

### State Structure

**Input State:**
```python
{
    "task_name": "payment_method",      # Required (unless using object_key)
    "company_name": "Acme Corp",        # Required (unless using object_key)
    # OR
    "object_key": "Company/CODE/file.json"  # Alternative: direct retrieval
}
```

**Output State:**
```python
{
    "domain_config": {...},             # Full result dict
    "domain_config_error": None         # Error message (if any)
}
```

## Multi-Source Hybrid Retrieval

Combine this skill with other sources (PPT search, vector DB, etc.):

```python
from app.agents.skills.get_domain_configuration import get_domain_config
from app.agents.skills.ppt_content_extractor import search_ppt_by_query
# from vector_db import search_vector_db

user_question = "What are the available payment methods?"

# Source 1: Domain Configuration
config_result = get_domain_config("payment_method", "Acme Corp")
config_methods = config_result['configuration']['methods']

# Source 2: PPT Presentation
ppt_results = search_ppt_by_query("payment methods", limit=3)

# Source 3: Vector Database
# vector_results = search_vector_db(user_question)

# Combine and rank results
all_results = {
    "configuration": config_methods,
    "presentation": ppt_results,
    # "knowledge_base": vector_results,
}
```

## Error Handling

The skill raises specific exceptions:

```python
from app.agents.skills.get_domain_configuration import (
    DomainConfigurationError,
    get_domain_config
)
from app.services.knowledgebase import KnowledgebaseDownloadError

try:
    result = get_domain_config("payment_method", "Unknown Corp")
except DomainConfigurationError as e:
    # Metadata lookup failed or JSON parsing failed
    print(f"Configuration error: {e}")
except KnowledgebaseDownloadError as e:
    # S3 download failed
    print(f"Download error: {e}")
```

## Common Workflows

### 1. Load Configuration for Processing

```python
from app.agents.skills.get_domain_configuration import get_domain_config

result = get_domain_config(task_name, company_name)
if result['success']:
    config = result['configuration']
    # Use config for validation, calculation, etc.
    process_with_config(data, config)
```

### 2. Check If Config Exists

```python
from app.agents.skills.get_domain_configuration import find_config_by_task

metadata = find_config_by_task(task, company)
if metadata:
    print(f"Config found: {metadata['object_key']}")
else:
    print(f"No config for {task} in {company}")
```

### 3. Iterate Over All Configs

```python
from app.agents.skills.get_domain_configuration import list_configs_by_company

for cfg in list_configs_by_company(company):
    if cfg['task_name'] in REQUIRED_TASKS:
        load_and_validate(cfg['object_key'])
```

## Performance Considerations

- **Metadata Lookup**: O(log n) with database index on (company_name, task_name)
- **S3 Download**: ~100-500ms depending on file size
- **JSON Parsing**: Typically <10ms for reasonable config sizes
- **Total Time**: ~150-550ms per retrieval

## Future Enhancements

1. **Caching**: Cache recently loaded configs in memory
2. **Versioning**: Track multiple versions of configs per task
3. **Fallback**: Support fallback configs if primary not found
4. **Validation**: Validate config JSON against schema
5. **Monitoring**: Track config access patterns and errors
