"""
מנוע המלצת פיזור מזומן חדש.
ה-LLM מציע אחוזים (%) בלבד עם נימוק טקסטואלי,
ו-Python מחשב את הסכומים בש"ח ומוודא שהסכום מסתכמים ל-100%.
"""

import json
import logging
import re
from typing import Optional, List, Dict
from crewai import Agent, Task, Crew, Process, LLM
from app.config import PRIMARY_MODEL, FALLBACK_MODEL

logger = logging.getLogger(__name__)

# קטגוריות מותרות כברירת מחדל
VALID_CATEGORIES = {
    "equity_index": "מדדי מניות",
    "individual_stocks": "מניות בודדות",
    "bonds_government": "אג'ח ממשלתי",
    "bonds_corporate": "אג'ח קונצרני",
    "reit": "נדל\"ן / REIT",
    "cash_deposit": "מזומן / פיקדון"
}

def _build_llm(model_name: str) -> LLM:
    return LLM(model=model_name, temperature=0.3)

def recommend_cash_allocation(
    cash_amount: float,
    investor_age: Optional[int] = None,
    investment_horizon_years: Optional[int] = None,
    risk_tolerance: Optional[str] = None,
    investment_goal: Optional[str] = None,
    liquidity_needs: Optional[str] = None,
    existing_holdings: Optional[List[Dict]] = None
) -> dict:
    if cash_amount <= 0:
        raise ValueError("סכום המזומן חייב להיות גדול מ-0")

    profile_lines = []
    if investor_age is not None:
        profile_lines.append(f"- גיל: {investor_age}")
    if investment_horizon_years is not None:
        profile_lines.append(f"- אופק השקעה: {investment_horizon_years} שנים")
    if risk_tolerance:
        profile_lines.append(f"- סיכון: {risk_tolerance}")
    if investment_goal:
        profile_lines.append(f"- מטרה: {investment_goal}")
    if liquidity_needs:
        profile_lines.append(f"- נזילות: {liquidity_needs}")

    if profile_lines:
        profile_context = "\n".join(profile_lines)
    else:
        profile_context = "לא סופק פרופיל משקיע."

    if existing_holdings:
        holdings_json = json.dumps(existing_holdings, ensure_ascii=False, indent=2)
        holdings_context = f"אחזקות קיימות בתיק למניעת ריכוזיות יתר:\n{holdings_json}"
    else:
        holdings_context = "אין תיק קיים (המלצה בוואקום)."

    categories_list_str = "\n".join([f"- `{k}` ({v})" for k, v in VALID_CATEGORIES.items()])

    llm = _build_llm(PRIMARY_MODEL)

    asset_allocator = Agent(
        role="מומחה הקצאת נכסים ופיזור מזומן",
        goal="להמליץ על פיזור אופטימלי של מזומן חדש לפי קטגוריות נכסים",
        backstory="אנליסט בכיר המתמחה בהקצאת נכסים (Asset Allocation) ובבניית תיקי השקעות מותאמים אישית.",
        llm=llm
    )

    prompt_description = f"""
אתה נדרש להמליץ על פיזור סכום מזומן חדש בסך {cash_amount:,.2f} ש"ח.

### קטגוריות מותרות לשימוש בלבד:
{categories_list_str}

### פרופיל המשקיע:
{profile_context}

### הקשר התיק הקיים:
{holdings_context}

### הנחיות קריטיות:
1. החזר אך ורק אובייקט JSON תקין, ללא markdown fences (ללא ```json).
2. אל תשתמש בגרשיים כפולות (") בתוך הטקסט של הנימוקים בעברית - השתמש בגרש בודד (') עבור ראשי תיבות או מילים (למשל: אג'ח ולא אג"ח), כדי לא לשבור את מבנה ה-JSON.
3. קבע לכל קטגוריה שאתה ממליץ עליה אחוז (percentage) בין 0 ל-100.
4. סכום האחוזים של כל הקטגוריות המוצעות חייב להיות בדיוק 100.
5. רשום לכל קטגוריה נימוק קצר (reasoning) של 2-3 משפטים בעברית מקצועית.
6. צרף בשדה `summary_text` סיכום אסטרטגי כללי קצר (3-4 משפטים).

פורמט JSON מבוקש:
{{
  "summary_text": "סיכום אסטרטגי...",
  "allocation": [
    {{"category": "equity_index", "percentage": 40.0, "reasoning": "נימוק..."}},
    {{"category": "bonds_government", "percentage": 60.0, "reasoning": "נימוק..."}}
  ]
}}
"""

    task = Task(
        description=prompt_description,
        expected_output="אובייקט JSON בלבד בפורמט הנדרש",
        agent=asset_allocator
    )

    crew = Crew(
        agents=[asset_allocator],
        tasks=[task],
        process=Process.sequential,
        verbose=False
    )

    try:
        crew.kickoff()
        raw_output = task.output.raw
    except Exception as e:
        logger.warning(f"Primary model failed, retrying with fallback: {e}")
        asset_allocator.llm = _build_llm(FALLBACK_MODEL)
        crew.kickoff()
        raw_output = task.output.raw

    return _parse_and_calculate_allocation(raw_output, cash_amount)


