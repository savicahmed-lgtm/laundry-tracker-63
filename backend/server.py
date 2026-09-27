from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import math
import hashlib
import logging
import uuid
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

app = FastAPI()
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("loundry")

# --------------------------------------------------------------------------- #
# Constants
# --------------------------------------------------------------------------- #
BRANCH = {"lat": -6.21462, "lng": 106.84513, "name": "Loundry Suci - Cabang Pusat"}
POINTS_PER_REDEEM = 25
FREE_KG_VALUE = 7000  # Rp value of 1 free kg when redeeming points

CATALOG = [
    {"key": "karpet", "name": "Karpet", "price": 25000, "weight_kg": 3.0, "icon": "grid-outline"},
    {"key": "kaos", "name": "Kaos", "price": 5000, "weight_kg": 0.2, "icon": "shirt-outline"},
    {"key": "kemeja", "name": "Kemeja", "price": 6000, "weight_kg": 0.25, "icon": "shirt-outline"},
    {"key": "celana", "name": "Celana", "price": 7000, "weight_kg": 0.3, "icon": "man-outline"},
    {"key": "sepatu", "name": "Sepatu", "price": 25000, "weight_kg": 1.0, "icon": "footsteps-outline"},
    {"key": "gaun", "name": "Gaun", "price": 15000, "weight_kg": 0.5, "icon": "woman-outline"},
    {"key": "topi", "name": "Topi", "price": 8000, "weight_kg": 0.2, "icon": "medical-outline"},
    {"key": "tas", "name": "Tas", "price": 20000, "weight_kg": 1.0, "icon": "bag-handle-outline"},
    {"key": "bedcover", "name": "Bed Cover", "price": 30000, "weight_kg": 2.5, "icon": "bed-outline"},
    {"key": "sprei", "name": "Sprei", "price": 15000, "weight_kg": 1.0, "icon": "bed-outline"},
    {"key": "helm", "name": "Helm", "price": 20000, "weight_kg": 0.8, "icon": "bicycle-outline"},
    {"key": "boneka", "name": "Boneka", "price": 15000, "weight_kg": 1.0, "icon": "happy-outline"},
]
CATALOG_BY_KEY = {c["key"]: c for c in CATALOG}

STATUS_FLOW = ["diterima", "lunas", "dicuci", "disetrika", "siap", "selesai"]


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
    items: List[OrderItemIn]
    service: Literal["pickup", "branch"]
    address: str = ""
    note: str = ""
    use_points: bool = False


class StatusUpdate(BaseModel):
    status: Literal["diterima", "lunas", "dicuci", "disetrika", "siap", "selesai"]


class FeedbackIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=500)


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
    if user.get("role") != "admin":
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
        items.append({
            "key": it["key"],
            "name": cat.get("name", it["key"]),
            "qty": it["qty"],
            "price": cat.get("price", 0),
            "icon": cat.get("icon", "cube-outline"),
        })
    return {
        "id": o["id"],
        "customer_id": o["customer_id"],
        "customer_name": o.get("customer_name", ""),
        "customer_phone": o.get("customer_phone", ""),
        "items": items,
        "service": o["service"],
        "address": o.get("address", ""),
        "note": o.get("note", ""),
        "subtotal": o["subtotal"],
        "discount": o.get("discount", 0),
        "total": o["total"],
        "weight_kg": o["weight_kg"],
        "points_earned": o["points_earned"],
        "use_points": o.get("use_points", False),
        "status": o["status"],
        "paid": o.get("paid", False),
        "rating": o.get("rating"),
        "comment": o.get("comment"),
        "created_at": iso(o.get("created_at")),
        "siap_at": iso(o.get("siap_at")),
        "branch": BRANCH,
        "destination": o.get("destination", destination_for(o["id"])),
    }


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
        "points_per_redeem": POINTS_PER_REDEEM,
        "free_kg_value": FREE_KG_VALUE,
    }


# --------------------------------------------------------------------------- #
# Routes: orders
# --------------------------------------------------------------------------- #
@api.post("/orders")
async def create_order(body: OrderCreate, user: dict = Depends(get_current_user)):
    if not body.items:
        raise HTTPException(status_code=422, detail="Pilih minimal 1 item cucian")
    subtotal = 0
    weight = 0.0
    norm_items = []
    for it in body.items:
        cat = CATALOG_BY_KEY.get(it.key)
        if not cat:
            raise HTTPException(status_code=422, detail=f"Item tidak dikenal: {it.key}")
        subtotal += cat["price"] * it.qty
        weight += cat["weight_kg"] * it.qty
        norm_items.append({"key": it.key, "qty": it.qty})

    discount = 0
    use_points = bool(body.use_points) and user.get("points", 0) >= POINTS_PER_REDEEM
    if use_points:
        discount = FREE_KG_VALUE
    total = max(subtotal - discount, 0)
    points_earned = max(int(round(weight)), 1)

    oid = str(uuid.uuid4())
    order = {
        "id": oid,
        "customer_id": user["id"],
        "customer_name": user.get("name", ""),
        "customer_phone": user.get("phone", ""),
        "items": norm_items,
        "service": body.service,
        "address": body.address or user.get("address", ""),
        "note": body.note,
        "subtotal": subtotal,
        "discount": discount,
        "total": total,
        "weight_kg": round(weight, 2),
        "points_earned": points_earned,
        "use_points": use_points,
        "status": "diterima",
        "paid": False,
        "rating": None,
        "comment": None,
        "created_at": now_utc(),
        "siap_at": None,
        "destination": destination_for(oid),
    }
    await db.orders.insert_one(order)
    return order_public(order)


@api.get("/orders")
async def list_orders(user: dict = Depends(get_current_user)):
    query = {} if user.get("role") == "admin" else {"customer_id": user["id"]}
    docs = await db.orders.find(query).sort("created_at", -1).to_list(500)
    return [order_public(d) for d in docs]


@api.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if user.get("role") != "admin" and o["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Bukan pesanan Anda")
    return order_public(o)


@api.post("/orders/{order_id}/pay")
async def pay_order(order_id: str, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if o["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Bukan pesanan Anda")
    if o["status"] != "diterima":
        raise HTTPException(status_code=400, detail="Pesanan sudah dibayar")

    # Deduct redeemed points, then award earned points.
    delta = 0
    if o.get("use_points"):
        delta -= POINTS_PER_REDEEM
    delta += o["points_earned"]
    await db.users.update_one({"id": user["id"]}, {"$inc": {"points": delta}})
    await db.orders.update_one(
        {"id": order_id}, {"$set": {"status": "lunas", "paid": True, "paid_at": now_utc()}}
    )
    fresh = await db.orders.find_one({"id": order_id})
    return order_public(fresh)


@api.patch("/orders/{order_id}/status")
async def update_status(order_id: str, body: StatusUpdate, admin: dict = Depends(require_admin)):
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    cur = STATUS_FLOW.index(o["status"])
    nxt = STATUS_FLOW.index(body.status)
    if nxt != cur + 1:
        raise HTTPException(status_code=400, detail="Status harus berurutan")
    upd = {"status": body.status}
    if body.status == "siap":
        upd["siap_at"] = now_utc()
    await db.orders.update_one({"id": order_id}, {"$set": upd})
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
# Startup seed
# --------------------------------------------------------------------------- #
@app.on_event("startup")
async def seed():
    await db.users.create_index("phone", unique=True)
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
