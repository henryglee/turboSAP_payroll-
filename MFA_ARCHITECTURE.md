# Multi-Factor Authentication (MFA) Architecture

## Overview

The authentication system is designed to support MFA in the future. While MFA is not currently implemented, the architecture allows for easy addition of second-factor authentication methods.

**Current Status**: Single-factor authentication (username + password)  
**Future**: Will support MFA via Email OTP, SMS OTP, or Authenticator App (TOTP)

---

## Current Authentication Flow

```
User → POST /api/auth/login (username, password)
     → Verify password
     → Generate JWT token
     → Return token
```

Single-step process: password verification immediately grants access.

---

## Future MFA Flow

### Two-Step Authentication Process

```
Step 1: POST /api/auth/login (username, password)
      → Verify password
      → Check if MFA enabled for user
      → If MFA enabled:
           - Generate temporary session token
           - Send MFA code (email/SMS/TOTP)
           - Return: { "requiresMFA": true, "tempToken": "..." }
      → If MFA not enabled:
           - Generate JWT token
           - Return: { "token": "..." }

Step 2: POST /api/auth/verify-mfa (tempToken, mfaCode)
      → Verify MFA code
      → Generate final JWT token
      → Return: { "token": "..." }
```

### MFA Methods to Support

1. **Email OTP**: Send code to user's email
2. **SMS OTP**: Send code to user's phone number
3. **Authenticator App (TOTP)**: Google Authenticator, Authy, etc.

---

## Required Changes (When Implementing MFA)

### 1. Database Schema Updates

Add fields to `users` table:

```sql
ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN mfa_method TEXT;  -- 'email', 'sms', 'totp'
ALTER TABLE users ADD COLUMN mfa_secret TEXT;  -- For TOTP: base32 encoded secret
ALTER TABLE users ADD COLUMN email TEXT;       -- For email OTP
ALTER TABLE users ADD COLUMN phone_number TEXT; -- For SMS OTP
```

### 2. Temporary Session Storage

Create new table or use in-memory storage for MFA sessions:

```sql
CREATE TABLE IF NOT EXISTS mfa_sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    temp_token TEXT UNIQUE NOT NULL,
    mfa_code TEXT NOT NULL,
    mfa_method TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_mfa_sessions_temp_token ON mfa_sessions(temp_token);
CREATE INDEX idx_mfa_sessions_expires ON mfa_sessions(expires_at);
```

### 3. New API Endpoints

```python
# Step 1: Login (returns tempToken if MFA enabled)
POST /api/auth/login
Request: { "username", "password" }
Response: { "requiresMFA": true, "tempToken": "...", "mfaMethod": "email" }
   OR:    { "token": "..." }  # If MFA not enabled

# Step 2: Verify MFA code
POST /api/auth/verify-mfa
Request: { "tempToken", "mfaCode" }
Response: { "token": "..." }

# Enable/disable MFA (admin or own account)
POST /api/auth/mfa/enable
Request: { "method": "email" | "sms" | "totp", "phoneNumber"?: string }
Response: { "status": "ok", "mfaEnabled": true }

POST /api/auth/mfa/disable
Request: { "password" }  # Require password to disable
Response: { "status": "ok", "mfaEnabled": false }

# Setup TOTP (generates QR code)
GET /api/auth/mfa/totp/setup
Response: { "secret": "...", "qrCode": "data:image/png;base64,..." }
```

### 4. Code Changes

#### Update Login Endpoint

```python
@app.post("/api/auth/login")
def login(request: dict = Body(...)):
    # ... existing password verification ...
    
    # NEW: Check if MFA enabled
    if user.get("mfa_enabled"):
        # Generate temporary token
        temp_token = generate_temp_token(user["id"])
        mfa_code = generate_mfa_code(user["id"], user["mfa_method"])
        
        # Send code based on method
        if user["mfa_method"] == "email":
            send_email_otp(user["email"], mfa_code)
        elif user["mfa_method"] == "sms":
            send_sms_otp(user["phone_number"], mfa_code)
        # TOTP doesn't need code sent, user generates from app
        
        return {
            "requiresMFA": True,
            "tempToken": temp_token,
            "mfaMethod": user["mfa_method"]
        }
    
    # Existing flow: return JWT token
    token = create_token(user["id"], user["username"], user["role"])
    return { "token": token, ... }
```

#### New MFA Verification Endpoint