def _parse_and_calculate_allocation(raw_text: str, cash_amount: float) -> dict:
    text = raw_text.strip()
    
    # ניקוי מעטפת markdown אם קיימת
    if text.startswith("```"):
        lines = text.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    # חילוץ ממוקד של בלוק ה-JSON מתוך הטקסט
    start_idx = text.find("{")
    end_idx = text.rfind("}")
    if start_idx != -1 and end_idx != -1:
        text = text[start_idx:end_idx + 1]

    # ניסיון פרסור JSON עם טיפול במקרי קיצון של גרשיים כפולות בטקסט עברי
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        try:
            # תיקון אוטומטי של גרשיים כפולות פנימיות בתוך מילים בעברית
            fixed_text = re.sub(r'(?<=[\u0590-\u05FF])"(?=[\u0590-\u05FF])', "'", text)
            data = json.loads(fixed_text)
        except json.JSONDecodeError as err:
            logger.error(f"Failed to parse LLM JSON response. Raw output:\n{raw_text}")
            raise ValueError(f"פורמט JSON לא תקין שהתקבל מה-AI: {err}")

    raw_allocation = data.get("allocation", [])
    summary_text = data.get("summary_text", "המלצת פיזור מזומן מותאמת אישית.")

    if not raw_allocation:
        raise ValueError("ה-LLM לא החזיר קטגוריות פיזור")

    valid_items = []
    for item in raw_allocation:
        cat = item.get("category")
        pct = float(item.get("percentage", 0))
        reasoning = item.get("reasoning", "")
        if cat in VALID_CATEGORIES and pct > 0:
            valid_items.append({"category": cat, "percentage": pct, "reasoning": reasoning})

    if not valid_items:
        raise ValueError("לא נותרו קטגוריות תקינות בפיזור")

    total_pct = sum(item["percentage"] for item in valid_items)
    if abs(total_pct - 100.0) > 15.0:
        raise ValueError(f"סטיית אחוזים גדולה מדי מתקבלת מה-LLM: {total_pct}%")

    processed_allocation = []
    for item in valid_items:
        normalized_pct = round((item["percentage"] / total_pct) * 100, 2)
        amount_ils = round((normalized_pct / 100.0) * cash_amount, 2)
        
        processed_allocation.append({
            "category": item["category"],
            "category_label": VALID_CATEGORIES[item["category"]],
            "percentage": normalized_pct,
            "amount": amount_ils,
            "reasoning": item["reasoning"]
        })

    return {
        "cash_amount": cash_amount,
        "summary_text": summary_text,
        "allocation": processed_allocation
    }