"""
Agent Skills Package

Reusable skills that can be integrated into LangGraph agents and other workflows.
Each skill is self-contained with documentation, examples, and metadata.

Available Skills:
    - ppt_content_extractor: Extract and search PPT content from S3 with FTS5
    - get_domain_configuration: Retrieve JSON domain configurations by task
    - context_storage: Store and retrieve agent context from Qdrant
"""

__all__ = [
    "ppt_content_extractor",
    "get_domain_configuration",
    "context_storage",
]
