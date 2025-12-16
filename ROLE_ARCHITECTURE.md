# Role Architecture & Future Expansion

## Current Architecture (MVP)

### Current Roles
- **`admin`**: Full system administrator with access to all features
- **`client`**: Regular user with access to configuration features

### Design Principles

1. **Role as String**: Roles are stored as strings in the database, allowing flexibility
2. **Centralized Validation**: Role validation is handled through `backend/app/roles.py`
3. **No Hardcoded Lists**: Role checks use utility functions, not hardcoded lists
4. **Extensible**: Design allows easy extension without breaking changes

---

## Future Expansion (18+ Months)

### Module-Level Roles

The system will need to support module-level access control:

- **`ROLE_PAYROLL`**: Access to Payroll module only
- **`ROLE_FINANCE`**: Access to Finance (FI) module only
- **`ROLE_SD`**: Access to Sales/Distribution (SD) module only
- **`ROLE_MM`**: Access to Materials Management (MM) module only
- **`ROLE_PS`**: Access to Project Systems (PS) module only

### Access Control Rules

1. **Admin**: Always has access to all modules
2. **Module Roles**: Users with module roles can only access their assigned module
3. **Data Isolation**: Payroll users cannot see Finance data, and vice versa

---

## Implementation Status

### ✅ Already Designed for Extension

1. **Database Schema**
   - `role` field is `TEXT` type (not enum), allowing any string value
   - No database constraints limiting role values

2. **Role Utility Module** (`backend/app/roles.py`)
   - Centralized role checking functions
   - `is_valid_role()` can be extended to accept module roles
   - `has_module_access()` prepared for module-level checks

3. **Validation Logic**
   - Uses `is_valid_role()` instead of hardcoded lists
   - Can be extended without changing callers

4. **Authentication Middleware**
   - Uses `is_admin()` utility function
   - Easy to add module-specific middleware

### 🔄 To Be Implemented (When Needed)

1. **Update `is_valid_role()`** in `roles.py`:
   ```python
   def is_valid_role(role: str) -> bool:
       # Accept admin and client (current)
       if role in {ADMIN_ROLE, CLIENT_ROLE}:
           return True
       # Accept module roles (future)
       if role.startswith("ROLE_"):
           return True
       return False
   ```

2. **Implement `has_module_access()`**:
   ```python
   def has_module_access(role: str, module: str) -> bool:
       if is_admin(role):
           return True
       module_map = {
           "payroll": "ROLE_PAYROLL",
           "finance": "ROLE_FINANCE",
           # ... etc
       }
       return role == module_map.get(module)
   ```

3. **Add Module-Specific Middleware**:
   ```python
   async def require_module_access(
       module: str,
       authorization: Optional[str] = Header(None)
   ) -> dict:
       user = await get_current_user(authorization)
       if not has_module_access(user["role"], module):
           raise HTTPException(403, f"Access to {module} module required")
       return user
   ```

4. **Update API Endpoints**:
   - Add module access checks to module-specific endpoints
   - Filter data based on user's module access

---

## Code Locations

### Role Management
- `backend/app/roles.py`: Role utility functions
- `backend/app/middleware.py`: Authentication middleware
- `backend/app/main.py`: API endpoints using role checks

### Database
- `backend/app/database.py`: User table with `role TEXT` field

### Frontend
- `src/store/auth.ts`: User store with role
- `src/pages/AdminPage.tsx`: User management (may need updates for module roles)
- `src/App.tsx`: Role-based UI rendering

---

## Migration Path (When Needed)

### Phase 1: Update Role Validation
1. Update `is_valid_role()` to accept `ROLE_*` roles
2. Add module constants to `roles.py`

### Phase 2: Implement Module Access Control
1. Complete `has_module_access()` implementation
2. Add module-specific middleware
3. Update endpoints to check module access

### Phase 3: Update Frontend
1. Update TypeScript types to include module roles
2. Update UI to show module-specific features
3. Add module selection/assignment UI

### Phase 4: Data Isolation
1. Add module filtering to database queries
2. Ensure sessions/configurations are module-scoped
3. Add module field to relevant tables if needed

---

## Notes

- **No Breaking Changes**: Current code will continue to work with admin/client roles
- **Backward Compatible**: Adding module roles won't break existing functionality
- **Gradual Migration**: Can be implemented incrementally
- **Database Schema**: No migration needed (role is already TEXT)

---

## Example: Adding Module Access Check

When implementing module access, an endpoint would look like:

```python
from .roles import has_module_access

@app.get("/api/payroll/areas")
async def get_payroll_areas(
    current_user: dict = Depends(get_current_user)
):
    # Check module access
    if not has_module_access(current_user["role"], "payroll"):
        raise HTTPException(403, "Access to payroll module required")
    
    # Return payroll data (already filtered by instance)
    return {"areas": [...]}
```

This ensures that:
- Admin users can access all modules
- Module-role users can only access their module
- Data remains isolated per module

