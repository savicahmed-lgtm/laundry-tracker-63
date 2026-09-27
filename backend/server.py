from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import math
import hashlib
import logging
import uuid
import requests
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ.get("JWT_SECRET", "loundry-suci-dev-secret-change-me")
JWT_ALGO = "HS256"
JWT_DAYS = 30

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)

# --------------------------------------------------------------------------- #
# Object storage (Emergent managed)
# --------------------------------------------------------------------------- #
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "loundry-suci"
_storage_key: Optional[str] = None


def init_storage():
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


app = FastAPI()
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("loundry")

# --------------------------------------------------------------------------- #
# Constants
# --------------------------------------------------------------------------- #
POINTS_PER_REDEEM = 25
FREE_KG_VALUE = 7000  # Rp value of 1 free kg when redeeming points

# Branches (nearest branches shown to the customer for drop-off).
BRANCHES = [
    {"id": "pusat", "name": "Cabang Pusat", "address": "Jl. Merdeka No. 1, Jakarta Pusat", "lat": -6.21462, "lng": 106.84513},
    {"id": "selatan", "name": "Cabang Selatan", "address": "Jl. Fatmawati No. 25, Jakarta Selatan", "lat": -6.29180, "lng": 106.79790},
    {"id": "timur", "name": "Cabang Timur", "address": "Jl. Pemuda No. 10, Jakarta Timur", "lat": -6.19750, "lng": 106.89500},
]
BRANCH_BY_ID = {b["id"]: b for b in BRANCHES}
BRANCH = BRANCHES[0]  # courier origin (pusat)

# Pricing: helm/sepatu/karpet are per-piece (satuan); everything else is per-kg (kiloan).
CATALOG = [
    {"key": "karpet", "name": "Karpet", "pricing": "satuan", "price": 25000, "icon": "grid-outline"},
    {"key": "sepatu", "name": "Sepatu", "pricing": "satuan", "price": 25000, "icon": "footsteps-outline"},
    {"key": "helm", "name": "Helm", "pricing": "satuan", "price": 20000, "icon": "bicycle-outline"},
    {"key": "kaos", "name": "Kaos", "pricing": "kiloan", "price": 0, "icon": "shirt-outline"},
    {"key": "kemeja", "name": "Kemeja", "pricing": "kiloan", "price": 0, "icon": "shirt-outline"},
    {"key": "celana", "name": "Celana", "pricing": "kiloan", "price": 0, "icon": "man-outline"},
    {"key": "gaun", "name": "Gaun", "pricing": "kiloan", "price": 0, "icon": "woman-outline"},
    {"key": "topi", "name": "Topi", "pricing": "kiloan", "price": 0, "icon": "medical-outline"},
    {"key": "tas", "name": "Tas", "pricing": "kiloan", "price": 0, "icon": "bag-handle-outline"},
    {"key": "bedcover", "name": "Bed Cover", "pricing": "kiloan", "price": 0, "icon": "bed-outline"},
    {"key": "sprei", "name": "Sprei", "pricing": "kiloan", "price": 0, "icon": "bed-outline"},
    {"key": "boneka", "name": "Boneka", "pricing": "kiloan", "price": 0, "icon": "happy-outline"},
]
CATALOG_BY_KEY = {c["key"]: c for c in CATALOG}

# Per-kg rates by treatment (for kiloan items).
KG_RATES = {"cuci_setrika": 7000, "cuci": 5000, "setrika": 4000}
TREATMENTS = [
    {"key": "cuci_setrika", "label": "Cuci + Setrika", "rate": KG_RATES["cuci_setrika"], "icon": "sparkles-outline"},
    {"key": "cuci", "label": "Cuci Saja", "rate": KG_RATES["cuci"], "icon": "water-outline"},
    {"key": "setrika", "label": "Setrika Saja", "rate": KG_RATES["setrika"], "icon": "flame-outline"},
]
TREATMENT_LABEL = {t["key"]: t["label"] for t in TREATMENTS}

STATUS_FLOW = ["diterima", "lunas", "dicuci", "disetrika", "siap", "selesai"]

