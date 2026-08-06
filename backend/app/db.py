"""
חיבור ל-Supabase. הבקאנד משתמש ב"מפתח שירות" (service key) - מפתח בעל הרשאה מלאה
שמדלג על RLS. לכן חשוב ביותר: כל שאילתה מהבקאנד *חייבת* לסנן ידנית לפי user_id,
כדי לא לחשוף בטעות נתונים של משתמש אחד למשתמש אחר.
"""

from functools import lru_cache
from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY


@lru_cache
def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_KEY לא מוגדרים ב-.env")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
