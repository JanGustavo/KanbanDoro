"""Cópia consistente de SQLite ativo via sqlite3.backup. Execute no container."""
import argparse
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import get_settings


def main():
    parser = argparse.ArgumentParser(description='Cria backup consistente do SQLite KanbanDoro')
    parser.add_argument('destination', type=Path, help='Diretório de destino, fora do volume de dados')
    args = parser.parse_args()
    url = get_settings().database_url
    prefix = 'sqlite+aiosqlite:///'
    if not url.startswith(prefix):
        parser.error('DATABASE_URL deve ser SQLite para este utilitário')
    source = Path(url[len(prefix):])
    if not source.is_file():
        parser.error(f'Banco não encontrado: {source}')
    args.destination.mkdir(parents=True, exist_ok=True)
    target = args.destination / f"kanbandoro-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.db"
    with sqlite3.connect(f'file:{source}?mode=ro', uri=True) as db, sqlite3.connect(target) as copy:
        db.backup(copy)
        if copy.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            target.unlink(missing_ok=True)
            parser.error('Backup falhou na verificação de integridade')
    print(target)


if __name__ == '__main__':
    main()
