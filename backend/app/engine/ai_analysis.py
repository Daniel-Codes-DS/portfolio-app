"""
צוות סוכני CrewAI שמנתח את התיק - זהה ללוגיקה שכבר נבדקה בסוכן המייל.
מחזיר dict (לא tuple) בכוונה - כדי להימנע מבאגים של "too many values to unpack"
שכבר נתקלנו בהם בגרסה הקודמת של הפרויקט.
"""

import json
import logging
import pandas as pd
from typing import Optional
from crewai import Agent, Task, Crew, Process, LLM
from app.config import PRIMARY_MODEL, FALLBACK_MODEL, FEE_CONFIG

logger = logging.getLogger(__name__)

PROFESSIONAL_TONE = (
    "כתוב בטון מקצועי כמו קטע מתוך דוח אנליסט השקעות ללקוח - תמציתי, ענייני, בגוף שלישי. "
    "אל תפתח בפנייה אישית (למשל 'שלום', 'אני'), עבור ישר לתוכן."
)

# תרגום ערכי ה-enum לטקסט עברי ברור לפרומפט
_RISK_LABEL = {
    "conservative": "שמרן (מעדיף יציבות על פני תשואה, נמנע מתנודתיות גבוהה)",
    "balanced": "מאוזן (מוכן לתנודתיות בינונית לטובת תשואה סבירה)",
    "aggressive": "אגרסיבי (מוכן לתנודתיות גבוהה לשם תשואה מקסימלית)",
}
_GOAL_LABEL = {
    "retirement": "פרישה לגמלאות",
    "home_purchase": "רכישת נדל\"ן/דירה",
    "general_savings": "חיסכון כללי",
    "other": "מטרה אחרת",
}
_LIQUIDITY_LABEL = {
    "low": "נמוכה (רוב הכסף נעול ולא צפוי להידרש בטווח הקצר)",
    "medium": "בינונית (חלק מהתיק עשוי להידרש בשנים הקרובות)",
    "high": "גבוהה (חלק משמעותי מהתיק עשוי להידרש בזמן קרוב יחסית)",
}


def _build_llm(model_name):
    return LLM(model=model_name, temperature=0.3)


def _build_investor_profile_block(
    investor_age: Optional[int],
    investment_horizon_years: Optional[int],
    risk_tolerance: Optional[str],
    investment_goal: Optional[str],
    liquidity_needs: Optional[str],
) -> str:
    """
    בונה בלוק טקסט תמציתי של פרופיל המשקיע להזרקה לפרומפטים.
    אם לא סופק אף פרמטר - מחזיר מחרוזת ריקה (ללא שינוי לפרומפטים הקיימים).
    """
    lines = []
    if investor_age is not None:
        lines.append(f"- גיל המשקיע: {investor_age}")
    if investment_horizon_years is not None:
        lines.append(f"- טווח זמן השקעה: {investment_horizon_years} שנים")
    if risk_tolerance is not None:
        lines.append(f"- רמת סיכון מועדפת: {_RISK_LABEL.get(risk_tolerance, risk_tolerance)}")
    if investment_goal is not None:
        lines.append(f"- מטרת ההשקעה: {_GOAL_LABEL.get(investment_goal, investment_goal)}")
    if liquidity_needs is not None:
        lines.append(f"- צרכי נזילות: {_LIQUIDITY_LABEL.get(liquidity_needs, liquidity_needs)}")

    if not lines:
        return ""

    return (
        "\n\n## פרופיל המשקיע (חובה להתאים את ההמלצות במפורש לנתונים אלו!)\n"
        "הנתונים הבאים מתארים את המשקיע ויש להם משקל משמעותי בהחלטה ובניתוח. "
        "התאם את רמת הסיכון, הקצאת הנכסים, וההמלצות בדו\"ח במפורש לפרופיל זה:\n"
        + "\n".join(lines)
    )


def parse_target_weights(raw_text):
    """מנסה לפרש JSON של משקלי יעד מפלט ה-LLM. מחזיר None אם הפרסור נכשל."""
    if not raw_text:
        return None
    text = raw_text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    try:
        weights = json.loads(text)
        weights = {str(k).upper(): float(v) for k, v in weights.items()}
        total = sum(weights.values())
        if total > 0:
            weights = {k: v / total for k, v in weights.items()}
        return weights
    except Exception:
        return None