# Admin roles and what each may do.
ADMIN_ROLES = {"admin", "admin_cabang", "admin_cuci", "admin_setrika", "admin_antar"}
ROLE_LABEL = {
    "admin": "Super Admin",
    "admin_cabang": "Admin Cabang",
    "admin_cuci": "Admin Cuci",
    "admin_setrika": "Admin Setrika",
    "admin_antar": "Admin Antar",
    "customer": "Pelanggan",
}
# Target status each role is allowed to set (the transition INTO that status).
# Flow: Cabang input item -> Pelanggan bayar -> Cuci scan (dicuci) ->
#       Setrika scan (disetrika) -> Cabang tandai siap -> Kurir scan (selesai).
ROLE_CAN_SET = {
    "admin": {"dicuci", "disetrika", "siap", "selesai"},
    "admin_cuci": {"dicuci"},
    "admin_setrika": {"disetrika"},
    "admin_cabang": {"siap"},
    "admin_antar": {"selesai"},
}
# Roles that verify a step by scanning the order QR code.
SCAN_ROLES = {"admin_cuci", "admin_setrika", "admin_antar"}
# Hours after which a branch drop-off order auto-completes once "siap".
AUTO_COMPLETE_HOURS = 24
ITEM_INPUT_ROLES = {"admin", "admin_cabang"}


def is_admin(u: dict) -> bool:
    return u.get("role") in ADMIN_ROLES


def gen_code(order_id: str) -> str:
    return "SUCI-" + order_id.replace("-", "")[:6].upper()


# --------------------------------------------------------------------------- #
# Models
# --------------------------------------------------------------------------- #
class RegisterIn(BaseModel):
    phone: str = Field(min_length=6, max_length=20)
    password: str = Field(min_length=4, max_length=128)
    name: str = Field(min_length=1, max_length=80)
    address: str = Field(default="", max_length=240)


class LoginIn(BaseModel):
    phone: str
    password: str


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None


class OrderItemIn(BaseModel):
    key: str
    qty: int = Field(ge=1, le=99)


class OrderCreate(BaseModel):
    service: Literal["pickup", "branch"]
    treatment: Literal["cuci_setrika", "cuci", "setrika"] = "cuci_setrika"
    branch_id: Optional[str] = None
    address: str = ""
    note: str = ""


class OrderItemsUpdate(BaseModel):
    items: List[OrderItemIn] = []
    weight_kg: float = Field(ge=0, le=200)


class PayIn(BaseModel):
    use_points: bool = False


class StatusUpdate(BaseModel):
    status: Literal["diterima", "lunas", "dicuci", "disetrika", "siap", "selesai"]


class FeedbackIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=500)


class RewashIn(BaseModel):
    reason: str = Field(min_length=1, max_length=500)
    photos: List[str] = []


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def normalize_phone(value: str) -> str:
    v = re.sub(r"[^\d+]", "", value.strip())
    if v.startswith("+62"):
        v = "0" + v[3:]
    return v


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt) -> Optional[str]:
    if dt is None:
        return None
    if isinstance(dt, str):
        return dt
    return dt.isoformat()


