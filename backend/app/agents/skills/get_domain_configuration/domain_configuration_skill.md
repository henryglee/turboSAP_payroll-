---
name: domain-configuration-retriever
description: Retrieve JSON domain configurations from the knowledge base by task and company. Use when you need to load structured configuration files, payroll rules, payment methods, or other domain-specific settings.
---

# Domain Configuration Retriever

## Overview

The Domain Configuration Retriever skill enables Claude to retrieve and load JSON domain configuration files from the knowledge base. It provides:

- **Two-step retrieval process**: Metadata lookup + S3 download
- **Query-based retrieval** by task name and company
- **Direct retrieval** by S3 object key when path is known
- **Configuration listing** to discover available configs
- **Automatic JSON parsing** with error handling
- **LangGraph integration** for orchestrated workflows

## When to use this Skill

Use the Domain Configuration Retriever when:
- Loading payroll rules, tax settings, or business logic
- Retrieving payment method configurations
- Accessing salary calculation rules
- Loading task-specific settings from the knowledge base
- Building multi-source workflows that combine configs with other data
- Discovering available configurations for a company
- Integrating structured data into agent decision-making

## Quick Start

### Basic Configuration Retrieval

```python
from app.agents.skills.get_domain_configuration.get_domain_configuration import get_domain_config

# Retrieve configuration by task and company
result = get_domain_config(
    task_name="payment_method",
    company_name="Acme Corp"
)

if result['success']:
    config = result['configuration']
    print(f"Payment methods: {config['methods']}")
    print(f"Default: {config['default']}")
    print(f"File size: {result['file_size']} bytes")
```

### Check Configuration Availability

```python
from get_domain_configuration import find_config_by_task

# Only query metadata (don't download)
metadata = find_config_by_task("payment_method", "Acme Corp")

if metadata:
    print(f"Config found at: {metadata['object_key']}")
    print(f"Created: {metadata['created_at']}")
else:
    print("Configuration not found in database")
```

### Direct Retrieval by Object Key

```python
from get_domain_configuration import get_domain_config_by_object_key

# When you already know the S3 path
result = get_domain_config_by_object_key("Acme Corp/ACME001/payment_method.json")

if result['success']:
    config = result['configuration']
    print(config)
```

### List All Available Configurations

```python
from get_domain_configuration import list_configs_by_company

# Discover what configurations exist for a company
configs = list_configs_by_company("Acme Corp")

print(f"Available configurations:")
for cfg in configs:
    print(f"  - {cfg['task_name']}: {cfg['object_key']}")
    print(f"    Created: {cfg['created_at']}")
```

### Batch Loading Multiple Configurations

```python
from get_domain_configuration import (
    get_domain_config,
    DomainConfigurationError,
)

tasks = ["payment_method", "payroll_area", "salary_rules"]
company = "Acme Corp"

configs = {}
for task in tasks:
    try:
        result = get_domain_config(task, company)
        if result['success']:
            configs[task] = result['configuration']
        else:
            print(f"Failed to load {task}: {result['error']}")
    except DomainConfigurationError as e:
        print(f"Error loading {task}: {e}")

print(f"Loaded {len(configs)} configurations")
```

## Configuration Structure

Configurations are stored as JSON in S3 and are task-specific. Common examples:

### Payment Method Configuration

```json
{
  "methods": ["direct_deposit", "check", "wire_transfer"],
  "default": "direct_deposit",
  "rules": {
    "min_amount": 100,
    "max_amount": 100000,
    "processing_days": 2
  }
}
```

### Payroll Area Configuration

```json
{
  "areas": ["north_america", "emea", "asia_pacific"],
  "tax_rules": {
    "north_america": {...}
  },
  "holidays": {...}
}
```

## API Reference

### `get_domain_config(task_name: str, company_name: str) -> Dict[str, Any]`

Primary function to retrieve configuration by task and company.

**Parameters:**
- `task_name` (str): Configuration task identifier (e.g., "payment_method")
- `company_name` (str): Company name

**Returns:**
- `Dict` with: `success`, `task_name`, `company_name`, `configuration`, `metadata`, `file_size`, `downloaded_at`, `error`

**Raises:** `DomainConfigurationError`, `KnowledgebaseDownloadError`

**Example:**
```python
result = get_domain_config("payment_method", "Acme Corp")
if result['success']:
    config = result['configuration']
    methods = config.get('methods', [])
```

### `find_config_by_task(task_name: str, company_name: str) -> Optional[Dict[str, Any]]`

Query metadata without downloading the file.

**Parameters:**
- `task_name` (str): Configuration task identifier
- `company_name` (str): Company name

**Returns:**
- `Dict` with metadata: `object_key`, `task_name`, `company_name`, `content_type`, `created_at`
- `None` if not found

**Example:**
```python
metadata = find_config_by_task("payment_method", "Acme Corp")
if metadata:
    print(f"Object key: {metadata['object_key']}")
```

### `get_domain_config_by_object_key(object_key: str) -> Dict[str, Any]`

Direct retrieval when S3 object key is known.

**Parameters:**
- `object_key` (str): Full S3 path (e.g., "Company/CODE/config.json")

**Returns:**
- `Dict` with: `success`, `object_key`, `configuration`, `file_size`, `downloaded_at`, `error`

**Raises:** `KnowledgebaseDownloadError`, `json.JSONDecodeError`

