"""
rate_limit.py - מגבלות קצב משותפות לכל ה-routers

מנגנון כפול:
1. Redis (Upstash) - אם REDIS_URL מוגדר בסביבה. יתרון: persistent בין restarts
   של Render, ועובד נכון אם יוספו instances נוספים בעתיד.
2. In-memory fallback - אם REDIS_URL לא מוגדר (פיתוח מקומי, או לפני הגדרת Upstash).
   מתנהג בדיוק כמו קודם - state נמחק ב-restart אבל עובד כצפוי ב-instance יחיד.

שימוש:
    from app.rate_limit import check_and_record
    check_and_record(user_id="...", key="analysis", max_per_hour=5, min_seconds_between=20)
    # זורק HTTPException(429) אם חריגה, אחרת ממשיך בשקט
"""

import logging
import os
import time
from collections import defaultdict

from fastapi import HTTPException

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Redis client (lazy init - לא מחבר בטעינת המודול, רק בשימוש ראשון)
# ---------------------------------------------------------------------------
_redis_client = None
_redis_unavailable = False  # flag: לא לנסות חיבור מחדש אחרי כשל ראשוני


def _get_redis():
    """מחזיר redis client אם REDIS_URL מוגדר ו-Redis זמין. אחרת None."""
    global _redis_client, _redis_unavailable

    if _redis_client is not None:
        return _redis_client
    if _redis_unavailable:
        return None

    redis_url = os.environ.get("REDIS_URL", "").strip()
    if not redis_url:
        return None  # REDIS_URL לא מוגדר - fallback מיידי לזיכרון

    try:
        import redis

        client = redis.from_url(
            redis_url,
            decode_responses=True,
            socket_timeout=3,
            socket_connect_timeout=3,
        )
        client.ping()  # בדיקה שהחיבור אכן עובד
        _redis_client = client
        logger.info(
            "Rate limiter: connected to Redis at %s",
            redis_url.split("@")[-1] if "@" in redis_url else "(upstash)",
        )
        return _redis_client

    except Exception as e:
        _redis_unavailable = True
        logger.warning(
            "Rate limiter: Redis connection failed (%s) - falling back to in-memory. "
            "Set REDIS_URL correctly to enable persistent rate limiting.",
            e,
        )
        return None


# ---------------------------------------------------------------------------
# In-memory fallback state
# ---------------------------------------------------------------------------
_mem_timestamps: dict[str, list[float]] = defaultdict(list)
_mem_last_call: dict[str, float] = {}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def check_and_record(
    user_id: str,
    key: str,
    max_per_hour: int,
    min_seconds_between: int,
) -> None:
    """
    בודק אם המשתמש חרג ממגבלת הקצב. אם כן - זורק HTTPException(429).
    אם לא - רושם את הקריאה הנוכחית (שני שלבים: בדיקה + רישום אטומי ב-Redis).

    Args:
        user_id: מזהה המשתמש (מגיע מ-get_current_user)
        key: מזהה ייחודי לסוג הפעולה, למשל "analysis" או "cash_rec"
        max_per_hour: מקסימום קריאות תקינות בחלון שעה אחת
        min_seconds_between: מינימום שניות בין שתי קריאות עוקבות
    """
    r = _get_redis()
    if r is not None:
        _check_redis(r, user_id, key, max_per_hour, min_seconds_between)
    else:
        _check_memory(user_id, key, max_per_hour, min_seconds_between)


# ---------------------------------------------------------------------------
# Redis implementation
# ---------------------------------------------------------------------------

def _check_redis(r, user_id: str, key: str, max_per_hour: int, min_seconds_between: int):
    now = time.time()
    cooldown_key = f"rl:cd:{key}:{user_id}"   # מתי הייתה הקריאה האחרונה
    hourly_key = f"rl:hr:{key}:{user_id}"      # מונה קריאות בשעה הנוכחית

    try:
        # בדיקת cooldown - האם עבר מספיק זמן מהקריאה הקודמת?
        last_str = r.get(cooldown_key)
        if last_str is not None:
            last = float(last_str)
            remaining = min_seconds_between - (now - last)
            if remaining > 0:
                logger.warning(
                    "Rate limit (cooldown/redis): user=%s key=%s remaining=%.0fs",
                    user_id, key, remaining,
                )
                raise HTTPException(
                    429,
                    f"Please wait at least {int(remaining) + 1} seconds between requests",
                )

        # בדיקת מגבלה שעתית
        count_str = r.get(hourly_key)
        if count_str is not None and int(count_str) >= max_per_hour:
            logger.warning(
                "Rate limit (hourly/redis): user=%s key=%s count=%s limit=%d",
                user_id, key, count_str, max_per_hour,
            )
            raise HTTPException(
                429,
                f"You have reached the limit of {max_per_hour} requests per hour - please try again later",
            )

        # רישום: עדכון cooldown + הגדלת מונה שעתי (pipeline = atomically)
        pipe = r.pipeline()
        pipe.set(cooldown_key, now, ex=min_seconds_between + 10)
        pipe.incr(hourly_key)
        pipe.expire(hourly_key, 3600)
        pipe.execute()

    except HTTPException:
        raise  # לא לתפוס את ה-429 שלנו!

    except Exception as e:
        # Redis נפל באמצע - נרשום לוג אבל נאפשר את הבקשה (fail-open).
        # עדיף לאפשר בקשה לגיטימית אחת נוספת מאשר לחסום כל בקשה כשRedis לא זמין.
        logger.error(
            "Redis rate limit check failed (fail-open): user=%s key=%s error=%s",
            user_id, key, e,
        )


# ---------------------------------------------------------------------------
# In-memory implementation (identical behaviour to the old per-router code)
# ---------------------------------------------------------------------------

def _check_memory(user_id: str, key: str, max_per_hour: int, min_seconds_between: int):
    now = time.time()
    mem_key = f"{key}:{user_id}"

    # ניקוי timestamps ישנים מחוץ לחלון השעה
    timestamps = _mem_timestamps[mem_key]
    timestamps[:] = [t for t in timestamps if now - t < 3600]

    # בדיקת cooldown
    last = _mem_last_call.get(mem_key, 0)
    if now - last < min_seconds_between:
        remaining = min_seconds_between - (now - last)
        logger.warning(
            "Rate limit (cooldown/memory): user=%s key=%s remaining=%.0fs",
            user_id, key, remaining,
        )
        raise HTTPException(
            429,
            f"Please wait at least {int(remaining) + 1} seconds between requests",
        )

    # בדיקת מגבלה שעתית
    if len(timestamps) >= max_per_hour:
        logger.warning(
            "Rate limit (hourly/memory): user=%s key=%s count=%d limit=%d",
            user_id, key, len(timestamps), max_per_hour,
        )
        raise HTTPException(
            429,
            f"You have reached the limit of {max_per_hour} requests per hour - please try again later",
        )

    # רישום
    timestamps.append(now)
    _mem_last_call[mem_key] = now
