"""
טעינת נתוני תיק ממקורות שונים: CSV/Excel (מבנה עמודות), או PDF/תמונה (חילוץ חכם ע"י Gemini).
זהה ללוגיקה שכבר נבדקה בסוכן המייל - מועברת לכאן ללא שינוי מהותי.
"""

import io
import json
import re
import pandas as pd
import numpy as np
import logging
import yfinance as yf
from google import genai
from google.genai import types
from app.config import GOOGLE_API_KEY, PRIMARY_MODEL
logger = logging.getLogger(__name__)

REQUIRED_COLUMNS = {"ticker", "quantity", "avg_price"}
OPTIONAL_COLUMNS = ["asset_type", "value_override", "annual_return_override", "annual_vol_override"]

# כל עמודה שאינה ברשימה הזו (חובה + רשות) לא קיימת בטבלת holdings ב-DB,
# ולכן תוסר בשקט לפני השמירה - ראו _select_known_columns.
KNOWN_COLUMNS = REQUIRED_COLUMNS | set(OPTIONAL_COLUMNS)

NUMERIC_COLUMNS = ["quantity", "avg_price", "value_override", "annual_return_override", "annual_vol_override"]

COLUMN_ALIASES = {
    "ticker": ["ticker", "symbol", "sym", "stock", "security", "טיקר", "סימבול", "נייר", "נייר ערך"],
    "quantity": ["quantity", "qty", "shares", "amount", "units", "כמות", "יחידות", "מספר יחידות"],
    "avg_price": ["avg_price", "average_price", "avg price", "price", "cost", "purchase_price",
                  "cost_basis_price", "מחיר", "מחיר ממוצע", "מחיר קנייה", "עלות"],
    "asset_type": ["asset_type", "type", "asset type", "סוג", "סוג נכס"],
    "value_override": ["value_override", "value", "manual_value", "שווי ידני"],
    "annual_return_override": ["annual_return_override", "return_override", "תשואה ידנית"],
    "annual_vol_override": ["annual_vol_override", "vol_override", "תנודתיות ידנית"],
}

SUMMARY_ROW_LABELS = {
    "total", "totals", "sum", "grand total", "subtotal",
    "סהכ", 'סה"כ', "סך הכל", "סך הכול", "סך-הכל", "סיכום",
}

MIME_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}

EXTRACTION_PROMPT = """
אתה מומחה בזיהוי נתוני תיקי השקעות ממסמכים (דוחות ברוקר, צילומי מסך, טבלאות).
חלץ מהמסמך המצורף את כל האחזקות (holdings) בתיק, והחזר אך ורק מערך JSON תקין - בלי טקסט נוסף, בלי גדרות markdown.

לכל אחזקה, החזר אובייקט עם השדות הבאים:
- "ticker": סימבול המסחר הרשמי בפורמט Yahoo Finance. מניות/ETF - הסימבול הרגיל (AAPL, VTI).
  מדדים - תחילית ^ (^GSPC, ^TA125.TA) או ETF מייצג אם לא בטוח. קריפטו - TICKER-USD.
  שם חברה בלי סימבול - תרגם לסימבול הנכון. אם אי אפשר לזהות סימבול אמיתי - תיאור קצר + value_override.
- "quantity": כמות היחידות (מספר)
- "avg_price": מחיר קנייה ממוצע ליחידה (מספר)
- "asset_type": stock / etf / crypto / bond / bond_etf / index / option / other
- "value_override": שווי נוכחי אם צוין במפורש ואי אפשר לזהות סימבול, אחרת null
- "annual_return_override": null אלא אם יש מידע מפורש
- "annual_vol_override": null אלא אם יש מידע מפורש

החזר רק את מערך ה-JSON, שום דבר אחר.
"""

_PAREN_NEGATIVE_RE = re.compile(r"^\((.*)\)$")


