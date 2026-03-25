from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.db.base_class import Base

def generate_uuid():
    return str(uuid.uuid4())

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    operator_id = Column(String, ForeignKey("users.id"), nullable=False)
    target_record_id = Column(String, ForeignKey("exchange_records.id"), nullable=True)
    action = Column(String, nullable=False) # 'create', 'update', 'delete', 'lock', 'unlock'
    details = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    operator = relationship("User", back_populates="audit_logs")
    record = relationship("ExchangeRecord", back_populates="audit_logs")