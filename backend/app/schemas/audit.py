from pydantic import BaseModel, UUID4
from typing import List, Optional
from datetime import datetime

class AuditLogOut(BaseModel):
    id: str
    operator_id: str
    target_record_id: Optional[str]
    action: str
    details: Optional[str]
    created_at: datetime

    class Config:
        orm_mode = True