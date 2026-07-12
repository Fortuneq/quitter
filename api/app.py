"""quitter API: пользователи, триал, подписки, платежи Telegram Stars и ЮKassa.

Аутентификация — подпись Telegram WebApp initData (заголовок Authorization: tma <initData>).
Хранилище — SQLite. Платежи — абстракция провайдеров: Stars (XTR) и ЮKassa.
"""
import asyncio
import hashlib
import hmac
import json
import os
import re
import sqlite3
import time
import uuid
from urllib.parse import parse_qsl

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Histogram,
    Gauge,
    generate_latest,
)

BOT_TOKEN = os.environ["BOT_TOKEN"]
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")
ADMIN_CHAT_ID = int(os.environ.get("ADMIN_CHAT_ID", "0"))  # уведомления о лидах
DB_PATH = os.environ.get("DB_PATH", "/data/quitter.db")
APP_URL = os.environ.get("APP_URL", "https://example.com/")
DOCS_URL = os.environ.get("DOCS_URL", APP_URL + "docs/")
BOT_URL = os.environ.get("BOT_URL", "https://t.me/")
TG_API = f"https://api.telegram.org/bot{BOT_TOKEN}"

# ЮKassa: без ключей провайдер выключен (оплата картой недоступна)
YOOKASSA_SHOP_ID = os.environ.get("YOOKASSA_SHOP_ID", "")
YOOKASSA_SECRET_KEY = os.environ.get("YOOKASSA_SECRET_KEY", "")
YOOKASSA_RETURN_URL = os.environ.get("YOOKASSA_RETURN_URL", BOT_URL)
YK_API = "https://api.yookassa.ru/v3"

TRIAL_HOURS = 24
INIT_DATA_MAX_AGE = 24 * 3600

# Планы подписки. Рубли — витринная цена (ЮKassa),
# stars — цена в XTR (~1.6 ₽ за звезду, округлено).
PLANS = {
    "month": {"title": "1 месяц", "rub": 799, "stars": 500, "days": 30},
    "year": {"title": "1 год", "rub": 2990, "stars": 1870, "days": 365},
}

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

# Общий клиент с пулом соединений — без TLS-хендшейка на каждый запрос
http_client = httpx.AsyncClient(timeout=20)


# --- БД ---

