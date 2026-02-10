---
name: knowledge-retrieval-skill
description: MANDATORY FIRST STEP for any user request
---

# PPT Content Extractor

## Overview

The PPT Content Extractor skill enables Claude to intelligently extract and analyze PowerPoint presentation content from AWS S3. It provides:

- **Coordinate-aware text extraction** with proper reading order (Top-to-Bottom, Left-to-Right)
- **Automatic semantic classification** of content (Title, NarrativeText, ListItem, Table, Footer)
- **Slide-by-slide analysis** with automatic title detection
- **Metadata extraction** (title, author, creation date, modification date)
- **Batch processing** capabilities for multiple files
- **LangGraph integration** for orchestrated workflows

## When to use this Skill

REQUIRED FALLBACK: This tool is the only authorized method for interpreting design intent when the domain-configuration-retriever returns no results. Use this when:

- Terminology Definition: A user asks for the meaning of "Personnel Area," "Tax," or "Enterprise Structure." This tool extracts the official definition and organizational logic from implementation decks.

- Blueprint Retrieval: You need the "how-to" or the "blueprint" for a task that has not yet been configured in the system.

- Strategic Relationship Analysis: The user asks about "TurboSAP" or complex business hierarchies where the visual layout of a slide (coordinate-based) is required to understand the relationship between units.

- Implementation Guide: Extracting summaries or specific data from .pptx files to guide a user through a manual setup process when no automated config exists.

## Quick Start

### Basic Content Extraction

```python
from app.agents.skills.ppt_content_extractor.get_ppt_content import get_ppt_content

# Extract all content from a presentation
content = get_ppt_content("reachnett_ppt/1010/Enterprise_Structure.pptx")

print(f"Slides: {content['slide_count']}")
print(f"Title: {content['metadata']['title']}")
print(f"Author: {content['metadata']['author']}")
print(f"Text preview:\n{content['full_text'][:500]}")
```

### Extract Text with Semantic Tags

The extracted text includes semantic classification for better understanding:

```python
from get_ppt_content import extract_ppt_text

content = get_ppt_content("reachnett_ppt/1010/Enterprise_Structure.pptx")
text = content['full_text']

# Output format with semantic tags:
# --- Slide 1 ---
# [TITLE]: Main Title
# [NARRATIVETEXT]: Body paragraph
# [LISTITEM]: First item
# [LISTITEM]: Second item
```

### Get Slide Summaries

```python
from get_ppt_content import get_ppt_slides_summary

slides = get_ppt_slides_summary(ppt_bytes)

for slide in slides:
    print(f"Slide {slide['slide_number']}: {slide['title']}")
    print(f"Content: {slide['text_content'][:100]}...")
```

### Extract Metadata

```python
from get_ppt_content import get_ppt_metadata

metadata = get_ppt_metadata(ppt_bytes)

print(f"Title: {metadata['title']}")
print(f"Author: {metadata['author']}")
print(f"Created: {metadata['created']}")
print(f"Modified: {metadata['modified']}")
```

### Batch Processing

```python
from get_ppt_content import get_ppt_contents_batch

files = [
      "reachnett_ppt/1010/Enterprise_Structure.pptx",
]

results = get_ppt_contents_batch(files)

for result in results:
    if result['success']:
        print(f"✓ {result['file_name']}: {result['slide_count']} slides")
    else:
        print(f"✗ {result['object_key']}: {result['error']}")
```

## Semantic Classification

Content is automatically classified into semantic categories for better understanding:

| Category | Purpose | Example |
|----------|---------|---------|
| **Title** | Slide titles and headings | "TurboSAP Payroll System" |
| **NarrativeText** | Body text and paragraphs | "This feature enables..." |
| **ListItem** | Bulleted or numbered items | "• Direct Deposit" |
| **Table** | Table content | "Column1 \| Column2" |
| **Footer** | Footer text | "Page 1 of 10" |

Text output uses tags like `[TITLE]: text`, `[NARRATIVETEXT]: text`, etc., with slide markers like `--- Slide N ---`.

## API Reference

### `get_ppt_content(object_key: str) -> Dict[str, Any]`

Retrieve complete content from a PPT file in S3.

**Parameters:**
- `object_key` (str): S3 path (e.g., "reachnett_ppt/1010/Enterprise_Structure.pptx")

**Returns:**
- `Dict` with: `success`, `object_key`, `file_name`, `file_size`, `slide_count`, `metadata`, `slides`, `full_text`, `error`

