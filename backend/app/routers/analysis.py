# ============================================================
# analysis.py - קובץ מלא, להחלפה
# ============================================================
import logging
import time
import uuid
from collections import defaultdict

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_current_user
from app.db import get_supabase
from app.engine.data_loader import holdings_records_to_df
from app.engine import metrics as metrics_engine
from app.engine import ai_analysis
from app.engine import charts as charts_engine
from app.engine import pdf_report as pdf_engine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/portfolios/{portfolio_id}/analysis", tags=["analysis"])

# Rate limiting בזיכרון (per-process) - מתאים ל-instance יחיד. אם בעתיד יעברו
# ל-multi-instance deployment, יש להחליף למנגנון משותף (למשל Redis) - ראו HANDOVER.
_RATE_LIMIT_WINDOW_SECONDS = 3600
_RATE_LIMIT_MAX_REQUESTS = 5
_MIN_SECONDS_BETWEEN_REQUESTS = 20
_user_request_log: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(user_id: str):
    now = time.time()
    timestamps = _user_request_log[user_id]
    timestamps[:] = [t for t in timestamps if now - t < _RATE_LIMIT_WINDOW_SECONDS]

    if timestamps and (now - timestamps[-1]) < _MIN_SECONDS_BETWEEN_REQUESTS:
        logger.warning("Rate limit (cooldown) hit by user %s", user_id)
        raise HTTPException(429, f"יש להמתין לפחות {_MIN_SECONDS_BETWEEN_REQUESTS} שניות בין ניתוחים")

    if len(timestamps) >= _RATE_LIMIT_MAX_REQUESTS:
        logger.warning("Rate limit (hourly cap) hit by user %s", user_id)
        raise HTTPException(429, f"הגעת למגבלת {_RATE_LIMIT_MAX_REQUESTS} ניתוחים לשעה - נסה שוב מאוחר יותר")

    timestamps.append(now)


def _get_owned_portfolio(supabase, portfolio_id, user_id):
    # מחזיר * (כולל שדות פרופיל המשקיע) - נדרש כדי להעביר אותם ל-run_crew_analysis
    resp = supabase.table("portfolios").select("*").eq("id", portfolio_id).eq("user_id", user_id).execute()
    if not resp.data:
        raise HTTPException(404, "תיק לא נמצא")
    return resp.data[0]


def _safe_float(value):
    return float(value) if pd.notna(value) else None


@router.post("")
def run_analysis(portfolio_id: str, user=Depends(get_current_user)):
    _check_rate_limit(user["id"])

    supabase = get_supabase()
    # שליפת כל שדות התיק (כולל פרופיל המשקיע) - לא רק id
    portfolio = _get_owned_portfolio(supabase, portfolio_id, user["id"])

    holdings_resp = supabase.table("holdings").select("*").eq("portfolio_id", portfolio_id).execute()
    if not holdings_resp.data:
        raise HTTPException(400, "לא נמצאו אחזקות בתיק - יש להעלות קובץ או להוסיף אחזקות קודם")

    portfolio_df = holdings_records_to_df(holdings_resp.data)
    m = metrics_engine.compute_metrics(portfolio_df)

    # העברת שדות פרופיל המשקיע מרשומת התיק ל-run_crew_analysis
    # כל השדות nullable - אם לא מולאו, run_crew_analysis מתנהג כמו קודם (backward compatible)
    ai_result = ai_analysis.run_crew_analysis(
        m,
        investor_age=portfolio.get("investor_age"),
        investment_horizon_years=portfolio.get("investment_horizon_years"),
        risk_tolerance=portfolio.get("risk_tolerance"),
        investment_goal=portfolio.get("investment_goal"),
        liquidity_needs=portfolio.get("liquidity_needs"),
    )

    chart_bytes = charts_engine.generate_allocation_charts(
        m["summary_df"], ai_result["target_weights"], m["corr_matrix"]
    )
    pdf_bytes = pdf_engine.generate_pdf_report(
        ai_result["report_text"], m["summary_df"], chart_bytes,
        m["total_value"], m["annual_return"], m["annual_vol"], m["sharpe_ratio"],
    )

    pdf_path = f"{user['id']}/{portfolio_id}/{uuid.uuid4()}.pdf"
    supabase.storage.from_("reports").upload(pdf_path, pdf_bytes, {"content-type": "application/pdf"})

    run_resp = supabase.table("analysis_runs").insert({
        "portfolio_id": portfolio_id,
        "total_value": _safe_float(m["total_value"]),
        "annual_return": _safe_float(m["annual_return"]),
        "annual_vol": _safe_float(m["annual_vol"]),
        "sharpe_ratio": _safe_float(m["sharpe_ratio"]),
        "hhi_concentration": _safe_float(m["hhi_concentration"]),
        "report_text": ai_result["report_text"],
        "target_weights": ai_result["target_weights"],
        "pdf_storage_path": pdf_path,
    }).execute()

    analysis_id = run_resp.data[0]["id"]
    logger.info("Analysis %s completed for portfolio %s", analysis_id, portfolio_id)

    return {
        "analysis_id": analysis_id,
        "report_text": ai_result["report_text"],
        "target_weights": ai_result["target_weights"],
        "total_value": _safe_float(m["total_value"]),
        "annual_return": _safe_float(m["annual_return"]),
        "annual_vol": _safe_float(m["annual_vol"]),
        "sharpe_ratio": _safe_float(m["sharpe_ratio"]),
        "pdf_storage_path": pdf_path,
    }


@router.get("")
def list_analysis_history(portfolio_id: str, user=Depends(get_current_user)):
    supabase = get_supabase()
    _get_owned_portfolio(supabase, portfolio_id, user["id"])
    resp = (
        supabase.table("analysis_runs")
        .select("id, total_value, annual_return, annual_vol, sharpe_ratio, hhi_concentration, created_at")
        .eq("portfolio_id", portfolio_id)
        .order("created_at", desc=True)
        .execute()
    )
    return resp.data


@router.get("/{analysis_id}")
def get_analysis(portfolio_id: str, analysis_id: str, user=Depends(get_current_user)):
    supabase = get_supabase()
    _get_owned_portfolio(supabase, portfolio_id, user["id"])
    resp = (
        supabase.table("analysis_runs").select("*")
        .eq("id", analysis_id).eq("portfolio_id", portfolio_id).execute()
    )
    if not resp.data:
        raise HTTPException(404, "ניתוח לא נמצא")
    return resp.data[0]


@router.get("/{analysis_id}/pdf-url")
def get_pdf_download_url(portfolio_id: str, analysis_id: str, user=Depends(get_current_user)):
    """מייצר קישור הורדה זמני (תקף לשעה) לקובץ ה-PDF של ניתוח ספציפי."""
    supabase = get_supabase()
    _get_owned_portfolio(supabase, portfolio_id, user["id"])
    resp = (
        supabase.table("analysis_runs").select("pdf_storage_path")
        .eq("id", analysis_id).eq("portfolio_id", portfolio_id).execute()
    )
    if not resp.data:
        raise HTTPException(404, "ניתוח לא נמצא")

    pdf_path = resp.data[0].get("pdf_storage_path")
    if not pdf_path:
        raise HTTPException(404, "קובץ PDF לא נמצא עבור ניתוח זה")

    signed = supabase.storage.from_("reports").create_signed_url(pdf_path, 3600)
    return {"url": signed["signedURL"]}