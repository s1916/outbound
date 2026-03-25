from fastapi import APIRouter
from app.api.endpoints import auth, records, admin, files, export

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(records.router, prefix="/records", tags=["records"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(export.router, prefix="/export", tags=["export"])