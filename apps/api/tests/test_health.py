from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_ok():
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["version"]


def test_health_db_reports_status():
    res = client.get("/api/v1/health/db")
    assert res.status_code == 200
    assert res.json()["database"] in {"ok", "unavailable"}
