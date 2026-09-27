"""Backend tests for NEW iteration features:
  - GET /api/promos (3 seeded promos)
  - GET /api/points/history (balance + transactions; earn+redeem txns on pay)
  - Order create returns estimated_ready_at (ISO)
  - Photos: POST /api/upload (auth) -> {path}; GET /api/files/{path}?token= -> bytes;
            POST /api/orders/{id}/photos (ADMIN ONLY, 403 for customer);
            photos on order.photos[]
"""
import io
import os
import re
import base64
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

DEMO_CUSTOMER = {"phone": "081211112222", "password": "password123"}
ADMIN = {"phone": "081200000000", "password": "admin123"}

ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")

# 1x1 PNG
_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def customer_token():
    r = requests.post(f"{API}/auth/login", json=DEMO_CUSTOMER, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


# --------------------------------------------------------------------------- #
# Promos
# --------------------------------------------------------------------------- #
class TestPromos:
    def test_promos_public(self):
        # spec says GET /api/promos returns seeded promos; check no-auth works
        r = requests.get(f"{API}/promos", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 3, f"expected >=3 promos, got {len(data)}"

    def test_promos_shape(self):
        r = requests.get(f"{API}/promos", timeout=15).json()
        for p in r:
            for k in ("id", "title", "subtitle", "badge", "image"):
                assert k in p, f"missing {k} in promo {p}"
            assert isinstance(p["title"], str) and p["title"]


# --------------------------------------------------------------------------- #
# Points history
# --------------------------------------------------------------------------- #
class TestPointsHistory:
    def test_requires_auth(self):
        r = requests.get(f"{API}/points/history", timeout=15)
        assert r.status_code == 401

    def test_shape(self, customer_token):
        r = requests.get(f"{API}/points/history", headers=_hdr(customer_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "balance" in data and isinstance(data["balance"], int)
        assert "transactions" in data and isinstance(data["transactions"], list)
        for t in data["transactions"]:
            for k in ("id", "type", "delta", "reason", "created_at"):
                assert k in t
            assert t["type"] in ("earn", "redeem")

    def test_earn_and_redeem_recorded_on_pay(self, customer_token):
        """Create order with use_points=True, pay, then verify BOTH earn AND redeem
        transactions are appended to points/history and balance changes correctly."""
        # Make sure demo customer has >=25 points (conftest sets to 30, but tests may have run before).
        before = requests.get(f"{API}/points/history", headers=_hdr(customer_token)).json()
        before_bal = before["balance"]
        before_len = len(before["transactions"])
        if before_bal < 25:
            pytest.skip(f"demo customer only has {before_bal} points, need 25")

        body = {"items": [{"key": "kaos", "qty": 3}, {"key": "kemeja", "qty": 2}],
                "service": "branch", "use_points": True}
        cr = requests.post(f"{API}/orders", headers=_hdr(customer_token), json=body, timeout=20)
        assert cr.status_code == 200, cr.text
        order = cr.json()
        assert order["use_points"] is True
        oid = order["id"]
        earned = order["points_earned"]

        pr = requests.post(f"{API}/orders/{oid}/pay", headers=_hdr(customer_token), timeout=20)
        assert pr.status_code == 200, pr.text

        after = requests.get(f"{API}/points/history", headers=_hdr(customer_token)).json()
        # Two new txns: earn + redeem
        assert len(after["transactions"]) == before_len + 2, (before_len, len(after["transactions"]))
        recent = after["transactions"][:2]
        types = {t["type"] for t in recent}
        assert types == {"earn", "redeem"}
        earn_txn = next(t for t in recent if t["type"] == "earn")
        redeem_txn = next(t for t in recent if t["type"] == "redeem")
        assert earn_txn["delta"] == earned
        assert redeem_txn["delta"] == -25
        # Balance delta = earned - 25
        assert after["balance"] == before_bal - 25 + earned


# --------------------------------------------------------------------------- #
# Estimated ready at
# --------------------------------------------------------------------------- #
class TestEstimatedReady:
    def test_order_create_returns_iso(self, customer_token):
        body = {"items": [{"key": "kaos", "qty": 1}], "service": "branch", "use_points": False}
        r = requests.post(f"{API}/orders", headers=_hdr(customer_token), json=body, timeout=15)
        assert r.status_code == 200, r.text
        o = r.json()
        assert "estimated_ready_at" in o and o["estimated_ready_at"], "missing estimated_ready_at"
        assert ISO_RE.match(o["estimated_ready_at"]), f"not iso: {o['estimated_ready_at']}"

    def test_order_get_persisted_estimate(self, customer_token):
        body = {"items": [{"key": "karpet", "qty": 4}], "service": "pickup", "use_points": False}
        r = requests.post(f"{API}/orders", headers=_hdr(customer_token), json=body, timeout=15).json()
        oid, est = r["id"], r["estimated_ready_at"]
        g = requests.get(f"{API}/orders/{oid}", headers=_hdr(customer_token)).json()
        # Mongo persists ms-precision; compare truncated to seconds.
        from datetime import datetime
        def _sec(s):
            return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None, microsecond=0)
        assert _sec(g["estimated_ready_at"]) == _sec(est)


# --------------------------------------------------------------------------- #
# Photos / object storage
# --------------------------------------------------------------------------- #
class TestPhotos:
    @pytest.fixture(scope="class")
    def new_order(self, customer_token):
        body = {"items": [{"key": "kaos", "qty": 1}], "service": "branch", "use_points": False}
        r = requests.post(f"{API}/orders", headers=_hdr(customer_token), json=body, timeout=15)
        assert r.status_code == 200, r.text
        return r.json()

    def test_upload_requires_auth(self):
        r = requests.post(f"{API}/upload",
                          files={"file": ("t.png", io.BytesIO(base64.b64decode(_PNG_B64)), "image/png")},
                          timeout=20)
        assert r.status_code in (401, 403)

    def test_upload_ok_as_customer(self, customer_token):
        r = requests.post(
            f"{API}/upload",
            headers=_hdr(customer_token),
            files={"file": ("t.png", io.BytesIO(base64.b64decode(_PNG_B64)), "image/png")},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "path" in data and data["path"], data

    def test_download_requires_token(self, customer_token):
        # Upload first
        up = requests.post(
            f"{API}/upload", headers=_hdr(customer_token),
            files={"file": ("t.png", io.BytesIO(base64.b64decode(_PNG_B64)), "image/png")},
            timeout=30,
        ).json()
        path = up["path"]

        # Without token -> 401
        r_no = requests.get(f"{API}/files/{path}", timeout=15)
        assert r_no.status_code == 401

        # With token as query param -> 200 bytes
        r_ok = requests.get(f"{API}/files/{path}", params={"token": customer_token}, timeout=15)
        assert r_ok.status_code == 200, r_ok.text[:200]
        assert r_ok.content and len(r_ok.content) > 0
        assert r_ok.headers.get("content-type", "").startswith("image/")

        # With Authorization header -> 200
        r_hdr = requests.get(f"{API}/files/{path}", headers=_hdr(customer_token), timeout=15)
        assert r_hdr.status_code == 200

    def test_customer_cannot_add_photos(self, customer_token, new_order):
        up = requests.post(
            f"{API}/upload", headers=_hdr(customer_token),
            files={"file": ("t.png", io.BytesIO(base64.b64decode(_PNG_B64)), "image/png")},
            timeout=30,
        ).json()
        r = requests.post(
            f"{API}/orders/{new_order['id']}/photos",
            headers=_hdr(customer_token),
            json={"paths": [up["path"]]},
            timeout=15,
        )
        assert r.status_code == 403, r.text

    def test_admin_adds_photos_and_customer_sees_them(self, customer_token, admin_token, new_order):
        # admin uploads (upload is auth-only, admin allowed too)
        up = requests.post(
            f"{API}/upload", headers=_hdr(admin_token),
            files={"file": ("admin.png", io.BytesIO(base64.b64decode(_PNG_B64)), "image/png")},
            timeout=30,
        ).json()
        path = up["path"]
        r = requests.post(
            f"{API}/orders/{new_order['id']}/photos",
            headers=_hdr(admin_token),
            json={"paths": [path]},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert path in r.json().get("photos", []), r.json()

        # customer GETs the order and sees photo in list
        g = requests.get(f"{API}/orders/{new_order['id']}", headers=_hdr(customer_token)).json()
        assert path in g.get("photos", [])

        # append second photo, both remain
        up2 = requests.post(
            f"{API}/upload", headers=_hdr(admin_token),
            files={"file": ("admin2.png", io.BytesIO(base64.b64decode(_PNG_B64)), "image/png")},
            timeout=30,
        ).json()
        r2 = requests.post(
            f"{API}/orders/{new_order['id']}/photos",
            headers=_hdr(admin_token),
            json={"paths": [up2["path"]]},
            timeout=15,
        )
        assert r2.status_code == 200
        assert r2.json()["photos"] == [path, up2["path"]]

    def test_photos_endpoint_nonexistent_order(self, admin_token):
        r = requests.post(
            f"{API}/orders/nonexistent-id/photos",
            headers=_hdr(admin_token),
            json={"paths": ["x/y.jpg"]},
            timeout=15,
        )
        assert r.status_code == 404
