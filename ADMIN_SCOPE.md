# Admin Role Scope & Design

## Design Principle: Instance-Scoped Admin Only

**Key Decision**: Admin role is **scoped to a single instance only**. There is **NO** super administrator that can manage multiple customer instances.

---

## Current Admin Capabilities

### ✅ What Instance Admins Can Do

Within their own instance, admins can:

1. **User Management**
   - Create new users (client or admin roles)
   - View all users in the instance
   - Update user roles
   - Delete users (with appropriate safeguards)

2. **Configuration Management**
   - Upload and modify question configurations
   - Restore original question configurations
   - Manage instance-specific settings

3. **Full Instance Access**
   - Access all features and modules within the instance
   - View all sessions and data within the instance
   - Perform all administrative operations

### ❌ What Admins Cannot Do

- **Cannot access other instances**: No cross-instance visibility or management
- **Cannot view data from other customers**: Complete data isolation
- **No unified control panel**: No UI that shows multiple instances

---

## Why No Super Admin?

### 1. Strong Isolation
- Maintains complete separation between customer instances
- Each customer's data remains completely isolated
- Prevents accidental or intentional cross-instance access

### 2. Security
- Reduces attack surface: no single account with broad access
- Limits impact of compromised admin credentials to one instance
- Follows principle of least privilege

### 3. Compliance
- Easier to demonstrate data isolation for compliance requirements
- Each customer's data is managed independently
- Clear audit trail per instance

### 4. Simplicity
- No complex cross-instance permission logic needed
- Simpler codebase and easier maintenance
- Clearer security model

---

## Support Operations

While there is no super admin UI, support operations can still be performed:

### Operational Scripts
- Support team can use scripts for maintenance tasks
- Scripts can be run per-instance for specific operations
- No unified "control panel" UI

### Initial Setup
- Each new customer instance is created via automation/scripts
- Initial admin account is created using `backend/create_admin.py`
- Admin credentials are provided to the customer
- Similar to SAP BTP: deploy code → run initialization → provide tenant admin

### Example Workflow
```bash
# For each new customer:
1. Deploy code to new AWS stack
2. Run initialization script
3. Create initial admin: python3 backend/create_admin.py admin_user secure_password "Company Name"
4. Provide admin credentials to customer
5. Customer logs in and manages their own instance
```

---

## Implementation Details

### Admin Role Check
- Admin role is checked using `require_admin()` middleware
- Checks are performed within the instance's database
- No cross-instance queries or operations

### Database Scope
- All admin operations query only the instance's database
- No shared database or cross-instance tables
- Each instance has its own `turbosap.db` file

### API Endpoints
All admin endpoints are instance-scoped:
- `/api/admin/users` - Only shows users in current instance
- `/api/config/questions/*` - Only modifies current instance's config
- All operations are limited to the authenticated instance

---

## Comparison with Multi-Tenant Systems

### Multi-Tenant System (NOT Our Design)
```
┌─────────────────────────────────────┐
│   Super Admin UI                    │
│   ┌─────────┬─────────┬─────────┐  │
│   │Tenant 1 │Tenant 2 │Tenant 3│  │
│   └─────────┴─────────┴─────────┘  │
└─────────────────────────────────────┘
```

### Our Design (Single-Instance)
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Instance 1  │  │ Instance 2  │  │ Instance 3  │
│   Admin     │  │   Admin     │  │   Admin     │
│  (isolated) │  │  (isolated) │  │  (isolated) │
└─────────────┘  └─────────────┘  └─────────────┘
```

---

## Future Considerations

### If Cross-Instance Management is Needed

If business requirements change and cross-instance management is needed:

1. **Separate Support System**: Create a separate support/admin system (not part of customer instances)
2. **API-Based**: Use APIs to interact with instances, not direct database access
3. **Audit Trail**: Maintain clear audit logs for all cross-instance operations
4. **Limited Scope**: Only specific operations, not full admin access

**However, current requirements explicitly state this is NOT needed.**

---

## Summary

✅ **Current Design**: Instance-scoped admin only  
✅ **No Super Admin**: No cross-instance management UI  
✅ **Strong Isolation**: Complete separation between instances  
✅ **Support Operations**: Via scripts, not unified UI  
✅ **Initial Setup**: Automated per-instance admin creation  

This design aligns with the requirement for strong isolation and follows the SAP BTP model where each tenant is completely independent.

