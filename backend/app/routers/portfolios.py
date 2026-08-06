import logging
import math

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.auth import get_current_user
from app.db import get_supabase
from app.models import PortfolioCreate, PortfolioUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/portfolios", tags=["portfolios"])

# מגבלות על קובץ מועלה - מונעות עומס זיכרון/CPU מקובץ ענק בטעות.
MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024  # 5MB
MAX_UPLOAD_ROWS = 2000


def _get_owned_portfolio(supabase, portfolio_id, user_id):
    resp = supabase.table("portfolios").select("*").eq("id", portfolio_id).eq("user_id", user_id).execute()
    if not resp.data:
        raise HTTPException(404, "Portfolio not found")
    return resp.data[0]


@router.get("")
def list_portfolios(user=Depends(get_current_user)):
    supabase = get_supabase()
    resp = (
        supabase.table("portfolios").select("*")
        .eq("user_id", user["id"]).order("created_at", desc=True).execute()
    )
    return resp.data


@router.post("")
def create_portfolio(payload: PortfolioCreate, user=Depends(get_current_user)):
    supabase = get_supabase()

    # בניית רשומת התיק - כוללת את 5 שדות פרופיל המשקיע (כולם nullable)
    insert_data = {
        "user_id": user["id"],
        "name": payload.name,
        "investor_age": payload.investor_age,
        "investment_horizon_years": payload.investment_horizon_years,
        "risk_tolerance": payload.risk_tolerance,
        "investment_goal": payload.investment_goal,
        "liquidity_needs": payload.liquidity_needs,
    }
    # הסרת None מפורשת לא נדרשת - Supabase/PostgREST מטפל בהם כ-NULL,
    # אך נשאיר אותם כדי שה-record יכלול את כל העמודות (למקרה של logging/debug)

    portfolio_resp = supabase.table("portfolios").insert(insert_data).execute()
    portfolio = portfolio_resp.data[0]

    if payload.holdings:
        rows = [{"portfolio_id": portfolio["id"], **h.model_dump()} for h in payload.holdings]
        supabase.table("holdings").insert(rows).execute()

    return portfolio


@router.patch("/{portfolio_id}")
def update_portfolio(portfolio_id: str, payload: PortfolioUpdate, user=Depends(get_current_user)):
    """עדכון פרופיל המשקיע של תיק קיים (ללא שינוי האחזקות).
    רק שדות שסופקו בפועל (לא None) יעודכנו - partial update."""
    supabase = get_supabase()
    _get_owned_portfolio(supabase, portfolio_id, user["id"])

    # model_dump עם exclude_none=True - שולח רק שדות שהמשתמש מילא בפועל
    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(400, "No fields provided for update")

    resp = supabase.table("portfolios").update(update_data).eq("id", portfolio_id).execute()
    return resp.data[0]


@router.get("/{portfolio_id}")
def get_portfolio(portfolio_id: str, user=Depends(get_current_user)):
    supabase = get_supabase()
    # שימוש ב-_get_owned_portfolio שמחזיר * (כולל שדות פרופיל)
    portfolio = _get_owned_portfolio(supabase, portfolio_id, user["id"])
    holdings = supabase.table("holdings").select("*").eq("portfolio_id", portfolio_id).execute()
    return {**portfolio, "holdings": holdings.data}


@router.put("/{portfolio_id}/holdings")
def replace_holdings(portfolio_id: str, holdings: list[dict], user=Depends(get_current_user)):
    """מחליף את כל האחזקות בתיק - שימושי לעדכון התיק לפי המלצות מהניתוח."""
    supabase = get_supabase()
    _get_owned_portfolio(supabase, portfolio_id, user["id"])

    supabase.table("holdings").delete().eq("portfolio_id", portfolio_id).execute()
    if holdings:
        rows = [{"portfolio_id": portfolio_id, **h} for h in holdings]
        supabase.table("holdings").insert(rows).execute()

    return {"status": "updated", "count": len(holdings)}


@router.post("/{portfolio_id}/upload")
async def upload_portfolio_file(portfolio_id: str, file: UploadFile = File(...), user=Depends(get_current_user)):
    """מעלה קובץ (CSV/Excel/PDF/תמונה) ומחליף את אחזקות התיק בהתאם לתוכן שזוהה."""
    from app.engine.data_loader import load_portfolio_file

    supabase = get_supabase()
    _get_owned_portfolio(supabase, portfolio_id, user["id"])

    content = await file.read()

    # בדיקת גודל - לפני כל פרסור, כדי לא לבזבז CPU/זיכרון על קובץ שנדחה ממילא.
    if len(content) > MAX_UPLOAD_SIZE_BYTES:
        logger.warning(
            "Upload rejected: file too large (%d bytes) for portfolio %s",
            len(content), portfolio_id,
        )
        raise HTTPException(
            400,
            f"File too large ({len(content) / (1024*1024):.1f} MB) – "
            f"maximum allowed size is {MAX_UPLOAD_SIZE_BYTES // (1024*1024)} MB",
        )

    try:
        df, diagnostics = load_portfolio_file(file.filename, content)
    except Exception as e:
        logger.warning("Failed to parse uploaded file '%s' for portfolio %s: %s", file.filename, portfolio_id, e)
        raise HTTPException(400, f"Failed to parse uploaded file: {e}")

    # בדיקת מספר שורות - אחרי הפרסור (כי רק אז יודעים כמה שורות תקינות יש בפועל),
    # אבל לפני ה-insert ל-DB, כדי לא ליצור insert ענק שיכביד על הבקשה ל-Supabase.
    if len(df) > MAX_UPLOAD_ROWS:
        logger.warning(
            "Upload rejected: too many rows (%d) for portfolio %s", len(df), portfolio_id,
        )
        raise HTTPException(
            400,
            f"File contains {len(df)} valid rows – maximum allowed is {MAX_UPLOAD_ROWS}",
        )

    def _clean_value(v):
        if isinstance(v, float) and math.isnan(v):
            return None
        return v

    rows = [
        {k: _clean_value(v) for k, v in r.items()}
        for r in df.to_dict(orient="records")
    ]
    supabase.table("holdings").delete().eq("portfolio_id", portfolio_id).execute()
    if rows:
        insert_rows = [{"portfolio_id": portfolio_id, **r} for r in rows]
        supabase.table("holdings").insert(insert_rows).execute()

    ticker_check = diagnostics.get("ticker_check", {})
    logger.info(
        "Uploaded %d holdings to portfolio %s (merged=%d, ignored_columns=%s, "
        "ticker_check_ok=%s, unresolved=%s)",
        len(rows), portfolio_id,
        diagnostics.get("duplicate_tickers_merged", 0),
        diagnostics.get("columns_ignored", []),
        ticker_check.get("checked"),
        ticker_check.get("unresolved_tickers"),
    )

    return {
        "status": "uploaded",
        "holdings_count": len(rows),
        "summary": {
            "rows_accepted": diagnostics.get("rows_accepted", len(rows)),
            "rows_dropped_summary_labels": diagnostics.get("dropped_summary_rows", 0),
            "rows_dropped_missing_data": diagnostics.get("dropped_missing_data_rows", 0),
            "duplicate_tickers_merged": diagnostics.get("duplicate_tickers_merged", 0),
            "columns_ignored": diagnostics.get("columns_ignored", []),
            "ticker_check_completed": ticker_check.get("checked", False),
            "unresolved_tickers": ticker_check.get("unresolved_tickers", []),
        },
    }