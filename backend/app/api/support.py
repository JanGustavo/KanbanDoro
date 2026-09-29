"""Optional static Pix QR for voluntary support; never claims payment confirmation."""

import base64
import io
import re
from decimal import Decimal, InvalidOperation

import qrcode
from fastapi import APIRouter, HTTPException, Query

from app.core.config import get_settings

router = APIRouter(prefix="/support", tags=["support"])


def field(identifier: str, value: str) -> str:
    length = len(value.encode("utf-8"))
    if length > 99:
        raise ValueError("Pix field exceeds the BR Code limit")
    return f"{identifier}{length:02d}{value}"


def crc16(data: str) -> str:
    crc = 0xFFFF
    for byte in data.encode("utf-8"):
        crc ^= byte << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return f"{crc:04X}"


def pix_payload(key: str, name: str, city: str, amount: Decimal) -> str:
    # Static Pix / BR Code. Recipient details must match the registered Pix key.
    if not (1 <= len(name) <= 25 and 1 <= len(city) <= 15):
        raise ValueError("Pix recipient name or city exceeds the BR Code limit")
    merchant = field("00", "br.gov.bcb.pix") + field("01", key)
    body = "".join([
        field("00", "01"), field("26", merchant), field("52", "0000"),
        field("53", "986"), field("54", f"{amount:.2f}"), field("58", "BR"),
        field("59", name), field("60", city), field("62", field("05", "***")),
        "6304",
    ])
    return body + crc16(body)


@router.get("/pix")
def get_pix(amount: str = Query(..., max_length=10)):
    if not re.fullmatch(r"[0-9]{1,5}(\.[0-9]{1,2})?", amount):
        raise HTTPException(status_code=422, detail="Valor inválido.")
    try:
        value = Decimal(amount)
    except InvalidOperation:
        raise HTTPException(status_code=422, detail="Valor inválido.") from None
    if not Decimal("1.00") <= value <= Decimal("99999.99"):
        raise HTTPException(status_code=422, detail="Valor fora do intervalo permitido.")
    settings = get_settings()
    if not (settings.pix_key and settings.pix_receiver_name and settings.pix_receiver_city):
        raise HTTPException(status_code=503, detail="Apoio por Pix ainda não configurado.")
    try:
        payload = pix_payload(settings.pix_key, settings.pix_receiver_name, settings.pix_receiver_city, value)
    except ValueError:
        raise HTTPException(status_code=503, detail="Configuração Pix inválida.") from None
    image = qrcode.make(payload)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return {"payload": payload, "qrCode": "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")}
