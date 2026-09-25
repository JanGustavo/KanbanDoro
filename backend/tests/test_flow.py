import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.main import app


@pytest.mark.asyncio
async def test_auth_and_task_session_flow(tmp_path, monkeypatch):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'test.db'}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False)

    async def database_override():
        async with maker() as db:
            yield db

    app.dependency_overrides[get_db] = database_override
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            assert (await client.get("/tasks")).status_code == 401
            user = await client.post("/auth/register", json={"email": "one@example.com", "password": "password123"})
            assert user.status_code == 201, user.text
            other = await client.post("/auth/register", json={"email": "two@example.com", "password": "password123"})
            assert other.status_code == 201, other.text
            login = await client.post("/auth/login", data={"username": "one@example.com", "password": "password123"})
            assert login.status_code == 200, login.text
            token = login.json()["access_token"]
            client.headers["Authorization"] = f"Bearer {token}"
            assert (await client.get("/auth/me")).status_code == 200
            task = await client.post("/tasks", json={"name": "Build UI", "estimate": 2})
            assert task.status_code == 201, task.text
            task_id = task.json()["id"]
            slice_response = await client.post(f"/tasks/{task_id}/slices", json={"name": "Make cards"})
            assert slice_response.status_code == 201, slice_response.text
            slice_id = slice_response.json()["id"]
            assert (await client.post("/sessions", json={"task_id": "wrong", "original_minutes": 2})).status_code == 404
            session = await client.post("/sessions", json={"task_id": task_id, "scope": "slices", "selected_slice_ids": [slice_id], "original_minutes": 2})
            assert session.status_code == 201, session.text
            session_id = session.json()["id"]
            assert session.json()["selected_slice_ids"] == [slice_id]
            assert 119_000 <= session.json()["ends_at"] - session.json()["started_at"] <= 120_000
            assert (await client.post("/sessions", json={"task_id": task_id, "original_minutes": 2})).status_code == 409
            assert (await client.post(f"/sessions/{session_id}/extend", json={"minutes": 1})).status_code == 409
            resolve = await client.post(f"/sessions/{session_id}/resolve", json={"outcome": "interrupted"})
            assert resolve.status_code == 200, resolve.text
            assert resolve.json()["phase"] == "finished"
            history = await client.get("/sessions/history")
            assert history.status_code == 200, history.text
            assert history.json()[0]["slice_ids"] == [slice_id]

            retry = await client.post("/sessions", json={"task_id": task_id, "original_minutes": 2})
            retry_id = retry.json()["id"]
            monkeypatch.setattr("app.services.session_service.millis_now", lambda: retry.json()["ends_at"] + 1_000)
            extension = await client.post(f"/sessions/{retry_id}/extend", json={"minutes": 1})
            assert extension.status_code == 200, extension.text
            assert extension.json()["extensions"] == 1
            assert (await client.post(f"/sessions/{retry_id}/extend", json={"minutes": 1})).status_code == 409
            monkeypatch.setattr("app.services.session_service.millis_now", lambda: extension.json()["ends_at"] + 1_000)
            failure = await client.post(f"/sessions/{retry_id}/resolve", json={"outcome": "failed"})
            assert failure.status_code == 200, failure.text
            assert (await client.post(f"/sessions/{retry_id}/resolve", json={"outcome": "failed"})).status_code == 409
            updated = (await client.get(f"/tasks/{task_id}")).json()
            assert updated["column"] == "late" and updated["failures"] == 1
            pause = await client.post(f"/sessions/{retry_id}/break", json={"name": "Água", "minutes": 5})
            assert pause.status_code == 200, pause.text
            assert pause.json()["phase"] == "break"
            assert (await client.post(f"/sessions/{retry_id}/finish")).json()["phase"] == "finished"

            second_slice = await client.post(f"/tasks/{task_id}/slices", json={"name": "Polish cards"})
            assert second_slice.status_code == 201
            subset = await client.post("/sessions", json={"task_id": task_id, "scope": "slices", "selected_slice_ids": [slice_id], "original_minutes": 2})
            assert subset.status_code == 201, subset.text
            finished_subset = await client.post(f"/sessions/{subset.json()['id']}/resolve", json={"outcome": "completed"})
            assert finished_subset.status_code == 200, finished_subset.text
            subset_task = (await client.get(f"/tasks/{task_id}")).json()
            assert subset_task["column"] == "doing"
            assert {item["id"]: item["done"] for item in subset_task["slices"]} == {slice_id: True, second_slice.json()["id"]: False}

            second_login = await client.post("/auth/login", data={"username": "two@example.com", "password": "password123"})
            client.headers["Authorization"] = f"Bearer {second_login.json()['access_token']}"
            assert (await client.get(f"/tasks/{task_id}")).status_code == 404
            assert (await client.get("/sessions/active")).json() is None
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()
