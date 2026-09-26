import base64
import hashlib
import secrets
import time
from datetime import datetime
from email.message import EmailMessage
from urllib.parse import quote

import httpx
from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.models.google_connection_model import GoogleConnection

router = APIRouter(prefix="/connections/google", tags=["connections"])
SCOPES = {
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/tasks",
}


class ExchangeRequest(BaseModel):
    code: str = Field(min_length=4, max_length=2048)
    code_verifier: str = Field(pattern=r"^[A-Za-z0-9._~-]{43,128}$")
    redirect_uri: str


class CalendarDraft(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    description: str = Field(default="", max_length=4000)
    start: datetime
    end: datetime


class TaskDraft(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    notes: str = Field(default="", max_length=4000)


class CalendarUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=180)
    description: str | None = Field(default=None, max_length=4000)
    start: datetime | None = None
    end: datetime | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=180)
    notes: str | None = Field(default=None, max_length=4000)


class EmailDraft(BaseModel):
    to: EmailStr
    subject: str = Field(min_length=1, max_length=250)
    body: str = Field(min_length=1, max_length=10000)


def config():
    settings = get_settings()
    if not all((settings.google_client_id, settings.google_client_secret,
                settings.google_extension_id or settings.google_extension_ids, settings.google_token_encryption_key)):
        raise HTTPException(503, "Google OAuth não configurado no servidor")
    return settings


def cipher() -> Fernet:
    try:
        return Fernet(config().google_token_encryption_key.encode())
    except (ValueError, TypeError) as exc:
        raise HTTPException(503, "Chave de criptografia inválida") from exc


async def connected(db: AsyncSession, authorization: str | None) -> GoogleConnection:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Conexão ausente")
    token = authorization.removeprefix("Bearer ")
    if len(token) != 64:
        raise HTTPException(401, "Conexão inválida")
    digest = hashlib.sha256(token.encode()).hexdigest()
    record = await db.scalar(select(GoogleConnection).where(GoogleConnection.session_hash == digest))
    if record is None:
        raise HTTPException(401, "Conexão expirada ou desconectada")
    return record


async def google_access(record: GoogleConnection, db: AsyncSession) -> str:
    if record.expires_at > time.time() + 90:
        return cipher().decrypt(record.access_token.encode()).decode()
    settings = config()
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post("https://oauth2.googleapis.com/token", data={
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "refresh_token": cipher().decrypt(record.encrypted_refresh_token.encode()).decode(),
            "grant_type": "refresh_token",
        })
    if response.status_code != 200:
        raise HTTPException(401, "Autorização Google expirada. Conecte novamente.")
    data = response.json()
    record.access_token = cipher().encrypt(data["access_token"].encode()).decode()
    record.expires_at = int(time.time()) + int(data.get("expires_in", 3600))
    await db.commit()
    return data["access_token"]


async def google_get(record: GoogleConnection, db: AsyncSession, url: str, params: dict | None = None) -> dict:
    token = await google_access(record, db)
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(url, params=params, headers={"Authorization": f"Bearer {token}"})
    if response.status_code in (401, 403):
        raise HTTPException(401, "Google recusou o acesso. Reconecte a conta e confira as permissões.")
    if response.status_code != 200:
        raise HTTPException(502, f"Falha na consulta ao Google ({response.status_code})")
    return response.json()


async def google_post(record: GoogleConnection, db: AsyncSession, url: str, body: dict, scope: str) -> dict:
    if scope not in record.scopes.split():
        raise HTTPException(403, "Permissão de escrita ausente. Atualize a conexão Google.")
    token = await google_access(record, db)
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(url, json=body, headers={"Authorization": f"Bearer {token}"})
    if response.status_code in (401, 403):
        raise HTTPException(403, "Google recusou a gravação. Confira as permissões e conecte novamente.")
    if response.status_code not in (200, 201):
        raise HTTPException(502, f"Google não confirmou a gravação ({response.status_code}).")
    return response.json()


