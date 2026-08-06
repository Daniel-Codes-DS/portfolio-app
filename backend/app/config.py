"""
הגדרות האפליקציה - נטענות ממשתני סביבה (.env).
"""

import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")  # מפתח שירות - גישה מלאה, שרת בלבד!
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")    # לאימות טוקנים של משתמשים

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")

PRIMARY_MODEL = os.environ.get("PRIMARY_MODEL", "gemini/gemini-3.1-flash-lite")
FALLBACK_MODEL = os.environ.get("FALLBACK_MODEL", "gemini/gemini-3.5-flash")

LOOKBACK_PERIOD = os.environ.get("LOOKBACK_PERIOD", "2y")

FEE_CONFIG = {
    "pct_fee": float(os.environ.get("FEE_PCT", "0.0008")),
    "min_fee": float(os.environ.get("FEE_MIN", "5.0")),
    "effort_minutes_per_trade": int(os.environ.get("FEE_EFFORT_MINUTES", "5")),
    "hourly_value": float(os.environ.get("FEE_HOURLY_VALUE", "150")),
}

if GOOGLE_API_KEY:
    os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY
    os.environ["GEMINI_API_KEY"] = GOOGLE_API_KEY

REQUIRED_SETTINGS = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "SUPABASE_JWT_SECRET", "GOOGLE_API_KEY"]


def validate_config():
    missing = [name for name in REQUIRED_SETTINGS if not globals().get(name)]
    if missing:
        raise RuntimeError(
            f"חסרות הגדרות חובה ב-.env: {', '.join(missing)}. ראו .env.example."
        )
