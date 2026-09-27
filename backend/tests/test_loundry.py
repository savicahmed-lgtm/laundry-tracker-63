"""Backend tests for Loundry Suci API.

Covers auth, catalog, order create/pay, status progression (admin-only),
courier tracking, feedback, and authorization edge cases.
"""
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

DEMO_CUSTOMER = {"phone": "081211112222", "password": "password123"}
ADMIN = {"phone": "081200000000", "password": "admin123"}


# ------------------------------- fixtures ---------------------------------- #
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def customer_token(session):
    r = session.post(f"{API}/auth/login", json=DEMO_CUSTOMER, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def second_customer(session):
    """Register a fresh secondary customer for authorization tests."""
    phone = f"0812{uuid.uuid4().int % 10**8:08d}"
    body = {"phone": phone, "password": "pass1234", "name": "TEST_Second", "address": "TEST"}
    r = session.post(f"{API}/auth/register", json=body, timeout=30)
    assert r.status_code == 200, r.text
    return {"token": r.json()["access_token"], "phone": phone, "user": r.json()["user"]}


# ------------------------------- health / catalog -------------------------- #
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_catalog(self, session):
        r = session.get(f"{API}/catalog", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert len(data["items"]) == 12
        assert data["points_per_redeem"] == 25
        keys = {i["key"] for i in data["items"]}
        for k in ["karpet", "kaos", "kemeja", "celana", "sepatu", "gaun",
                  "topi", "tas", "bedcover", "sprei", "helm", "boneka"]:
            assert k in keys


# ------------------------------- auth -------------------------------------- #
class TestAuth:
    def test_login_demo_customer(self, session):
        r = session.post(f"{API}/auth/login", json=DEMO_CUSTOMER, timeout=30)
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["phone"] == "081211112222"
        assert u["role"] == "customer"
        assert u["points"] >= 0

    def test_login_admin(self, session):
        r = session.post(f"{API}/auth/login", json=ADMIN, timeout=30)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "admin"

    def test_login_wrong_password(self, session):
        r = session.post(f"{API}/auth/login",
                         json={"phone": DEMO_CUSTOMER["phone"], "password": "wrong"}, timeout=30)
        assert r.status_code == 401

    def test_me_requires_token(self, session):
        r = session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_with_token(self, session, customer_token):
        r = session.get(f"{API}/auth/me", headers=_auth_headers(customer_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["phone"] == "081211112222"

    def test_patch_me(self, session, customer_token):
        r = session.patch(f"{API}/auth/me",
                          headers=_auth_headers(customer_token),
                          json={"address": "Jl. Melati No. 12, Jakarta"}, timeout=15)
        assert r.status_code == 200
        assert "Jl. Melati" in r.json()["address"]

    def test_register_duplicate(self, session):
        r = session.post(f"{API}/auth/register",
                         json={"phone": "081211112222", "password": "xxxx",
                               "name": "dup", "address": ""}, timeout=15)
        assert r.status_code == 409


# ------------------------------- orders ------------------------------------ #
class TestOrderFlow:
    """Full happy-path: create -> pay -> admin advance -> feedback."""

    order_id = None
    initial_points = None

    def test_create_order_with_redemption(self, session, customer_token):
        # snapshot points
        me = session.get(f"{API}/auth/me", headers=_auth_headers(customer_token)).json()
        TestOrderFlow.initial_points = me["points"]
        assert me["points"] >= 25, "Demo customer needs >=25 points for redemption test"

        body = {
            "items": [{"key": "kaos", "qty": 3}, {"key": "kemeja", "qty": 2}],
            "service": "pickup",
            "address": "Jl. Test 1",
            "note": "TEST order",
            "use_points": True,
        }
        r = session.post(f"{API}/orders", headers=_auth_headers(customer_token),
                         json=body, timeout=20)
        assert r.status_code == 200, r.text
        o = r.json()
        # subtotal = 3*5000 + 2*6000 = 27000
        assert o["subtotal"] == 27000
        assert o["discount"] == 7000  # FREE_KG_VALUE
        assert o["total"] == 20000
        assert o["use_points"] is True
        assert o["status"] == "diterima"
        assert o["paid"] is False
        assert o["points_earned"] >= 1
        assert "destination" in o and "branch" in o
        TestOrderFlow.order_id = o["id"]

    def test_get_order_persisted(self, session, customer_token):
        assert TestOrderFlow.order_id
        r = session.get(f"{API}/orders/{TestOrderFlow.order_id}",
                        headers=_auth_headers(customer_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["total"] == 20000

    def test_list_orders_customer_only_own(self, session, customer_token):
        r = session.get(f"{API}/orders", headers=_auth_headers(customer_token), timeout=15)
        assert r.status_code == 200
        for o in r.json():
            assert o["customer_phone"] == "081211112222"

    def test_pay_order(self, session, customer_token):
        r = session.post(f"{API}/orders/{TestOrderFlow.order_id}/pay",
                         headers=_auth_headers(customer_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "lunas"
        assert r.json()["paid"] is True

    def test_points_after_pay(self, session, customer_token):
        r = session.get(f"{API}/auth/me", headers=_auth_headers(customer_token)).json()
        # Points delta: -25 (redeem) + points_earned
        order = session.get(f"{API}/orders/{TestOrderFlow.order_id}",
                            headers=_auth_headers(customer_token)).json()
        expected = TestOrderFlow.initial_points - 25 + order["points_earned"]
        assert r["points"] == expected, f"expected {expected}, got {r['points']}"

    def test_double_pay_rejected(self, session, customer_token):
        r = session.post(f"{API}/orders/{TestOrderFlow.order_id}/pay",
                         headers=_auth_headers(customer_token), timeout=15)
        assert r.status_code == 400

    # --- admin status progression ---
    def test_customer_cannot_advance_status(self, session, customer_token):
        r = session.patch(f"{API}/orders/{TestOrderFlow.order_id}/status",
                          headers=_auth_headers(customer_token),
                          json={"status": "dicuci"}, timeout=15)
        assert r.status_code == 403

    def test_admin_non_sequential_rejected(self, session, admin_token):
        r = session.patch(f"{API}/orders/{TestOrderFlow.order_id}/status",
                          headers=_auth_headers(admin_token),
                          json={"status": "selesai"}, timeout=15)
        assert r.status_code == 400

    def test_admin_advances_sequentially(self, session, admin_token):
        for s in ["dicuci", "disetrika", "siap", "selesai"]:
            r = session.patch(f"{API}/orders/{TestOrderFlow.order_id}/status",
                              headers=_auth_headers(admin_token),
                              json={"status": s}, timeout=15)
            assert r.status_code == 200, f"{s}: {r.text}"
            assert r.json()["status"] == s

    def test_courier_endpoint(self, session, customer_token):
        r = session.get(f"{API}/orders/{TestOrderFlow.order_id}/courier",
                        headers=_auth_headers(customer_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ["lat", "lng", "progress", "eta_min", "branch", "destination", "service", "status"]:
            assert k in d
        # after selesai progress should be 1
        assert d["progress"] == 1.0

    def test_feedback_success(self, session, customer_token):
        r = session.post(f"{API}/orders/{TestOrderFlow.order_id}/feedback",
                         headers=_auth_headers(customer_token),
                         json={"rating": 5, "comment": "TEST bagus"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["rating"] == 5
        assert r.json()["comment"] == "TEST bagus"


# ------------------------------- edge cases -------------------------------- #
class TestEdgeCases:
    def test_feedback_before_selesai(self, session, customer_token):
        # create a fresh order still in "diterima"
        body = {"items": [{"key": "kaos", "qty": 1}], "service": "branch", "use_points": False}
        r = session.post(f"{API}/orders", headers=_auth_headers(customer_token),
                         json=body, timeout=15)
        oid = r.json()["id"]
        fb = session.post(f"{API}/orders/{oid}/feedback",
                          headers=_auth_headers(customer_token),
                          json={"rating": 4, "comment": "early"}, timeout=15)
        assert fb.status_code == 400

    def test_empty_items_rejected(self, session, customer_token):
        r = session.post(f"{API}/orders", headers=_auth_headers(customer_token),
                         json={"items": [], "service": "branch"}, timeout=15)
        assert r.status_code == 422

    def test_unknown_item_rejected(self, session, customer_token):
        r = session.post(f"{API}/orders", headers=_auth_headers(customer_token),
                         json={"items": [{"key": "unknown", "qty": 1}], "service": "branch"},
                         timeout=15)
        assert r.status_code == 422

    def test_use_points_without_enough_points(self, session, second_customer):
        # New user with 0 points -> use_points should silently be ignored (no discount)
        body = {"items": [{"key": "kaos", "qty": 1}], "service": "branch", "use_points": True}
        r = session.post(f"{API}/orders",
                         headers=_auth_headers(second_customer["token"]),
                         json=body, timeout=15)
        assert r.status_code == 200
        assert r.json()["discount"] == 0
        assert r.json()["use_points"] is False

    def test_cross_customer_access_forbidden(self, session, customer_token, second_customer):
        # customer1 creates order, customer2 tries to fetch
        r = session.post(f"{API}/orders", headers=_auth_headers(customer_token),
                         json={"items": [{"key": "topi", "qty": 1}], "service": "branch"},
                         timeout=15)
        assert r.status_code == 200
        oid = r.json()["id"]
        r2 = session.get(f"{API}/orders/{oid}",
                         headers=_auth_headers(second_customer["token"]), timeout=15)
        assert r2.status_code == 403

    def test_courier_active_when_siap_pickup(self, session, customer_token, admin_token):
        # create pickup order, pay, advance to 'siap', check active=True
        body = {"items": [{"key": "kemeja", "qty": 1}], "service": "pickup", "use_points": False}
        cr = session.post(f"{API}/orders", headers=_auth_headers(customer_token),
                          json=body, timeout=15)
        assert cr.status_code == 200, cr.text
        oid = cr.json()["id"]
        pr = session.post(f"{API}/orders/{oid}/pay",
                          headers=_auth_headers(customer_token), timeout=15)
        assert pr.status_code == 200, pr.text
        for s in ["dicuci", "disetrika", "siap"]:
            sr = session.patch(f"{API}/orders/{oid}/status",
                               headers=_auth_headers(admin_token),
                               json={"status": s}, timeout=15)
            assert sr.status_code == 200, f"{s}: {sr.text}"
        c = session.get(f"{API}/orders/{oid}/courier",
                        headers=_auth_headers(customer_token), timeout=15).json()
        assert c["service"] == "pickup"
        assert c["status"] == "siap"
        assert c["active"] is True

    def test_admin_can_see_all_orders(self, session, admin_token):
        r = session.get(f"{API}/orders", headers=_auth_headers(admin_token), timeout=15)
        assert r.status_code == 200
        phones = {o["customer_phone"] for o in r.json()}
        # at least demo customer's phone
        assert "081211112222" in phones
