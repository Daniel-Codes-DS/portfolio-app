import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.db import get_supabase
from app.rate_limit import check_and_record
from app.engine.cash_allocation import recommend_cash_allocation

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/recommendations", tags=["recommendations"])

_RATE_LIMIT_MAX_PER_HOUR = 10
_RATE_LIMIT_MIN_SECONDS  = 20
_RATE_LIMIT_KEY          = "cash_rec"


def _get_language(request: Request) -> str:
    lang = request.query_params.get("lang", "").strip().lower()
    if lang in ("en", "he"):
        return lang
    lang = request.headers.get("x-app-language", "").strip().lower()
    if lang in ("en", "he"):
        return lang
    return "en"


class CashAllocationRequest(BaseModel):
    cash_amount:              float          = Field(..., gt=0, description="Cash amount to invest")
    investor_age:             Optional[int]  = None
    investment_horizon_years: Optional[int]  = None
    risk_tolerance:           Optional[str]  = None
    investment_goal:          Optional[str]  = None
    liquidity_needs:          Optional[str]  = None
    portfolio_id:             Optional[str]  = None


@router.post("/cash-allocation")
def get_cash_allocation_recommendation(
    req: CashAllocationRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    user_id  = current_user["id"]
    language = _get_language(request)
    logger.info("=== CASH ALLOC LANGUAGE: %s (query_params=%s) ===", language, request.query_params.get('lang', 'MISSING'))

    check_and_record(
        user_id=user_id,
        key=_RATE_LIMIT_KEY,
        max_per_hour=_RATE_LIMIT_MAX_PER_HOUR,
        min_seconds_between=_RATE_LIMIT_MIN_SECONDS,
    )

    existing_holdings = None
    supabase = get_supabase()

    if req.portfolio_id:
        port_res = (
            supabase.table("portfolios")
            .select("id")
            .eq("id", req.portfolio_id)
            .eq("user_id", user_id)
            .execute()
        )
        if port_res.data:
            holdings_res = (
                supabase.table("holdings")
                .select("ticker, quantity, avg_price")
                .eq("portfolio_id", req.portfolio_id)
                .execute()
            )
            existing_holdings = holdings_res.data
        else:
            logger.warning(
                "cash-allocation: user %s sent portfolio_id %s that does not belong to them – ignoring",
                user_id, req.portfolio_id,
            )

    try:
        result = recommend_cash_allocation(
            cash_amount              = req.cash_amount,
            investor_age             = req.investor_age,
            investment_horizon_years = req.investment_horizon_years,
            risk_tolerance           = req.risk_tolerance,
            investment_goal          = req.investment_goal,
            liquidity_needs          = req.liquidity_needs,
            existing_holdings        = existing_holdings,
            language                 = language,
        )
        return result

    except Exception as e:
        logger.exception("cash-allocation failed for user %s: %s", user_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate allocation recommendation",
        )
