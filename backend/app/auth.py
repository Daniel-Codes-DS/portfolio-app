import concurrent.futures
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

# timeout מפורש על קריאת get_user ל-Supabase. בלי זה, אם Supabase לא עונה
# כלל, הבקשה תיתקע עד ל-TCP timeout של מערכת ההפעלה (דקות) - זה בלתי-קביל.
# 10 שניות: מספיק לבקשה רשת תקינה (בד"כ < 500ms), אבל לא ממתינים לנצח.
_AUTH_TIMEOUT_SECONDS = 10

# ThreadPoolExecutor קבוע - ניצור thread יחיד לכל בקשת auth ונבדוק timeout.
# max_workers=4 מספיק לעומס הצפוי (free tier עם עד ~100 משתמשים).
_auth_executor = concurrent.futures.ThreadPoolExecutor(
    max_workers=4, thread_name_prefix="supabase-auth"
)


def _token_cache_key(token: str) -> str:
    # שומרים hash של הטוקן, לא את הטוקן עצמו, כדי לא להחזיק bearer token
    # תקף בזיכרון השרת בטקסט גלוי יותר משצריך.
    return hashlib.sha256(token.encode()).hexdigest()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    cache_key = _token_cache_key(token)

    # בדיקת מטמון - אם הטוקן אומת לאחרונה בפחות מ-60 שניות, אין צורך ב-round-trip
    cached = _TOKEN_CACHE.get(cache_key)
    if cached and (time.time() - cached["cached_at"]) < _CACHE_TTL_SECONDS:
        return cached["user"]

    supabase = get_supabase()

    # שלב 1: קריאת get_user ב-thread נפרד עם timeout מפורש.
    # future.result(timeout=N) זורק concurrent.futures.TimeoutError אם עברו N שניות.
    try:
        future = _auth_executor.submit(supabase.auth.get_user, token)
        user_response = future.result(timeout=_AUTH_TIMEOUT_SECONDS)

    except concurrent.futures.TimeoutError:
        # Supabase לא ענה תוך 10 שניות - בעיית זמינות, לא בעיית טוקן
        logger.error(
            "Supabase auth.get_user timed out after %ss", _AUTH_TIMEOUT_SECONDS
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable, please try again in a moment",
        )

    except Exception as e:
        # כשל רשת/connection error אחר - אותו טיפול: 503 לא 401
        logger.error("Supabase auth.get_user failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable, please try again in a moment",
        )

    # שלב 2: בדיקת תקינות הטוקן עצמו - בכוונה מחוץ ל-try כדי שלא ייתפס
    # ע"י ה-except הכללי ותאבד ההודעה המדויקת "Invalid token or expired session".
    if not user_response or not user_response.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token or expired session",
        )

    user_dict = user_response.user.model_dump()
    _TOKEN_CACHE[cache_key] = {"user": user_dict, "cached_at": time.time()}
    return user_dict