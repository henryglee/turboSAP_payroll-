"""
Role management utilities.

Current roles (MVP):
- "admin": Full system administrator access
- "client": Regular user access

Future expansion (18+ months):
- Module-level roles will be added:
  - ROLE_PAYROLL, ROLE_FINANCE, ROLE_SD, ROLE_MM, ROLE_PS
- Users will be restricted to their module's data
- Design: role field accepts any string to allow future extension

Design principles:
1. Role is stored as a string (flexible)
2. Admin check is explicit (role == "admin")
3. No hardcoded role lists in validation (extensible)
4. Future: can extend to prefix-based checks (e.g., role.startswith("ROLE_"))
"""

# Current MVP roles
ADMIN_ROLE = "admin"
CLIENT_ROLE = "client"

# Future module roles (documentation only, not yet used)
# ROLE_PAYROLL = "ROLE_PAYROLL"
# ROLE_FINANCE = "ROLE_FINANCE"
# ROLE_SD = "ROLE_SD"
# ROLE_MM = "ROLE_MM"
# ROLE_PS = "ROLE_PS"


def is_admin(role: str) -> bool:
    """
    Check if user has admin role.
    
    Args:
        role: User role string
        
    Returns:
        True if role is "admin", False otherwise
    """
    return role == ADMIN_ROLE


def is_client(role: str) -> bool:
    """
    Check if user has client role.
    
    Args:
        role: User role string
        
    Returns:
        True if role is "client", False otherwise
    """
    return role == CLIENT_ROLE


def is_valid_role(role: str) -> bool:
    """
    Validate role string.
    
    Current: Accepts "admin" or "client"
    Future: Can extend to accept module roles (ROLE_*)
    
    Design decision: Currently accepts only MVP roles, but can be extended
    without breaking changes.
    
    Args:
        role: Role string to validate
        
    Returns:
        True if role is valid, False otherwise
    """
    # MVP: Only admin and client
    valid_roles = {ADMIN_ROLE, CLIENT_ROLE}
    
    # Future: Can extend like this:
    # if role.startswith("ROLE_"):
    #     return True
    # return role in valid_roles
    
    return role in valid_roles


def has_module_access(role: str, module: str) -> bool:
    """
    Check if user has access to a specific module.
    
    Current (MVP): Admin has access to all modules, client has access to all.
    
    Future: Will check module-specific roles:
    - ROLE_PAYROLL -> payroll module access
    - ROLE_FINANCE -> finance module access
    - etc.
    
    Args:
        role: User role string
        module: Module name (e.g., "payroll", "finance")
        
    Returns:
        True if user has access to the module
    """
    # Admin has access to everything
    if is_admin(role):
        return True
    
    # MVP: Client has access to all modules
    if is_client(role):
        return True
    
    # Future: Module-specific role checking
    # module_roles = {
    #     "payroll": ROLE_PAYROLL,
    #     "finance": ROLE_FINANCE,
    #     "sd": ROLE_SD,
    #     "mm": ROLE_MM,
    #     "ps": ROLE_PS,
    # }
    # required_role = module_roles.get(module)
    # return role == required_role or role.startswith(f"ROLE_{module.upper()}")
    
    # Default: no access
    return False

