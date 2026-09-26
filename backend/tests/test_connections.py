import pytest
from cryptography.fernet import Fernet
from httpx import ASGITransport, AsyncClient, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api import connections
from app.core.config import Settings
from app.core.database import Base, get_db
from app.main import app
from app.models.google_connection_model import GoogleConnection


@pytest.mark.asyncio
async def test_google_exchange_and_read_only_connections(tmp_path, monkeypatch):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'oauth.db'}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False)

    async def database_override():
        async with maker() as db:
            yield db

    settings = Settings(
        google_client_id="public.apps.googleusercontent.com",
        google_client_secret="secret-server-only",
        google_extension_id="abcdefghijklmnoabcdefghijklmnoa",
        google_token_encryption_key=Fernet.generate_key().decode(),
    )
    monkeypatch.setattr(connections, "get_settings", lambda: settings)
    calls = []

    async def fake_post(url, data=None, **kwargs):
        calls.append((url, data))
        if url.endswith('/token'):
            return Response(200, json={"access_token": "google-secret-access", "refresh_token": "google-secret-refresh",
                "expires_in": 3600, "scope": " ".join(sorted(connections.SCOPES))})
        if url.endswith('/messages/send'):
            import base64

            raw = kwargs['json']['raw']
            decoded = base64.urlsafe_b64decode(raw + '=' * (-len(raw) % 4)).decode()
            assert 'Subject: Teste' in decoded and 'To: destino@example.com' in decoded
            return Response(200, json={'id': 'sent-mail'})
        return Response(200, json={'id': 'created-item', 'htmlLink': 'https://calendar.google.com/'})

    async def fake_get(url, params=None, **kwargs):
        calls.append((url, params))
        assert kwargs['headers']['Authorization'] == 'Bearer google-secret-access'
        if url.endswith('/messages'):
            return Response(200, json={"messages": [{"id": "123abc"}]})
        if '/messages/' in url:
            return Response(200, json={"id": "123abc", "snippet": "Trecho", "payload": {"headers": [{"name": "Subject", "value": "Assunto"}]}})
        if url.endswith('/events'):
            return Response(200, json={"items": [{"id": "event1", "summary": "Reunião", "start": {"date": "2026-09-26"}}]})
        if url.endswith('/lists'):
            return Response(200, json={"items": [{"id": "list1", "title": "Pessoal"}]})
        return Response(200, json={"items": [{"id": "task1", "title": "Estudar"}]})

    class GoogleClient:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            pass

        post = staticmethod(fake_post)
        get = staticmethod(fake_get)

    monkeypatch.setattr(connections.httpx, "AsyncClient", GoogleClient)
    app.dependency_overrides[get_db] = database_override
    redirect = f"https://{settings.google_extension_id}.chromiumapp.org/"
    payload = {"code": "authorization-code", "code_verifier": "x" * 43, "redirect_uri": redirect}
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            assert (await client.post("/connections/google/exchange", json={**payload, "redirect_uri": "https://attacker.chromiumapp.org/"})).status_code == 400
            assert not calls
            exchanged = await client.post("/connections/google/exchange", json=payload)
            assert exchanged.status_code == 200, exchanged.text
            assert calls[0][1]["code_verifier"] == "x" * 43
            assert calls[0][1]["client_secret"] == "secret-server-only"
            session = exchanged.json()["session"]
            assert "google-secret" not in str(exchanged.json())
            async with maker() as db:
                stored = (await db.scalars(select(GoogleConnection))).one()
                assert "google-secret" not in stored.encrypted_refresh_token
                assert "google-secret" not in stored.access_token
                stored.expires_at = 0
                await db.commit()
            client.headers["Authorization"] = f"Bearer {session}"
            assert (await client.get("/connections/google/status")).json()["connected"]
            assert (await client.get("/connections/google/gmail/messages")).json()["messages"][0]["subject"] == "Assunto"
            assert len([call for call in calls if call[0].endswith('/token')]) == 2, "expired access tokens must refresh on the server"
            assert (await client.get("/connections/google/calendar/events", params={"start": "2026-09-26T00:00:00Z", "end": "2026-09-27T00:00:00Z"})).json()["events"][0]["title"] == "Reunião"
            assert (await client.get("/connections/google/tasks/lists")).json()["lists"][0]["title"] == "Pessoal"
            assert (await client.get("/connections/google/tasks/lists/list1")).json()["tasks"][0]["title"] == "Estudar"
            assert (await client.post("/connections/google/calendar/events", json={"title": "Reunião", "description": "Discussão", "start": "2026-09-26T14:00:00-03:00", "end": "2026-09-26T15:00:00-03:00"})).json()["id"] == "created-item"
            assert (await client.post("/connections/google/tasks/lists/list1", json={"title": "Estudar", "notes": "Linux"})).json()["id"] == "created-item"
            assert (await client.post("/connections/google/gmail/send", json={"to": "destino@example.com", "subject": "Teste", "body": "Olá"})).json()["id"] == "sent-mail"
            assert (await client.post("/connections/google/gmail/send", json={"to": "destino@example.com", "subject": "Teste", "body": ""})).status_code == 422
            assert (await client.post("/connections/google/calendar/events", json={"title": "Inválido", "start": "2026-09-26T15:00:00Z", "end": "2026-09-26T14:00:00Z"})).status_code == 400
            assert (await client.get("/connections/google/tasks/lists/bad%21list")).status_code == 400
            assert (await client.delete("/connections/google")).status_code == 200
            assert (await client.get("/connections/google/status")).status_code == 401
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()
