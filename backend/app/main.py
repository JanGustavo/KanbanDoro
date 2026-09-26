from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, connections, sessions, tasks
from app.core.config import get_settings
from app.core.database import init_db

settings = get_settings()
if settings.app_env != "development" and settings.jwt_secret == "development-only-change-before-deploy":
    raise RuntimeError("Configure JWT_SECRET before running outside development")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="KanbanDoro API",
    description="Backend for KanbanDoro extension - Kanban + Pomodoro with AI assistance",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(sessions.router)
app.include_router(connections.router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {"message": "KanbanDoro API", "version": "0.1.0"}
