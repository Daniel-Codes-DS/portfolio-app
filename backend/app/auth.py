import hashlib
import logging
import time

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.db import get_supabase

logger = logging.getLogger(__name__)
security = HTTPBearer()

# מטמון קצר-טווח (in-memory) לתוצאות אימות טוקן - חוסך קריאת רשת חוזרת
# ל-Supabase לאותו טוקן תוך זמן קצר. TTL קצר בכוונה (60 שניות): לא מחליף
# את פקיעת הטוקן האמיתית (Supabase עדיין הסמכות הבלעדית), רק מייעל.
# לא persistent (נמחק בכל restart של השרת) - וזה בסדר, זה רק אופטימיזציה.
_TOKEN_CACHE: dict[str, dict] = {}
_CACHE_TTL_SECONDS = 60


def _token_cache_key(token: str) -> str:
    # שומרים hash של הטוקן, לא את הטוקן עצמו, כדי לא להחזיק bearer token
    # תקף בזיכרון השרת בטקסט גלוי יותר משצריך.
    return hashlib.sha256(token.encode()).hexdigest()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    cache_key = _token_cache_key(token)

    cached = _TOKEN_CACHE.get(cache_key)
    if cached and (time.time() - cached["cached_at"]) < _CACHE_TTL_SECONDS:
        return cached["user"]

    supabase = get_supabase()

    try:
        user_response = supabase.auth.get_user(token)
    except Exception as e:
        # כשל רשת/timeout מול Supabase עצמו - זו לא בעיה עם הטוקן, זו זמינות
        # של שירות חיצוני. מחזירים 503 (לא 401) כדי לא להטעות את המשתמש
        # ("תתנתק ותתחבר מחדש" הוא הפתרון הלא-נכון פה), ולא חושפים את str(e)
        # הגולמי ללקוח - רק ללוג שלנו.
        logger.error("Supabase auth.get_user failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="שירות האימות אינו זמין כרגע, נסו שוב בעוד רגע",
        )

    # בכוונה מחוץ ל-try - כדי שלא ייתפס ע"י ה-except הכללי מעל ותאבד
    # ההודעה המדויקת "Invalid token or expired session".
    if not user_response or not user_response.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token or expired session",
        )

    user_dict = user_response.user.model_dump()
    _TOKEN_CACHE[cache_key] = {"user": user_dict, "cached_at": time.time()}
    return user_dict