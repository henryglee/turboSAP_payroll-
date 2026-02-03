"""
Example Usage of Domain Configuration Retriever Skill

Demonstrates various ways to use the get_domain_configuration skill
for retrieving JSON configurations from the knowledge base.
"""
from app.agents.skills.get_domain_configuration.get_domain_configuration import (
    get_domain_config,
    find_config_by_task,
    get_domain_config_by_object_key,
    list_configs_by_company,
    DomainConfigurationError
)
# ============================================
# Basic Usage Examples
# ============================================

def example_basic_retrieval():
    """Example 1: Basic configuration retrieval"""
    from app.agents.skills.get_domain_configuration.get_domain_configuration import (
    get_domain_config,
    find_config_by_task,
    get_domain_config_by_object_key,
    list_configs_by_company,
    DomainConfigurationError
)
    
    # Retrieve a specific configuration
    result = get_domain_config(
        task_name="payment_method",
        company_name="reachnett"
    )
    
    if result['success']:
        config = result['configuration']
        print(f"✓ Retrieved: {result['task_name']}")
        print(f"  File size: {result['file_size']} bytes")
        print(f"  Config keys: {list(config.keys())}")
        
        # Use the configuration
        print(f" Questions found: {len(config.get('questions', []))}")
    else:
        print(f"✗ Error: {result['error']}")


def example_metadata_only():
    """Example 2: Look up metadata without downloading"""
    from app.agents.skills.get_domain_configuration.get_domain_configuration import find_config_by_task
    
    # Only query the database
    metadata = find_config_by_task(
        task_name="payment_method",
        company_name="reachnett"
    )
    
    if metadata:
        print(f"✓ Configuration found in database")
        print(f"  Object key: {metadata['object_key']}")
        print(f"  Created: {metadata['created_at']}")
        # Download later if needed
    else:
        print(f"✗ Configuration not found in database")


def example_direct_retrieval():
    """Example 3: Retrieve by object key directly"""
    from app.agents.skills.get_domain_configuration.get_domain_configuration import get_domain_config_by_object_key
    
    # When you already know the object key
    object_key = "knowledgebase/reachnett/payment_method/payment_method_questions.json"
    
    result = get_domain_config_by_object_key(object_key)
    
    if result['success']:
        config = result['configuration']
        print(f"✓ Retrieved configuration from {object_key}")
        print(f"  Configuration: {config}")
    else:
        print(f"✗ Download failed: {result['error']}")


def example_list_all_configs():
    """Example 4: List all configurations for a company"""
    from app.agents.skills.get_domain_configuration.get_domain_configuration import list_configs_by_company
    
    company = "reachnett"
    configs = list_configs_by_company(company)
    
    print(f"✓ Found {len(configs)} configurations for {company}:")
    for cfg in configs:
        print(f"  - {cfg['task_name']:<20} | {cfg['created_at']}")
        print(f"    Location: {cfg['object_key']}")


# ============================================
# Error Handling Examples
# ============================================

def example_error_handling():
    """Example 5: Proper error handling"""
    from app.agents.skills.get_domain_configuration.get_domain_configuration import (
        get_domain_config,
        DomainConfigurationError,
    )
    from app.services.knowledgebase import KnowledgebaseDownloadError
    
    try:
        result = get_domain_config(
            task_name="unknown_task",
            company_name="Unknown Corp"
        )
        
        if result['success']:
            config = result['configuration']
            print(f"✓ Retrieved config: {config}")
        
    except DomainConfigurationError as e:
        # Metadata lookup failed or JSON parsing failed
        print(f"✗ Configuration error: {e}")
        # Handle: Check database, validate task name, etc.
        
    except KnowledgebaseDownloadError as e:
        # S3 download failed
        print(f"✗ Download error: {e}")
        # Handle: Check S3 permissions, bucket availability, etc.
        
    except Exception as e:
        # Unexpected error
        print(f"✗ Unexpected error: {e}")


# ============================================
# Integration with Agents
# ============================================

def example_langgraph_integration():
    """Example 6: Using with LangGraph agents"""
    from langgraph.graph import StateGraph
    from app.agents.skills.get_domain_configuration.get_domain_configuration import create_domain_config_node
    
    # Create graph
    graph_builder = StateGraph(dict)
    
    # Add the configuration retrieval node
    graph_builder.add_node("retrieve_config", create_domain_config_node())
    
    # Set as entry point
    graph_builder.set_entry_point("retrieve_config")
    graph_builder.set_finish_point("retrieve_config")
    
    # Compile and run
    graph = graph_builder.compile()
    
    initial_state = {
        "task_name": "payment_method",
        "company_name": "reachnett"
    }
    
    result = graph.invoke(initial_state)
    
    if result.get("domain_config") and result["domain_config"]["success"]:
        config = result["domain_config"]["configuration"]
        print(f"✓ Agent retrieved config: {config}")
    else:
        print(f"✗ Agent error: {result.get('domain_config_error')}")




# ============================================
# Advanced Workflow Examples
# ============================================

def example_config_validation():
    """Example 8: Load and validate configuration"""
    from app.agents.skills.get_domain_configuration.get_domain_configuration import get_domain_config
    
    required_fields = ['methods', 'default', 'rules']
    
    result = get_domain_config("payment_method", "reachnett")
    
    if result['success']:
        config = result['configuration']
        
        # Validate structure
        missing_fields = [f for f in required_fields if f not in config]
        
        if missing_fields:
            print(f"✗ Invalid config: missing {missing_fields}")
        else:
            print(f"✓ Config is valid")
            print(f"  Available methods: {config['methods']}")
            print(f"  Default method: {config['default']}")


def example_multi_task_workflow():
    """Example 9: Load multiple related configurations"""
    from app.agents.skills.get_domain_configuration.get_domain_configuration import list_configs_by_company
    
    company = "reachnett"
    required_tasks = ["payment_method", "payroll_area", "salary_rules"]
    
    # Get all configs for company
    available_configs = {
        cfg['task_name']: cfg for cfg in list_configs_by_company(company)
    }
    
    # Load required configurations
    missing_configs = []
    for task in required_tasks:
        if task not in available_configs:
            missing_configs.append(task)
    
    if missing_configs:
        print(f"✗ Missing configurations: {missing_configs}")
    else:
        print(f"✓ All required configurations available:")
        for task in required_tasks:
            cfg = available_configs[task]
            print(f"  - {task}: {cfg['object_key']}")


# ============================================
# Main Entry Point
# ============================================

if __name__ == "__main__":
    print("=" * 60)
    print("Domain Configuration Retriever - Usage Examples")
    print("=" * 60)
    
    print("\n[Example 1] Basic Retrieval")
    print("-" * 60)
    try:
        example_basic_retrieval()
    except Exception as e:
        print(f"Skipped: {e}")
    
    print("\n[Example 2] Metadata Only")
    print("-" * 60)
    try:
        example_metadata_only()
    except Exception as e:
        print(f"Skipped: {e}")
    
    print("\n[Example 3] Direct Retrieval by Object Key")
    print("-" * 60)
    try:
        example_direct_retrieval()
    except Exception as e:
        print(f"Skipped: {e}")
    
    print("\n[Example 4] List All Configs")
    print("-" * 60)
    try:
        example_list_all_configs()
    except Exception as e:
        print(f"Skipped: {e}")
    
    print("\n[Example 5] Error Handling")
    print("-" * 60)
    try:
        example_error_handling()
    except Exception as e:
        print(f"Skipped: {e}")
    
    
    print("\n" + "=" * 60)
    print("Examples complete!")
    print("=" * 60)