async def google_mutate(record: GoogleConnection, db: AsyncSession, url: str, method: str, scope: str, body: dict | None = None) -> dict:
    if scope not in record.scopes.split():
        raise HTTPException(403, "Permissão de escrita ausente. Atualize a conexão Google.")
    token = await google_access(record, db)
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.request(method, url, json=body, headers={"Authorization": f"Bearer {token}"})
    if response.status_code == 404:
        raise HTTPException(404, "Item não encontrado no Google. Atualize a lista.")
    if response.status_code in (401, 403):
        raise HTTPException(403, "Google recusou a alteração. Confira as permissões e conecte novamente.")
    if response.status_code not in (200, 204):
        raise HTTPException(502, f"Google não confirmou a alteração ({response.status_code}).")
    return response.json() if response.status_code == 200 else {}


@router.post("/exchange")
async def exchange(payload: ExchangeRequest, db: AsyncSession = Depends(get_db)):
    settings = config()
    redirects = {f"https://{extension_id}.chromiumapp.org/" for extension_id in
                 [settings.google_extension_id, *settings.google_extension_ids] if extension_id}
    if payload.redirect_uri not in redirects:
        raise HTTPException(400, "Redirect URI não autorizado")
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post("https://oauth2.googleapis.com/token", data={
            "code": payload.code,
            "code_verifier": payload.code_verifier,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": payload.redirect_uri,
            "grant_type": "authorization_code",
        })
    if response.status_code != 200:
        raise HTTPException(400, "O Google recusou o código de autorização")
    data = response.json()
    scopes = set(data.get("scope", "").split())
    if not scopes.issuperset(SCOPES):
        raise HTTPException(400, "Autorize Gmail, Agenda e Tarefas para prosseguir")
    if not data.get("refresh_token"):
        raise HTTPException(400, "Google não devolveu refresh token. Remova o acesso anterior e autorize novamente.")
    session = secrets.token_hex(32)
    db.add(GoogleConnection(
        session_hash=hashlib.sha256(session.encode()).hexdigest(),
        encrypted_refresh_token=cipher().encrypt(data["refresh_token"].encode()).decode(),
        scopes=" ".join(sorted(scopes)),
        access_token=cipher().encrypt(data["access_token"].encode()).decode(),
        expires_at=int(time.time()) + int(data.get("expires_in", 3600)),
    ))
    await db.commit()
    return {"session": session}


@router.get("/status")
async def status(authorization: str | None = Header(default=None), db: AsyncSession = Depends(get_db)):
    record = await connected(db, authorization)
    return {"connected": True, "scopes": record.scopes.split()}


@router.delete("")
async def disconnect(authorization: str | None = Header(default=None), db: AsyncSession = Depends(get_db)):
    record = await connected(db, authorization)
    refresh = cipher().decrypt(record.encrypted_refresh_token.encode()).decode()
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            await client.post("https://oauth2.googleapis.com/revoke", data={"token": refresh})
        except httpx.HTTPError:
            pass
    await db.delete(record)
    await db.commit()
    return {"connected": False}


@router.get("/gmail/messages")
async def gmail_messages(q: str = "newer_than:7d", authorization: str | None = Header(default=None), db: AsyncSession = Depends(get_db)):
    record = await connected(db, authorization)
    base = "https://gmail.googleapis.com/gmail/v1/users/me/messages"
    page = await google_get(record, db, base, {"q": q[:200], "maxResults": 10})
    result = []
    for item in page.get("messages", [])[:10]:
        if not str(item.get("id", "")).isalnum():
            continue
        detail = await google_get(record, db, f"{base}/{item['id']}", {
            "format": "metadata", "metadataHeaders": ["Subject", "From", "Date"]})
        headers = {h["name"].lower(): h.get("value", "") for h in detail.get("payload", {}).get("headers", [])}
        result.append({"id": item["id"], "subject": headers.get("subject", "(Sem assunto)")[:180],
                       "from": headers.get("from", "")[:180], "date": headers.get("date", "")[:100],
                       "snippet": detail.get("snippet", "")[:350]})
    return {"messages": result}