def run_crew_analysis(
    metrics: dict,
    investor_age=None,
    investment_horizon_years=None,
    risk_tolerance=None,
    investment_goal=None,
    liquidity_needs=None
) -> dict:
    """
    metrics: התוצאה של engine.metrics.compute_metrics (dict).
    פרמטרי פרופיל משקיע: כולם אופציונליים. אם לא סופקו - הניתוח זהה לקודם.
    מחזיר dict: {"report_text": str, "target_weights": dict|None}
    """
    summary_df = metrics["summary_df"]
    total_value = metrics["total_value"]
    ann_return_port = metrics["annual_return"]
    ann_vol_port = metrics["annual_vol"]
    sharpe_port = metrics["sharpe_ratio"]
    hhi = metrics["hhi_concentration"]

    portfolio_context_json = summary_df.round(4).to_json(orient="records", force_ascii=False, indent=2)
    risk_metrics_json = json.dumps({
        "hhi_concentration": round(float(hhi), 4),
        "annual_volatility_portfolio": round(float(ann_vol_port), 4) if pd.notna(ann_vol_port) else None,
        "sharpe_ratio_portfolio": round(float(sharpe_port), 4) if pd.notna(sharpe_port) else None,
    }, ensure_ascii=False, indent=2)
    return_metrics_json = json.dumps({
        "total_value": round(float(total_value), 2),
        "total_unrealized_pnl": round(float(summary_df["unrealized_pnl"].sum()), 2),
        "annual_return_portfolio_hist": round(float(ann_return_port), 4) if pd.notna(ann_return_port) else None,
    }, ensure_ascii=False, indent=2)
    fee_config_json = json.dumps(FEE_CONFIG, ensure_ascii=False, indent=2)

    # 1. בונים את בלוק הפרופיל הדינמי בכל קריאה
    investor_profile_block = _build_investor_profile_block(
        investor_age, investment_horizon_years, risk_tolerance, investment_goal, liquidity_needs
    )

    llm = _build_llm(PRIMARY_MODEL)

    # 2. הגדרת הסוכנים וה-Tasks בתוך הפונקציה (להבטחת פרומפטים מעודכנים בזיכרון)
    portfolio_analyst = Agent(
        role="אנליסט תיקים",
        goal="לתאר ולסכם את הרכב התיק בצורה מקצועית ומדויקת",
        backstory=f"אנליסט תיקים בכיר עם ניסיון רב בכתיבת דוחות ללקוחות פרטיים. {PROFESSIONAL_TONE}",
        llm=llm
    )
    risk_analyst = Agent(
        role="אנליסט סיכונים",
        goal="לזהות ולהסביר סיכונים בצורה מקצועית",
        backstory=f"אנליסט סיכונים בכיר, מומחה במדדי VaR, Sharpe ופיזור סיכון. {PROFESSIONAL_TONE}",
        llm=llm
    )
    return_analyst = Agent(
        role="אנליסט תשואות",
        goal="לנתח ביצועים ורווח/הפסד בצורה מקצועית",
        backstory=f"אנליסט ביצועים בכיר המתמחה בתשואה מתואמת סיכון. {PROFESSIONAL_TONE}",
        llm=llm
    )
    cost_benefit_analyst = Agent(
        role="אנליסט עלות-תועלת",
        goal="לקבוע אם שינוי בתיק משתלם מול עמלות וטרחה, בצורה מקצועית",
        backstory=f"מומחה למסחר יעיל ולעלויות עסקה. {PROFESSIONAL_TONE}",
        llm=llm
    )
    chief_strategist = Agent(
        role="אסטרטג ראשי",
        goal="לכתוב דוח סיכום מקצועי, מובנה וזהיר, המיועד ללקוח",
        backstory=(
            "אנליסט השקעות בכיר בעל ניסיון רב בכתיבת דוחות סיכום מקצועיים ללקוחות פרטיים. "
            f"{PROFESSIONAL_TONE} תמיד מבהיר בבירור שמדובר בניתוח אוטומטי ולא בייעוץ השקעות מוסמך."
        ),
        llm=llm
    )

    task_portfolio = Task(
        description=f"נתח את הרכב התיק. {PROFESSIONAL_TONE}\n{portfolio_context_json}",
        expected_output="סיכום מקצועי של הרכב התיק",
        agent=portfolio_analyst
    )
    task_risk = Task(
        description=f"נתח סיכונים. {PROFESSIONAL_TONE}\n{risk_metrics_json}{investor_profile_block}",
        expected_output="ניתוח סיכונים מקצועי המביא בחשבון את פרופיל המשקיע אם סופק",
        agent=risk_analyst
    )
    task_return = Task(
        description=f"נתח ביצועים. {PROFESSIONAL_TONE}\n{return_metrics_json}",
        expected_output="ניתוח תשואות מקצועי",
        agent=return_analyst
    )
    task_cost_benefit = Task(
        description=f"בהינתן עמלות: {fee_config_json}\nהאם כדאי לשקול שינויים בתיק? {PROFESSIONAL_TONE}",
        expected_output="מסקנת עלות-תועלת מקצועית",
        agent=cost_benefit_analyst
    )
    task_final = Task(
        description=(
            f"{investor_profile_block}\n\n"
            "שלב את הניתוחים הקודמים (הרכב תיק, סיכונים, תשואות, עלות-תועלת) לדוח סיכום מקצועי אחד.\n"
            "כללי כתיבה מחייבים:\n"
            "- אל תפתח בפנייה אישית ('שלום', 'אני האסטרטג...') - עבור ישר לתוכן\n"
            "- השתמש בכותרות משנה ברורות (## כותרת) לכל סעיף: תמצית מנהלים, הרכב התיק, "
            "ניתוח סיכונים, ניתוח תשואות, המלצות, סיכונים לתשומת לב\n"
            "- המלצות בפורמט רשימה ממוספרת, כל אחת עם נימוק כמותי קצר מבוסס הנתונים\n"
            "- התאם את ההמלצות במפורש לנתוני פרופיל המשקיע המופיעים למעלה (אם צוינו)\n"
            "- טון מקצועי, תמציתי, בגוף שלישי - כמו דוח אנליסט ללקוח, לא כמו הודעת צ'אט\n"
            "- סיים תמיד בהבהרה שזהו ניתוח אוטומטי ואינו מהווה ייעוץ השקעות מוסמך"
        ),
        expected_output="דוח סיכום מקצועי בעברית, מובנה בכותרות משנה, ללא פניות אישיות",
        agent=chief_strategist,
        context=[task_portfolio, task_risk, task_return, task_cost_benefit],
    )
    task_target_allocation = Task(
        description=(
            f"{investor_profile_block}\n\n"
            "בהתבסס על כל הניתוחים הקודמים ועל פרופיל המשקיע (אם סופק), הצע הקצאת יעד (target allocation) מספרית מעודכנת לתיק.\n"
            "השתמש באותם טיקרים שמופיעים בתיק הנוכחי בלבד (אם ממליץ למכור נכס לגמרי - הקצה לו משקל 0).\n"
            "המשקלים חייבים להיות מספרים בין 0 ל-1 שסכומם קרוב ל-1 (100%).\n"
            f"טיקרים נוכחיים ומשקלם: {portfolio_context_json}\n"
            "החזר אך ורק אובייקט JSON תקין, ללא טקסט נוסף, ללא markdown fences, בפורמט המדויק:\n"
            '{"TICKER1": 0.30, "TICKER2": 0.15}'
        ),
        expected_output="אובייקט JSON בלבד עם משקלי יעד מומלצים לכל טיקר",
        agent=cost_benefit_analyst,
        context=[task_portfolio, task_risk, task_return, task_cost_benefit],
    )

    # 3. הדפסה ללוג לבדיקת קבלה לפני ה-kickoff
    logger.info("=== TASK FINAL DESCRIPTION START ===")
    logger.info(task_final.description)
    logger.info("=== TASK FINAL DESCRIPTION END ===")

    crew = Crew(
        agents=[portfolio_analyst, risk_analyst, return_analyst, cost_benefit_analyst, chief_strategist],
        tasks=[task_portfolio, task_risk, task_return, task_cost_benefit, task_final, task_target_allocation],
        process=Process.sequential,
        verbose=False,
    )

    try:
        crew.kickoff()
    except Exception:
        fallback_llm = _build_llm(FALLBACK_MODEL)
        for agent in crew.agents:
            agent.llm = fallback_llm
        crew.kickoff()

    report_text = task_final.output.raw if task_final.output is not None else ""
    target_weights = parse_target_weights(task_target_allocation.output.raw) if task_target_allocation.output is not None else None

    return {"report_text": report_text, "target_weights": target_weights}