def make_token(user_id: str) -> str:
    payload = {"sub": user_id, "iat": now_utc(), "exp": now_utc() + timedelta(days=JWT_DAYS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "phone": u["phone"],
        "name": u.get("name", ""),
        "address": u.get("address", ""),
        "points": u.get("points", 0),
        "role": u.get("role", "customer"),
        "role_label": ROLE_LABEL.get(u.get("role", "customer"), "Pengguna"),
    }


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    err = HTTPException(status_code=401, detail="Token tidak valid atau kadaluarsa")
    if not creds or creds.scheme.lower() != "bearer":
        raise err
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        uid = payload.get("sub")
    except jwt.PyJWTError:
        raise err
    user = await db.users.find_one({"id": uid})
    if not user:
        raise err
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Akses khusus admin")
    return user


def destination_for(order_id: str) -> dict:
    # Deterministic offset from branch based on order id so the route is stable.
    h = hashlib.md5(order_id.encode()).hexdigest()
    dlat = (int(h[0:4], 16) / 65535 - 0.5) * 0.06
    dlng = (int(h[4:8], 16) / 65535 - 0.5) * 0.06
    return {"lat": round(BRANCH["lat"] + dlat, 6), "lng": round(BRANCH["lng"] + dlng, 6)}


def order_public(o: dict) -> dict:
    items = []
    for it in o.get("items", []):
        cat = CATALOG_BY_KEY.get(it["key"], {})
        pricing = cat.get("pricing", "kiloan")
        items.append({
            "key": it["key"],
            "name": cat.get("name", it["key"]),
            "qty": it["qty"],
            "pricing": pricing,
            "price": cat.get("price", 0),
            "line_total": cat.get("price", 0) * it["qty"] if pricing == "satuan" else 0,
            "icon": cat.get("icon", "cube-outline"),
        })
    treatment = o.get("treatment", "cuci_setrika")
    branch = BRANCH_BY_ID.get(o.get("branch_id") or "pusat", BRANCH)
    return {
        "id": o["id"],
        "code": o.get("code", gen_code(o["id"])),
        "customer_id": o["customer_id"],
        "customer_name": o.get("customer_name", ""),
        "customer_phone": o.get("customer_phone", ""),
        "items": items,
        "service": o["service"],
        "treatment": treatment,
        "treatment_label": TREATMENT_LABEL.get(treatment, treatment),
        "branch_id": o.get("branch_id"),
        "address": o.get("address", ""),
        "note": o.get("note", ""),
        "priced": o.get("priced", False),
        "subtotal": o.get("subtotal", 0),
        "discount": o.get("discount", 0),
        "total": o.get("total", 0),
        "weight_kg": o.get("weight_kg", 0),
        "kg_rate": KG_RATES.get(treatment, 0),
        "points_earned": o.get("points_earned", 0),
        "use_points": o.get("use_points", False),
        "status": o["status"],
        "paid": o.get("paid", False),
        "rating": o.get("rating"),
        "comment": o.get("comment"),
        "photos": o.get("photos", []),
        "complaints": o.get("complaints", []),
        "rewash_count": o.get("rewash_count", 0),
        "rewash_active": o.get("rewash_active", False),
        "auto_completed": o.get("auto_completed", False),
        "estimated_ready_at": iso(o.get("estimated_ready_at")),
        "created_at": iso(o.get("created_at")),
        "siap_at": iso(o.get("siap_at")),
        "selesai_at": iso(o.get("selesai_at")),
        "branch": branch,
        "destination": o.get("destination", destination_for(o["id"])),
    }


def compute_pricing(items: list, weight_kg: float, treatment: str) -> dict:
    satuan_total = 0
    for it in items:
        cat = CATALOG_BY_KEY.get(it["key"], {})
        if cat.get("pricing") == "satuan":
            satuan_total += cat.get("price", 0) * it["qty"]
    kiloan_total = int(round(weight_kg * KG_RATES.get(treatment, 0)))
    subtotal = satuan_total + kiloan_total
    points_earned = int(round(weight_kg))
    return {"subtotal": subtotal, "points_earned": points_earned}


async def maybe_autocomplete(o: dict) -> dict:
    """Branch drop-off orders auto-complete AUTO_COMPLETE_HOURS after they are ready."""
    if o.get("status") == "siap" and o.get("service") == "branch" and o.get("siap_at"):
        siap = o["siap_at"]
        if isinstance(siap, str):
            siap = datetime.fromisoformat(siap)
        if siap.tzinfo is None:
            siap = siap.replace(tzinfo=timezone.utc)
        if (now_utc() - siap) >= timedelta(hours=AUTO_COMPLETE_HOURS):
            await db.orders.update_one(
                {"id": o["id"]},
                {"$set": {"status": "selesai", "selesai_at": now_utc(), "auto_completed": True}},
            )
            o["status"] = "selesai"
            o["selesai_at"] = now_utc()
            o["auto_completed"] = True
    return o


# --------------------------------------------------------------------------- #
# Routes: auth
# --------------------------------------------------------------------------- #
@api.get("/")
async def root():
    return {"app": "Loundry Suci", "status": "ok"}


@api.post("/auth/register")
async def register(body: RegisterIn):
    phone = normalize_phone(body.phone)
    if await db.users.find_one({"phone": phone}):
        raise HTTPException(status_code=409, detail="Nomor HP sudah terdaftar")
    user = {
        "id": str(uuid.uuid4()),
        "phone": phone,
        "name": body.name,
        "address": body.address,
        "password_hash": pwd_ctx.hash(body.password),
        "points": 0,
        "role": "customer",
        "created_at": now_utc(),
    }
    await db.users.insert_one(user)
    return {"access_token": make_token(user["id"]), "user": public_user(user)}


@api.post("/auth/login")
async def login(body: LoginIn):
    phone = normalize_phone(body.phone)
    user = await db.users.find_one({"phone": phone})
    if not user or not pwd_ctx.verify(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Nomor HP atau password salah")
    return {"access_token": make_token(user["id"]), "user": public_user(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api.patch("/auth/me")
async def update_me(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in body.dict(exclude_none=True).items()}
    if upd:
        await db.users.update_one({"id": user["id"]}, {"$set": upd})
    fresh = await db.users.find_one({"id": user["id"]})
    return public_user(fresh)


# --------------------------------------------------------------------------- #
# Routes: catalog
# --------------------------------------------------------------------------- #
@api.get("/catalog")
async def catalog():
    return {
        "items": CATALOG,
        "treatments": TREATMENTS,
        "branches": BRANCHES,
        "kg_rates": KG_RATES,
        "points_per_redeem": POINTS_PER_REDEEM,
        "free_kg_value": FREE_KG_VALUE,
    }


# --------------------------------------------------------------------------- #
# Routes: orders
# --------------------------------------------------------------------------- #
@api.post("/orders")
async def create_order(body: OrderCreate, user: dict = Depends(get_current_user)):
    if body.service == "branch" and not body.branch_id:
        raise HTTPException(status_code=422, detail="Pilih cabang tujuan")
    if body.service == "branch" and body.branch_id not in BRANCH_BY_ID:
        raise HTTPException(status_code=422, detail="Cabang tidak dikenal")
    address = body.address or user.get("address", "")
    if body.service == "pickup" and not address.strip():
        raise HTTPException(status_code=422, detail="Isi alamat penjemputan")

    oid = str(uuid.uuid4())
    ready_hours = 24 + (8 if body.service == "pickup" else 0)
    estimated_ready = now_utc() + timedelta(hours=ready_hours)
    order = {
        "id": oid,
        "code": gen_code(oid),
        "customer_id": user["id"],
        "customer_name": user.get("name", ""),
        "customer_phone": user.get("phone", ""),
        "items": [],
        "service": body.service,
        "treatment": body.treatment,
        "branch_id": body.branch_id if body.service == "branch" else "pusat",
        "address": address,
        "note": body.note,
        "priced": False,
        "subtotal": 0,
        "discount": 0,
        "total": 0,
        "weight_kg": 0.0,
        "points_earned": 0,
        "use_points": False,
        "status": "diterima",
        "paid": False,
        "rating": None,
        "comment": None,
        "photos": [],
        "estimated_ready_at": estimated_ready,
        "created_at": now_utc(),
        "siap_at": None,
        "destination": destination_for(oid),
    }
    await db.orders.insert_one(order)
    return order_public(order)


@api.patch("/orders/{order_id}/items")
async def set_items(order_id: str, body: OrderItemsUpdate, admin: dict = Depends(require_admin)):
    if admin["role"] not in ITEM_INPUT_ROLES:
        raise HTTPException(status_code=403, detail="Hanya Admin Cabang yang dapat input item")
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if o["status"] != "diterima":
        raise HTTPException(status_code=400, detail="Item hanya bisa diubah sebelum pembayaran")
    norm_items = []
    for it in body.items:
        if it.key not in CATALOG_BY_KEY:
            raise HTTPException(status_code=422, detail=f"Item tidak dikenal: {it.key}")
        norm_items.append({"key": it.key, "qty": it.qty})
    pricing = compute_pricing(norm_items, body.weight_kg, o.get("treatment", "cuci_setrika"))
    ready_hours = 24 + (12 if body.weight_kg > 3 else 0) + (8 if o["service"] == "pickup" else 0)
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "items": norm_items,
            "weight_kg": round(body.weight_kg, 2),
            "subtotal": pricing["subtotal"],
            "total": pricing["subtotal"],
            "points_earned": pricing["points_earned"],
            "priced": True,
            "estimated_ready_at": now_utc() + timedelta(hours=ready_hours),
        }},
    )
    fresh = await db.orders.find_one({"id": order_id})
    return order_public(fresh)


@api.get("/orders")
async def list_orders(user: dict = Depends(get_current_user)):
    query = {} if is_admin(user) else {"customer_id": user["id"]}
    docs = await db.orders.find(query).sort("created_at", -1).to_list(500)
    docs = [await maybe_autocomplete(d) for d in docs]
    return [order_public(d) for d in docs]


@api.post("/orders/scan")
async def scan_order(body: dict, admin: dict = Depends(require_admin)):
    code = (body.get("code") or "").strip().upper()
    if not code:
        raise HTTPException(status_code=422, detail="Kode kosong")
    o = await db.orders.find_one({"code": code})
    if not o:
        raise HTTPException(status_code=404, detail=f"Pesanan {code} tidak ditemukan")
    return order_public(o)


@api.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if not is_admin(user) and o["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Bukan pesanan Anda")
    o = await maybe_autocomplete(o)
    return order_public(o)


@api.post("/orders/{order_id}/pay")
async def pay_order(order_id: str, body: PayIn = PayIn(), user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if o["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Bukan pesanan Anda")
    if o["status"] != "diterima":
        raise HTTPException(status_code=400, detail="Pesanan sudah dibayar")
    if not o.get("priced") or o.get("subtotal", 0) <= 0:
        raise HTTPException(status_code=400, detail="Menunggu admin menimbang & input item")

    subtotal = o.get("subtotal", 0)
    short_id = order_id[:8].upper()
    use_points = bool(body.use_points) and user.get("points", 0) >= POINTS_PER_REDEEM
    discount = min(FREE_KG_VALUE, subtotal) if use_points else 0
    total = max(subtotal - discount, 0)

    delta = 0
    if use_points:
        delta -= POINTS_PER_REDEEM
        await db.point_txns.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "order_id": order_id,
            "type": "redeem",
            "delta": -POINTS_PER_REDEEM,
            "reason": f"Tukar 1 kg gratis · #{short_id}",
            "created_at": now_utc(),
        })
    delta += o.get("points_earned", 0)
    if o.get("points_earned", 0) > 0:
        await db.point_txns.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "order_id": order_id,
            "type": "earn",
            "delta": o["points_earned"],
            "reason": f"Pembayaran pesanan · #{short_id}",
            "created_at": now_utc(),
        })
    if delta != 0:
        await db.users.update_one({"id": user["id"]}, {"$inc": {"points": delta}})
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "lunas", "paid": True, "paid_at": now_utc(),
                  "use_points": use_points, "discount": discount, "total": total}},
    )
    fresh = await db.orders.find_one({"id": order_id})
    return order_public(fresh)