@router.get("/calendar/events")
async def calendar_events(start: datetime, end: datetime, authorization: str | None = Header(default=None), db: AsyncSession = Depends(get_db)):
    if not start.tzinfo or not end.tzinfo or not (start < end) or (end - start).days > 31:
        raise HTTPException(400, "Escolha um período de até 31 dias com fuso horário")
    record = await connected(db, authorization)
    data = await google_get(record, db, "https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        "timeMin": start.isoformat(), "timeMax": end.isoformat(), "singleEvents": "true",
        "orderBy": "startTime", "maxResults": 50})
    return {"events": [{"id": e.get("id"), "title": e.get("summary", "(Sem título)")[:180],
                         "description": e.get("description", "")[:2000],
                         "start": e.get("start", {}).get("dateTime", e.get("start", {}).get("date", "")),
                         "end": e.get("end", {}).get("dateTime", e.get("end", {}).get("date", ""))}
                        for e in data.get("items", []) if e.get("id") and e.get("status") != "cancelled"]}


@router.get("/tasks/lists")
async def task_lists(authorization: str | None = Header(default=None), db: AsyncSession = Depends(get_db)):
    record = await connected(db, authorization)
    data = await google_get(record, db, "https://tasks.googleapis.com/tasks/v1/users/@me/lists", {"maxResults": 100})
    return {"lists": [{"id": item["id"], "title": item.get("title", "")} for item in data.get("items", [])]}


@router.get("/tasks/lists/{list_id}")
async def tasks_in_list(list_id: str, authorization: str | None = Header(default=None), db: AsyncSession = Depends(get_db)):
    validate_list_id(list_id)
    record = await connected(db, authorization)
    data = await google_get(record, db, f"https://tasks.googleapis.com/tasks/v1/lists/{quote(list_id, safe='')}/tasks", {
        "maxResults": 100, "showCompleted": "false"})
    return {"tasks": [{"id": item["id"], "title": item.get("title", "(Sem título)")[:180],
                       "notes": item.get("notes", "")[:2000], "due": item.get("due", "")}
                      for item in data.get("items", []) if item.get("id") and item.get("status") != "completed"]}


def validate_list_id(list_id: str) -> None:
    if not list_id or len(list_id) > 256 or not all(char.isascii() and (char.isalnum() or char in "_-+=:@") for char in list_id):
        raise HTTPException(400, "Lista inválida")


def validate_item_id(item_id: str) -> None:
    if not item_id or len(item_id) > 256 or not all(char.isascii() and (char.isalnum() or char in "_-+=:@") for char in item_id):
        raise HTTPException(400, "Identificador do item inválido")


@router.post("/calendar/events")
async def create_event(draft: CalendarDraft, authorization: str | None = Header(default=None), db: AsyncSession = Depends(get_db)):
    if not draft.title.strip():
        raise HTTPException(400, "Informe um título")
    if not draft.start.tzinfo or not draft.end.tzinfo or draft.end <= draft.start or (draft.end - draft.start).days > 7:
        raise HTTPException(400, "Informe começo e fim válidos, com fuso horário e até 7 dias de duração")
    record = await connected(db, authorization)
    result = await google_post(record, db, "https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        "summary": draft.title.strip(), "description": draft.description,
        "start": {"dateTime": draft.start.isoformat()}, "end": {"dateTime": draft.end.isoformat()},
    }, "https://www.googleapis.com/auth/calendar.events")
    return {"id": result.get("id"), "link": result.get("htmlLink", "")}


@router.post("/tasks/lists/{list_id}")
async def create_task(list_id: str, draft: TaskDraft, authorization: str | None = Header(default=None), db: AsyncSession = Depends(get_db)):
    validate_list_id(list_id)
    if not draft.title.strip():
        raise HTTPException(400, "Informe um título")
    record = await connected(db, authorization)
    result = await google_post(record, db, f"https://tasks.googleapis.com/tasks/v1/lists/{quote(list_id, safe='')}/tasks", {
        "title": draft.title.strip(), "notes": draft.notes,
    }, "https://www.googleapis.com/auth/tasks")
    return {"id": result.get("id")}


