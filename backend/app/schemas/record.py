from pydantic import BaseModel, UUID4
from typing import List, Optional
from datetime import date, datetime

class ParticipantBase(BaseModel):
    type: str # 'internal' or 'external'
    name_or_employee_id: str

class ParticipantCreate(ParticipantBase):
    pass

class ParticipantOut(ParticipantBase):
    id: str

    class Config:
        orm_mode = True

class AttachmentBase(BaseModel):
    file_name: str
    file_path: str
    file_type: str
    file_size: int

class AttachmentOut(AttachmentBase):
    id: str
    uploaded_at: datetime

    class Config:
        orm_mode = True

class RecordBase(BaseModel):
    customer_name: str
    city: str
    submit_date: date

class RecordCreate(RecordBase):
    participants: List[ParticipantCreate] = []

class RecordUpdate(RecordBase):
    participants: Optional[List[ParticipantCreate]] = None

class RecordOut(RecordBase):
    id: str
    submitter_id: str
    is_locked: bool
    created_at: datetime
    updated_at: datetime
    participants: List[ParticipantOut] = []
    attachments: List[AttachmentOut] = []

    class Config:
        orm_mode = True