import logging
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import validate_config
from app.routers import portfolios, analysis, recommendations

# תצורת logging בסיסית - כל שאר הקבצים (auth.py, routers) ישתמשו ב-
# logging.getLogger(__name__) וירשו את התצורה הזו אוטומטית.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Sentry initialization for Error Tracking (Priority 2)
# The DSN will be read from the SENTRY_DSN environment variable on Render.
import sentry_sdk
sentry_dsn = os.environ.get("SENTRY_DSN", "").strip()
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
    )
    logger.info("Sentry initialized successfully")
else:
    logger.warning("SENTRY_DSN not provided, Sentry error tracking is disabled")

app = FastAPI(title="Portfolio Analysis API")

# CORS - מאפשר ל-Frontend (שרץ על כתובת אחרת) לדבר עם ה-API הזה.
#
# שינוי לעומת הגרסה הקודמת: הוסר allow_origins=["*"] (שהתיר גישה מכל דומיין
# באינטרנט - לא בטוח בפרודקשן) והוחלף ברשימה מפורשת, הנקראת ממשתנה סביבה
# ALLOWED_ORIGINS (מחרוזת דומיינים מופרדת בפסיקים, בלי רווחים). כך אפשר
# לעדכן את רשימת הדומיינים המורשים (למשל אם כתובת ה-Vercel תשתנה, או
# תתווסף כתובת production נוספת) בלי לגעת בקוד - רק בהגדרות הסביבה של Render.
#
# אם ALLOWED_ORIGINS לא מוגדר בכלל (למשל בפיתוח מקומי, לפני שיוצרים .env
# עם הערך הזה) - נופלים חזרה לברירת מחדל שמכסה רק פיתוח מקומי (localhost)
# ואת כתובת ה-production הידועה נכון לעכשיו, לא "*".
_DEFAULT_ALLOWED_ORIGINS = (
    "http://localhost:5173,"
    "http://127.0.0.1:5173,"
    "https://portfolio-app-zeta-peach.vercel.app"
)
_allowed_origins_raw = os.environ.get("ALLOWED_ORIGINS", _DEFAULT_ALLOWED_ORIGINS)
ALLOWED_ORIGINS = [origin.strip() for origin in _allowed_origins_raw.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(portfolios.router)
app.include_router(analysis.router)
app.include_router(recommendations.router)


@app.on_event("startup")
def startup():
    validate_config()
    logger.info("Portfolio Analysis API started")
    logger.info("CORS allowed origins: %s", ALLOWED_ORIGINS)


from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    תופס כל חריגה לא-צפויה שלא טופלה במקום אחר. רושם ללוג את השגיאה המלאה
    (כולל traceback, לצורך אבחון מהיר בפרודקשן) - אבל מחזיר ללקוח תגובה נקייה
    בלי לחשוף פרטי implementation. זה מונע "קריסה" גולמית שמגיעה למשתמש.
    """
    if isinstance(exc, StarletteHTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "שגיאת שרת פנימית - הצוות טכני קיבל התראה"},
    )

# Code version - bump this on every deploy to verify Render picked up the change
_CODE_VERSION = "2026-08-07-v3-queryparam"


from app.db import get_supabase

@app.get("/health")
def health_check():
    """
    בדיקת תקינות בסיסית של השרת והחיבור למסד הנתונים.
    משמש גם למניעת Cold Starts מול UptimeRobot.
    """
    supabase_status = "ok"
    try:
        supabase = get_supabase()
        # Query a single row from a lightweight table or just check auth admin
        response = supabase.table("portfolios").select("id").limit(1).execute()
    except Exception as e:
        logger.error(f"Supabase health check failed: {e}")
        supabase_status = "error"

    return {
        "status": "ok" if supabase_status == "ok" else "degraded",
        "version": _CODE_VERSION,
        "supabase": supabase_status
    }

@app.get("/debug/lang")
def debug_lang(request: Request):
    """
    Hit this endpoint in the browser to verify language detection.
    Example: /debug/lang?lang=en  or  /debug/lang?lang=he
    """
    qp = request.query_params.get("lang", "MISSING")
    hdr_xapp = request.headers.get("x-app-language", "MISSING")
    hdr_accept = request.headers.get("accept-language", "MISSING")

    # Same logic as routers
    lang = qp.strip().lower() if qp != "MISSING" else ""
    resolved = lang if lang in ("en", "he") else None
    if not resolved:
        lang2 = hdr_xapp.strip().lower() if hdr_xapp != "MISSING" else ""
        resolved = lang2 if lang2 in ("en", "he") else "en"

    return {
        "resolved_language": resolved,
        "query_param_lang": qp,
        "header_x_app_language": hdr_xapp,
        "header_accept_language": hdr_accept,
        "code_version": _CODE_VERSION,
    }