def normalize_columns(df):
    reverse_map = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            reverse_map[alias.strip().lower()] = canonical

    new_columns = []
    for c in df.columns:
        key = str(c).strip().lower()
        new_columns.append(reverse_map.get(key, key))
    df.columns = new_columns
    return df.loc[:, ~df.columns.duplicated()]


def _select_known_columns(df):
    """
    משאיר רק עמודות שקיימות בפועל בטבלת holdings ב-DB (KNOWN_COLUMNS).
    כל עמודה אחרת בקובץ המקור (למשל 'שם חברה', 'רווח', הערות חופשיות) -
    לא מוכרת ל-DB, ולכן מוסרת כאן בשקט במקום לגרום לשגיאת insert.
    מחזיר גם את רשימת העמודות שהוסרו, לצורך דיווח למשתמש (סעיף 9, פריט 5).
    """
    keep = [c for c in df.columns if c in KNOWN_COLUMNS]
    dropped = [c for c in df.columns if c not in KNOWN_COLUMNS]
    return df[keep], dropped


def _clean_numeric_value(val):
    """
    מנקה ערך בודד להמרה מספרית. תומך ב:
    - סימני מטבע/רווחים/אחוזים ("$150.50", "150.50 ₪", "5%") - מוסרים.
    - פסיקי אלפים אמריקאיים ("1,234.56").
    - עשרוני אירופאי ("1.234,56" או "1234,56") - מזוהה אוטומטית לפי מיקום
      הפסיק/נקודה האחרונים בטקסט.
    - מספרים שליליים בסוגריים, מוסכמת הנהלת חשבונות ("(150.00)" = -150).
      בלי הטיפול הזה, הסוגריים היו נמחקים והמספר הופך בטעות לחיובי.
    כל מה שלא ניתן להמרה בסוף התהליך הופך ל-NaN (מטופל בהמשך ע"י
    filter_valid_holdings), במקום לזרוק שגיאה ולתקוע את כל ההעלאה.
    """
    if pd.isna(val):
        return np.nan
    s = str(val).strip()
    if s == "":
        return np.nan

    is_negative = False
    m = _PAREN_NEGATIVE_RE.match(s)
    if m:
        is_negative = True
        s = m.group(1)

    # משאירים רק ספרות, נקודה, פסיק, מינוס (מסירים סימני מטבע/רווחים/% וכו')
    s = re.sub(r"[^\d,.\-]", "", s)

    if "," in s and "." in s:
        # שני המפרידים קיימים - זה שמופיע אחרון בטקסט הוא המפריד העשרוני
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")  # פורמט אירופאי: 1.234,56
        else:
            s = s.replace(",", "")  # פורמט אמריקאי: 1,234.56
    elif "," in s:
        # רק פסיק בטקסט - אם יש בדיוק 2 ספרות אחריו, כנראה עשרוני אירופאי
        # (1234,56); אחרת כנראה מפריד אלפים (1,234).
        parts = s.split(",")
        if len(parts) == 2 and len(parts[1]) == 2:
            s = s.replace(",", ".")
        else:
            s = s.replace(",", "")

    if s in ("", "-", "."):
        return np.nan
    try:
        num = float(s)
    except ValueError:
        return np.nan
    return -num if is_negative else num


def _clean_numeric_series(series):
    if series.dtype.kind in "if":  # כבר מספרי (int/float)
        return series
    return series.apply(_clean_numeric_value)


def _coerce_numeric_columns(df):
    for col in NUMERIC_COLUMNS:
        if col in df.columns:
            df[col] = _clean_numeric_series(df[col])
    return df