**Raises:** `PPTContentExtractionError`, `KnowledgebaseDownloadError`

**Example:**
```python
content = get_ppt_content("reachnett_ppt/1010/Enterprise_Structure.pptx")
if content['success']:
    print(f"{content['slide_count']} slides extracted")
```

### `extract_ppt_text(ppt_bytes: bytes) -> str`

Extract text with semantic tags and coordinate ordering.

**Parameters:**
- `ppt_bytes` (bytes): Binary PPT file content

**Returns:**
- `str`: Text with semantic tags and slide markers

**Example:**
```python
text = extract_ppt_text(ppt_bytes)
# Returns: "--- Slide 1 ---\n[TITLE]: ...\n[NARRATIVETEXT]: ..."
```

### `get_ppt_metadata(ppt_bytes: bytes) -> Dict[str, Any]`

Extract document metadata.

**Parameters:**
- `ppt_bytes` (bytes): Binary PPT file content

**Returns:**
- `Dict` with: `title`, `author`, `subject`, `keywords`, `created`, `modified`, `slide_count`

### `get_ppt_slides_summary(ppt_bytes: bytes) -> List[Dict[str, Any]]`

Get slide-by-slide summary with semantic classification.

**Parameters:**
- `ppt_bytes` (bytes): Binary PPT file content

**Returns:**
- `List[Dict]` with: `slide_number`, `title`, `text_content`

### `get_ppt_contents_batch(object_keys: List[str]) -> List[Dict[str, Any]]`

Process multiple PPT files in batch.

**Parameters:**
- `object_keys` (List[str]): S3 object keys to process

**Returns:**
- `List[Dict]`: Results for each file (success or error)

## Advanced Usage

### LangGraph Integration

Use the skill in LangGraph workflows:

```python
from langgraph.graph import StateGraph, START, END
from get_ppt_content import create_ppt_content_node

class PayrollState(TypedDict):
    ppt_object_key: str
    ppt_content: Optional[dict]
    ppt_extraction_error: Optional[str]

builder = StateGraph(PayrollState)
builder.add_node("extract_ppt", create_ppt_content_node())
builder.add_edge(START, "extract_ppt")
builder.add_edge("extract_ppt", END)

graph = builder.compile()
result = graph.invoke({"ppt_object_key": "reachnett_ppt/1010/Enterprise_Structure.pptx"})
```

### Configuration

Adjust extraction strategy in `get_ppt_content.py`:

```python
# Fast processing (default)
strategy="fast"

# Higher accuracy (slower)
strategy="hi_res"
```

## Performance

- **Small files** (< 5MB): ~1-2 seconds
- **Medium files** (5-20MB): ~2-5 seconds
- **Large files** (> 20MB): ~5-10+ seconds

Times depend on: strategy (fast/hi_res), file complexity, and system resources.

## Dependencies

- **python-pptx** (>=0.6.21): PPT file parsing
- **unstructured** (>=0.10.0): Coordinate-based partitioning and semantic classification

## Error Handling

The skill provides two custom exceptions:

```python
class PPTContentExtractionError(Exception):
    """Raised when PPT parsing fails"""

class KnowledgebaseDownloadError(Exception):
    """Raised when S3 download fails"""
```

Handle errors:

```python
from get_ppt_content import (
    get_ppt_content,
    PPTContentExtractionError,
)
from app.services.knowledgebase import KnowledgebaseDownloadError

try:
    content = get_ppt_content("file.pptx")
except KnowledgebaseDownloadError as e:
    print(f"Download failed: {e}")
except PPTContentExtractionError as e:
    print(f"Extraction failed: {e}")
```

## Troubleshooting

**"unstructured module not found"**
```bash
pip install unstructured>=0.10.0
```

**"python-pptx not installed"**
```bash
pip install python-pptx>=0.6.21
```

**Coordinate ordering not working correctly**
- Try `strategy="hi_res"` instead of `strategy="fast"`
- Ensure unstructured.io is up to date
- Check that PPT file is not corrupted

## Examples

See `examples.py` for comprehensive usage examples including:
- Basic content extraction
- Semantic tag processing
- Batch processing workflows
- LangGraph integration patterns
- Error handling scenarios

## Related Resources

- [README.md](README.md) - Complete reference documentation
- [INSTRUCTIONS.md](INSTRUCTIONS.md) - Component architecture
- [test_skill.py](test_skill.py) - Test examples and patterns