@api.patch("/orders/{order_id}/status")
async def update_status(order_id: str, body: StatusUpdate, admin: dict = Depends(require_admin)):
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if body.status not in ROLE_CAN_SET.get(admin["role"], set()):
        raise HTTPException(status_code=403, detail="Peran Anda tidak dapat menandai status ini")
    if admin["role"] == "admin_antar" and body.status == "selesai" and o.get("service") != "pickup":
        raise HTTPException(status_code=403, detail="Kurir hanya dapat menyelesaikan pesanan antar-jemput")
    cur = STATUS_FLOW.index(o["status"])
    nxt = STATUS_FLOW.index(body.status)
    if nxt != cur + 1:
        raise HTTPException(status_code=400, detail="Status harus berurutan")
    upd = {"status": body.status}
    if body.status == "siap":
        upd["siap_at"] = now_utc()
    if body.status == "selesai":
        upd["selesai_at"] = now_utc()
        upd["rewash_active"] = False
    await db.orders.update_one({"id": order_id}, {"$set": upd})
    fresh = await db.orders.find_one({"id": order_id})
    return order_public(fresh)


@api.post("/orders/{order_id}/confirm-received")
async def confirm_received(order_id: str, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if o["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Bukan pesanan Anda")
    if o["status"] != "siap":
        raise HTTPException(status_code=400, detail="Pesanan belum siap diambil")
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "selesai", "selesai_at": now_utc(), "rewash_active": False}},
    )
    fresh = await db.orders.find_one({"id": order_id})
    return order_public(fresh)


