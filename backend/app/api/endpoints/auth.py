from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api import deps
from app.core.config import settings
from app.core.security import create_access_token
from app.models.user import User
from app.db.session import get_db

router = APIRouter()

# Note: In a real enterprise SSO integration, you would use Authlib to redirect to the SSO provider.
# For demonstration and local development, we'll create a mock SSO endpoint.

@router.post("/login/sso")
def login_sso_mock(employee_id: str, db: Session = Depends(get_db)):
    """
    Mock SSO login endpoint for development.
    In production, this would be a GET redirecting to the SSO provider.
    """
    user = db.query(User).filter(User.employee_id == employee_id).first()
    if not user:
        # Auto-register mock user
        user = User(
            employee_id=employee_id,
            name=f"Mock User {employee_id}",
            department="IT Department",
            role="admin" if employee_id == "admin" else "user"
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
