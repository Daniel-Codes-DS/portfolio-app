import logging
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
# בפרודקשן: תחליפו את "*" לכתובת המדויקת של ה-Frontend שלכם (למשל https://your-app.vercel.app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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