@api.post("/orders/{order_id}/rewash")
async def request_rewash(order_id: str, body: RewashIn, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if o["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Bukan pesanan Anda")
    if o["status"] not in {"siap", "selesai"}:
        raise HTTPException(status_code=400, detail="Cuci ulang hanya untuk pesanan yang siap/selesai")
    complaint = {
        "id": str(uuid.uuid4()),
        "reason": body.reason.strip(),
        "photos": body.photos or [],
        "from_status": o["status"],
        "status": "diproses",
        "created_at": now_utc(),
    }
    complaints = o.get("complaints", []) + [complaint]
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "dicuci",
            "complaints": complaints,
            "rewash_count": o.get("rewash_count", 0) + 1,
            "rewash_active": True,
            "rating": None,
            "comment": None,
            "siap_at": None,
            "selesai_at": None,
            "auto_completed": False,
            "estimated_ready_at": now_utc() + timedelta(hours=24),
        }},
    )
    fresh = await db.orders.find_one({"id": order_id})
    return order_public(fresh)


@api.get("/orders/{order_id}/courier")
async def courier_location(order_id: str, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    branch = BRANCH
    dest = o.get("destination", destination_for(order_id))
    # Route origin/dest depending on service: pickup -> courier goes branch->home
    origin, target = branch, dest
    progress = 0.0
    active = False
    if o["status"] == "siap" and o.get("siap_at"):
        siap = o["siap_at"]
        if isinstance(siap, str):
            siap = datetime.fromisoformat(siap)
        if siap.tzinfo is None:
            siap = siap.replace(tzinfo=timezone.utc)
        elapsed = (now_utc() - siap).total_seconds()
        progress = max(0.0, min(1.0, elapsed / 180.0))
        active = o["service"] == "pickup"
    elif o["status"] == "selesai":
        progress = 1.0
    lat = origin["lat"] + (target["lat"] - origin["lat"]) * progress
    lng = origin["lng"] + (target["lng"] - origin["lng"]) * progress
    eta = max(0, int(round((1 - progress) * 3)))
    return {
        "lat": round(lat, 6),
        "lng": round(lng, 6),
        "progress": round(progress, 3),
        "eta_min": eta,
        "active": active,
        "branch": branch,
        "destination": dest,
        "service": o["service"],
        "status": o["status"],
    }


@api.post("/orders/{order_id}/feedback")
async def feedback(order_id: str, body: FeedbackIn, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if o["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Bukan pesanan Anda")
    if o["status"] != "selesai":
        raise HTTPException(status_code=400, detail="Beri rating setelah pesanan selesai")
    await db.orders.update_one(
        {"id": order_id}, {"$set": {"rating": body.rating, "comment": body.comment}}
    )
    fresh = await db.orders.find_one({"id": order_id})
    return order_public(fresh)


# --------------------------------------------------------------------------- #
# Routes: photos / object storage
# --------------------------------------------------------------------------- #
class PhotoPaths(BaseModel):
    paths: List[str]


def _user_from_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


@api.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Ukuran file maksimal 8MB")
    ext = (file.filename or "img.jpg").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp", "heic"):
        ext = "jpg"
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    content_type = file.content_type or "image/jpeg"
    try:
        result = await run_in_threadpool(put_object, path, data, content_type)
    except Exception as exc:
        logger.error(f"upload failed: {exc}")
        raise HTTPException(status_code=502, detail="Gagal mengunggah foto")
    return {"path": result["path"]}


@api.get("/files/{path:path}")
async def download_file(path: str, token: Optional[str] = Query(None),
                        creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)):
    uid = None
    if creds and creds.scheme.lower() == "bearer":
        uid = _user_from_token(creds.credentials)
    if not uid and token:
        uid = _user_from_token(token)
    if not uid:
        raise HTTPException(status_code=401, detail="Tidak diizinkan")
    try:
        content, content_type = await run_in_threadpool(get_object, path)
    except Exception:
        raise HTTPException(status_code=404, detail="File tidak ditemukan")
    return Response(content=content, media_type=content_type)


@api.post("/orders/{order_id}/photos")
async def add_photos(order_id: str, body: PhotoPaths, admin: dict = Depends(require_admin)):
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    photos = o.get("photos", []) + body.paths
    await db.orders.update_one({"id": order_id}, {"$set": {"photos": photos}})
    fresh = await db.orders.find_one({"id": order_id})
    return order_public(fresh)


# --------------------------------------------------------------------------- #
# Routes: points history
# --------------------------------------------------------------------------- #
@api.get("/points/history")
async def points_history(user: dict = Depends(get_current_user)):
    txns = await db.point_txns.find({"user_id": user["id"]}).sort("created_at", -1).to_list(200)
    return {
        "balance": user.get("points", 0),
        "transactions": [
            {
                "id": t["id"],
                "type": t["type"],
                "delta": t["delta"],
                "reason": t.get("reason", ""),
                "created_at": iso(t.get("created_at")),
            }
            for t in txns
        ],
    }


# --------------------------------------------------------------------------- #
# Routes: promos
# --------------------------------------------------------------------------- #
@api.get("/promos")
async def promos():
    docs = await db.promos.find({"active": True}).sort("order", 1).to_list(50)
    return [
        {
            "id": p["id"],
            "title": p["title"],
            "subtitle": p.get("subtitle", ""),
            "badge": p.get("badge", ""),
            "image": p.get("image", ""),
        }
        for p in docs
    ]



# --------------------------------------------------------------------------- #
# Startup seed
# --------------------------------------------------------------------------- #
@app.on_event("startup")
async def seed():
    await db.users.create_index("phone", unique=True)
    await db.orders.create_index("code")
    async for o in db.orders.find({"code": {"$exists": False}}):
        await db.orders.update_one({"id": o["id"]}, {"$set": {"code": gen_code(o["id"])}})
    if not await db.users.find_one({"role": "admin"}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "phone": "081200000000",
            "name": "Admin Suci",
            "address": BRANCH["name"],
            "password_hash": pwd_ctx.hash("admin123"),
            "points": 0,
            "role": "admin",
            "created_at": now_utc(),
        })
        logger.info("Seeded admin user")

    role_admins = [
        ("081200000001", "Admin Cabang", "admin_cabang"),
        ("081200000002", "Admin Cuci", "admin_cuci"),
        ("081200000003", "Admin Setrika", "admin_setrika"),
        ("081200000004", "Admin Antar", "admin_antar"),
    ]
    for phone, name, role in role_admins:
        if not await db.users.find_one({"phone": phone}):
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "phone": phone,
                "name": name,
                "address": BRANCH["name"],
                "password_hash": pwd_ctx.hash("admin123"),
                "points": 0,
                "role": role,
                "created_at": now_utc(),
            })
            logger.info(f"Seeded {role}")
    if not await db.users.find_one({"phone": "081211112222"}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "phone": "081211112222",
            "name": "Budi Santoso",
            "address": "Jl. Melati No. 12, Jakarta",
            "password_hash": pwd_ctx.hash("password123"),
            "points": 30,
            "role": "customer",
            "created_at": now_utc(),
        })
        logger.info("Seeded demo customer")

    try:
        await run_in_threadpool(init_storage)
        logger.info("Object storage initialized")
    except Exception as exc:
        logger.warning(f"Object storage init failed (uploads may be unavailable): {exc}")

    if await db.promos.count_documents({}) == 0:
        await db.promos.insert_many([
            {
                "id": str(uuid.uuid4()), "order": 1, "active": True,
                "title": "Diskon 20% Cuci Bed Cover",
                "subtitle": "Berlaku untuk semua ukuran minggu ini",
                "badge": "-20%",
                "image": "https://images.unsplash.com/photo-1522771930-2df6b4a1e6f4?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
            },
            {
                "id": str(uuid.uuid4()), "order": 2, "active": True,
                "title": "Gratis Jemput & Antar",
                "subtitle": "Untuk order di atas Rp 50.000",
                "badge": "FREE",
                "image": "https://images.unsplash.com/photo-1617347454431-f49d7ff5c3b1?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
            },
            {
                "id": str(uuid.uuid4()), "order": 3, "active": True,
                "title": "Kumpulkan Poin, Cuci Gratis",
                "subtitle": "25 poin = 1 kg gratis",
                "badge": "POIN",
                "image": "https://images.unsplash.com/photo-1626806819282-2c1dc01a5e0c?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
            },
        ])
        logger.info("Seeded promos")


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()
