from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import uuid
import pandas as pd
from io import BytesIO

from app.api import deps
from app.models.record import ExchangeRecord
from app.models.user import User
from app.db.session import get_db

router = APIRouter()

@router.post("/excel")
def export_excel(
    record_ids: List[str],
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    query = db.query(ExchangeRecord).filter(ExchangeRecord.id.in_(record_ids), ExchangeRecord.is_deleted == False)
    
    if current_user.role != "admin":
        query = query.filter(ExchangeRecord.submitter_id == current_user.id)
        
    records = query.all()
    
    if not records:
        raise HTTPException(status_code=404, detail="No valid records found for export")
        
    data = []
    for r in records:
        participants_internal = [p.name_or_employee_id for p in r.participants if p.type == 'internal']
        participants_external = [p.name_or_employee_id for p in r.participants if p.type == 'external']
        
        data.append({
            "提交人": r.submitter.name if r.submitter else "Unknown",
            "客户名称": r.customer_name,
            "所在城市": r.city,
            "提交日期": r.submit_date.strftime("%Y-%m-%d"),
            "本公司参与人": ", ".join(participants_internal),
            "对方公司参与人": ", ".join(participants_external),
            "是否锁定": "是" if r.is_locked else "否",
            "创建时间": r.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })
        
    df = pd.DataFrame(data)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Exchange Records')
        
    output.seek(0)
    
    headers = {
        'Content-Disposition': 'attachment; filename="exchange_records.xlsx"'
    }
    
    return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')