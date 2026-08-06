import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.db import get_supabase
from app.engine.cash_allocation import recommend_cash_allocation

router = APIRouter(prefix="/recommendations", tags=["recommendations"])

# Rate Limiting בזיכרון התהליך (per-process) - זהה ל-analysis.py
_USER_LAST_RECOMMENDATION = {}
COOLDOWN_SECONDS = 20

class CashAllocationRequest(BaseModel):
    cash_amount: float = Field(..., gt=0, description="סכום המזומן להשקעה בש\"ח")
    investor_age: Optional[int] = None
    investment_horizon_years: Optional[int] = None
    risk_tolerance: Optional[str] = None
    investment_goal: Optional[str] = None
    liquidity_needs: Optional[str] = None
    portfolio_id: Optional[str] = None

@router.post("/cash-allocation")
def get_cash_allocation_recommendation(
    req: CashAllocationRequest,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["id"]

    # בדיקת Rate Limit (צינון בין קריאות)
    now = time.time()
    last_run = _USER_LAST_RECOMMENDATION.get(user_id, 0)
    if now - last_run < COOLDOWN_SECONDS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"נא להמתין {int(COOLDOWN_SECONDS - (now - last_run))} שניות בין בקשות המלצה."
        )

    existing_holdings = None
    supabase = get_supabase()

    # אם סופק portfolio_id - שולפים את ה-holdings הקיימים לטובת הזרקת הקשר
    if req.portfolio_id:
        port_res = supabase.table("portfolios").select("id").eq("id", req.portfolio_id).eq("user_id", user_id).execute()
        if port_res.data:
            holdings_res = supabase.table("holdings").select("symbol, quantity, avg_price").eq("portfolio_id", req.portfolio_id).execute()
            existing_holdings = holdings_res.data

    try:
        result = recommend_cash_allocation(
            cash_amount=req.cash_amount,
            investor_age=req.investor_age,
            investment_horizon_years=req.investment_horizon_years,
            risk_tolerance=req.risk_tolerance,
            investment_goal=req.investment_goal,
            liquidity_needs=req.liquidity_needs,
            existing_holdings=existing_holdings
        )
        _USER_LAST_RECOMMENDATION[user_id] = now
        return result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"שגיאה ביצירת המלצת הפיזור: {str(e)}"
        )
