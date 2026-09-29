from decimal import Decimal
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.api import support
from app.api.support import crc16, pix_payload
from app.main import app


def test_pix_crc_and_amount():
    payload = pix_payload("recipient@example.com", "KANBANDORO", "SAO PAULO", Decimal("5.00"))
    assert "54045.00" in payload
    assert "br.gov.bcb.pix" in payload
    assert payload[-4:] == crc16(payload[:-4])


def test_pix_does_not_claim_payment_without_configuration():
    with TestClient(app) as client:
        response = client.get("/support/pix", params={"amount": "5.00"})
    assert response.status_code == 503


def test_pix_rejects_invalid_amount_before_generating_code():
    with TestClient(app) as client:
        response = client.get("/support/pix", params={"amount": "1e3"})
    assert response.status_code == 422


def test_pix_returns_real_qr_and_copy_paste(monkeypatch):
    monkeypatch.setattr(support, "get_settings", lambda: SimpleNamespace(
        pix_key="recipient@example.com", pix_receiver_name="KANBANDORO", pix_receiver_city="SAO PAULO"
    ))
    with TestClient(app) as client:
        response = client.get("/support/pix", params={"amount": "10.50"})
    assert response.status_code == 200
    data = response.json()
    assert "540510.50" in data["payload"]
    assert data["qrCode"].startswith("data:image/png;base64,iVBOR")
