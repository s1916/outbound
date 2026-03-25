from sqlalchemy import Column, String, Boolean, DateTime, Date, ForeignKey, Integer
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.db.base_class import Base

def generate_uuid():
    return str(uuid.uuid4())

class ExchangeRecord(Base):
    __tablename__ = "exchange_records"

    id = Column(String, primary_key=True, default=generate_uuid)
    submitter_id = Column(String, ForeignKey("users.id"), nullable=False)
    customer_name = Column(String, index=True, nullable=False)
    city = Column(String, index=True, nullable=False)
    submit_date = Column(Date, nullable=False)
    
    is_locked = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    submitter = relationship("User", back_populates="records")
    participants = relationship("Participant", back_populates="record", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="record", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="record")

class Participant(Base):
    __tablename__ = "participants"

    id = Column(String, primary_key=True, default=generate_uuid)
    record_id = Column(String, ForeignKey("exchange_records.id"), nullable=False)
    type = Column(String, nullable=False) # 'internal' or 'external'
    name_or_employee_id = Column(String, nullable=False)
    
    # Relationships
    record = relationship("ExchangeRecord", back_populates="participants")

class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(String, primary_key=True, default=generate_uuid)
    record_id = Column(String, ForeignKey("exchange_records.id"), nullable=False)
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    record = relationship("ExchangeRecord", back_populates="attachments")