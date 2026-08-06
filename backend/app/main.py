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


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    תופס כל חריגה לא-צפויה שלא טופלה במקום אחר. רושם ללוג את השגיאה המלאה
    (כולל traceback, לצורך אבחון מהיר בפרודקשן) - אבל מחזיר ללקוח תגובה נקייה
    בלי לחשוף פרטי implementation. זה מונע "קריסה" גולמית שמגיעה למשתמש.
    """
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "שגיאת שרת פנימית - הצוות טכני קיבל התראה"},
    )


@app.get("/health")
def health():
    return {"status": "ok"}