def _merge_duplicate_tickers(df):
    """
    מאחד שורות עם אותו ticker לשורה אחת, כדי למנוע "שווי כפול" לאותה אחזקה
    בניתוח (התנהגות שקודם לא הייתה מוגדרת - שתי השורות פשוט נכנסו כמו שהן).
    - quantity: מסוכם.
    - avg_price: ממוצע משוקלל לפי quantity (לא ממוצע פשוט), כדי לשמר עלות
      בסיס נכונה - שורה של 10 יח' ב-$100 ושורה של 90 יח' ב-$10 אמורות
      להתאחד ל-100 יח' ב-$19 (משוקלל), לא ב-$55 (ממוצע פשוט).
    - value_override/annual_return_override/annual_vol_override: נלקח
      הערך הראשון שאינו NaN מבין השורות המאוחדות, אם קיים.
    - asset_type: נלקח מהשורה הראשונה בקבוצה.
    מחזיר (df מאוחד, מספר טיקרים ייחודיים שאוחדו) - למספר האחרון לצורך דיווח.
    """
    if df.empty:
        return df, 0

    dup_mask = df["ticker"].duplicated(keep=False)
    n_merged_tickers = df.loc[dup_mask, "ticker"].nunique()
    if n_merged_tickers == 0:
        return df, 0

    df = df.copy()
    df["_weighted_price_sum"] = df["quantity"].fillna(0) * df["avg_price"].fillna(0)

    def _first_non_null(s):
        non_null = s.dropna()
        return non_null.iloc[0] if not non_null.empty else np.nan

    agg_dict = {
        "quantity": "sum",
        "_weighted_price_sum": "sum",
        "asset_type": "first",
    }
    for col in ["value_override", "annual_return_override", "annual_vol_override"]:
        if col in df.columns:
            agg_dict[col] = _first_non_null

    grouped = df.groupby("ticker", as_index=False, sort=False).agg(agg_dict)
    total_qty = grouped["quantity"].replace(0, np.nan)
    grouped["avg_price"] = grouped["_weighted_price_sum"] / total_qty
    grouped = grouped.drop(columns=["_weighted_price_sum"])

    return grouped, n_merged_tickers


def filter_valid_holdings(df):
    """
    מסנן שורות סיכום (Total/סה"כ) ושורות עם נתוני ליבה חסרים (quantity או
    גם avg_price וגם value_override חסרים). מחזיר גם diagnostics (כמה שורות
    הוסרו ולמה) לצורך דיווח למשתמש (סעיף 9, פריט 5).
    """
    df = df.copy()
    ticker_norm = df["ticker"].astype(str).str.strip().str.lower().str.replace('"', "", regex=False)
    is_summary_row = ticker_norm.isin(SUMMARY_ROW_LABELS)
    missing_core_data = df["quantity"].isna() | (df["avg_price"].isna() & df["value_override"].isna())

    dropped_summary = int(is_summary_row.sum())
    dropped_missing = int((missing_core_data & ~is_summary_row).sum())

    valid = df[~is_summary_row & ~missing_core_data].reset_index(drop=True)
    diagnostics = {
        "dropped_summary_rows": dropped_summary,
        "dropped_missing_data_rows": dropped_missing,
    }
    return valid, diagnostics


def _ensure_optional_columns(df):
    for col in OPTIONAL_COLUMNS:
        if col not in df.columns:
            df[col] = np.nan
    return df


def _process_dataframe(df):
    """
    שרשרת העיבוד המשותפת לכל מקורות הנתונים (CSV/Excel/PDF-image), אחרי
    שכבר יש DataFrame עם עמודות מנורמלות. מבצעת: ניקוי מספרי -> נירמול
    ticker -> איחוד כפילויות -> סינון שורות לא תקינות -> סינון עמודות לא
    מוכרות. מחזירה (df סופי, diagnostics מלא).
    """
    df = _ensure_optional_columns(df)
    df = _coerce_numeric_columns(df)
    df["ticker"] = df["ticker"].astype(str).str.strip().str.upper()

    df, n_merged_tickers = _merge_duplicate_tickers(df)
    df, filter_diagnostics = filter_valid_holdings(df)
    df, dropped_columns = _select_known_columns(df)

    diagnostics = {
        "rows_accepted": len(df),
        "duplicate_tickers_merged": n_merged_tickers,
        "columns_ignored": dropped_columns,
        **filter_diagnostics,
    }
    return df, diagnostics


