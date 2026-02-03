"""
Domain Configuration Retriever Agent Skill Package

This skill provides functionality to retrieve JSON domain configuration files
for specific tasks and companies from the KnowledgeBase.

The skill works in two steps:
1. Query the KnowledgeBaseMetaData table to find the object_key for a task
2. Download the actual JSON configuration file from S3

Quick Start:
    from get_domain_configuration import get_domain_config
    
    config = get_domain_config(task_name="payment_method", company_name="Acme Corp")
    print(config['configuration'])
"""

from .get_domain_configuration import (
    get_domain_config,
    find_config_by_task,
    create_domain_config_node,
    get_skill_info,
)

__all__ = [
    "get_domain_config",
    "find_config_by_task",
    "create_domain_config_node",
    "get_skill_info",
]
