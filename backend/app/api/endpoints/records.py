from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
import uuid

from app.api import deps
from app.models.record import ExchangeRecord, Participant
from app.models.user import User
from app.schemas.record import RecordCreate, RecordUpdate, RecordOut
from app.db.session import get_db

router = APIRouter()

@router.post("/", response_model=RecordOut)
def create_record(
    *,
    db: Session = Depends(get_db),
    record_in: RecordCreate,
    current_user: User = Depends(deps.get_current_active_user),
):
    db_record = ExchangeRecord(
        submitter_id=current_user.id,
        customer_name=record_in.customer_name,
        city=record_in.city,
        submit_date=record_in.submit_date,
    )
    db.add(db_record)
    db.flush() # flush to get db_record.id
    
    for p in record_in.participants:
        db_participant = Participant(
            record_id=db_record.id,
            type=p.type,
            name_or_employee_id=p.name_or_employee_id
        )
        db.add(db_participant)
        
    db.commit()
    db.refresh(db_record)
    return db_record

@router.get("/", response_model=List[RecordOut])
def read_records(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    customer_name: Optional[str] = None,
    city: Optional[str] = None,
    is_locked: Optional[bool] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    submitter: Optional[str] = None,
    current_user: User = Depends(deps.get_current_active_user),
):
    query = db.query(ExchangeRecord).filter(ExchangeRecord.is_deleted == False)
    
    if current_user.role != "admin":
        query = query.filter(ExchangeRecord.submitter_id == current_user.id)
        
    if customer_name:
        query = query.filter(ExchangeRecord.customer_name.ilike(f"%{customer_name}%"))
    if city:
        query = query.filter(ExchangeRecord.city.ilike(f"%{city}%"))
    if is_locked is not None:
        query = query.filter(ExchangeRecord.is_locked == is_locked)
    if start_date:
        query = query.filter(ExchangeRecord.submit_date >= start_date)
    if end_date:
        query = query.filter(ExchangeRecord.submit_date <= end_date)
    if submitter:
        query = query.join(User, ExchangeRecord.submitter_id == User.id).filter(
            (User.employee_id.ilike(f"%{submitter}%")) | (User.name.ilike(f"%{submitter}%"))
        )
        
    records = query.offset(skip).limit(limit).all()
    return records

@router.get("/{id}", response_model=RecordOut)
def read_record(
    *,
    db: Session = Depends(get_db),
    id: str,
    current_user: User = Depends(deps.get_current_active_user),
):
    record = db.query(ExchangeRecord).filter(ExchangeRecord.id == id, ExchangeRecord.is_deleted == False).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if current_user.role != "admin" and record.submitter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return record

@router.put("/{id}", response_model=RecordOut)
def update_record(
    *,
    db: Session = Depends(get_db),
    id: str,
    record_in: RecordUpdate,
    current_user: User = Depends(deps.get_current_active_user),
):
    record = db.query(ExchangeRecord).filter(ExchangeRecord.id == id, ExchangeRecord.is_deleted == False).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if current_user.role != "admin" and record.submitter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    if record.is_locked:
        raise HTTPException(status_code=400, detail="Cannot edit a locked record")
        
    # Update fields
    record.customer_name = record_in.customer_name
    record.city = record_in.city
    record.submit_date = record_in.submit_date
    
    # Update participants if provided
    if record_in.participants is not None:
        db.query(Participant).filter(Participant.record_id == record.id).delete()
        for p in record_in.participants:
            db_participant = Participant(
                record_id=record.id,
                type=p.type,
                name_or_employee_id=p.name_or_employee_id
            )
            db.add(db_participant)
            
    db.commit()
    db.refresh(record)
    return record

@router.delete("/{id}")
def delete_record(
    *,
    db: Session = Depends(get_db),
    id: str,
    current_user: User = Depends(deps.get_current_active_user),
):
    record = db.query(ExchangeRecord).filter(ExchangeRecord.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if current_user.role != "admin" and record.submitter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    if record.is_locked and current_user.role != "admin":
        raise HTTPException(status_code=400, detail="Cannot delete a locked record")
        
    record.is_deleted = True
    db.commit()
    return {"ok": True}