**Example:**
```python
result = get_domain_config_by_object_key("Acme Corp/ACME001/payment_method.json")
config = result['configuration']
```

### `list_configs_by_company(company_name: str) -> List[Dict[str, Any]]`

List all available configurations for a company.

**Parameters:**
- `company_name` (str): Company name

**Returns:**
- `List[Dict]` with metadata for each configuration

**Example:**
```python
configs = list_configs_by_company("Acme Corp")
for cfg in configs:
    print(f"{cfg['task_name']}: {cfg['created_at']}")
```

## Advanced Usage

### Hybrid Retrieval

Combine with other sources (PPT, vector DB) for comprehensive answers:

```python
from get_domain_configuration import get_domain_config
from app.agents.skills.ppt_content_extractor import search_ppt_by_query

query = "What payment methods are available?"
company = "Acme Corp"

# Source 1: Domain configuration (structured)
config_result = get_domain_config("payment_method", company)
config = config_result['configuration'] if config_result['success'] else {}

# Source 2: PPT presentation (ranked)
ppt_results = search_ppt_by_query("payment methods", limit=3)

# Source 3: Vector database (semantic)
# vector_results = search_vector_db(query)

# Combine results
answer = {
    "methods": config.get('methods', []),
    "documentation": ppt_results,
    # "knowledge_base": vector_results,
}
```

### LangGraph Integration

Use in state-based workflows:

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Optional
from get_domain_configuration import create_domain_config_node

class ConfigState(TypedDict):
    task_name: str
    company_name: str
    domain_config: Optional[dict]
    domain_config_error: Optional[str]

builder = StateGraph(ConfigState)
builder.add_node("get_config", create_domain_config_node())
builder.add_edge(START, "get_config")
builder.add_edge("get_config", END)

graph = builder.compile()
result = graph.invoke({
    "task_name": "payment_method",
    "company_name": "Acme Corp"
})

if result['domain_config']['success']:
    config = result['domain_config']['configuration']
```

### Workflow Pattern: Load and Validate

```python
from get_domain_configuration import get_domain_config

def load_and_validate_config(task, company, required_fields):
    result = get_domain_config(task, company)
    
    if not result['success']:
        return {"valid": False, "error": result['error']}
    
    config = result['configuration']
    
    # Validate required fields
    missing = [f for f in required_fields if f not in config]
    if missing:
        return {
            "valid": False,
            "error": f"Missing fields: {missing}"
        }
    
    return {
        "valid": True,
        "config": config,
        "metadata": result['metadata']
    }

# Usage
validation = load_and_validate_config(
    "payment_method",
    "Acme Corp",
    required_fields=["methods", "default", "rules"]
)

if validation['valid']:
    print("Config is valid")
else:
    print(f"Validation failed: {validation['error']}")
```

## Performance

- **Metadata lookup**: ~10-20ms (fast DB query)
- **S3 download**: ~100-500ms (depends on file size)
- **JSON parsing**: ~5-10ms (very fast)
- **Total time**: ~150-550ms per retrieval
- **Parallelizable**: Yes - metadata and download can run in parallel

## Dependencies

- **KnowledgebaseDownloadService**: S3 integration (existing)
- **KnowledgeBaseMetaData table**: Metadata tracking (existing)
- **Python json module**: JSON parsing (standard library)

## Error Handling

The skill provides custom exceptions for different failure modes:

```python
from get_domain_configuration import (
    DomainConfigurationError,
    get_domain_config,
)
from app.services.knowledgebase import KnowledgebaseDownloadError

try:
    result = get_domain_config("payment_method", "Acme Corp")
except DomainConfigurationError as e:
    # Configuration not found or JSON parsing failed
    print(f"Config error: {e}")
except KnowledgebaseDownloadError as e:
    # S3 download failed
    print(f"Download error: {e}")
except json.JSONDecodeError as e:
    # Invalid JSON in file
    print(f"JSON error: {e}")
```

## Database Integration

The skill uses the existing `KnowledgeBaseMetaData` table:

```sql
CREATE TABLE KnowledgeBaseMetaData (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    object_key TEXT NOT NULL,           -- S3 path
    company_name TEXT NOT NULL,         -- Company identifier
    content_type TEXT NOT NULL,         -- application/json
    task_name TEXT,                     -- Task identifier
    created_at TIMESTAMP DEFAULT NOW    -- Upload timestamp
)
```

## Troubleshooting

**Configuration not found**
- Verify task_name and company_name match database entries
- Use `list_configs_by_company()` to see available configs
- Check that configuration was uploaded to knowledge base

**JSON parsing error**
- Ensure file is valid JSON format
- Check for encoding issues (must be UTF-8)
- Verify file is not corrupted

**S3 download timeout**
- Check network connectivity to S3
- Verify S3 bucket and permissions
- Try with smaller configuration file first

**Database query slow**
- Ensure database indexes are created on company_name and task_name
- Consider caching frequently used configs
- Profile query performance

## Examples

See `examples.py` for comprehensive usage examples including:
- Basic retrieval by task and company
- Metadata-only lookup
- Direct object key retrieval
- Listing all configurations
- Hybrid retrieval with multiple sources
- LangGraph workflow integration
- Error handling patterns
- Batch configuration loading

## Related Resources

- [README.md](README.md) - Complete reference documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) - 3-source hybrid retrieval design
- [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) - Integration guide
- [examples.py](examples.py) - Runnable example scenarios