```python
@app.post("/api/auth/verify-mfa")
def verify_mfa(request: dict = Body(...)):
    temp_token = request.get("tempToken")
    mfa_code = request.get("mfaCode")
    
    # Verify temp token and MFA code
    session = get_mfa_session(temp_token)
    if not session or is_expired(session):
        raise HTTPException(401, "Invalid or expired MFA session")
    
    if not verify_mfa_code(session, mfa_code):
        raise HTTPException(401, "Invalid MFA code")
    
    # Generate final JWT token
    user = get_user_by_id(session["user_id"])
    token = create_token(user["id"], user["username"], user["role"])
    
    # Clean up temp session
    delete_mfa_session(temp_token)
    
    return { "token": token, ... }
```

---

## Implementation Considerations

### Security

1. **Temporary Token Expiration**: MFA sessions should expire quickly (e.g., 5-10 minutes)
2. **Rate Limiting**: Prevent brute force on MFA codes (max attempts per session)
3. **Code Strength**: OTP codes should be 6-8 digits, random
4. **TOTP Secret Storage**: Store TOTP secrets encrypted (not plain text)

### User Experience

1. **Optional MFA**: Allow users to enable/disable MFA
2. **Backup Codes**: Provide backup codes when enabling TOTP
3. **Remember Device**: Optional "remember this device for 30 days" to skip MFA
4. **Recovery**: Admin can disable MFA if user loses access

### Backward Compatibility

1. **Default**: MFA is disabled by default
2. **Existing Users**: Continue working with password-only login
3. **Progressive Rollout**: Can enable MFA per-user or per-role

---

## Recommended Libraries

### Python (Backend)

- **pyotp**: For TOTP generation and verification
  ```bash
  pip install pyotp qrcode[pil]
  ```

- **Email**: Use existing email infrastructure or service (SendGrid, AWS SES)

- **SMS**: Use SMS service (Twilio, AWS SNS)

### Frontend

- **QR Code Display**: Use `qrcode.react` or similar for TOTP setup
- **OTP Input**: Use specialized OTP input component for better UX

---

## Migration Strategy

### Phase 1: Database Schema
1. Add MFA columns to `users` table (nullable, default to disabled)
2. Create `mfa_sessions` table
3. No breaking changes to existing users

### Phase 2: Backend Endpoints
1. Add new MFA endpoints
2. Modify login endpoint to check MFA status
3. Keep backward compatibility (MFA disabled by default)

### Phase 3: Frontend Updates
1. Add MFA setup UI in user settings
2. Update login flow to handle two-step authentication
3. Add OTP input component

### Phase 4: Rollout
1. Enable MFA for admin users first
2. Allow optional enablement for all users
3. Eventually require MFA for sensitive operations

---

## Current Code Locations

### Authentication Files
- `backend/app/auth.py`: Token generation/verification
- `backend/app/main.py`: Login endpoint (line ~157)
- `backend/app/database.py`: User schema and operations
- `backend/app/middleware.py`: Token validation

### Frontend Files
- `src/components/auth/LoginForm.tsx`: Login UI
- `src/api/auth.ts`: Login API calls

---

## Notes

- **No Breaking Changes**: Current implementation remains fully functional
- **Extensible Design**: Database uses TEXT fields where possible (flexible)
- **Industry Standard**: Follows OAuth 2.0 MFA patterns
- **Future-Proof**: Can support additional MFA methods without major refactoring

---

## Example: Email OTP Implementation

```python
import secrets
import hashlib
from datetime import datetime, timedelta

def generate_mfa_code(user_id: int, method: str) -> str:
    """Generate 6-digit OTP code"""
    code = str(secrets.randbelow(1000000)).zfill(6)
    
    # Store in database with expiration
    store_mfa_session(user_id, code, method, expires_in_minutes=10)
    
    return code

def send_email_otp(email: str, code: str):
    """Send OTP via email"""
    # Use your email service
    send_email(
        to=email,
        subject="Your TurboSAP Login Code",
        body=f"Your verification code is: {code}\nValid for 10 minutes."
    )
```

---

## Conclusion

The current authentication system can support MFA with minimal architectural changes. The design allows for:

- ✅ Progressive rollout (MFA optional, enabled per-user)
- ✅ Multiple MFA methods (email, SMS, TOTP)
- ✅ Backward compatibility (existing users continue working)
- ✅ Industry-standard implementation

When ready to implement, follow the phased approach above to minimize risk and disruption.

