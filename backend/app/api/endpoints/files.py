from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import uuid
import os
import shutil

from app.api import deps
from app.models.record import ExchangeRecord, Attachment
from app.models.user import User
from app.schemas.record import AttachmentOut
from app.db.session import get_db
from app.core.config import settings

router = APIRouter()

ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "application/pdf"
]

@router.post("/upload/{record_id}", response_model=AttachmentOut)
async def upload_file(
    record_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    # Verify record exists and belongs to user
    record = db.query(ExchangeRecord).filter(ExchangeRecord.id == record_id, ExchangeRecord.is_deleted == False).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if current_user.role != "admin" and record.submitter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    if record.is_locked:
        raise HTTPException(status_code=400, detail="Cannot upload to a locked record")

    # Read file content for validation
    content = await file.read()
    
    # Check file size
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File too large")
        
    # Basic mime type check (fallback since libmagic might not be installed on all OS easily)
    file_mime_type = file.content_type
    if file_mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"File type {file_mime_type} not allowed. Only JPG, PNG, PDF are allowed.")

    # Save file
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_extension = os.path.splitext(file.filename)[1]
    new_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(settings.UPLOAD_DIR, new_filename)
    
    with open(file_path, "wb") as f:
        f.write(content)
        
    # Save to database
    db_attachment = Attachment(
        record_id=record_id,
        file_name=file.filename,
        file_path=file_path,
        file_type=file_mime_type,
        file_size=len(content)
    )
    db.add(db_attachment)
    db.commit()
    db.refresh(db_attachment)
    
    return db_attachment

@router.get("/download/{attachment_id}")
def download_file(
    attachment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
        
    record = db.query(ExchangeRecord).filter(ExchangeRecord.id == attachment.record_id).first()
    if not record or record.is_deleted:
         raise HTTPException(status_code=404, detail="Record not found")
         
    if current_user.role != "admin" and record.submitter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    if not os.path.exists(attachment.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
        
    return FileResponse(
        path=attachment.file_path, 
        filename=attachment.file_name, 
        media_type=attachment.file_type
    )