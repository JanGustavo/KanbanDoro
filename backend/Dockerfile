FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN groupadd -r kanbandoro && useradd -r -g kanbandoro -d /app kanbandoro
COPY pyproject.toml README.md ./
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./alembic.ini
RUN python -m pip install --no-cache-dir .
RUN mkdir /data && chown kanbandoro:kanbandoro /data
USER kanbandoro
EXPOSE 8000
CMD ["sh", "-c", "alembic -c alembic.ini upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --proxy-headers --forwarded-allow-ips=127.0.0.1"]
