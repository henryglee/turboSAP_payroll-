# Deployment Architecture

## Core Principle: One Customer = One Instance

**Important**: This system uses a fully isolated deployment model, **NOT a multi-tenant system**.

- ✅ **One customer = One independent AWS stack**
- ✅ **One customer = One completely independent deployment**
- ✅ **One customer = Own independent database**
- ✅ **One customer = Own admin and user accounts**

### Architecture Characteristics

1. **Complete Isolation**: Each customer deployment has its own independent environment, no interference
2. **Simplified Design**: No complex multi-tenant permission control logic needed
3. **Independent Data**: Each instance has its own database file (SQLite: `turbosap.db`)
4. **Independent Configuration**: Each instance has its own configuration files (`questions_current.json`, etc.)
5. **Independent User System**: Each instance manages its own users (admin and client)

---

## Current Project Status

### ✅ Implemented: Fully Compliant with Single-Instance Architecture

1. **Database Isolation**
   - Each deployment uses an independent SQLite database file: `backend/turbosap.db`
   - No `tenant_id` or similar tenant identifier fields
   - All data queries are isolated within the instance

2. **User System**
   - `username` in `users` table uses UNIQUE constraint, unique only within the current instance
   - Different deployment instances can use the same usernames (they are completely independent)
   - `company_name` field is for display purposes only, **NOT a tenant isolation mechanism**

3. **Session Management**
   - `sessions` table associates with users via `user_id`
   - All session data is in the instance's database

4. **Configuration Files**
   - Question configuration stored in local files: `backend/app/config/questions_current.json`
   - Each instance can have its own question configuration

5. **Authentication System**
   - JWT token only contains `user_id`, `username`, `role`
   - No tenant-related token information
   - All authentication checks are performed within the instance

---

## Important Notes

### 1. Purpose of `company_name` Field

The `company_name` field in the `users` table is **NOT** for tenant isolation, but rather:
- For frontend display of the user's company name
- Stored as part of user information
- For display purposes only

**Do NOT remove** this field, as it provides useful user information.

### 2. Username Uniqueness

The current `username` field has a UNIQUE constraint, which is appropriate:
- Within a single instance, usernames must be unique
- Different deployment instances can use the same usernames (they are completely independent)

### 3. No Multi-Tenant Logic

The code does not contain the following (which is correct):
- ❌ No `tenant_id` field
- ❌ No tenant filtering queries
- ❌ No cross-instance data sharing
- ❌ No complex tenant permission control

---

## Deployment Recommendations

### For Each Customer Deployment:

1. **Independent Code Repository or Branch**
   - Each customer can have its own deployment configuration
   - Or use the same code but deploy independently

2. **Independent Environment Variables**
   - Each instance can have its own environment configuration
   - Database paths, ports, etc. can be configured independently

3. **Independent Database File**
   - Each deployment creates its own `turbosap.db`
   - Database migrations are performed within each instance

4. **Initial Admin Account**
   - Use `backend/create_admin.py` to create initial admin for each instance
   - Admin accounts for each instance are completely independent
   - **No super admin**: There is no cross-instance super administrator
   - Each instance's admin can only manage users within that instance

---

## Admin Role Scope

### ✅ Instance-Level Admin (Current Design)

- **Scope**: Admin role is scoped to a single instance only
- **Capabilities**: 
  - Manage users within the same instance
  - Configure questions for the instance
  - Access all features within the instance
- **Limitations**: Cannot access or manage other instances

### ❌ No Super Admin / Cross-Instance Admin

**Design Decision**: There is **NO** super administrator that can manage multiple instances.

**Reasons**:
1. **Strong Isolation**: Maintains complete separation between customer instances
2. **Security**: Prevents cross-instance data access
3. **Compliance**: Each customer's data remains isolated
4. **Simplicity**: No complex cross-instance permission logic needed

**Support Operations**:
- Support team can use **operational scripts** for maintenance
- No unified "control panel" UI that accesses multiple instances
- Each instance is managed independently

**Initial Setup**:
- Each new customer instance is created via script/automation
- Initial admin account is created using `backend/create_admin.py`
- Admin credentials are provided to the customer
- Similar to SAP BTP: deploy code → run initialization script → provide tenant admin credentials

---

## If Multi-Tenant Support is Needed (Not Recommended)

**The current system does NOT support multi-tenancy**. If multi-tenant support is needed, significant refactoring would be required:

1. Database Level:
   - Add `tenant_id` field to all tables
   - All queries need tenant filtering
   - Need data isolation mechanisms between tenants

2. Authentication Level:
   - JWT token needs to include `tenant_id`
   - All API calls need tenant permission verification
   - Need username handling logic across tenants

3. Configuration Level:
   - Each tenant needs its own configuration management
   - Need tenant-level configuration isolation

**However, according to requirements, none of these are needed**, as the architecture is single-instance, single-customer.

---

## Summary

The current project **fully complies with single-customer, single-instance architecture requirements**:

✅ Each deployment is completely independent  
✅ No multi-tenant logic  
✅ Complete database isolation  
✅ Independent user system  
✅ Independent configuration  

**No code changes needed** - simply ensure each customer has an independent deployment instance during deployment.