def load_tabular_file(filename, content_bytes):
    """טוען קובץ CSV/Excel למבנה תיק אחיד. מחזיר (df, diagnostics)."""
    buf = io.BytesIO(content_bytes)
    ext = filename.lower().rsplit(".", 1)[-1]
    df = pd.read_csv(buf) if ext == "csv" else pd.read_excel(buf)

    df = normalize_columns(df)
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"חסרות עמודות חובה בקובץ: {missing}")

    return _process_dataframe(df)


def extract_holdings_via_llm(filename, content_bytes):
    """מחלץ טבלת אחזקות מקובץ PDF או תמונה, באמצעות יכולת הראייה של Gemini. מחזיר (df, diagnostics)."""
    ext = "." + filename.lower().rsplit(".", 1)[-1]
    mime_type = MIME_TYPES.get(ext, "application/octet-stream")

    client = genai.Client(api_key=GOOGLE_API_KEY)
    response = client.models.generate_content(
        model=PRIMARY_MODEL.split("/", 1)[-1],
        contents=[types.Part.from_bytes(data=content_bytes, mime_type=mime_type), EXTRACTION_PROMPT],
    )

    text = response.text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()

    holdings = json.loads(text)
    df = pd.DataFrame(holdings)
    return _process_dataframe(df)

def _check_ticker_resolution(tickers):
    """
    משוב מוקדם על טיקרים שכנראה לא יזוהו ע"י yfinance - עוד בשלב ה-upload,
    לא רק אחרי ניתוח מלא (סעיף 9, פריט 8).
    קריאת רשת אחת בלבד (batch) - לא קריאה נפרדת לכל טיקר. כשל בקריאה
    (רשת/timeout/שינוי API) לא מפיל את ה-upload - רק מסמן checked=False.
    """
    unique_tickers = sorted({str(t).strip() for t in tickers if str(t).strip()})
    if not unique_tickers:
        return {"checked": True, "unresolved_tickers": []}

    try:
        data = yf.download(
            tickers=unique_tickers, period="5d", progress=False, threads=True, timeout=5,
        )
        if data.empty:
            return {"checked": True, "unresolved_tickers": unique_tickers}

        unresolved = []
        if len(unique_tickers) == 1:
            close = data.get("Close")
            if close is None or close.isna().all():
                unresolved.append(unique_tickers[0])
        else:
            close = data.get("Close")
            for t in unique_tickers:
                if close is None or t not in close.columns or close[t].isna().all():
                    unresolved.append(t)

        return {"checked": True, "unresolved_tickers": sorted(unresolved)}
    except Exception as e:
        logger.warning("Ticker resolution pre-check failed (non-blocking): %s", e)
        return {"checked": False, "unresolved_tickers": []}


def load_portfolio_file(filename, content_bytes):
    """נקודת כניסה יחידה - מזהה את סוג הקובץ ומפעיל את הטוען המתאים. מחזיר (df, diagnostics)."""
    ext = filename.lower().rsplit(".", 1)[-1]
    if ext in ("pdf", "png", "jpg", "jpeg"):
        df, diagnostics = extract_holdings_via_llm(filename, content_bytes)
    elif ext in ("csv", "xlsx", "xls"):
        df, diagnostics = load_tabular_file(filename, content_bytes)
    else:
        raise ValueError(f"סוג קובץ לא נתמך: .{ext}")

    diagnostics["ticker_check"] = _check_ticker_resolution(df["ticker"].tolist())
    return df, diagnostics


def holdings_records_to_df(holdings_records):
    """
    ממיר רשומות אחזקה שהגיעו ממסד הנתונים (list[dict]) למבנה תיק אחיד -
    משמש בשלב הניתוח (analysis.py), לא בהעלאה. מחזיר df בלבד (בלי
    diagnostics) כדי לשמור על תאימות לקוד הקורא הקיים.
    """
    df = pd.DataFrame(holdings_records)
    if df.empty:
        raise ValueError("לא נמצאו אחזקות בתיק")
    df, _diagnostics = _process_dataframe(df)
    return df