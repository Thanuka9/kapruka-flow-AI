import sqlite3
import json
import hashlib
import hmac
import secrets
from datetime import datetime
from typing import List, Dict, Optional

from .config import settings
from .logging_config import get_logger

logger = get_logger("database")

DB_PATH = settings.db_path

# Number of PBKDF2 iterations. High enough to be safe, low enough for fast auth.
_PBKDF2_ITERATIONS = 200_000


def get_db_connection():
    """Return a thread-safe SQLite connection with sane production pragmas."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=15.0)
    conn.row_factory = sqlite3.Row
    # WAL improves concurrent read/write; NORMAL sync is the durable+fast sweet spot.
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def hash_password(password: str) -> str:
    """Hash a password using PBKDF2-HMAC-SHA256 with a per-user random salt."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), _PBKDF2_ITERATIONS
    ).hex()
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    """Verify a password against a stored hash.

    Supports legacy plaintext rows for backward compatibility so existing
    accounts keep working; those should be re-hashed on next successful login.
    """
    if not stored:
        return False
    if stored.startswith("pbkdf2_sha256$"):
        try:
            _, iterations, salt, digest = stored.split("$", 3)
            computed = hashlib.pbkdf2_hmac(
                "sha256",
                password.encode("utf-8"),
                salt.encode("utf-8"),
                int(iterations),
            ).hex()
            return hmac.compare_digest(computed, digest)
        except Exception as exc:
            logger.warning("Password verify failed: %s", exc)
            return False
    # Legacy plaintext fallback.
    return hmac.compare_digest(password, stored)


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create sessions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)

    # Create messages table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions (session_id)
    )
    """)

    # Create cart_versions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cart_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        version_name TEXT NOT NULL,
        products_json TEXT NOT NULL,
        story_json TEXT,
        total_price REAL NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions (session_id)
    )
    """)

    # Create user_preferences table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_preferences (
        session_id TEXT PRIMARY KEY,
        budget REAL,
        language TEXT,
        city TEXT,
        delivery_speed TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions (session_id)
    )
    """)

    # Create delivery_state table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS delivery_state (
        session_id TEXT PRIMARY KEY,
        city TEXT,
        address TEXT,
        recipient_name TEXT,
        recipient_phone TEXT,
        sender_name TEXT,
        gift_message TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions (session_id)
    )
    """)

    # Create analytics table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        event_type TEXT NOT NULL,
        event_data TEXT NOT NULL,
        timestamp TEXT NOT NULL
    )
    """)

    # Create users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        password TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)

    # Create orders table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        order_id TEXT PRIMARY KEY,
        email TEXT,
        session_id TEXT NOT NULL,
        version TEXT NOT NULL,
        total_price REAL NOT NULL,
        delivery_city TEXT NOT NULL,
        recipient_name TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)

    # Safely alter table to add evolution column if not exists
    try:
        cursor.execute("ALTER TABLE user_preferences ADD COLUMN evolution TEXT")
    except sqlite3.OperationalError:
        pass  # Column already exists

    # Persist ordered product categories so the AI can learn real preferences.
    try:
        cursor.execute("ALTER TABLE orders ADD COLUMN categories TEXT")
    except sqlite3.OperationalError:
        pass  # Column already exists

    # Indexes for the hot read paths.
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_messages_session ON messages (session_id)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_cart_versions_session ON cart_versions (session_id)"
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_email ON orders (email)")
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics (session_id)"
    )

    conn.commit()
    conn.close()
    logger.info("Database initialized at %s", DB_PATH)


def create_session(session_id: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    try:
        cursor.execute(
            "INSERT OR IGNORE INTO sessions (session_id, created_at, updated_at) VALUES (?, ?, ?)",
            (session_id, now, now),
        )
        conn.commit()
        return True
    except Exception as e:
        logger.error("create_session failed: %s", e)
        return False
    finally:
        conn.close()


def save_message(session_id: str, role: str, content: str):
    create_session(session_id)
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    try:
        cursor.execute(
            "INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (session_id, role, content, now),
        )
        conn.commit()
    except Exception as e:
        logger.error("save_message failed: %s", e)
    finally:
        conn.close()


def get_messages(session_id: str) -> List[Dict]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT role, content, created_at FROM messages WHERE session_id = ? ORDER BY id ASC",
            (session_id,),
        )
        rows = cursor.fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error("get_messages failed: %s", e)
        return []
    finally:
        conn.close()


def safe_extract_price(p: dict) -> float:
    """Type-safe helper to parse product price into a float amount."""
    price = p.get("price", 0)
    if isinstance(price, dict):
        return float(price.get("amount", 0))
    try:
        return float(price)
    except (TypeError, ValueError):
        return 0.0


def save_cart_versions(
    session_id: str, versions: Dict[str, List[Dict]], story: List[str]
):
    create_session(session_id)
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    try:
        # First clear old cart versions for this session to keep it clean
        cursor.execute("DELETE FROM cart_versions WHERE session_id = ?", (session_id,))

        # Save each version
        for version_name, products in versions.items():
            total_price = sum(safe_extract_price(p) for p in products)
            cursor.execute(
                "INSERT INTO cart_versions (session_id, version_name, products_json, story_json, total_price, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    session_id,
                    version_name,
                    json.dumps(products),
                    json.dumps(story),
                    total_price,
                    now,
                ),
            )
        conn.commit()
    except Exception as e:
        logger.error("save_cart_versions failed: %s", e)
    finally:
        conn.close()


def get_cart_versions(session_id: str) -> Dict[str, List[Dict]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    versions = {}
    try:
        cursor.execute(
            "SELECT version_name, products_json FROM cart_versions WHERE session_id = ?",
            (session_id,),
        )
        rows = cursor.fetchall()
        for r in rows:
            versions[r["version_name"]] = json.loads(r["products_json"])
        return versions
    except Exception as e:
        logger.error("get_cart_versions failed: %s", e)
        return {}
    finally:
        conn.close()


def get_story(session_id: str) -> List[str]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT story_json FROM cart_versions WHERE session_id = ? LIMIT 1",
            (session_id,),
        )
        row = cursor.fetchone()
        if row and row["story_json"]:
            return json.loads(row["story_json"])
        return []
    except Exception as e:
        logger.error("get_story failed: %s", e)
        return []
    finally:
        conn.close()


def save_user_preferences(
    session_id: str,
    budget: float,
    language: str,
    city: str,
    delivery_speed: str,
    evolution: str = None,
):
    create_session(session_id)
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if evolution is not None:
            cursor.execute(
                """INSERT INTO user_preferences (session_id, budget, language, city, delivery_speed, evolution)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT(session_id) DO UPDATE SET
                   budget=excluded.budget, language=excluded.language, city=excluded.city, 
                   delivery_speed=excluded.delivery_speed, evolution=excluded.evolution""",
                (session_id, budget, language, city, delivery_speed, evolution),
            )
        else:
            cursor.execute(
                """INSERT INTO user_preferences (session_id, budget, language, city, delivery_speed)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(session_id) DO UPDATE SET
                   budget=excluded.budget, language=excluded.language, city=excluded.city, delivery_speed=excluded.delivery_speed""",
                (session_id, budget, language, city, delivery_speed),
            )
        conn.commit()
    except Exception as e:
        logger.error("save_user_preferences failed: %s", e)
    finally:
        conn.close()


def get_user_preferences(session_id: str) -> Optional[Dict]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT budget, language, city, delivery_speed, evolution FROM user_preferences WHERE session_id = ?",
            (session_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    except Exception as e:
        logger.error("get_user_preferences failed: %s", e)
        return None
    finally:
        conn.close()


def save_delivery_state(
    session_id: str,
    city: str,
    address: str,
    recipient_name: str,
    recipient_phone: str,
    sender_name: str,
    gift_message: str,
):
    create_session(session_id)
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """INSERT INTO delivery_state (session_id, city, address, recipient_name, recipient_phone, sender_name, gift_message)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(session_id) DO UPDATE SET
               city=excluded.city, address=excluded.address, recipient_name=excluded.recipient_name,
               recipient_phone=excluded.recipient_phone, sender_name=excluded.sender_name, gift_message=excluded.gift_message""",
            (
                session_id,
                city,
                address,
                recipient_name,
                recipient_phone,
                sender_name,
                gift_message,
            ),
        )
        conn.commit()
    except Exception as e:
        logger.error("save_delivery_state failed: %s", e)
    finally:
        conn.close()


def get_delivery_state(session_id: str) -> Optional[Dict]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT city, address, recipient_name, recipient_phone, sender_name, gift_message FROM delivery_state WHERE session_id = ?",
            (session_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    except Exception as e:
        logger.error("get_delivery_state failed: %s", e)
        return None
    finally:
        conn.close()


def log_analytics(session_id: Optional[str], event_type: str, event_data: Dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    try:
        cursor.execute(
            "INSERT INTO analytics (session_id, event_type, event_data, timestamp) VALUES (?, ?, ?, ?)",
            (session_id, event_type, json.dumps(event_data), now),
        )
        conn.commit()
    except Exception as e:
        logger.error("log_analytics failed: %s", e)
    finally:
        conn.close()


# User Credentials Functions
def create_user(email: str, name: str, password: str):
    """Create a user, storing only a salted PBKDF2 hash of the password."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    try:
        cursor.execute(
            "INSERT OR REPLACE INTO users (email, name, password, created_at) VALUES (?, ?, ?, ?)",
            (email, name, hash_password(password), now),
        )
        conn.commit()
    except Exception as e:
        logger.error("create_user failed: %s", e)
    finally:
        conn.close()


