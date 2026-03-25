from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.api import deps
from app.models.record import ExchangeRecord
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogOut
from app.schemas.record import RecordOut
from app.db.session import get_db

router = APIRouter()

def log_action(db: Session, operator_id: str, action: str, target_id: str = None, details: str = None):
    audit_log = AuditLog(
        operator_id=operator_id,
        target_record_id=target_id,
        action=action,
        details=details
    )
    db.add(audit_log)
    db.commit()

@router.post("/records/{id}/lock")
def lock_record(
    id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(deps.get_current_admin_user),
):
    record = db.query(ExchangeRecord).filter(ExchangeRecord.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
        
    record.is_locked = True
    db.commit()
    
    log_action(db, current_admin.id, "lock", record.id, "Record locked by admin")
    return {"ok": True, "message": "Record locked successfully"}

@router.post("/records/{id}/unlock")
def unlock_record(
    id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(deps.get_current_admin_user),
):
    record = db.query(ExchangeRecord).filter(ExchangeRecord.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
        
    record.is_locked = False
    db.commit()
    
    log_action(db, current_admin.id, "unlock", record.id, "Record unlocked by admin")
    return {"ok": True, "message": "Record unlocked successfully"}

@router.delete("/records")
def batch_delete_records(
    record_ids: List[str],
    db: Session = Depends(get_db),
    current_admin: User = Depends(deps.get_current_admin_user),
):
    records = db.query(ExchangeRecord).filter(ExchangeRecord.id.in_(record_ids)).all()
    
    for record in records:
        record.is_deleted = True
        log_action(db, current_admin.id, "soft_delete", record.id, "Record batch deleted by admin")
        
    db.commit()
    return {"ok": True, "deleted_count": len(records)}

@router.get("/audit-logs", response_model=List[AuditLogOut])
def get_audit_logs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_admin: User = Depends(deps.get_current_admin_user),
):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return logs