@router.patch("/calendar/events/{event_id}")
async def update_event(event_id: str, draft: CalendarUpdate, authorization: str | None = Header(default=None), db: AsyncSession = Depends(get_db)):
    validate_item_id(event_id)
    if draft.title is not None and not draft.title.strip():
        raise HTTPException(400, "Informe um título")
    changes = draft.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(400, "Nenhuma alteração informada")
    if any(value is None for value in changes.values()):
        raise HTTPException(400, "Campos da alteração não podem ser nulos")
    if "start" in changes or "end" in changes:
        if not draft.start or not draft.end or not draft.start.tzinfo or not draft.end.tzinfo or draft.end <= draft.start or (draft.end - draft.start).days > 7:
            raise HTTPException(400, "Informe começo e fim válidos, com fuso horário e até 7 dias de duração")
        changes["start"] = {"dateTime": draft.start.isoformat()}
        changes["end"] = {"dateTime": draft.end.isoformat()}
    if "title" in changes:
        changes["summary"] = changes.pop("title").strip()
    record = await connected(db, authorization)
    result = await google_mutate(record, db, f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{quote(event_id, safe='')}", "PATCH", "https://www.googleapis.com/auth/calendar.events", changes)
    return {"id": result.get("id"), "link": result.get("htmlLink", "")}


@router.delete("/calendar/events/{event_id}")
async def delete_event(event_id: str, authorization: str | None = Header(default=None), db: AsyncSession = Depends(get_db)):
    validate_item_id(event_id)
    record = await connected(db, authorization)
    await google_mutate(record, db, f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{quote(event_id, safe='')}", "DELETE", "https://www.googleapis.com/auth/calendar.events")
    return {"deleted": True}


@router.patch("/tasks/lists/{list_id}/tasks/{task_id}")
async def update_task(list_id: str, task_id: str, draft: TaskUpdate, authorization: str | None = Header(default=None), db: AsyncSession = Depends(get_db)):
    validate_list_id(list_id)
    validate_item_id(task_id)
    if draft.title is not None and not draft.title.strip():
        raise HTTPException(400, "Informe um título")
    changes = draft.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(400, "Nenhuma alteração informada")
    if any(value is None for value in changes.values()):
        raise HTTPException(400, "Campos da alteração não podem ser nulos")
    if "title" in changes:
        changes["title"] = changes["title"].strip()
    record = await connected(db, authorization)
    result = await google_mutate(record, db, f"https://tasks.googleapis.com/tasks/v1/lists/{quote(list_id, safe='')}/tasks/{quote(task_id, safe='')}", "PATCH", "https://www.googleapis.com/auth/tasks", changes)
    return {"id": result.get("id")}


@router.delete("/tasks/lists/{list_id}/tasks/{task_id}")
async def delete_task(list_id: str, task_id: str, authorization: str | None = Header(default=None), db: AsyncSession = Depends(get_db)):
    validate_list_id(list_id)
    validate_item_id(task_id)
    record = await connected(db, authorization)
    await google_mutate(record, db, f"https://tasks.googleapis.com/tasks/v1/lists/{quote(list_id, safe='')}/tasks/{quote(task_id, safe='')}", "DELETE", "https://www.googleapis.com/auth/tasks")
    return {"deleted": True}


@router.post("/gmail/send")
async def send_email(draft: EmailDraft, authorization: str | None = Header(default=None), db: AsyncSession = Depends(get_db)):
    record = await connected(db, authorization)
    email = EmailMessage()
    email["To"] = str(draft.to)
    email["Subject"] = draft.subject.replace("\r", " ").replace("\n", " ")
    email.set_content(draft.body)
    raw = base64.urlsafe_b64encode(email.as_bytes()).decode().rstrip("=")
    result = await google_post(record, db, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        "raw": raw,
    }, "https://www.googleapis.com/auth/gmail.send")
    return {"id": result.get("id")}