def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                tg_id INTEGER PRIMARY KEY,
                username TEXT,
                first_name TEXT,
                created_at INTEGER NOT NULL,
                premium_until INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tg_id INTEGER NOT NULL,
                plan TEXT NOT NULL,
                provider TEXT NOT NULL,
                amount INTEGER NOT NULL,
                currency TEXT NOT NULL,
                charge_id TEXT UNIQUE,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS user_state (
                tg_id INTEGER PRIMARY KEY,
                data TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS yk_pending (
                payment_id TEXT PRIMARY KEY,
                tg_id INTEGER NOT NULL,
                plan TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS consents (
                tg_id INTEGER PRIMARY KEY,
                granted_at INTEGER NOT NULL,
                revoked_at INTEGER,
                revoke_reason TEXT
            );
            CREATE TABLE IF NOT EXISTS leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                contact TEXT NOT NULL,
                email TEXT NOT NULL,
                plan TEXT NOT NULL,
                buyer_type TEXT NOT NULL DEFAULT 'individual',
                org_name TEXT,
                inn TEXT,
                utm TEXT,
                payment_id TEXT UNIQUE,
                paid INTEGER NOT NULL DEFAULT 0,
                code TEXT UNIQUE,
                redeemed_by INTEGER,
                created_at INTEGER NOT NULL
            );
            """
        )


init_db()


# --- Метрики Prometheus ---

HTTP_REQUESTS = Counter(
    "quitter_http_requests_total", "HTTP-запросы", ["method", "path", "status"]
)
HTTP_DURATION = Histogram(
    "quitter_http_request_duration_seconds", "Длительность запросов", ["method", "path"]
)
PAYMENTS_TOTAL = Gauge(
    "quitter_payments_total", "Оплаты за всё время", ["provider", "plan"]
)
REVENUE_TOTAL = Gauge(
    "quitter_revenue_total", "Выручка за всё время", ["provider", "plan", "currency"]
)
LEADS_TOTAL = Gauge("quitter_leads_total", "Лидов с минисайта")
LEADS_PAID = Gauge("quitter_leads_paid", "Оплаченных лидов")
CONSENTS_ACTIVE = Gauge("quitter_consents_active", "Активных согласий на обработку ПДн")
CONSENTS_REVOKED = Gauge("quitter_consents_revoked", "Отозванных согласий (удалили данные)")
USERS_TOTAL = Gauge("quitter_users_total", "Всего пользователей")
PREMIUM_ACTIVE = Gauge("quitter_premium_active", "Активных платных подписок")
TRIAL_ACTIVE = Gauge("quitter_trial_active", "Пользователей на триале")
STATE_USERS = Gauge("quitter_state_users", "Пользователей с синхронизированным прогрессом")

# Группируем пути, чтобы не плодить метки на каждый запрос
KNOWN_PATHS = {
    "/api/me", "/api/invoice", "/api/state",
    "/api/tg-webhook", "/api/yk-webhook", "/api/pay/yookassa",
    "/api/pay/yookassa/check", "/api/pay/methods",
    "/api/lead", "/api/lead/status", "/api/consent/revoke",
    "/api/health", "/api/metrics",
}


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    path = request.url.path if request.url.path in KNOWN_PATHS else "other"
    start = time.monotonic()
    response = await call_next(request)
    HTTP_DURATION.labels(request.method, path).observe(time.monotonic() - start)
    HTTP_REQUESTS.labels(request.method, path, response.status_code).inc()
    return response


def refresh_business_metrics() -> None:
    now = int(time.time())
    with db() as conn:
        USERS_TOTAL.set(conn.execute("SELECT COUNT(*) FROM users").fetchone()[0])
        PREMIUM_ACTIVE.set(
            conn.execute(
                "SELECT COUNT(*) FROM users WHERE premium_until > ?", (now,)
            ).fetchone()[0]
        )
        TRIAL_ACTIVE.set(
            conn.execute(
                "SELECT COUNT(*) FROM users WHERE premium_until <= ? AND created_at + ? > ?",
                (now, TRIAL_HOURS * 3600, now),
            ).fetchone()[0]
        )
        STATE_USERS.set(
            conn.execute("SELECT COUNT(*) FROM user_state").fetchone()[0]
        )
        LEADS_TOTAL.set(conn.execute("SELECT COUNT(*) FROM leads").fetchone()[0])
        LEADS_PAID.set(
            conn.execute("SELECT COUNT(*) FROM leads WHERE paid = 1").fetchone()[0]
        )
        CONSENTS_ACTIVE.set(
            conn.execute(
                "SELECT COUNT(*) FROM consents WHERE revoked_at IS NULL"
            ).fetchone()[0]
        )
        CONSENTS_REVOKED.set(
            conn.execute(
                "SELECT COUNT(*) FROM consents WHERE revoked_at IS NOT NULL"
            ).fetchone()[0]
        )
        for provider, plan, cnt, total, currency in conn.execute(
            """SELECT provider, plan, COUNT(*), SUM(amount), currency
               FROM payments GROUP BY provider, plan, currency"""
        ):
            PAYMENTS_TOTAL.labels(provider, plan).set(cnt)
            # Stars храним в звёздах, ЮKassa — в копейках
            value = total / 100 if currency == "RUB" else total
            REVENUE_TOTAL.labels(provider, plan, currency).set(value)


@app.get("/api/metrics")
def metrics():
    refresh_business_metrics()
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


# --- Аутентификация по initData ---

def validate_init_data(init_data: str) -> dict:
    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = pairs.pop("hash", "")
    check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    expected = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received_hash):
        raise HTTPException(401, "bad initData signature")
    if time.time() - int(pairs.get("auth_date", 0)) > INIT_DATA_MAX_AGE:
        raise HTTPException(401, "initData expired")
    try:
        return json.loads(pairs["user"])
    except (KeyError, ValueError):
        raise HTTPException(401, "no user in initData")


def current_user(authorization: str = Header("")) -> sqlite3.Row:
    scheme, _, init_data = authorization.partition(" ")
    if scheme != "tma" or not init_data:
        raise HTTPException(401, "expected Authorization: tma <initData>")
    tg_user = validate_init_data(init_data)
    now = int(time.time())
    with db() as conn:
        conn.execute(
            """INSERT INTO users (tg_id, username, first_name, created_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(tg_id) DO UPDATE SET
                 username = excluded.username, first_name = excluded.first_name""",
            (tg_user["id"], tg_user.get("username"), tg_user.get("first_name"), now),
        )
        # Использование сервиса = принятие оферты и согласие на обработку ПДн;
        # после отзыва повторное использование возобновляет согласие.
        conn.execute(
            """INSERT INTO consents (tg_id, granted_at) VALUES (?, ?)
               ON CONFLICT(tg_id) DO UPDATE SET
                 granted_at = CASE WHEN revoked_at IS NOT NULL THEN ? ELSE granted_at END,
                 revoked_at = NULL, revoke_reason = NULL""",
            (tg_user["id"], now, now),
        )
        return conn.execute(
            "SELECT * FROM users WHERE tg_id = ?", (tg_user["id"],)
        ).fetchone()


def delete_user_data(tg_id: int, reason: str) -> None:
    """Отзыв согласия: удаляем профиль и данные, фиксируем отзыв в consents.
    payments храним — первичные учётные документы по 54-ФЗ."""
    now = int(time.time())
    with db() as conn:
        conn.execute("DELETE FROM user_state WHERE tg_id = ?", (tg_id,))
        conn.execute("DELETE FROM users WHERE tg_id = ?", (tg_id,))
        conn.execute(
            """INSERT INTO consents (tg_id, granted_at, revoked_at, revoke_reason)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(tg_id) DO UPDATE SET revoked_at = ?, revoke_reason = ?""",
            (tg_id, now, now, reason, now, reason),
        )


def entitlement(user: sqlite3.Row) -> dict:
    now = int(time.time())
    trial_until = user["created_at"] + TRIAL_HOURS * 3600
    if user["premium_until"] > now:
        status = "premium"
    elif trial_until > now:
        status = "trial"
    else:
        status = "free"
    return {
        "status": status,
        "trial_until": trial_until,
        "premium_until": user["premium_until"] or None,
    }


# --- API для miniapp ---

@app.get("/api/me")
def me(user: sqlite3.Row = Depends(current_user)):
    return {
        **entitlement(user),
        "plans": [
            {"id": pid, "title": p["title"], "rub": p["rub"],
             "stars": p["stars"], "days": p["days"]}
            for pid, p in PLANS.items()
        ],
    }


@app.post("/api/invoice")
async def create_invoice(body: dict, user: sqlite3.Row = Depends(current_user)):
    plan_id = body.get("plan")
    plan = PLANS.get(plan_id)
    if not plan:
        raise HTTPException(400, "unknown plan")
    provider = body.get("provider", "stars")
    if provider != "stars":
        raise HTTPException(400, "provider not available")
    r = await http_client.post(
        f"{TG_API}/createInvoiceLink",
            json={
                "title": f"Подписка Ребут · {plan['title']}",
                "description": "План 90 дней, статистика восстановления и все инструменты",
                "payload": f"sub:{user['tg_id']}:{plan_id}",
                "currency": "XTR",
                "prices": [{"label": plan["title"], "amount": plan["stars"]}],
            },
            timeout=15,
        )
    data = r.json()
    if not data.get("ok"):
        raise HTTPException(502, f"telegram: {data.get('description')}")
    return {"link": data["result"]}


@app.post("/api/consent/revoke")
async def revoke_consent(user: sqlite3.Row = Depends(current_user)):
    delete_user_data(user["tg_id"], "app_button")
    return {"ok": True}


@app.get("/api/state")
def get_state(user: sqlite3.Row = Depends(current_user)):
    with db() as conn:
        row = conn.execute(
            "SELECT data, updated_at FROM user_state WHERE tg_id = ?",
            (user["tg_id"],),
        ).fetchone()
    if not row:
        return {"state": None, "updated_at": 0}
    return {"state": json.loads(row["data"]), "updated_at": row["updated_at"]}


@app.put("/api/state")
def put_state(body: dict, user: sqlite3.Row = Depends(current_user)):
    state = body.get("state")
    if not isinstance(state, dict):
        raise HTTPException(400, "state must be an object")
    raw = json.dumps(state, ensure_ascii=False)
    if len(raw) > 200_000:
        raise HTTPException(400, "too large")
    now = int(time.time())
    with db() as conn:
        conn.execute(
            """INSERT INTO user_state (tg_id, data, updated_at) VALUES (?, ?, ?)
               ON CONFLICT(tg_id) DO UPDATE SET data = excluded.data,
                 updated_at = excluded.updated_at""",
            (user["tg_id"], raw, now),
        )
    return {"ok": True, "updated_at": now}


# --- ЮKassa: оплата картой для физлиц и юрлиц ---

async def create_yk_payment(plan, description, metadata, customer, return_url) -> dict:
    amount = {"value": f"{plan['rub']:.2f}", "currency": "RUB"}
    payload = {
        "amount": amount,
        "capture": True,
        "confirmation": {"type": "redirect", "return_url": return_url},
        "description": description,
        "metadata": metadata,
        "receipt": {
            "customer": customer,
            "items": [{
                "description": f"Доступ к сервису Ребут · {plan['title']}",
                "quantity": "1.00",
                "amount": amount,
                "vat_code": 1,
                "payment_subject": "service",
                "payment_mode": "full_payment",
            }],
        },
    }
    r = await http_client.post(
        f"{YK_API}/payments",
        json=payload,
        auth=(YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY),
        headers={"Idempotence-Key": str(uuid.uuid4())},
    )
    data = r.json()
    if r.status_code not in (200, 201) or "confirmation" not in data:
        raise HTTPException(502, f"yookassa: {data.get('description', r.status_code)}")
    return data


def parse_buyer(body: dict) -> tuple[str, dict, str, str | None, str | None]:
    """Общая валидация покупателя для чека: (buyer_type, customer, email, org, inn)."""
    email = (body.get("email") or "").strip()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(400, "нужен e-mail для чека")
    buyer_type = body.get("buyer_type", "individual")
    org_name = inn = None
    customer = {"email": email}
    if buyer_type == "company":
        org_name = (body.get("org_name") or "").strip()
        inn = (body.get("inn") or "").strip()
        if not org_name:
            raise HTTPException(400, "нужно название организации")
        if not re.fullmatch(r"\d{10}", inn):
            raise HTTPException(400, "ИНН организации должен состоять из 10 цифр")
        customer = {"full_name": org_name, "inn": inn, "email": email}
    elif buyer_type != "individual":
        raise HTTPException(400, "buyer_type: individual или company")
    return buyer_type, customer, email, org_name, inn


@app.get("/api/pay/methods")
def pay_methods():
    return {"stars": True, "yookassa": bool(YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY)}


@app.post("/api/pay/yookassa")
async def pay_yookassa(body: dict, user: sqlite3.Row = Depends(current_user)):
    if not (YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY):
        raise HTTPException(503, "оплата картой пока недоступна")
    plan_id = body.get("plan")
    plan = PLANS.get(plan_id)
    if not plan:
        raise HTTPException(400, "unknown plan")

    buyer_type, customer, _, _, _ = parse_buyer(body)

    data = await create_yk_payment(
        plan,
        description=f"Подписка Ребут · {plan['title']} (tg {user['tg_id']})",
        metadata={"tg_id": str(user["tg_id"]), "plan": plan_id, "buyer_type": buyer_type},
        customer=customer,
        return_url=YOOKASSA_RETURN_URL,
    )
    with db() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO yk_pending (payment_id, tg_id, plan, created_at) VALUES (?, ?, ?, ?)",
            (data["id"], user["tg_id"], plan_id, int(time.time())),
        )
    return {
        "payment_id": data["id"],
        "confirmation_url": data["confirmation"]["confirmation_url"],
    }


async def settle_yk_payment(payment_id: str) -> int | None:
    """Проверяет платёж в ЮKassa; при успехе активирует подписку и возвращает
    tg_id покупателя. Идемпотентно."""
    r = await http_client.get(
        f"{YK_API}/payments/{payment_id}",
        auth=(YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY),
    )
    payment = r.json()
    meta = payment.get("metadata", {})
    status = payment.get("status")
    if status != "succeeded":
        if status == "canceled":
            with db() as conn:
                conn.execute("DELETE FROM yk_pending WHERE payment_id = ?", (payment_id,))
        return None
    kopeks = round(float(payment["amount"]["value"]) * 100)

    # Оплата лида с минисайта: помечаем и выдаём код активации
    if meta.get("kind") == "lead":
        if mark_lead_paid(payment_id, meta.get("plan"), kopeks):
            with db() as conn:
                lead = conn.execute(
                    "SELECT id, name, contact, plan FROM leads WHERE payment_id = ?",
                    (payment_id,),
                ).fetchone()
            if lead:
                await notify_admin(
                    f"💰 Лид #{lead['id']} оплатил: {lead['name']} ({lead['contact']}) — "
                    f"{PLANS[lead['plan']]['title']}, {PLANS[lead['plan']]['rub']} ₽"
                )
        return None

    tg_id = None
    if meta.get("plan") in PLANS and meta.get("tg_id"):
        tg_id = int(meta["tg_id"])
        grant_premium(tg_id, meta["plan"], "yookassa", kopeks, "RUB", payment_id)
        with db() as conn:
            conn.execute("DELETE FROM yk_pending WHERE payment_id = ?", (payment_id,))
    return tg_id


def mark_lead_paid(payment_id: str, plan_id: str | None, kopeks: int) -> bool:
    """Фиксирует оплату лида: код активации + строка в payments (tg_id=0 до активации).
    Возвращает True, если оплата зафиксирована впервые."""
    if plan_id not in PLANS:
        return False
    code = "act_" + uuid.uuid4().hex[:12]
    now = int(time.time())
    with db() as conn:
        cur = conn.execute(
            "UPDATE leads SET paid = 1, code = COALESCE(code, ?) WHERE payment_id = ? AND paid = 0",
            (code, payment_id),
        )
        if cur.rowcount:
            try:
                conn.execute(
                    """INSERT INTO payments (tg_id, plan, provider, amount, currency,
                       charge_id, created_at) VALUES (0, ?, 'yookassa', ?, 'RUB', ?, ?)""",
                    (plan_id, kopeks, payment_id, now),
                )
            except sqlite3.IntegrityError:
                pass
        return bool(cur.rowcount)


def redeem_lead(code: str, tg_id: int) -> str | None:
    """Активация оплаченного лида по deep-link. Возвращает plan_id или None."""
    now = int(time.time())
    with db() as conn:
        lead = conn.execute(
            "SELECT id, plan, payment_id FROM leads WHERE code = ? AND paid = 1 AND redeemed_by IS NULL",
            (code,),
        ).fetchone()
        if not lead or lead["plan"] not in PLANS:
            return None
        conn.execute("UPDATE leads SET redeemed_by = ? WHERE id = ?", (tg_id, lead["id"]))
        row = conn.execute(
            "SELECT premium_until FROM users WHERE tg_id = ?", (tg_id,)
        ).fetchone()
        base = max(now, row["premium_until"]) if row else now
        new_until = base + PLANS[lead["plan"]]["days"] * 86400
        conn.execute(
            """INSERT INTO users (tg_id, created_at, premium_until) VALUES (?, ?, ?)
               ON CONFLICT(tg_id) DO UPDATE SET premium_until = ?""",
            (tg_id, now, new_until, new_until),
        )
        # выручку переписываем на реального пользователя
        conn.execute(
            "UPDATE payments SET tg_id = ? WHERE charge_id = ?", (tg_id, lead["payment_id"])
        )
    return lead["plan"]


@app.post("/api/pay/yookassa/check")
async def yk_check(user: sqlite3.Row = Depends(current_user)):
    """Fallback без вебхука: опрашиваем незавершённые платежи пользователя."""
    if not (YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY):
        raise HTTPException(503, "not configured")
    cutoff = int(time.time()) - 24 * 3600
    with db() as conn:
        rows = conn.execute(
            """SELECT payment_id FROM yk_pending
               WHERE tg_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 5""",
            (user["tg_id"], cutoff),
        ).fetchall()
    paid = False
    for row in rows:
        if await settle_yk_payment(row["payment_id"]) is not None:
            paid = True
    with db() as conn:
        fresh = conn.execute(
            "SELECT * FROM users WHERE tg_id = ?", (user["tg_id"],)
        ).fetchone()
    return {"paid": paid, **entitlement(fresh)}


@app.post("/api/yk-webhook")
async def yk_webhook(request: Request):
    if not (YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY):
        raise HTTPException(503, "not configured")
    event = await request.json()
    if event.get("event") != "payment.succeeded":
        return {"ok": True}
    payment_id = event.get("object", {}).get("id", "")
    if not payment_id:
        return {"ok": True}
    # Телу вебхука не доверяем — статус подтверждаем прямым запросом к ЮKassa
    tg_id = await settle_yk_payment(payment_id)
    if tg_id is not None:
        await tg_call("sendMessage", {
            "chat_id": tg_id,
            "text": "Оплата прошла, подписка активна! Полный доступ открыт 💪",
        })
    return {"ok": True}


# --- Lead-минисайт: форма + оплата + активация через бота ---

@app.post("/api/lead")
async def create_lead(body: dict):
    if not (YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY):
        raise HTTPException(503, "оплата пока недоступна")
    if body.get("website"):  # honeypot для ботов
        return {"ok": True}
    name = (body.get("name") or "").strip()[:120]
    contact = (body.get("contact") or "").strip()[:120]
    if not name:
        raise HTTPException(400, "как к тебе обращаться?")
    if not contact:
        raise HTTPException(400, "нужен telegram или телефон для связи")
    plan_id = body.get("plan")
    plan = PLANS.get(plan_id)
    if not plan:
        raise HTTPException(400, "unknown plan")
    buyer_type, customer, email, org_name, inn = parse_buyer(body)
    utm = json.dumps(body.get("utm") or {}, ensure_ascii=False)[:1000]

    now = int(time.time())
    with db() as conn:
        lead_id = conn.execute(
            """INSERT INTO leads (name, contact, email, plan, buyer_type, org_name,
               inn, utm, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (name, contact, email, plan_id, buyer_type, org_name, inn, utm, now),
        ).lastrowid

    data = await create_yk_payment(
        plan,
        description=f"Подписка Ребут · {plan['title']} (лид {lead_id})",
        metadata={"kind": "lead", "lead_id": str(lead_id), "plan": plan_id},
        customer=customer,
        return_url=f"{APP_URL}start/thanks.html",
    )
    with db() as conn:
        conn.execute("UPDATE leads SET payment_id = ? WHERE id = ?", (data["id"], lead_id))
    utm_note = f", {utm}" if utm != "{}" else ""
    # уведомление в фоне — не задерживаем редирект пользователя на оплату
    asyncio.create_task(notify_admin(
        f"🆕 Лид #{lead_id}: {name} ({contact}, {email}) — "
        f"{plan['title']}, {plan['rub']} ₽, "
        f"{'юрлицо ' + str(org_name) if buyer_type == 'company' else 'физлицо'}{utm_note}"
    ))
    return {
        "payment_id": data["id"],
        "confirmation_url": data["confirmation"]["confirmation_url"],
    }


@app.get("/api/lead/status")
async def lead_status(payment_id: str = ""):
    if not re.fullmatch(r"[a-f0-9-]{36}", payment_id):
        raise HTTPException(400, "bad payment_id")
    with db() as conn:
        lead = conn.execute(
            "SELECT paid, code FROM leads WHERE payment_id = ?", (payment_id,)
        ).fetchone()
    if not lead:
        raise HTTPException(404, "not found")
    if not lead["paid"]:
        # вебхук мог не дойти — проверяем напрямую
        await settle_yk_payment(payment_id)
        with db() as conn:
            lead = conn.execute(
                "SELECT paid, code FROM leads WHERE payment_id = ?", (payment_id,)
            ).fetchone()
    if lead["paid"] and lead["code"]:
        return {"paid": True, "link": f"{BOT_URL}?start={lead['code']}"}
    return {"paid": False}


# --- Вебхук бота: платежи и /start ---

async def tg_call(method: str, payload: dict) -> None:
    await http_client.post(f"{TG_API}/{method}", json=payload)


async def notify_admin(text: str) -> None:
    if not ADMIN_CHAT_ID:
        return
    try:
        await tg_call("sendMessage", {"chat_id": ADMIN_CHAT_ID, "text": text})
    except Exception:
        pass  # уведомление не должно ломать основной поток


def grant_premium(tg_id: int, plan_id: str, provider: str, amount: int,
                  currency: str, charge_id: str | None) -> None:
    plan = PLANS[plan_id]
    now = int(time.time())
    with db() as conn:
        try:
            conn.execute(
                """INSERT INTO payments (tg_id, plan, provider, amount, currency,
                   charge_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (tg_id, plan_id, provider, amount, currency, charge_id, now),
            )
        except sqlite3.IntegrityError:
            return  # повторная доставка того же платежа
        row = conn.execute(
            "SELECT premium_until, created_at FROM users WHERE tg_id = ?", (tg_id,)
        ).fetchone()
        base = max(now, row["premium_until"]) if row else now
        new_until = base + plan["days"] * 86400
        conn.execute(
            """INSERT INTO users (tg_id, created_at, premium_until) VALUES (?, ?, ?)
               ON CONFLICT(tg_id) DO UPDATE SET premium_until = ?""",
            (tg_id, now, new_until, new_until),
        )


@app.post("/api/tg-webhook")
async def tg_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str = Header(""),
):
    """Ответ бота уходит прямо в HTTP-ответе вебхука (поле method) —
    без исходящего запроса к api.telegram.org, мгновенно для пользователя."""
    if WEBHOOK_SECRET and x_telegram_bot_api_secret_token != WEBHOOK_SECRET:
        raise HTTPException(403, "bad secret")
    update = await request.json()

    if pcq := update.get("pre_checkout_query"):
        payload = pcq.get("invoice_payload", "")
        ok = payload.startswith("sub:") and payload.split(":")[2] in PLANS
        return {
            "method": "answerPreCheckoutQuery",
            "pre_checkout_query_id": pcq["id"],
            "ok": ok,
            **({} if ok else {"error_message": "Неизвестный тариф, попробуй ещё раз."}),
        }

    if message := update.get("message"):
        chat_id = message["chat"]["id"]

        def reply(text, keyboard=None):
            resp = {"method": "sendMessage", "chat_id": chat_id, "text": text}
            if keyboard:
                resp["reply_markup"] = {"inline_keyboard": keyboard}
            return resp

        if sp := message.get("successful_payment"):
            _, tg_id, plan_id = sp["invoice_payload"].split(":")
            grant_premium(
                int(tg_id), plan_id, "stars",
                sp["total_amount"], sp["currency"],
                sp.get("telegram_payment_charge_id"),
            )
            return reply("Подписка активна! Полный доступ открыт — держись курса 💪")

        text = message.get("text") or ""

        if text.startswith("/start"):
            # Активация оплаченного лида: /start act_XXXX
            parts = text.split(maxsplit=1)
            if len(parts) == 2 and parts[1].startswith("act_"):
                plan_id = redeem_lead(parts[1].strip(), message["from"]["id"])
                if plan_id:
                    return reply(
                        f"Оплата найдена — подписка «{PLANS[plan_id]['title']}» "
                        "активирована! Полный доступ открыт 💪",
                        [[{"text": "Открыть приложение", "web_app": {"url": APP_URL}}]],
                    )
                return reply(
                    "Код активации не найден или уже использован. "
                    "Если ты оплатил на сайте — напиши нам, разберёмся."
                )
            return reply(
                "Привет! Это Ребут — перезагрузка дофамина за 90 дней.\n"
                "Стрик-каунтер, план на каждый день и паник-кнопка на случай тяги.\n"
                "Первые сутки — полный доступ бесплатно.\n\n"
                "Используя сервис, вы принимаете оферту и правила сервиса, "
                "политику обработки персональных данных и даёте согласие на "
                "обработку персональных данных (документы — по кнопкам ниже).\n"
                "Удалить свои данные можно в любой момент командой /delete_me.",
                [
                    [{"text": "Открыть приложение", "web_app": {"url": APP_URL}}],
                    [{"text": "📄 Оферта и правила сервиса", "url": f"{DOCS_URL}oferta.html"}],
                    [{"text": "🔒 Политика обработки ПДн", "url": f"{DOCS_URL}privacy.html"}],
                    [{"text": "📝 Согласие на обработку ПДн", "url": f"{DOCS_URL}consent.html"}],
                ],
            )

        if text.startswith("/delete_me"):
            delete_user_data(message["from"]["id"], "delete_me")
            return reply(
                "Персональные данные удалены: профиль, подписка и прогресс "
                "стёрты. Дальнейшее использование приложения станет "
                "возможным после повторного принятия оферты и политики ПДн — "
                "просто открой приложение заново."
            )
    return {"ok": True}


@app.get("/api/health")
def health():
    return {"ok": True}