def get_user(email: str) -> Optional[Dict]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT email, name, password FROM users WHERE email = ?", (email,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    except Exception as e:
        logger.error("get_user failed: %s", e)
        return None
    finally:
        conn.close()


# User Orders History Functions
def save_order(
    order_id: str,
    email: Optional[str],
    session_id: str,
    version: str,
    total_price: float,
    delivery_city: str,
    recipient_name: str,
    categories: Optional[List[str]] = None,
):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    categories_csv = ",".join(
        sorted({c.strip().lower() for c in (categories or []) if c and c.strip()})
    )
    try:
        cursor.execute(
            """INSERT INTO orders (order_id, email, session_id, version, total_price, delivery_city, recipient_name, created_at, categories)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                order_id,
                email,
                session_id,
                version,
                total_price,
                delivery_city,
                recipient_name,
                now,
                categories_csv,
            ),
        )
        conn.commit()
    except Exception as e:
        logger.error("save_order failed: %s", e)
    finally:
        conn.close()


def get_user_orders(email: str) -> List[Dict]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT order_id, session_id, version, total_price, delivery_city, recipient_name, created_at, categories FROM orders WHERE email = ? ORDER BY created_at DESC",
            (email,),
        )
        rows = cursor.fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error("get_user_orders failed: %s", e)
        return []
    finally:
        conn.close()


def get_session_order(session_id: str, version: str) -> Optional[Dict]:
    """Retrieve an order by session_id and version (idempotency key lookup)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT order_id, session_id, version, total_price, delivery_city, recipient_name, created_at, categories FROM orders WHERE session_id = ? AND version = ? LIMIT 1",
            (session_id, version),
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    except Exception as e:
        logger.error("get_session_order failed: %s", e)
        return None
    finally:
        conn.close()
