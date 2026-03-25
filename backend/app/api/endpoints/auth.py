import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from app.api import deps
from app.core.config import settings
from app.core.security import create_access_token
from app.models.user import User
from app.db.session import get_db

router = APIRouter()

def _validate_sso_settings() -> None:
    required_settings = {
        "SSO_CLIENT_ID": settings.SSO_CLIENT_ID,
        "SSO_CLIENT_SECRET": settings.SSO_CLIENT_SECRET,
        "SSO_AUTHORIZATION_URL": settings.SSO_AUTHORIZATION_URL,
        "SSO_TOKEN_URL": settings.SSO_TOKEN_URL,
        "SSO_USERINFO_URL": settings.SSO_USERINFO_URL,
        "SSO_REDIRECT_URI": settings.SSO_REDIRECT_URI,
        "FRONTEND_SSO_CALLBACK_URL": settings.FRONTEND_SSO_CALLBACK_URL,
    }
    missing_settings = [key for key, value in required_settings.items() if not value]
    if missing_settings:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Missing SSO configuration: {', '.join(missing_settings)}"
        )

@router.get("/login/sso")
def login_sso():
    _validate_sso_settings()
    state = secrets.token_urlsafe(32)
    query = urlencode(
        {
            "response_type": "code",
            "client_id": settings.SSO_CLIENT_ID,
            "redirect_uri": settings.SSO_REDIRECT_URI,
            "scope": settings.SSO_SCOPE,
            "state": state,
        }
    )
    redirect_url = f"{settings.SSO_AUTHORIZATION_URL}?{query}"
    response = RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
    response.set_cookie(key="sso_state", value=state, httponly=True, samesite="lax", max_age=600)
    return response

@router.get("/callback/sso")
async def callback_sso(
    code: str,
    state: str,
    db: Session = Depends(get_db),
    sso_state: str = Cookie(default=None),
):
    _validate_sso_settings()
    if not sso_state or sso_state != state:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid SSO state")

    async with httpx.AsyncClient(timeout=15.0) as client:
        token_response = await client.post(
            settings.SSO_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.SSO_REDIRECT_URI,
                "client_id": settings.SSO_CLIENT_ID,
                "client_secret": settings.SSO_CLIENT_SECRET,
            },
            headers={"Accept": "application/json"},
        )
        if token_response.status_code >= 400:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to exchange SSO code")
        token_data = token_response.json()
        provider_access_token = token_data.get("access_token")
        if not provider_access_token:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Missing access token from SSO provider")

        userinfo_response = await client.get(
            settings.SSO_USERINFO_URL,
            headers={
                "Authorization": f"Bearer {provider_access_token}",
                "Accept": "application/json",
            },
        )
        if userinfo_response.status_code >= 400:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to fetch SSO user info")
        user_info = userinfo_response.json()

    employee_id_field = settings.SSO_USERINFO_EMPLOYEE_ID_FIELD
    name_field = settings.SSO_USERINFO_NAME_FIELD
    department_field = settings.SSO_USERINFO_DEPARTMENT_FIELD

    employee_id = str(user_info.get(employee_id_field) or "").strip()
    if not employee_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SSO user info missing employee_id")

    name = str(user_info.get(name_field) or employee_id).strip()
    department = str(user_info.get(department_field) or "Unknown").strip()

    user = db.query(User).filter(User.employee_id == employee_id).first()
    if not user:
        user = User(
            employee_id=employee_id,
            name=name or employee_id,
            department=department or "Unknown",
            role="user"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.name = name or user.name
        user.department = department or user.department
        db.commit()
        db.refresh(user)

    app_access_token = create_access_token(subject=user.employee_id)
    callback_query = urlencode({"token": app_access_token})
    frontend_redirect_url = f"{settings.FRONTEND_SSO_CALLBACK_URL}?{callback_query}"
    response = RedirectResponse(url=frontend_redirect_url, status_code=status.HTTP_302_FOUND)
    response.delete_cookie("sso_state")
    return response

@router.post("/login/mock")
def login_mock(employee_id: str, db: Session = Depends(get_db)):
    if not settings.ENABLE_MOCK_SSO:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mock SSO is disabled"
        )

    normalized_employee_id = employee_id.strip()
    if not normalized_employee_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="employee_id is required"
        )

    user = db.query(User).filter(User.employee_id == normalized_employee_id).first()
    if not user:
        # Auto-register mock user
        user = User(
            employee_id=normalized_employee_id,
            name=f"Mock User {normalized_employee_id}",
            department="IT Department",
            role="user"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
    access_token = create_access_token(subject=user.employee_id)
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me")
def read_users_me(
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Get current user.
    """
    return {
        "employee_id": current_user.employee_id,
        "name": current_user.name,
        "department": current_user.department,
        "role": current_user.role
    }

@router.get("/users/search")
def search_users(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    keyword = q.strip()
    if not keyword:
        return []

    users = db.query(User).filter(
        (User.employee_id.ilike(f"%{keyword}%")) | (User.name.ilike(f"%{keyword}%"))
    ).limit(limit).all()

    return [
        {
            "employee_id": user.employee_id,
            "name": user.name,
            "department": user.department,
        }
        for user in users
    ]
