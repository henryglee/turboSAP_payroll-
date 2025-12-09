"""
Authentication middleware for FastAPI.
"""

from fastapi import HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from .auth import verify_token, get_token_from_header

security = HTTPBearer(auto_error=False)


async def get_current_user(
    authorization: Optional[str] = None,
    credentials: Optional[HTTPAuthorizationCredentials] = None,
) -> dict:
    """
    Get current authenticated user from JWT token.

    Can extract token from:
    1. Authorization header (Bearer token)
    2. HTTPBearer credentials

    Returns:
        User payload from token (user_id, username, role)

    Raises:
        HTTPException: If token is invalid or missing
    """
    token = None

    # Try to get token from Authorization header
    if authorization:
        token = get_token_from_header(authorization)

    # Try to get token from HTTPBearer
    if not token and credentials:
        token = credentials.credentials

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


async def get_optional_user(
    authorization: Optional[str] = None,
    credentials: Optional[HTTPAuthorizationCredentials] = None,
) -> Optional[dict]:
    """
    Get current user if authenticated, otherwise return None.

    Useful for endpoints that work with or without authentication.
    """
    try:
        return await get_current_user(authorization, credentials)
    except HTTPException:
        return None

