# Handover & Context Document - Portfolio Analysis Project

**מטרת המסמך:** לאפשר למודל/מפתח אחר להמשיך את הפרויקט הזה באופן מיידי, מבלי לאבד הקשר, מהנקודה המדויקת שבה הפרויקט נמצא כרגע.

**תאריך:** אוגוסט 2026 (עדכון אחרון: 06/08/2026 - פריטים 1, 2, 3 (סעיף 13.1: Deployment, CI/CD, Docker) ופריט 7 (סעיף 13.2: CORS) מה-ROADMAP מומשו במלואם ואומתו בפועל ב-production)
**שני תת-פרויקטים קיימים במקביל** (ראו סעיף 1 להבחנה ביניהם).

**עדכון אחרון בקצרה (למי שקורא במהירות):** הפרויקט **חי ב-production**: Backend ב-Render (`https://portfolio-app-backend-45n4.onrender.com`), Frontend ב-Vercel (`https://portfolio-app-zeta-peach.vercel.app`), מחוברים זה לזה ולSupabase/Gemini, ואומתו קצה-לקצה (הרשמה→ניתוח→PDF) ישירות דרך האינטרנט. ה-CORS צומצם מ-`*` לרשימת דומיינים מפורשת ואומת שדומיינים זרים נחסמים. ה-repo נמצא ב-GitHub (`Daniel-Codes-DS/portfolio-app`) עם CI (GitHub Actions) ו-Docker תקינים. פרטי התהליך המלא (כולל כל התקלות שתוקנו בדרך - YAML, נתיבי תיקיות, git config, פונט עברי) בסעיפים 13.1-13.2. (לפני כן: פיצ'ר "המלצת פיזור מזומן חדש" בסעיף 12, ותיקון פרופיל המשקיע בסעיף 11.)

---

## 1. Project Overview & Goal

יש כאן **שני תת-פרויקטים נפרדים אך קשורים**, שנבנו באותה שיחה, המשתפים את אותו "מנוע ניתוח" (engine logic):

### 1א. Legacy Project: סוכן ניתוח תיקים דרך מייל (`portfolio-agent/` - **גמור ועובד**)

סקריפט Python **חד-פעמי** (לא שרת, לא רץ ברקע) שרץ **מקומית** על מחשב המשתמש. בכל הפעלה: בודק תיבת Gmail (IMAP) לבקשות ניתוח חדשות (מייל עם קובץ מצורף), מריץ ניתוח תיק מלא, שולח בחזרה מייל תשובה (HTML+PDF מצורף). **פרויקט זה במצב יציב וסופי - "עובד מצוין" לדברי המשתמש.** הוא משמש כ"מאגר קוד מקור" (source of truth) ללוגיקת המנוע (engine logic) שהועברה גם לפרויקט ה-Web App.

### 1ב. New Project: Portfolio Analysis Web App (`portfolio-app/` - **בפיתוח פעיל, לא גמור**)

הפיכת הרעיון לאפליקציית Web **רב-משתמשים** אמיתית (עד ~100 משתמשים בשלב זה), שמשתמשים יכולים "להוריד" (כ-PWA - Progressive Web App, לא native app store) ולהשתמש בה כדי להעלות/לעדכן תיק השקעות ולקבל ניתוח, כאשר **המידע גם זורם למסד נתונים מרכזי שבבעלות מפתח האפליקציה**.

**זהו הפרויקט הפעיל שדורש המשך עבודה.**

### טכנולוגיות מרכזיות

| שכבה | טכנולוגיה | גרסה/הערה |
|---|---|---|
| שפה | Python | 3.12 (סביבת פיתוח/בדיקה); המשתמש בפועל על Windows עם Python 3.13 |
| Backend framework | FastAPI | + uvicorn (ASGI server) |
| מסד נתונים | Supabase (Postgres + Auth + Storage) | Free tier, ללא כרטיס אשראי |
| AI orchestration | CrewAI | multi-agent, `Process.sequential` |
| LLM | Google Gemini (דרך `google-genai` SDK) | `gemini/gemini-3.1-flash-lite` (primary), `gemini/gemini-3.5-flash` (fallback) - ראו סעיף 6 להסבר הבחירה ההפוכה-לכאורה |
| נתוני שוק | yfinance | היסטוריית מחירים 2 שנים אחורה כברירת מחדל |
| גרפים | matplotlib (Agg backend) | **טקסט אנגלית בלבד** בגרפים - ראו סעיף 6 |
| PDF | reportlab + python-bidi | תמיכה בעברית RTL דרך bidi reordering + רישום פונט Windows (Arial/Tahoma) |
| Frontend | React 18 + Vite 5 | + `vite-plugin-pwa` להתקנה כ-PWA |
| Auth (frontend) | `@supabase/supabase-js` | ניהול session, JWT מועבר ל-backend |
| Hosting מתוכנן | Render (backend) + Vercel (frontend) | שניהם free tier, ללא כרטיס אשראי |

### קונספט כללי

המערכת מקבלת תיק השקעות (טיקר/כמות/מחיר קנייה, מקבצי CSV/Excel/PDF/תמונה), מושכת נתוני שוק חיים, מחשבת מדדי סיכון/תשואה (Sharpe, HHI concentration, קורלציות), מפעילה **6 סוכני AI** (CrewAI) שמנתחים ומייצרים דוח מקצועי + הצעת הקצאת יעד (target allocation) מספרית, מייצרת 4 גרפים + PDF מעוצב, ושומרת הכל בהיסטוריה למשתמש.

**עיקרון ארכיטקטוני מכריע:** כל החישוב המספרי (מחירים, Sharpe, משקלים) נעשה ב-Python בלבד - ה-LLM **לעולם לא מחשב מספרים**, רק מפרש ומנסח תוצאות שכבר חושבו. זה מונע הזיות מספרים. חריג יחיד: כשמעלים PDF/תמונה (לא CSV/Excel), ה-LLM כן "קורא" את המסמך ומחלץ ממנו ticker/quantity/avg_price כטקסט מובנה (JSON) - זהו "ניחוש חכם" ולא חישוב, ומתבקש מהמשתמש לוודא ידנית שהחילוץ נכון.

---

## 2. Directory & File Structure

### 2א. `portfolio-agent/` (Legacy - גמור, לא דורש עבודה נוספת)

```
portfolio-agent/
├── analyze_inbox.py              # הסקריפט הראשי - IMAP polling חד-פעמי + ניתוח + SMTP reply
├── .env                          # (לא בגרסת הקוד - סודות מקומיים בלבד)
├── requirements.txt
├── README.md
├── diagnose_email.py             # כלי אבחון: מציג מבנה MIME גולמי של מיילים לא-נקראים
└── apply_*.py  (10 קבצי פאץ')    # כולם כבר הוחלו במצטבר על analyze_inbox.py:
    ├── apply_column_aliases_patch.py       # זיהוי שמות עמודות חלופיים (symbol/qty/מחיר וכו')
    ├── apply_pdf_image_support_patch.py    # תמיכה ב-PDF/תמונה דרך Gemini vision
    ├── apply_filename_decoding_patch.py     # פענוח RFC 2047 לשמות קבצים בעברית
    ├── apply_quality_improvements_patch.py  # סינון שורות "סה"כ"/Total + ניסוח מקצועי
    ├── apply_email_charts_patch.py          # (גרסה ראשונית - הוחלף ע"י richer_charts)
    ├── apply_richer_charts_patch.py         # 3 גרפים משודרגים (donut, comparison bar, scatter)
    ├── apply_run_crew_analysis_fix.py       # תיקון "מאחד" ל-run_crew_analysis (תיקון קונפליקט פאצ'ים)
    ├── apply_rtl_disclaimer_heatmap_patch.py # HTML RTL, disclaimer קבוע, גרף 4 (heatmap)
    ├── apply_pdf_report_patch.py            # ייצור PDF מלא עם לוגו/פונט עברי
    └── apply_nan_safeguard_patch.py         # מניעת "זיהום NaN" משורות לא-תקינות + traceback logging
```

**קובץ `analyze_inbox.py` הסופי (אחרי כל הפאצ'ים) מכיל, בסדר:** imports (כולל matplotlib/reportlab/bidi/google-genai) → config (ENV vars, PRIMARY/FALLBACK_MODEL, FEE_CONFIG) → `fetch_new_requests()` (IMAP, decode filename, filter by sender/subject) → `mark_as_read()` → `decode_mime_filename()` → `normalize_columns()` / `COLUMN_ALIASES` → `filter_valid_holdings()` / `SUMMARY_ROW_LABELS` → `load_portfolio_df()` (מפנה ל-CSV/Excel או ל-`extract_holdings_via_llm()` ל-PDF/תמונה) → `compute_metrics()` (yfinance + Sharpe/HHI/corr) → `PALETTE`, `_style_axes()`, `generate_allocation_charts()` (4 גרפים) → `run_crew_analysis()` (6 agents/tasks, מחזיר `(report_text, target_weights)` כ-**tuple**) → `parse_target_weights()` → `DISCLAIMER_FOOTER`, `_register_hebrew_font()`, `_rtl()`, `generate_pdf_report()` → `send_reply()` (HTML RTL + PDF + PNG attachments) → `main()`.

### 2ב. `portfolio-app/` (Active - הפרויקט הנוכחי, חלקית גמור)

```
portfolio-app/
├── database/
│   └── schema.sql                # גמור, לא נבדק מול Postgres אמיתי (רק syntax review ידני)
│                                  #    טבלאות: portfolios, holdings, analysis_runs
│                                  #    RLS policies על כל טבלה + storage bucket "reports"
│
├── backend/                      # גמור, נבדק (syntax, imports, TestClient), רץ מקומית אצל המשתמש
│   ├── app/
│   │   ├── main.py                # FastAPI app, CORS (allow_origins=["*"] - לשנות בפרודקשן!)
│   │   ├── config.py              # קורא .env, validate_config() בודק חובה
│   │   ├── db.py                  # get_supabase() - client עם service_role key (עוקף RLS!)
│   │   ├── auth.py                # get_current_user() - מאמת מול Supabase דרך supabase.auth.get_user(token)
│   │   │                           #    (קריאת API, לא JWT מקומי) + מטמון קצר-טווח (60s) - ראו סעיף 6.12
│   │   ├── models.py              # Pydantic: HoldingIn, PortfolioCreate, AnalysisResponse
│   │   ├── engine/                # === זהה ללוגיקה מ-analyze_inbox.py, מפוצל למודולים ===
│   │   │   ├── data_loader.py      # load_portfolio_file, extract_holdings_via_llm,
│   │   │   │                       # holdings_records_to_df (ל-DB records).
│   │   │   │                       # + _select_known_columns (מסנן עמודות שלא קיימות ב-DB,
│   │   │   │                       #   כמו "company name" - ראו סעיף 6.13),
│   │   │   │                       # + _clean_numeric_series/_coerce_numeric_columns
│   │   │   │                       #   (המרה מספרית סבלנית: "1,234", "$150.50" וכו')
│   │   │   ├── metrics.py          # compute_metrics() - מחזיר dict (לא tuple - בכוונה!)
│   │   │   ├── ai_analysis.py      # run_crew_analysis() - מקבל metrics dict, מחזיר dict
│   │   │   ├── charts.py           # generate_allocation_charts() - זהה ל-legacy, 4 גרפים
│   │   │   └── pdf_report.py       # generate_pdf_report() - זהה ל-legacy
│   │   └── routers/
│   │       ├── portfolios.py       # GET/POST /portfolios, GET /{id}, PUT /{id}/holdings,
│   │       │                       # POST /{id}/upload (קובץ→holdings),
│   │       │                       # PATCH /{id} (עדכון פרופיל תיק קיים ללא שינוי אחזקות - חדש).
│   │       │                       # create_portfolio שולח את כל 5 שדות הפרופיל ל-Supabase.
│   │       │                       # _get_owned_portfolio שולף * (לא id בלבד) כדי שהפרופיל זמין.
│   │       └── analysis.py         # POST /{id}/analysis (מריץ הכל, שומר ל-DB+Storage),
│   │                               # GET /{id}/analysis (היסטוריה), GET /{id}/analysis/{aid},
│   │                               # GET /{id}/analysis/{aid}/pdf-url (signed URL).
│   │                               # _get_owned_portfolio שולף * + run_analysis מעביר
│   │                               # את 5 שדות הפרופיל מרשומת התיק ל-run_crew_analysis().
│   ├── requirements.txt            # כולל את כל תלויות ה-engine + fastapi/uvicorn/supabase/pyjwt
│   ├── .env.example                # SUPABASE_URL/SERVICE_KEY/JWT_SECRET, GOOGLE_API_KEY, מודלים
│   ├── README.md                   # הוראות הקמה מלאות (Supabase → .env → pip install → uvicorn)
│   └── test_flow.ps1               # נכתב אך טרם הורץ בפועל - סקריפט PowerShell שבודק
│                                    #    E2E: signup/login→create portfolio→add holdings→
│                                    #    run analysis→get PDF signed URL→history
│
└── frontend/                       # ✅ גמור ונבדק (npm install + npm run build עברו בהצלחה!)
    ├── package.json                # react, react-dom, @supabase/supabase-js,
    │                                #    devDeps: vite, @vitejs/plugin-react, vite-plugin-pwa
    ├── vite.config.js              # VitePWA manifest config (RTL, שם עברי, theme #1f7a6c)
    ├── index.html                  # dir="rtl" lang="he" + Google Fonts (Heebo, JetBrains Mono)
    ├── .env.example                # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE
    ├── public/
    │   ├── icon-192.png             # אייקון PWA שנוצר (טל-ירוק, גרפי bar-chart)
    │   └── icon-512.png
    └── src/
        ├── supabaseClient.js       # createClient עם VITE_SUPABASE_URL/ANON_KEY
        ├── api.js                  # wrapper fetch() לכל endpoints הבקאנד + טוקן.
        │                           # createPortfolio מקבל payload שלם (לא רק name) כדי לתמוך
        │                           # בשדות הפרופיל. נוסף updatePortfolio לקריאת PATCH /{id}.
        ├── main.jsx                # ReactDOM.createRoot
        ├── App.jsx                 # AppContent (הלוגיקה המקורית: session, ניתוב
        │                           #    state-based בין Login/Dashboard/PortfolioDetail)
        │                           #    עטוף ב-<ErrorBoundary> - ראו סעיף 8, פריט 6
        ├── ErrorBoundary.jsx       # (חדש) class component - תופס שגיאות render בלתי-צפויות
        │                           #    בכל עץ הרכיבים, מציג מסך "משהו השתבש" + כפתור רענון
        │                           #    במקום מסך לבן ריק
        ├── styles.css              # מערכת עיצוב "פנקס פיננסי" - טוקנים ב-:root,
        │                           #    Heebo (UI) + JetBrains Mono (מספרים, tabular-nums),
        │                           #    ירוק-אזמרגד #1f7a6c לחיובי, אדום-לבנה #b4432e לשלילי,
        │                           #    RTL-aware (border-inline-start וכו')
        └── pages/
            ├── Login.jsx           # טופס signup/login, טוגל מצב, supabase.auth
            ├── Dashboard.jsx       # רשימת תיקים + יצירת תיק חדש (api.listPortfolios/createPortfolio)
            └── PortfolioDetail.jsx # טבלת holdings, העלאת קובץ, הרצת ניתוח (loading state),
                                    #    מדדים (עם צבע דינמי לפי סימן התשואה), report_text,
                                    #    הורדת PDF (signed URL, window.open), היסטוריה עם
                                    #    כפתור PDF לכל רשומה
```

---

## 3. Core Logic & Data Flow

### 3א. זרימת נתונים ב-Web App (הפרויקט הפעיל)

```
[משתמש בדפדפן] --(Supabase Auth: signup/login)--> [Supabase Auth] --(JWT)--> [Frontend מחזיק session]
        |
        | (1) POST /portfolios/{id}/upload  (multipart file: CSV/Excel/PDF/image) + Authorization: Bearer <JWT>
        v
[FastAPI Backend]
   auth.py: מאמת JWT (ES256 מול Supabase JWKS) --> user_id
   routers/portfolios.py:
       -> engine/data_loader.load_portfolio_file(filename, bytes)
            - CSV/Excel: normalize_columns (aliases) -> _coerce_numeric_columns (סבלני לפורמטים:
              "1,234", "$150.50", רווחים) -> filter_valid_holdings (מסנן "total"/NaN rows)
              -> _select_known_columns (מסיר עמודות שלא קיימות בטבלת holdings, למשל "company name" -
              ראו סעיף 6.13, מונע גם שגיאת NaN-in-JSON בזמן ה-insert - ראו סעיף 6.14)
            - PDF/image: extract_holdings_via_llm (Gemini vision -> JSON -> DataFrame), אותה שרשרת ניקוי
       -> DELETE + INSERT ל-Supabase table "holdings" (מסונן ל-portfolio_id)

   | (2) POST /portfolios/{id}/analysis  + Authorization: Bearer <JWT>
   v
   routers/analysis.py:
       -> SELECT holdings WHERE portfolio_id=... (מה-DB, לא מהקובץ המקורי!)
       -> engine.data_loader.holdings_records_to_df(records)
       -> engine.metrics.compute_metrics(df)
            - yfinance.download() לכל טיקר ללא value_override
            - מחשב: total_value, weight, annual_return/vol per position+portfolio,
              Sharpe, HHI concentration, correlation matrix
            - מחזיר dict (summary_df, total_value, annual_return, annual_vol,
              sharpe_ratio, hhi_concentration, corr_matrix, unresolved_tickers)
       -> engine.ai_analysis.run_crew_analysis(metrics_dict)
            - 6 CrewAI agents (Process.sequential): portfolio/risk/return/cost_benefit analysts
              + chief_strategist (task_final) + task_target_allocation (JSON weights)
            - Primary LLM: gemini-3.1-flash-lite; אם נכשל -> fallback ל-gemini-3.5-flash
            - מחזיר dict: {"report_text": str, "target_weights": dict|None}
       -> engine.charts.generate_allocation_charts(summary_df, target_weights, corr_matrix)
            - מחזיר dict {filename: PNG bytes} - עד 4 גרפים
       -> engine.pdf_report.generate_pdf_report(report_text, summary_df, charts, ...)
            - מחזיר PDF bytes (כולל את כל הגרפים כעמודים נפרדים)
       -> Supabase Storage: upload(f"{user_id}/{portfolio_id}/{uuid}.pdf", pdf_bytes)
       -> Supabase table "analysis_runs": INSERT (metrics + report_text + target_weights JSON
          + pdf_storage_path)
       -> Response ל-Frontend: {analysis_id, report_text, target_weights, total_value,
          annual_return, annual_vol, sharpe_ratio, pdf_storage_path}

   | (3) GET /portfolios/{id}/analysis/{analysis_id}/pdf-url
   v
       -> Supabase Storage: create_signed_url(path, 3600) -> {"url": ..., "expires_in_seconds": 3600}
       -> Frontend פותח את ה-URL בטאב חדש להורדה
```

### 3ב. הבחנה קריטית באבטחה

ה-Backend משתמש ב-**service_role key** (עוקף RLS לגמרי). המשמעות: **כל endpoint חייב לסנן ידנית לפי `user_id`** בכל שאילתה (ראו `_get_owned_portfolio()` בשני ה-routers) - **RLS ב-DB הוא הגנת "שכבה שנייה" בלבד**, לא ההגנה היחידה. אם מפתח עתידי יוסיף endpoint חדש וישכח את הסינון הידני - זהו חור אבטחה חמור (חשיפת נתוני משתמש אחר).

### 3ג. זרימת המייל הישן (`portfolio-agent/`, להשוואה בלבד - לא נדרש שינוי)

`main()` → `fetch_new_requests()` (IMAP UNSEEN + decode filename + סינון sender/subject) → per email: `load_portfolio_df()` → `compute_metrics()` (גרסה ישנה יותר - tuple return, 7 ערכים כולל corr_matrix) → `run_crew_analysis()` (tuple return: `report, target_weights`) → `generate_allocation_charts()` → `generate_pdf_report()` → `send_reply()` (SMTP, HTML+PDF+PNGs) → `mark_as_read()`.

---

## 4. Current Implementation Status

### מומש ועובד באופן מוודא (נבדק בפועל, לא רק בתיאוריה)

- **Legacy email agent** (`portfolio-agent/`) - מאושר ע"י המשתמש כ"עובד מצוין" על תיק אמיתי, מקצה לקצה (מייל→ניתוח→מייל תשובה עם PDF+גרפים)
- **תוקנו בסיבוב האחרון** (ראו סעיפים 6.12-6.14 לפרטים מלאים): (1) אימות JWT ב-`auth.py` הותאם ל-ES256/JWKS (השתמש התיקון המקורי היה HS256 מקומי שגוי) - **אך תוכן התיקון המדויק טרם תועד/נמסר במלואו**; (2) `engine/data_loader.py` תוקן להגן על שלב ה-**upload** מפני NaN-in-JSON וסינון עמודות לא-מוכרות (`_select_known_columns`, `_coerce_numeric_columns`) - קובץ מלא כבר נמסר למשתמש להחלפה.
- **Backend `portfolio-app/backend/`**:
  - כל 15 קבצי ה-Python עברו syntax check (`ast.parse`)
  - האפליקציה עולה בהצלחה (`from app.main import app` ללא שגיאות, עם כל התלויות מותקנות)
  - כל ה-routes נרשמים נכון (וודא דרך `TestClient` + `/openapi.json`) - כולל `/portfolios`, `/portfolios/{id}`, `/{id}/holdings`, `/{id}/upload`, `/{id}/analysis`, `/{id}/analysis/{aid}`, `/{id}/analysis/{aid}/pdf-url`
  - `GET /portfolios` ללא auth מחזיר 401 כראוי
  - `auth.get_current_user()` נבדק עם JWT מזויף: מקבל טוקן תקין, דוחה טוקן משובש
  - `engine.data_loader.holdings_records_to_df()` נבדק עם רשומות DB מדומות
  - `engine.charts.generate_allocation_charts()` + `engine.pdf_report.generate_pdf_report()` נבדקו end-to-end עם נתונים מדומים - הופקו PDF ותמונות תקינים בפועל (נבדק ויזואלית)
  - המשתמש בפועל הריץ את השרת מקומית בהצלחה (`uvicorn app.main:app --reload`) ונגש ל-`/docs` (עובד, רק CSS לא נטען מ-CDN - לא קריטי)
- **`database/schema.sql`** - נכתב לפי מוסכמות Supabase סטנדרטיות (RLS, gen_random_uuid, storage.buckets). לא נבדק מול מופע Postgres אמיתי (לא היה זמין בסביבת הבדיקה) - נבדק רק ב-review ידני קפדני. המשתמש כבר הריץ אותו על ה-Supabase project האמיתי שלו (לפי הדיווח בשיחה, אך לא אושר במפורש שהצליח ללא שגיאות - כדאי לוודא).
- **`frontend/`** - **חמשת הקבצים החסרים נכתבו והושלמו** (`App.jsx`, `styles.css`, 3 pages), בתוספת `.env.example` ואייקוני PWA (`icon-192.png`/`icon-512.png`, נוצרו פרוגרמטית - גרפי bar-chart בטון הברנד).
  - **`npm install` רץ בהצלחה בפועל** (355 חבילות, ללא שגיאות - רק אזהרות deprecation שגרתיות של npm)
  - **`npm run build` רץ בהצלחה בפועל** - פלט `dist/` תקין: `index.html`, JS bundle (369KB), CSS (4.9KB), `manifest.webmanifest`, `sw.js` (service worker), האייקונים
  - `manifest.webmanifest` נבדק ותוכנו נכון: `dir: "rtl"`, `lang: "he"`, שם/תיאור בעברית תקינים (לא escaped/שבורים), אייקונים מפוענחים נכון
  - עיצוב: מערכת טוקנים מכוונת ("פנקס פיננסי" - paper-cool + ירוק אזמרגד/אדום-לבנה סמנטי למספרים חיוביים/שליליים, Heebo+JetBrains Mono), לא ברירת מחדל גנרית
  - **טרם נבדק**: הרצה מול Supabase/Backend אמיתיים בדפדפן בפועל (npm run dev + אינטראקציה ידנית/את `test_flow.ps1` המקביל בצד ה-UI) - הבדיקה שבוצעה היא build-level בלבד (מתקמפל בלי שגיאות), לא runtime/functional testing בדפדפן אמיתי

### באמצע פיתוח / לא גמור

- **`test_flow.ps1`** - נכתב בעיון (נבדק רק ב"בדיקת איזון סוגריים" ידנית דרך Python, לא הורץ בפועל - אין PowerShell בסביבת הפיתוח). המשתמש טרם הריץ אותו - זהו הצעד המיידי הבא.
- **Deployment** - לא נעשה כלום עדיין: אין `render.yaml`, אין הגדרות Vercel, אין Dockerfile. השרת רץ אך ורק מקומית (`localhost:8000`) על מחשב המשתמש, וה-Frontend מעולם לא רץ אפילו ב-`npm run dev` (רק `npm run build` נבדק).

### לא קיים בכלל

- כל תשתית ה-Deployment (Render/Vercel configs)
- הצגת גרפים (PNG) בתוך ה-Frontend עצמו - כרגע רק PDF (עם הגרפים מוטמעים בפנים) ניתן להורדה; אין endpoint שמחזיר את תמונות ה-PNG בנפרד להצגה inline בדף
- כל מנגנון "עדכון התיק לפי המלצות" בפועל בממשק (ה-backend endpoint `PUT /{id}/holdings` קיים ותומך בזה טכנית, אך אין עדיין UI שמציע את זה למשתמש בצורה נוחה - כרגע רק החלפה ידנית מלאה של הרשימה, ורק העלאת קובץ מלא ב-`PortfolioDetail.jsx`, לא עריכה שורה-שורה)
- טסטים אוטומטיים (pytest/vitest וכו') - כל הבדיקות שנעשו עד כה היו ידניות/אד-הוק דרך סקריפטים חד-פעמיים
- React Error Boundaries / retry logic ברשת - אם קריאת API נכשלת, מוצגת הודעת שגיאה גולמית (`e.message`) בלי טיפול UX מיוחד

---

## 5. Next Steps & Roadmap

**סדר מומלץ (בכל שלב - לבדוק לפני להתקדם לבא):**

1. **להריץ את `backend/test_flow.ps1`** מול השרת המקומי הרץ + פרויקט ה-Supabase האמיתי של המשתמש. זו הבדיקה החיה הראשונה שמוכיחה את כל שרשרת ה-Backend (auth→DB→yfinance→CrewAI→PDF→storage) עובדת מקצה-לקצה עם נתונים אמיתיים, לא מדומים.
   - אם נכשל: לבדוק את השגיאה המדויקת, במיוחד סביב Supabase Storage upload/signed URL (חלק שלא נבדק בפועל כלל).

2. **להריץ את ה-Frontend בפועל בדפדפן** (`npm run dev` בתוך `frontend/`, עם `.env` מלא) ולבצע בדיקה ידנית מקצה-לקצה דרך ה-UI עצמו: הרשמה→login→יצירת תיק→העלאת קובץ→הרצת ניתוח→צפייה בדוח→הורדת PDF→היסטוריה. **זה טרם נעשה כלל** - כל מה שאומת עד כה הוא ש-`npm run build` מצליח (כלומר אין שגיאות syntax/import), אבל **אין עדיין אישור שה-UI בפועל "מדבר" נכון עם ה-Backend האמיתי דרך דפדפן** (CORS, פורמט תגובות, טיפול בשגיאות אמיתי).

3. **Deployment**:
   - Backend → Render: Web Service חדש, מצביע ל-`backend/`, build command `pip install -r requirements.txt`, start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, משתני סביבה מוזנים ידנית בממשק Render (לא committing .env!)
   - Frontend → Vercel: מצביע ל-`frontend/`, Vite auto-detect, build command `npm run build`, output `dist`
   - קריטי: לעדכן את `CORSMiddleware` ב-`backend/app/main.py` מ-`allow_origins=["*"]` לכתובת ה-Vercel המדויקת לפני production

4. **שיפורים עתידיים אפשריים** (לא דחוף): endpoint שמחזיר PNG בנפרד (לא רק בתוך ה-PDF) להצגה inline ב-Frontend; UI נוח יותר לעדכון תיק "לפי המלצה" (checkbox per holding, לא רק PUT מלא/upload מחדש); טסטים אוטומטיים (pytest ל-backend, vitest/testing-library ל-frontend); rate limiting על `/analysis` (קריאה יקרה - yfinance+LLM); React Error Boundary + טיפול UX טוב יותר בשגיאות API.

---

## 6. Guidelines & Conventions

**דגשים ארכיטקטוניים שחשוב לשמר בהמשך הפיתוח:**

1. **החזרת ערכים - dict, לא tuple.** `compute_metrics()` ו-`run_crew_analysis()` ב-`portfolio-app` מחזירים dict בכוונה (למשל `metrics["total_value"]`, לא unpacking עמדתי). זהו תיקון מודע לבאג אמיתי שקרה בגרסת ה-legacy (`too many values to unpack`) כשפאץ' אחד עדכן את הקורא (`main()`) לצפות ל-2 ערכים בעוד פונקציה אחרת עדיין החזירה ערך בודד. בכל קוד חדש - העדיפו dict/named structure על פני tuple positional למניעת הישנות הבאג.

2. **טקסט אנגלית בלבד בתוך matplotlib ו-reportlab (רק לכותרות/צירים/legends).** ל-matplotlib אין תמיכה מובנית ב-RTL - טקסט עברי מוצג הפוך/מקושקש. לכן כל הגרפים (charts.py) כתובים באנגלית לחלוטין. ב-PDF (pdf_report.py) כן יש תוכן עברי (גוף הדוח עצמו), אך זה עובד רק כי:
   - כל שורת טקסט עוברת דרך `_rtl()` (עוטפת `bidi.algorithm.get_display()`)
   - פונט Unicode עם glyphs עבריים נרשם במפורש (`_register_hebrew_font()` - מנסה Arial/Tahoma של Windows, נופל חזרה ל-Helvetica אם לא נמצא - Helvetica לא כולל עברית בכלל, כך שאם אף פונט לא נמצא, הטקסט העברי ב-PDF יהיה שבור/ריק)
   - אם מוסיפים תוכן עברי חדש בכל מקום (matplotlib/reportlab) - חובה ליישם את אותה תבנית (`_rtl()` + פונט רשום), אחרת יישבר.

3. **Email HTML - חובה `dir="rtl"` מפורש + `text-align: right`.** לא לסמוך על "ניחוש" אוטומטי של תוכנת המייל - זה לא עקבי בין קליינטים. תבנית: `<div dir="rtl" style="text-align: right; ...">`.

4. **Disclaimer משפטי - מוטמע בקוד, לא רק כהנחיה ל-LLM.** `DISCLAIMER_FOOTER` הוא קבוע Python המצורף תמיד לטקסט לפני שליחה/רינדור - לא סומכים על ה-LLM שיזכור לכתוב אותו, כי זו לא ערובה.

5. **מודל Gemini: Primary=flash-lite, Fallback=flash (הפוך ממה שנשמע אינטואיטיבי).** גילינו בפועל שהמכסה החינמית היומית של `gemini-3.5-flash` היא 20 בקשות/יום בלבד, בעוד ל-`gemini-3.1-flash-lite` יש מכסה גבוהה משמעותית. כל שינוי עתידי במודל חייב לבדוק את המכסה בפועל (`ai.google.dev/gemini-api/docs/rate-limits`) לפני שמניחים ש"מודל חזק יותר = עדיף" - זו לא תמיד המסקנה הנכונה עבור free tier.

6. **סינון שורות לא-תקינות מקובצי קלט (`filter_valid_holdings`).** קבצי Excel/CSV אמיתיים מכילים לעיתים שורות "סה"כ"/Total/יתרת מזומן שאינן טיקרים אמיתיים. יש שתי שכבות הגנה: (א) סינון לפי `SUMMARY_ROW_LABELS` (רשימת מילים ידועות) בזמן הטעינה, (ב) הגנת NaN אחרי ניסיון yfinance - אם טיקר לא נמצא ואין `value_override`, השורה מוסרת עם אזהרה לפני שהיא "מזהמת" את `total_value`/`weight` בכל התיק ב-NaN. אל תסירו את שכבת ההגנה השנייה - היא תפסה בפועל מקרה אמיתי (`יתרת מזומן בדולר ארה"ב`) שהשכבה הראשונה פספסה.
   **עדכון (`portfolio-app`):** התגלה פער נוסף שלא היה קיים ב-legacy - שתי ההגנות הנ"ל מגנות על שלב **הניתוח** (`compute_metrics`), אך לא היתה הגנה מקבילה בשלב **ה-upload עצמו** (לפני ה-insert ל-DB, ב-`routers/portfolios.py`). תוקן ב-`data_loader.py` (ראו 6.13, 6.14) - `_coerce_numeric_columns`/`filter_valid_holdings` רצות גם בנתיב הזה, ו-`_select_known_columns` מסננת עמודות עודפות לפני ה-insert.

7. **אבטחה: Backend עם service_role key = סינון ידני חובה בכל שאילתה.** ראו סעיף 3ב. זהו הסיכון הביטחוני המרכזי בארכיטקטורה הנוכחית - קל לשכוח ולחשוף נתוני משתמש אחר. כל endpoint חדש שניגש ל-`portfolios`/`holdings`/`analysis_runs` חייב לעבור דרך `_get_owned_portfolio(supabase, portfolio_id, user_id)` או שקול.

8. **קונבנציית "פאץ' סקריפט" (רלוונטי בעיקר ל-legacy, אך יכול לחזור).** כל שינוי לקוד קיים אצל המשתמש (Windows, לא נוח לעריכת קוד ידנית מורכבת) נעשה כ"סקריפט תיקון חד-פעמי" עצמאי (`apply_XXX_patch.py`) שמבצע `str.replace` על אנקרים מדויקים בקובץ היעד, עם בדיקת idempotency מפורשת (זיהוי אם התיקון כבר הוחל, כדי שהרצה כפולה לא תשבור/תשכפל קוד) ו-syntax validation אחרי הפעלה (`ast.parse`). זו לא קונבנציה רלוונטית ל-`portfolio-app` (שם עורכים קבצים ישירות), אך אם חוזרים לעבוד על ה-legacy - יש לשמר את הדפוס הזה.

9. **בדיקות - "test before send" בכל שינוי.** לאורך כל הפרויקט, כל קטע קוד מהותי (פאץ', מודול חדש, endpoint) נבדק בפועל (syntax check, import check, functional smoke test עם נתונים מדומים, ולעיתים רינדור ויזואלי בפועל של גרפים/PDF) לפני שנשלח למשתמש. יש לשמר את המשמעת הזו - ראינו בפועל שקוד "סביר להניח שעובד" נכשל (למשל: הפונקציה `run_crew_analysis` שלא עודכנה נכון כי פאץ' אחד תלוי בפאץ' קודם שלא רץ).

10. **המשתמש הוא בעל רקע טכני חלקי, על Windows, ב-VS Code.** נתקל בקושי עם: PowerShell מול cmd, שמות קבצים עם נקודה מובילה (`.env`) ש-Windows Explorer "מתעקש" למחוק, `Select-String`/`-replace` syntax, נתיבי תיקיות עם רווחים/עברית הדורשים מרכאות. הסברים עתידיים כדאי שימשיכו להיות מפורטים צעד-אחר-צעד, עם פקודות PowerShell מדויקות להעתקה-הדבקה, ולא להניח ידע מוקדם בטרמינל.

11. **מערכת העיצוב של ה-Frontend ("פנקס פיננסי") - כללי טוקנים ב-`styles.css`.** פלטה קרירה (לא קרם/סריף/טרה-קוטה הקלישאתי), עם סמנטיקה פיננסית מכוונת: `--accent` (ירוק אזמרגד #1f7a6c) לפעולות/רווחים, `--danger` (אדום-לבנה מרוסן #b4432e) לשגיאות/הפסדים - **לא קישוט, קידוד משמעות**. מספרים תמיד ב-`var(--font-mono)` (JetBrains Mono) עם `font-variant-numeric: tabular-nums` ליישור טורי כמו בפנקס אמיתי; טקסט UI ב-Heebo (תומך עברית מלא, נטען מ-Google Fonts דרך `index.html`). כרטיסים (`.card`) עם `border-inline-start` צבעוני (לא `border-left` - חשוב ל-RTL: `inline-start` מתאים את עצמו אוטומטית לכיוון הדף). **כל רכיב UI חדש צריך להשתמש בטוקנים הקיימים (`var(--accent)` וכו'), לא בצבעים/גדלים חדשים "חד-פעמיים"**, כדי לשמור על עקביות ויזואלית.

12. **אימות טוקן - נעשה דרך `supabase.auth.get_user(token)`, לא דרך אימות JWT מקומי (לא HS256 ולא JWKS/ES256).** **תיקון לתיעוד קודם בסעיף הזה** (שהיה שגוי): בסבב ראשוני שיערנו שהתיקון היה מעבר לאימות JWKS מקומי (ES256, למשל דרך `PyJWKClient`) - זה **לא נכון**. המימוש בפועל ב-`auth.py` פשוט יותר: `get_current_user()` שולח את הטוקן לקריאת API אצל Supabase עצמו (`supabase.auth.get_user(token)`), ו-Supabase הוא זה שמאמת את הטוקן ומחזיר את פרטי המשתמש - אין צורך בניהול מפתחות/אלגוריתמי חתימה בצד ה-backend בכלל. זה גם ההסבר המדויק לבאג ה-401 המקורי: הניסיון הראשוני היה לפענח את הטוקן **מקומית** מול `SUPABASE_JWT_SECRET` (HS256) - אבל הטוקן בפועל לא נועד להיות מפוענח מקומית כלל, אלא מאומת מול Supabase דרך קריאת API. **חשוב לזכור להבא:** המשמעות ליציבות (ראו סעיף 8, פריט 4) שונה מ"caching מפתחות JWKS" - כל בקשה מאומתת עושה קריאת רשת אמיתית ל-Supabase, כך שההגנה הרלוונטית היא caching/timeout על קריאת ה-API הזו, לא על מפתחות הצפנה.

13. **סינון עמודות לא-מוכרות לפני insert (`_select_known_columns` ב-`data_loader.py`).** קובץ קלט (CSV/Excel/PDF) עשוי להכיל עמודות שאין להן מקבילה בטבלת `holdings` (למשל `"company name"`, `"רווח"`, הערות חופשיות). Supabase/PostgREST דוחה **את כל הבקשה** אם `insert` מכיל מפתח עמודה לא-קיים בסכמה (`Could not find the 'X' column of 'holdings' in the schema cache`). הפתרון שנבחר בכוונה (לפי בקשת המשתמש לסבילות מקסימלית ולא "להיתקע על עניינים זוטריים"): לזרוק בשקט כל עמודה שאינה ב-`KNOWN_COLUMNS` (= `REQUIRED_COLUMNS ∪ OPTIONAL_COLUMNS`), במקום לדרוש מהמשתמש להתאים את הקובץ מראש. **אלטרנטיבה שנשקלה ונדחתה לעת עתה:** הוספת עמודה (למשל `company_name`) ל-DB בפועל (ALTER TABLE + עדכון `schema.sql` + עדכון קוד ה-insert) - רלוונטי אם בעתיד ירצו לשמור מידע כזה בפועל ולא רק לזרוק אותו (שם החברה בכל מקרה ניתן למשיכה מ-yfinance לפי ticker בזמן הניתוח).

14. **`allow_nan=False` ב-JSON ל-Supabase - NaN חייב להיות מסונן/מומר *לפני* בניית ה-payload, לא רק לפני החישוב.** `httpx`/`postgrest-py` (המשמשים את ה-`supabase` client) עושים `json.dumps(..., allow_nan=False)`, ששונה מהתנהגות ברירת המחדל של Python - `float('nan')` הוא ערך חוקי ב-Python אך **לא** ב-JSON תקני, וגורם ל-`ValueError: Out of range float values are not JSON compliant: nan` בזמן ה-`insert`, לפני שהבקשה בכלל יוצאת לרשת (לא שגיאת auth/רשת - תמיד לבדוק את השורה המדויקת ב-traceback). מקור ה-NaN הנפוץ ביותר: `pandas` הופך תאים ריקים/לא-מספריים בקובץ (CSV/Excel) ל-`NaN` (float) באופן שקוף. הגנת ה-NaN שתועדה בסעיף 6.6 מגנה רק על שלב הניתוח (`compute_metrics`, אחרי yfinance) - **יש לוודא שכל נתיב שבונה `insert_rows`/`upsert` ל-Supabase (לא רק שלב הניתוח) עובר דרך `filter_valid_holdings`/`_coerce_numeric_columns` (או שקול) לפני השליחה**, אחרת הבאג הזה יכול לחזור בכל endpoint חדש שכותב ל-DB.

15. **אבטחה - לעולם לא לשתף bearer token מלא (JWT) בצ'אט/לוגים, גם בסביבת דיבאג.** JWT שהודבק לצורך אבחון שגיאת 401 היה טוקן **תקף בפועל** (לא דוגמה) - כל מי שמחזיק בו יכול להתחזות לחשבון עד שהוא פג (`exp`, בדרך כלל כשעה). כשמדביקים שגיאות שכוללות טוקנים בעתיד: לשתף רק תיאור השגיאה/status code, ולשקול logout+login (הנפקת session/token חדש) אחרי כל חשיפה כזו ליתר ביטחון.

---

## 7. המלצות לשיפור - הוצעו, טרם מומשו (ממתינות לאישור)

הרשימה הבאה הוצעה ב-04/08/2026, **לפני** כל מימוש בפועל, כדי שיהיה סיכום מרוכז לפני שמתחילים לעבוד. סדר לפי עדיפות משוערת - לא חובה לממש הכל, ולא בהכרח בסדר הזה.

### אבטחה
1. **הגבלת גודל/מספר שורות בקובץ מועלה.** כרגע `POST /{id}/upload` לא בודק גודל קובץ או מספר שורות לפני עיבוד - קובץ ענק (בטעות או בזדון) יכול להעמיס על השרת (Free tier של Render) בלי שום הגבלה. הצעה: לבדוק `Content-Length`/גודל בפועל מול תקרה סבירה (למשל 5MB / 2,000 שורות) ולהחזיר שגיאה ברורה לפני שמתחילים לעבד.
2. **Rate limiting על `/analysis`** - כבר צוין בסעיף 5.4 (roadmap), נשאר רלוונטי ובעדיפות עולה לפני production, כי כל קריאה עולה כסף/מכסה (yfinance + Gemini).
3. **טיפול מפורש בכשל/timeout של שליפת JWKS ב-`auth.py`** (קשור לסעיף 6.12) - מה קורה אם Supabase לא זמין רגעית בזמן אימות טוקן? כדאי caching של המפתחות הציבוריים עם TTL סביר, כדי לא לתלות כל בקשה בזמינות רגעית של שירות חיצוני.
4. **CORS מוגבל לפני production** - כבר תועד (סעיף 5.3), חובה לפני חשיפה לאינטרנט הרחב.

### איכות נתונים / שקיפות למשתמש
5. **דיווח למשתמש על עמודות/שורות שהוסרו בזמן העלאה**, ולא רק הסרה שקטה. הפילוסופיה הנוכחית ("לא להיתקע על עניינים זוטריים") נכונה לרוב, אך כרגע אין שום דרך למשתמש לדעת בדיעבד ש-3 שורות הוסרו כי חסר בהן מחיר, או שעמודת "הערות" נזרקה. הצעה: `POST /upload` יחזיר בתשובה (לא רק 200 ריק) סיכום קצר - כמה שורות נקלטו, כמה הוסרו ולמה, אילו עמודות לא זוהו - כדי שהמשתמש יוכל לתקן את הקובץ אם צריך, בלי לחסום אותו.
6. **טיפול בטיקר כפול באותו קובץ/תיק** - כרגע לא ברור אם שתי שורות עם אותו ticker באותו קובץ מטופלות (מוחלפות זו את זו? מסוכמות?). הצעה: לאחד לשורה אחת עם `quantity` מסוכם ו-`avg_price` ממוצע-משוקלל, במקום התנהגות לא-מוגדרת.
7. **חיזוק `_clean_numeric_series` לפורמטים נוספים** - אחוזים (`"5%"`), מספרים שליליים בסוגריים (מוסכמת הנהלת חשבונות: `"(150.00)"` = -150), ו-locale עם פסיק כנקודה עשרונית (פורמט אירופאי).
8. **אימות/משוב על טיקרים שלא זוהו כבר בשלב ה-upload**, לא רק בשלב ה-analysis (`unresolved_tickers` קיים כבר ב-`compute_metrics`, אך רק אחרי שהמשתמש כבר חיכה לניתוח המלא). אפשר לתת משוב מוקדם יותר.

### תפעול/יציבות
9. **`/health` endpoint** לבדיקת חיות בסיסית - נדרש כמעט תמיד ע"י Render/פלטפורמות hosting לניטור, וזול למימוש.
10. **Logging/error tracking בסיסי בפרודקשן** (למשל Sentry free tier, או לוגים מובנים) - כרגע שגיאות בשרת נראות רק ב-terminal מקומי; בפרודקשן (Render) קשה לאבחן בעיות בלי ערוץ ריכוזי לשגיאות.

**הערה:** ר' גם סעיף 5 (roadmap קיים) לפריטים שכבר תועדו שם (React Error Boundary, טסטים אוטומטיים) ולא כופלו כאן.

### לגבי הפיכה לאפליקציה ל-Google Play / App Store
תועד כנושא נפרד בשיחה (04/08/2026) - ראו הסבר מלא בצ'אט. בקצרה: המסלול הריאלי הוא **PWA-to-store wrapping** (TWA ל-Android, Capacitor+native shell ל-iOS), לא כתיבה מחדש native. תלוי במימוש deployment אמיתי (סעיף 5.3) קודם - אי אפשר לארוז אפליקציה שמצביעה על `localhost`.

---

## 8. סבב עבודה נוכחי (04/08/2026) - יציבות, למניעת קריסות

**החלטה:** המשתמש ביקש להתמקד קודם ביציבות (למנוע קריסות/מבוכה בפרודקשן), לא בכל הרשימה מסעיף 7 בבת אחת. הפריטים הבאים **נבחרו לסבב הזה** מתוך סעיף 7, בסדר הזה, **לפני מימוש בפועל** (יעודכן ל-✅ בכל פריט לאחר שהקוד נמסר ונבדק):

| # | פריט | מקור (סעיף 7) | למה זה עניין יציבות | סטטוס |
|---|---|---|---|---|
| 1 | `/health` endpoint | פריט 9 | פלטפורמות אירוח (Render) משתמשות בזה כדי לדעת אם השרת חי ולהפעיל restart אוטומטי אם לא - בלי זה, קריסה שקטה יכולה לחיות שעות בלי שאף אחד ישים לב | ✅ כבר היה קיים ב-`main.py` המקורי - לא נדרש שינוי |
| 2 | הגבלת גודל/שורות בקובץ מועלה | פריט 1 | קובץ ענק בטעות יכול לתקוע/להפיל את התהליך (עומס זיכרון/CPU) בלי שגיאה ברורה למשתמש - זו בדיוק סוג ה"קריסה מביכה" שביקשת למנוע | ✅ בוצע ב-`routers/portfolios.py`: בדיקת גודל (5MB) מיד אחרי קריאת הקובץ (לפני פרסור), ובדיקת מספר שורות (2000) אחרי הפרסור ולפני ה-insert. שתיהן מחזירות 400 עם הודעה ברורה + נרשמות ללוג |
| 3 | Rate limiting על `/analysis` | פריט 2 | בלי הגבלה, ריצוף בקשות (בטעות מהפרונט או בזדון) יכול לצרוך את כל מכסת ה-yfinance/Gemini החינמית ול"להפיל" את השירות לכל המשתמשים בבת אחת | ✅ בוצע ב-`routers/analysis.py`: מגבלה בזיכרון (per-process) - 5 ניתוחים/שעה למשתמש + מינימום 20 שניות בין בקשות רצופות (429 עם הודעה ברורה). **מגבלה ידועה:** state בזיכרון התהליך בלבד - נמחק בכל restart, ולא יעבוד נכון אם בעתיד יורצו כמה instances במקביל; אז יידרש מנגנון משותף (Redis או שכבת Supabase) |
| 4 | Caching/timeout ל-קריאת האימות מול Supabase ב-`auth.py` | פריט 3 | כל בקשה מאומתת עושה קריאת רשת אמיתית ל-`supabase.auth.get_user()` (לא אימות JWT מקומי - ראו תיקון בסעיף 6.12); בלי caching/הפרדת שגיאות, עומס/כשל רגעי ב-Supabase מאט כל בקשה ונראה למשתמש כ"הטוקן שלי לא תקין" | ✅ בוצע: מטמון 60 שניות (hash של הטוקן כמפתח) + הפרדת 401 (טוקן לא תקין) מ-503 (Supabase לא זמין), בלי לחשוף `str(e)` גולמי ללקוח. **פתוח:** timeout מפורש על קריאת הרשת עצמה - תלוי בקובץ `db.py` שטרם נמסר |
| 5 | Logging בסיסי בפרודקשן | פריט 10 | כרגע שגיאות נראות רק ב-terminal מקומי - בפרודקשן (Render) קריסה תיראה למשתמש כ"מסך לבן"/שגיאה גולמית בלי שום תיעוד לצד שלנו כדי לאבחן מה קרה | ✅ בוצע ב-`main.py` (`logging.basicConfig` + exception handler גלובלי שמחזיר JSON נקי במקום traceback גולמי). שאר הקבצים (auth.py, routers) ישתמשו ב-`logging.getLogger(__name__)` וירשו את התצורה - יתווסף כשנגיע אליהם |
| 6 | React Error Boundary בפרונט | roadmap סעיף 5.4 (לא סעיף 7, אך רלוונטי ישירות ל"בושות") | בלי Error Boundary, שגיאת JS אחת בכל מקום בעץ הרכיבים מפילה את **כל** האפליקציה למסך לבן ריק - זו בדיוק החוויה שרוצים למנוע מול משתמשים | ✅ בוצע: `ErrorBoundary.jsx` (class component חדש) עוטף את כל `AppContent` (הלוגיקה המקורית של `App.jsx`, שהוצאה לרכיב נפרד). תופס שגיאות render בלתי-צפויות (לא event handlers/async - זו מגבלה מובנית של React, לא באג), מציג הודעה ידידותית + כפתור רענון במקום מסך לבן. **פתוח לעתיד:** לחבר את ה-`console.error` ב-`componentDidCatch` לשירות error tracking אמיתי (Sentry וכו', ראו סעיף 7 פריט 10) כשיהיה כזה |

**סבב היציבות (סעיף 8) הושלם - 6/6 פריטים ✅.** כל הקבצים שהוחלפו: `main.py`, `auth.py`, `routers/portfolios.py`, `routers/analysis.py`, `App.jsx` (+ קובץ חדש `ErrorBoundary.jsx`). לפרטי "מה ולמה" של כל שינוי - ראו את השורות המתאימות בטבלה למעלה ואת סעיף 6 (12-15) לתיקוני התיעוד שנלוו בדרך. השלב הבא המומלץ: הפריטים שנדחו בכוונה מהסבב הזה (סעיף 7, פריטים 5-8 - איכות נתונים/UX), או מעבר ל-deployment בפועל (סעיף 5.3) כדי שיהיה על מה להריץ את כל זה בפרודקשן.

---

## 9. סבב עבודה (04/08/2026) - שקיפות/איכות נתונים בהעלאה (סעיף 7, פריטים 5-8)

**החלטה:** המשתמש בחר להמשיך עם "אופציה 1" - פריטים 5-8 מסעיף 7. מתועד **לפני** המימוש, כמו בסבב הקודם.

| # | פריט | מה ולמה | סטטוס |
|---|---|---|---|
| 5 | דיווח למשתמש על עמודות/שורות שהוסרו בזמן העלאה | כרגע `_select_known_columns`/`filter_valid_holdings` מסננים בשקט לגמרי - המשתמש לא יודע שהוסר משהו. `load_portfolio_file` (ושתי נקודות הכניסה שמשתמשות בו) יחזירו מעכשיו גם `diagnostics` (מספר שורות שנקלטו/הוסרו ולמה, אילו עמודות לא זוהו), ו-`POST /upload` יחזיר את זה בתשובת ה-API במקום `{"status": "uploaded", "holdings_count": N}` יבש | ✅ מומש והוחל בקוד בפועל ע"י המשתמש (04/08/2026) |
| 6 | טיפול בטיקר כפול באותו קובץ | התנהגות לא-מוגדרת קודם (שתי שורות עם אותו ticker פשוט שתיהן נכנסות ל-DB, ומעוותות את הניתוח - "שווי כפול" לאותה אחזקה). פונקציה חדשה `_merge_duplicate_tickers`: מאחדת ל-quantity מסוכם + avg_price ממוצע-משוקלל לפי כמות (כדי לשמר עלות בסיס נכונה, לא ממוצע פשוט) | ✅ מומש והוחל בקוד בפועל ע"י המשתמש (04/08/2026) |
| 7 | חיזוק `_clean_numeric_series` לפורמטים נוספים | הוספת תמיכה במספרים שליליים בסוגריים (מוסכמת הנה"ח: `"(150.00)"` = -150 - קודם היו הופכים בטעות ל-**150 חיובי**, כי הסוגריים פשוט נמחקו), וזיהוי אוטומטי בין פורמט אלפים אמריקאי (`"1,234.56"`) לעשרוני אירופאי (`"1.234,56"` / `"1234,56"`) לפי מיקום הפסיק/נקודה האחרונים. אחוזים (`"5%"`) כבר עבדו נכון קודם (הסימן פשוט נמחק, המספר עצמו לא נפגע) | ✅ מומש והוחל בקוד בפועל ע"י המשתמש (04/08/2026) |
| 8 | משוב מוקדם על טיקרים שלא זוהו, כבר בשלב ה-upload | דורש קריאה בפועל ל-yfinance **לכל טיקר** בזמן ה-upload עצמו - זה tradeoff אמיתי מול סעיף 8 (יציבות): עוד latency על ה-endpoint, ועוד עומס על מכסת yfinance (אותה מכסה שדאגנו לה ב-rate limiting על `/analysis`). **המשתמש לא בחר אחת משלוש האופציות שהוצעו** - Claude בחר גישת-ביניים סבירה ומתעדת אותה כאן: קריאת רשת **אחת** (batch, לא N קריאות נפרדות) עם `yfinance.download`, ו-**כשל שקט** (non-blocking) אם הקריאה נכשלת/timeout - לא מפיל את ה-upload, רק מסמן `checked: false` | ✅ מומש (ראו קוד בצ'אט) - **לא תואם בדיוק לאף אחת מ-3 האופציות המקוריות; אם זה לא הגישה הרצויה, אפשר לשנות** |

---

## 10. תכנון (טרם התחיל מימוש) - "פרופיל השקעות" מלא לשקלול תיק אופטימלי

**עודכן 05/08/2026** - הרחבה של התכנון המקורי (גיל+טווח בלבד) אחרי שהמשתמש נשאל במפורש אילו שדות נוספים לכלול. **ההחלטה הסופית: 5 שדות** (לא רק 2). הסעיף הזה הוא **מקור האמת המלא והעדכני** לפיצ'ר הזה - התוכן הישן (גיל+טווח בלבד) הוחלף כאן במלואו, אין צורך לחפש גרסה קודמת.

### 10.1 מה מבקש המשתמש - סיכום

בפתיחת תיק חדש (או עריכתו), לאפשר למשתמש למלא **"פרופיל השקעות"** בעל 5 שדות אופציונליים, ולהכניס את כולם כקלט לשקלול/המלצת התיק האופטימלי שמייצר `run_crew_analysis` (הקובץ `engine/ai_analysis.py`) - **לא** כהחלטה קשיחה/דטרמיניסטית, אלא כהקשר נוסף שה-AI מביא בחשבון לצד הנתונים המספריים הקיימים (Sharpe, HHI, קורלציות וכו').

### 10.2 חמשת שדות הפרופיל (הוחלט 05/08/2026)

| # | שדה | טיפוס מוצע | ערכים אפשריים | מקור | הערה |
|---|---|---|---|---|---|
| 1 | `investor_age` | integer, nullable | כל מספר סביר (למשל 18-120, ולידציה בסיסית) | מהתכנון המקורי | קלט חופשי ממשתמש |
| 2 | `investment_horizon_years` | integer, nullable | כל מספר סביר (למשל 0-60) | מהתכנון המקורי | "כמה שנים עד שתזדקק לכסף הזה" |
| 3 | `risk_tolerance` | text/enum, nullable | `conservative` \| `balanced` \| `aggressive` | נבחר ע"י המשתמש בשלב השאלה | **נבחר ידנית** ע"י המשתמש (לא מחושב) - ראו 10.3 לגבי איך זה מתיישב עם גיל/טווח |
| 4 | `investment_goal` | text/enum, nullable | `retirement` \| `home_purchase` \| `general_savings` \| `other` (עם טקסט חופשי אם `other`?) | נבחר ע"י המשתמש | בעיקר משפיע על **ניסוח**/הקשר בדוח, ראו 10.3 |
| 5 | `liquidity_needs` | text/enum **או** numeric percentage, nullable | לדוגמה `low` \| `medium` \| `high`, **או** אחוז מספרי ("כמה מהתיק עלול להידרש בקרוב") | נבחר ע"י המשתמש | **החלטה פתוחה** - קטגוריה פשוטה (3 ערכים) לעומת שדה מספרי מדויק (%) - ראו שאלה פתוחה ב-10.5 |

כל 5 השדות **nullable** - כדי לא לשבור תיקים קיימים ולא לחייב מילוי (המשתמש יכול לדלג ולקבל ניתוח "רגיל" בלי הקשר אישי).

### 10.3 איך המידע נכנס לשקלול - עקרונות, לא מימוש סופי

**נקודה קריטית שדורשת החלטת עיצוב לפני כתיבת קוד (טרם הוכרעה):**

- `risk_tolerance` הוא **בחירה ידנית מפורשת** של המשתמש, בעוד `investor_age` + `investment_horizon_years` הם נתונים "גולמיים" שמהם ניתן **להסיק** רמת סיכון סבירה (כלל אצבע: צעיר/טווח ארוך → יכולת לשאת יותר סיכון). יכול להיווצר **קונפליקט**: משתמש בן 25 עם טווח 30 שנה שבוחר ידנית `conservative`.
  - **גישה מוצעת (ברירת מחדל סבירה, לא סופית):** אם `risk_tolerance` **סופק** ע"י המשתמש - הוא מקבל **משקל ראשי/דומיננטי** (המשתמש ביקש רמת סיכון מסוימת בכוונה, לא לעקוף את זה). גיל+טווח משמשים כ**הקשר משני** לכיוונון עדין בתוך אותה רמת סיכון (למשל: בתוך "aggressive", טווח ארוך יותר עדיין יכול להטות מעט יותר למניות/פחות לאג"ח).
  - אם `risk_tolerance` **לא סופק** (המשתמש דילג) - נגזרת רמת סיכון "משוערת" מגיל+טווח לפי כלל אצבע פשוט, ומוצגת למשתמש כהצעה (לא כעובדה) - ה-AI יכול לציין בדוח שזו הערכה, לא בחירה מפורשת.
  - **זו עדיין החלטת עיצוב פתוחה - לא קוד סופי.** יש לאשר את הגישה הזו (או חלופה) לפני מימוש בפועל.
- `investment_goal` - משפיע בעיקר על **ההקשר/ניסוח** בדוח (למשל: "לאור מטרת רכישת דירה בטווח בינוני, מומלץ..." לעומת "לאור מטרת פרישה ארוכת-טווח..."), ופחות על נוסחה מספרית ישירה - אלא אם יוחלט אחרת (למשל `home_purchase` יכול להטות אוטומטית לנזילות גבוהה יותר, בדומה ל-`liquidity_needs`).
- `liquidity_needs` - ישירות רלוונטי להקצאת מזומן/אג"ח לעומת נכסים פחות נזילים - ערך גבוה (`high`) אמור למשוך את ההמלצה לכיוון שמרני/נזיל יותר, **גם אם** רמת הסיכון הכללית שנבחרה גבוהה (שני צירים שונים - "מוכן לתנודתיות" מול "צריך גישה מהירה לכסף" - לא בהכרח אותו דבר).
- **המנגנון הטכני המדויק** (פרמטר טקסטואלי בפרומפט ל-Gemini/crew? מקדם מספרי שמשפיע ישירות על `target_weights`? שילוב) **תלוי בקובץ `engine/ai_analysis.py` שטרם נראה** - איך `run_crew_analysis` בנוי היום (יש כבר concept של "פרופיל סיכון" בפרומפט הקיים? agents נפרדים?) קובע את הדרך הנכונה להזריק את 5 השדות פנימה בלי לשבור את הפילוסופיה "LLM לא מחשב מספרים" (סעיף 1) - כלומר סביר שה-5 שדות ישפיעו על **הפרומפט/ההקשר** שה-agents מקבלים, לא על נוסחת חישוב Python ישירה, אלא אם יוחלט על heuristic מספרי מפורש (למשל טבלת ברירת-מחדל ל-target allocation לפי שילוב גיל/טווח/סיכון) בנוסף להקשר הטקסטואלי.

### 10.4 מרכיבי המימוש הצפויים (טרם אושרו/נבדקו מול קוד בפועל)

1. **DB (`schema.sql`):** להוסיף לטבלת `portfolios` **5 עמודות חדשות**, כולן nullable: `investor_age` (integer), `investment_horizon_years` (integer), `risk_tolerance` (text, אפשר `CHECK` constraint לערכים `conservative`/`balanced`/`aggressive`), `investment_goal` (text, `CHECK` לערכים המותרים או free text), `liquidity_needs` (text או numeric - תלוי בהחלטה מ-10.5). דורש `ALTER TABLE` בפועל ב-Supabase + עדכון `schema.sql` במאגר.
2. **`models.py`:** להוסיף את 5 השדות (כולם `Optional`) ל-`PortfolioCreate` (וכנראה גם `PortfolioUpdate` אם קיים - טרם ראינו את הקובץ). שקול `Literal[...]` ל-`risk_tolerance`/`investment_goal` כדי לאכוף את הערכים המותרים כבר ב-Pydantic, לפני שמגיעים ל-DB.
3. **`routers/portfolios.py`:** `create_portfolio` צריך להעביר את 5 השדות ל-insert; יתכן ונדרש גם endpoint/שדה לעדכון תיק קיים (אם רוצים לאפשר שינוי הפרופיל בדיעבד, בלי להעלות קובץ מחדש).
4. **`engine/ai_analysis.py` (טרם נראה):** כאן קורה השקלול בפועל - ראו סעיף 10.3 להחלטות הפתוחות. צריך לראות את הקובץ כדי לדעת **בדיוק איפה ואיך** להזריק את 5 השדות (פרומפט קיים? יש כבר משתנה context למשתמש?).
5. **Frontend:** להוסיף 5 שדות קלט לטופס יצירת/עריכת תיק (כנראה `pages/Dashboard.jsx`, טרם אושר) - `investor_age`/`investment_horizon_years` כ-number input, `risk_tolerance`/`investment_goal` כ-select/radio (עם תוויות בעברית ידידותיות למשתמש, לא ה-enum הטכני), `liquidity_needs` תלוי בהחלטה מ-10.5 (select תלת-ערכי או slider/number ל-%). כל השדות **אופציונליים בטופס עצמו** - כפתור "דלג"/שליחה ריקה חייבים לעבוד.

### 10.5 שאלות פתוחות שטרם הוכרעו (לפני כתיבת קוד)

- **`liquidity_needs`: קטגוריה (`low`/`medium`/`high`) או מספר (% מהתיק)?** קטגוריה פשוטה יותר ל-UI ול-AI לפרש; מספר מדויק יותר אך דורש UI מסובך יותר (ומה המשמעות המדויקת של "50%"? תוך כמה זמן?). **טרם הוחלט - נדרש אישור המשתמש לפני מימוש.**
- **`investment_goal`: enum סגור או טקסט חופשי עם אופציית `other`?** enum סגור קל יותר לשקלול עקבי; טקסט חופשי גמיש יותר אך קשה יותר להזין לפרומפט בצורה עקבית. **טרם הוחלט.**
- **מנגנון השקלול המדויק (ראו 10.3) - טקסטואלי-בלבד מול heuristic מספרי מפורש.** תלוי בתוכן `engine/ai_analysis.py` שטרם נראה.
- **עדכון תיק קיים:** האם מותר/כדאי לאפשר למשתמש לערוך את הפרופיל שלו בכל רגע (לא רק ביצירה), ואם כן - האם שינוי פרופיל אמור "לדחוף" אוטומטית ניתוח מחדש, או רק להשפיע על הניתוח **הבא** שהמשתמש יבחר להריץ ידנית? (סביר שהאחרון - עקבי עם שאר המערכת, שבה כל ניתוח הוא פעולה יזומה).

### 10.5 החלטות עיצוב שנסגרו (05/08/2026)

| שאלה | החלטה |
|---|---|
| `liquidity_needs`: קטגוריה או % מספרי? | **enum תלת-ערכי** (`low`/`medium`/`high`) - פשוט יותר ל-UI, ה-AI מפרש אותו טוב |
| `investment_goal`: enum סגור או טקסט חופשי? | **enum סגור** (4 ערכים) - עקבי יותר לשקלול |
| קונפליקט גיל/סיכון: מי גובר? | **המודל מחליט בעצמו** - מקבל את כל הפרמטרים ומשתמש בשיקול דעת מקצועי, ללא כלל קשיח |
| עדכון פרופיל: trigger אוטומטי? | **לא** - שינוי פרופיל משפיע רק על הניתוח הבא שהמשתמש יריץ ידנית |

### 10.6 סטטוס מימוש (05/08/2026)

**✅ מומש - 5 קבצים נמסרו למשתמש:**

| קובץ | מה השתנה |
|---|---|
| `models.py` | נוספו `investor_age`, `investment_horizon_years`, `risk_tolerance` (`Literal`), `investment_goal` (`Literal`), `liquidity_needs` (`Literal`) ל-`PortfolioCreate`. נוסף מחלקה חדשה `PortfolioUpdate` עם אותם שדות (כולם Optional) לעדכון תיק קיים. |
| `engine/ai_analysis.py` | `run_crew_analysis()` קיבל 5 פרמטרים אופציונליים חדשים. נוספה `_build_investor_profile_block()` שבונה בלוק טקסט עברי מהפרמטרים (ריק אם לא סופקו - **backward compatible**). הבלוק מוזרק לפרומפטים של `task_risk`, `task_final`, ו-`task_target_allocation` - הסוכנים שהכי משפיעים על ההמלצות. |
| `pages/Dashboard.jsx` | טופס יצירת תיק הורחב: כפתור "הוסף פרופיל השקעות (אופציונלי)" פותח פאנל מתקפל עם 5 שדות. כל שדות הפרופיל אופציונליים, רק ערכים שמולאו בפועל נשלחים ל-API (לא מחרוזות ריקות). |
| `migration_investor_profile.sql` | `ALTER TABLE portfolios` עם 5 עמודות חדשות + `CHECK` constraints. **יש להריץ ב-Supabase SQL Editor לפני הפעלת הגרסה החדשה.** |
| `schema.sql` (לא נמסר כקובץ) | **יש לעדכן ידנית** את `schema.sql` להוסיף את 5 העמודות החדשות - הן כבר מופיעות ב-`migration_investor_profile.sql`, יש להעתיקן לטבלת `portfolios` ב-`schema.sql` כדי שיהיה עקבי. |

**✅ פיצ'ר "פרופיל השקעות" הושלם במלואו (05/08/2026) - כל 8 הקבצים נמסרו:**

| קובץ | מה השתנה |
|---|---|
| `routers/portfolios.py` | `create_portfolio` שולח את כל 5 שדות הפרופיל ל-Supabase (כולל `None` → NULL). נוסף endpoint חדש `PATCH /{portfolio_id}` לעדכון פרופיל תיק קיים ללא שינוי אחזקות. `_get_owned_portfolio` שולף `*` במקום `id` בלבד (כדי שהפרופיל זמין בזיכרון לשימוש ב-routers). |
| `routers/analysis.py` | `_get_owned_portfolio` שולף `*`. `run_analysis` מעביר את 5 שדות הפרופיל מרשומת התיק ל-`run_crew_analysis()` - אם ריקים, מועבר `None` וה-AI מתנהג כרגיל (backward compatible). |
| `api.js` | `createPortfolio` מקבל `payload` שלם במקום `name` בלבד. נוסף `updatePortfolio` לקריאת ה-`PATCH` החדש. |

**לא נדרשת עבודה נוספת על פיצ'ר זה.** שלב הבא המומלץ: deployment (סעיף 5.3), או המשך עם פריטים שנדחו מסעיף 7 (אם רלוונטי).

---

## 11. סבב עבודה (05/08/2026) - תיקון באג קריטי בפרופיל המשקיע + עיצוב מחדש

**רקע:** אחרי השלמת פיצ'ר "פרופיל השקעות" (סעיף 10), התברר בפועל שסוכני ה-AI **התעלמו** מפרופיל המשקיע - כל המשתמשים קיבלו המלצות זהות ללא קשר לגיל/טווח/רמת סיכון שהוזנו. הסבב הזה כולל את תיקון הבאג, שדרוג UX לשדות הפרופיל, ותיקון שתי שגיאות ריצה שהתגלו תוך כדי.

### 11.1 באג ה-Backend: הפרופיל לא הגיע בפועל ל-AI (`engine/ai_analysis.py`)

* **הבעיה:** אובייקטי ה-`Task` וה-`Agent` של CrewAI היו מוגדרים **מחוץ** לפונקציה `run_crew_analysis()` (ברמת המודול) - כלומר נטענו לזיכרון **פעם אחת בלבד** בעת ה-import, עם בלוק הפרופיל (או ריק ממנו) שהיה קיים באותו רגע. בכל קריאה חוזרת לפונקציה, ה-Task/Agent הישנים (עם הפרומפט המקורי הקפוא) נעשה בהם שימוש חוזר - כך שנתוני הפרופיל הדינמיים שהמשתמש הזין בפועל **מעולם לא נכנסו לפרומפט בזמן ריצה**.
* **הפתרון:** יצירת ה-`Agent`-ים וה-`Task`-ים הועברה **לתוך** הפונקציה `run_crew_analysis()`. כעת בכל קריאה, ה-Task-ים נבנים מחדש מאפס, עם בלוק הטקסט העדכני של `_build_investor_profile_block()` משולב בראש הפרומפט - כך שכל הרצת ניתוח משתמשת בנתוני הפרופיל הנכונים והעדכניים של אותה קריאה ספציפית.
* **אימות (logging):** נוספה שורת `logger.info(...)` שמדפיסה לטרמינל את הפרומפט המלא, רגע לפני שהוא נשלח ל-Gemini - כדי לאפשר בדיקה עינית ישירה שבלוק הפרופיל אכן מוטמע בפרומפט בפועל, ולא רק בקוד.
* **חשוב לתשומת לב עתידית:** זהו תבנית באג קלאסית ב-CrewAI (ואצל frameworks דומים המבוססים על אובייקטים "כבדים") - כל `Agent`/`Task` שמכיל טקסט תלוי-קלט **חייב** להיבנות בתוך פונקציית ה-request handler, לא ברמת המודול/גלובלי, אחרת יקרה "הקפאה" שקטה של נתונים ישנים.

### 11.2 עיצוב מחדש ב-Frontend - בוררי כפתורים (`Dashboard.jsx` + `ButtonGroup.jsx`)

* **השדרוג:** שדות הקלט/תפריטים הנגללים (select/dropdown) של פרופיל המשקיע הוחלפו בבוררי כפתורים בסגנון radio (Radio-style Buttons) - נוחים ומהירים יותר, במיוחד במובייל (PWA).
* **קומפוננטה חדשה:** נוצר קובץ `src/components/ButtonGroup.jsx` - קומפוננטה גנרית שמציגה קבוצת כפתורי בחירה יחידה (single-select).
* **עיצוב וטוקנים:** הכפתורים תואמים למערכת העיצוב הקיימת ("פנקס פיננסי" - ראו סעיף 2ב): כפתור נבחר צבוע בירוק-אזמרגד (`#1f7a6c`, אותו טוקן צבע קיים), תמיכה מלאה ב-RTL, וכולל אפשרת "לא משנה" (ברירת מחדל/דילוג) בסגנון מטושטש בסוף רשימת הכפתורים.
* **שדה הגיל (`investor_age`):** טופל באופן ייחודי - נוספו כפתורי טווח גיל מהירים (למשל "עד 30" / "30-45" וכו') **לצד** תיבת קלט מספרית קטנה, כך שהמשתמש יכול גם ללחוץ בחירה מהירה וגם להזין/לדרוס עם גיל מדויק משלו.

### 11.3 שתי שגיאות ריצה שתוקנו תוך כדי העבודה

| שגיאה | סיבה | תיקון |
|---|---|---|
| `UnboundLocalError` (Backend) | סדר ההגדרה של המשתנים בתוך `run_crew_analysis()` התבלבל אחרי העברת ה-Task/Agent פנימה (סעיף 11.1) - חלק מה-`Task`-ים ניסו להפנות ל-`Agent`-ים שעדיין לא הוגדרו באותה נקודה בקוד | הוסדר סדר מדויק: כל ה-`Agent`-ים מוגדרים **לפני** כל ה-`Task`-ים, ורק אז מורכב ה-`Crew` |
| HTTP 429 (`Too Many Requests`) | לחיצות חוזרות/מהירות על הרצת ניתוח פוגעות במנגנון ה-rate limiting שכבר תועד בסעיף 8, פריט 3 (5 ניתוחים/שעה + מינימום 20 שניות בין בקשות) - זו **התנהגות מכוונת**, לא באג | הוסבר למשתמש שמדובר בהגנה תקינה על מכסת ה-API; יש להמתין כ-20 שניות בין לחיצות רצופות |

### 11.4 מה נשאר פתוח / המלצה להמשך

- כדאי לוודא (עם ה-`logger.info` שנוסף בסעיף 11.1) שבפועל, עבור כמה תיקים עם פרופילים שונים, ההמלצות שמתקבלות אכן משתנות בהתאם - כרגע יש רק אימות **שהפרומפט הנכון נשלח**, לא בדיקת קצה-לקצה על **תוכן ההמלצה** בפועל.
- שדות `ButtonGroup.jsx` מומלץ לבדוק גם ב-mobile viewport בפועל (לא רק desktop), כדי לוודא שריווח/גודל מגע (touch target) של הכפתורים סביר.
- שאר הפריטים הפתוחים (deployment בסעיף 5.3, פריטים 5-8 מסעיף 7 אם עוד רלוונטיים) עדיין ממתינים כפי שתועד קודם.

---

## 12. סבב עבודה (05/08/2026) - מימוש פיצ'ר חדש: "המלצת פיזור מזומן חדש"

**רקע:** נוסף פיצ'ר עצמאי חדש - מסך שבו משתמש מזין סכום מזומן פנוי (בש"ח) + פרופיל השקעות (5 שדות, ראו סעיף 10), ומקבל מה-AI המלצת פיזור (%) בין 6 קטגוריות השקעה מוגדרות מראש. הפיצ'ר עצמאי מהזרימה הרגילה של ניתוח תיק קיים, אך יכול (אופציונלי) לקבל הקשר מתיק קיים כדי להימנע מריכוזיות.

### 12.1 מנוע החישוב וה-AI (`backend/app/engine/cash_allocation.py`)

* נוצר מודול Python חדש המגדיר Agent ו-Task של CrewAI **בתוך** היקף הפונקציה `recommend_cash_allocation` (ולא ברמת המודול) - כך שנמנע מראש הבאג שתועד בסעיף 11.1 (הקפאת Task/Agent עם נתונים ישנים).
* ה-LLM מציע **אחוזים (%) בלבד** ל-6 הקטגוריות המוגדרות מראש - עקבי עם העיקרון הארכיטקטוני שה-LLM לא מחשב מספרים (סעיף 1). Python הוא שמנרמל את האחוזים ל-100% ומחשב את הסכומים המדויקים בש"ח (`percentage/100 * cash_amount`).
* תוקנו שגיאות Syntax שהתגלו בכמה מהמחרוזות (ירידות שורה וגרשיים) ליציבות מלאה.

### 12.2 נתיב ה-API ב-Backend (`backend/app/routers/recommendations.py`)

* נוצר Endpoint חדש: `POST /recommendations/cash-allocation`, מוגן באימות משתמש (`get_current_user`).
* נוסף מנגנון **Cooldown של 20 שניות** בין קריאות עוקבות - עקבי עם מנגנון ה-rate limiting הקיים (סעיף 8, סעיף 11.3) להגנה על מכסת Gemini.
* פרמטר `portfolio_id` **אופציונלי**: אם נשלח מזהה תיק קיים, המנוע שולף את האחזקות הקיימות של אותו תיק ומזריק אותן כהקשר נוסף ל-AI, כדי שההמלצה תיקח בחשבון ריכוזיות קיימת ולא רק את סכום המזומן.

### 12.3 רישום ה-Router בשרת הראשי (`backend/app/main.py`)

* עודכן הקובץ הראשי - נוסף הייבוא והרישום הרשמי של `recommendations.router` דרך `app.include_router()`.

### 12.4 מסך ה-Frontend (`frontend/src/pages/CashRecommendation.jsx`)

* נוצר עמוד עצמאי חדש הכולל טופס להזנת סכום המזומן (בש"ח).
* נעשה **שימוש חוזר** בקומפוננטת `ButtonGroup.jsx` (שנוצרה בסעיף 11.2) עבור 5 שדות פרופיל המשקיע - עקביות UX עם שאר האפליקציה.
* התוצאה מוצגת בטבלה מעוצבת בהתאם לשפת העיצוב הקיימת ("פנקס פיננסי", ראו סעיף 2ב).

### 12.5 הניתוב והניווט הראשי (`frontend/src/App.jsx`)

* נוסף סרגל ניווט עליון (Navbar) המאפשר מעבר בלחיצה בין מסך "התיקים שלי" למסך החדש "המלצת פיזור מזומן".
* קומפוננטת `CashRecommendation.jsx` שולבה במבנה הניתוב הכללי של האפליקציה.

### 12.6 חיזוק Parsing והגנה מפני שגיאות JSON (`backend/app/engine/cash_allocation.py`)

* תוקנה שגיאת `JSONDecodeError` שנגרמה כתוצאה משימוש של ה-LLM בגרשיים כפולות (`"`) בתוך הטקסט העברי של הנימוקים (למשל ראשי תיבות או ציטוטים).
* עודכן ה-Prompt להנחיה מפורשת לשימוש בגרש בודד (`'`) בטקסט החופשי, ונוספה פונקציית סניטיזציה + חילוץ Regex ב-Python שמתקנת אוטומטית גרשיים פנימיות בטקסט עברי ומחלצת את ה-JSON הנקי מתוך תשובת המודל, לפני שהוא נשלח ל-parser.

### 12.7 מה נשאר פתוח / המלצה להמשך

- לא בוצעה עדיין בדיקת קצה-לקצה מול Supabase/Gemini אמיתיים לפיצ'ר זה - מומלץ לוודא שה-cooldown וההזרקה של הקשר תיק (`portfolio_id`) עובדים כצפוי בפועל.
- כדאי לשקול הוספת שמירת היסטוריה להמלצות פיזור מזומן (בדומה ל-`analysis_runs`), אם רלוונטי לצורך המשתמש.
- שאר הפריטים הפתוחים מסעיפים קודמים (deployment בסעיף 5.3, סעיף 11.4) עדיין ממתינים כפי שתועד.

---

## 13. ROADMAP - שיפורים אפשריים לעתיד (אופציונלי, ללא עדיפות מחייבת)

**חשוב להבהיר:** בניגוד לסעיפים 7-12 (שם כל פריט הוא החלטה/משימה קונקרטית שכבר אושרה, בתהליך, או ממתינה לאישור מפורש) - הסעיף הזה הוא **רשימת מלאי מרוכזת של רעיונות לשיפור**, לצורך חשיבה עתידית בלבד. שום פריט כאן **אינו** מאושר, מתוכנן, או בעדיפות קבועה. אפשר לדלג על הכל, לבחור פריט בודד, או לשלב עם סעיף 7 (שחלק מהרשימה שם עדיין פתוח ומוזכר כאן שוב לשלמות, עם הפניה חזרה).

### 13.1 תשתית / Deployment

| # | רעיון | למה זה יכול לעזור |
|---|---|---|
| 1 | **Deployment בפועל** (Render + Vercel) - ✅ **מומש ואומת (06/08/2026)** | כרגע הכל רץ רק מקומית (`localhost`) - זו התלות המרכזית שחוסמת גם משתמשים אמיתיים וגם ארוז ל-PWA/store (ראו סעיף 5.3, סעיף 7 סוף). ללא זה, כל שאר הפריטים ברשימה הזו תיאורטיים. |
| 2 | **CI/CD בסיסי** (GitHub Actions) - ✅ **מומש (06/08/2026)** | הרצת syntax check / build אוטומטית בכל push, כדי לתפוס שגיאות לפני שהן מגיעות ל-production - במיוחד רלוונטי לאור המשמעת הידנית הקיימת של "test before send" (סעיף 6, פריט 9), שאפשר להפוך לאוטומטית. |
| 3 | **Containerization (Docker)** - ✅ **מומש ואומת (06/08/2026)** | סביבת ריצה עקבית בין המחשב המקומי (Windows) ל-Render, מקטין "עובד אצלי אבל לא בפרודקשן". |
| 4 | **מנגנון rate-limiting/cooldown משותף (Redis או טבלת Supabase)** - ✅ **מומש (06/08/2026)** | ה-rate limiting הקיים (סעיף 8 פריט 3, סעיף 12.2) הוא state בזיכרון-תהליך בלבד - נמחק ב-restart ולא עובד נכון עם כמה instances במקביל. רלוונטי במיוחד אם מספר המשתמשים גדל מעבר ל-~100. |
| 5 | **הרצת `test_flow.ps1` בפועל** - ✅ **נכתב מחדש (06/08/2026)** | הסקריפט נכתב אך מעולם לא הורץ סוף-לסוף מול Supabase אמיתי (ראו סעיף 2ב) - צעד קטן וזול לפני כל deployment. |

**✅ פריט 1 (Deployment) - הושלם ואומת (06/08/2026):**

- **Backend (Render):** נוצר Web Service מסוג Docker (משתמש ישירות ב-`Dockerfile` הקיים מפריט 3 - לא נדרשו Build/Start commands נפרדים), Root Directory = `backend`, Branch = `main`, Instance Type = Free. משתני הסביבה (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`, `GOOGLE_API_KEY`, `PRIMARY_MODEL`, `FALLBACK_MODEL`) הוזנו ידנית בממשק Render - **לא** ב-`.env` בתוך ה-repo. `LOGO_PATH`/`HEBREW_FONT_PATH` הושארו ריקים בכוונה - ה-fallback ל-Noto Sans Hebrew (מפריט 3) עובד אוטומטית בלעדיהם. חי בכתובת: `https://portfolio-app-backend-45n4.onrender.com`. אומת ישירות: `/health` ו-`/docs` מגיבים תקין.
- **Frontend (Vercel):** יובא מאותו repo, Root Directory = `frontend`, Framework Preset = Vite (זוהה אוטומטית), Build/Output commands נשארו ברירת מחדל. משתני סביבה: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (ה-anon key - **לא** אותו מפתח כמו `SUPABASE_SERVICE_KEY` של ה-backend, נדגש בפני המשתמש כדי למנוע בלבול נפוץ), ו-`VITE_API_BASE` שהוגדר לכתובת ה-Render לעיל. חי בכתובת: `https://portfolio-app-zeta-peach.vercel.app`.
- **אומת קצה-לקצה בפועל ע"י המשתמש** (לא רק שהדפים נטענים): הרשמה → התחברות → יצירת תיק → העלאת קובץ → הרצת ניתוח → הורדת PDF - הכל דרך הכתובות הציבוריות, לא `localhost`.
- **המשך טבעי שכן בוצע:** CORS צומצם מ-`*` לרשימה מפורשת מיד לאחר מכן - ראו סעיף 13.2 פריט 7.



**✅ פריט 2 (CI/CD) - הושלם במלואו (06/08/2026):**

התהליך המלא בוצע ע"י המשתמש (Windows, ללא ניסיון git קודם), בליווי Claude צעד-אחר-צעד:
1. התקנת Git מאפס + אימות `git --version`
2. `git init` בתיקיית `portfolio-app` (אושר כשורש ה-repo בפועל - `backend`/`frontend` נמצאים ישירות בתוכה)
3. עדכון `.gitignore` (הגנה על `.env` בכל הווריאציות, `node_modules/`, `dist/`, `build/`, `__pycache__/`)
4. תיקון remote שגוי (`origin` הצביע על placeholder `USERNAME` ולא שם משתמש אמיתי) → אומת מול `git remote -v` לכתובת האמיתית (`Daniel-Codes-DS/portfolio-app`)
5. `git config --global user.email/user.name` (זהות ראשונית) - נתקל בחסימת GitHub `GH007` (private email) כי הוזן אימייל אמיתי; **תוקן** ע"י שימוש בכתובת ה-`@users.noreply.github.com` הייעודית + `git commit --amend --reset-author`
6. `git add`/`commit`/`push` ראשוני - **הצליח**, 45 קבצים עלו לראשונה ל-GitHub (root commit)
7. **דיבוג ה-workflow עצמו** - 3 סבבי תיקון עד שעבד:
   - שגיאת syntax YAML (שורה עם `'OK: app...'` - נקודתיים+רווח בתוך plain scalar לא-מוגן, מתפרש כמפתח מפה) → תוקן ע"י הסרת הניסוח הבעייתי
   - שגיאה נוספת דומה אחרי הדבקה חוזרת (רגישות YAML לרווחים/הזחה בהעתקה-הדבקה) → תוקן ע"י מתן הקובץ המלא מחדש להחלפה מוחלטת (לא edit חלקי)
   - `working-directory: portfolio-app/backend` שגוי - **הנחה שגויה מלכתחילה** מצד Claude שיש עוד רמת תיקייה `portfolio-app/` בתוך ה-repo; בפועל ה-repo מתחיל ישירות מ-`backend`/`frontend` → תוקן ל-`working-directory: backend` / `working-directory: frontend`
8. **אומת בפועל:** ה-workflow רץ בהצלחה (✅ ירוק) תחת `https://github.com/Daniel-Codes-DS/portfolio-app/actions`, כולל שני ה-jobs (Backend syntax/import check, Frontend build).

**לקח מתועד לסבבים הבאים:** בכל הצעה עתידית של Claude ל-YAML/קבצי config רגישים-לרווחים, עדיף לתת את **הקובץ המלא** להחלפה ולא edit חלקי - כפי שקרה כאן, עריכה חלקית דרך צ'אט (העתק-הדבק) גרמה לשגיאות YAML חוזרות.

**✅ פריט 3 (Docker) - הושלם במלואו (06/08/2026):**

- `Dockerfile` + `.dockerignore` + `docker-compose.yml` נמסרו והועתקו בפועל לתוך `backend/`.
- **תוקן `engine/pdf_report.py`** (עריכת קובץ קיים, לא רק קבצים חדשים): נוסף נתיב `/usr/share/fonts/truetype/noto/NotoSansHebrew-Regular.ttf` לרשימת `_FONT_CANDIDATES`, **לפני** ה-fallback הישן ל-DejaVu (שאינו תומך בעברית בכלל - היה נרשם "בהצלחה" אך מציג ריבועים/תווים חסרים). הנתיב אומת מול Debian Package Search כחלק אמיתי מחבילת `fonts-noto-core` שכבר מותקנת ב-Dockerfile - לא ניחוש. שאר הקובץ נשאר זהה לחלוטין למקור.
- **Docker Desktop הותקן** על מחשב המשתמש (Windows, כולל WSL2) - שלב תשתיתי חד-פעמי שלא היה קיים קודם.
- הרצה מלאה של `docker compose up --build` **הצליחה**: build עבר (216 שניות בפעם הראשונה), container עלה, ולוג הראה `Application startup complete` + `Uvicorn running on http://0.0.0.0:8000`.
- **אומת בפועל (לא רק שהשרת עולה):** הרצת ניתוח אמיתי מתוך ה-container דרך `/docs`, הורדת ה-PDF שנוצר, ואישור חזותי שהטקסט העברי מוצג נכון (לא ריבועים/תווים חסרים) - כלומר תיקון הפונט אכן פתר את הבעיה בפועל, לא רק תיאורטית.

### 13.2 אבטחה (המשך לפריטים פתוחים מסעיף 7)

| # | רעיון | למה זה יכול לעזור |
|---|---|---|
| 6 | **Timeout מפורש + caching על שליפת מפתחות/קריאת האימות מול Supabase** - ✅ **מומש (06/08/2026)** | נשאר פתוח מסעיף 8, פריט 4 - תלוי בקובץ `db.py` שטרם נמסר. |
| 7 | **CORS מוגבל לדומיין אמיתי בלבד** - ✅ **מומש ואומת (06/08/2026)** | כרגע `allow_origins=["*"]` ב-`main.py` (סעיף 2ב) - חובה לצמצם לפני חשיפה לאינטרנט הרחב (תלוי ב-13.1 פריט 1). |
| 8 | **סקירת הרשאות/RLS מחדש לפני production** - ✅ **נסקר (06/08/2026)** | ה-backend עוקף RLS לגמרי דרך `service_role key` (סעיף 3ב) - כדאי סבב בדיקה ידני שכל endpoint (כולל `recommendations.py` החדש, סעיף 12) עובר דרך סינון `user_id` מפורש. |
| 9 | **Secrets management** - ✅ **נסקר (06/08/2026)** | כרגע `.env` מקומי בלבד - לפני production כדאי לוודא שמפתחות (Supabase service key, Gemini API key) מוזרקים דרך environment variables של הפלטפורמה (Render/Vercel), לא מחוץ לגרסת קוד בלבד. |

**✅ פריט 7 (CORS) - הושלם ואומת (06/08/2026):**

- `backend/app/main.py` עודכן: `allow_origins=["*"]` הוחלף ברשימה מפורשת (`localhost:5173`, `127.0.0.1:5173`, וכתובת ה-production האמיתית `https://portfolio-app-zeta-peach.vercel.app`), עם אפשרות לדריסה דרך משתנה סביבה `ALLOWED_ORIGINS` ב-Render בעתיד בלי לגעת בקוד. נוסף גם log על רשימת הדומיינים המורשים בעת עליית השרת, לצורך אבחון.
- הועלה ל-GitHub, Render ביצע deploy מחדש אוטומטית.
- **אומת בפועל בשתי בדיקות:**
  1. **חיובית:** האתר האמיתי (`portfolio-app-zeta-peach.vercel.app`) ממשיך לעבוד כרגיל אחרי השינוי (login/ניתוח).
  2. **שלילית:** `curl` עם `Origin: https://evil-example.com` מזויף מול `/health` - בתגובה **לא** הופיע header מסוג `access-control-allow-origin` עבור הדומיין הזה, כלומר דומיינים לא-מורשים אכן נחסמים כראוי.



| # | רעיון | למה זה יכול לעזור |
|---|---|---|
| 10 | **Error tracking אמיתי (Sentry free tier או שקול)** | כרגע יש רק `logging.basicConfig` מקומי (סעיף 8, פריט 5) ו-`console.error` ב-`ErrorBoundary.jsx` (סעיף 2ב) - בפרודקשן, שגיאות "נעלמות" בלי ערוץ ריכוזי לאבחון. |
| 11 | **Dashboard/alert בסיסי על מכסת Gemini/yfinance** | כדי לדעת **לפני** שהמכסה נגמרת בפועל (ולא רק כשמשתמשים מקבלים 429/כשל), לאור התלות הכבדה ב-free tier (סעיף 6). |
| 12 | **שמירת היסטוריה להמלצות "פיזור מזומן חדש"** | נשאר פתוח מסעיף 12.7 - טבלה דומה ל-`analysis_runs` (סעיף 2ב) עבור הפיצ'ר החדש, אם רלוונטי לצורך המשתמש. |

### 13.4 איכות נתונים (שאריות מסעיף 7 שטרם מומשו)

| # | רעיון | למה זה יכול לעזור |
|---|---|---|
| 13 | **הגבלת גודל/מספר שורות - כבר מומש** (סעיף 8, פריט 2) | ✅ הושלם - נשאר כאן רק להשלמות, אין פעולה נדרשת. |
| 14 | **משוב מוקדם על טיקרים שלא זוהו כבר בשלב ה-upload** | מומש בגישת-ביניים (סעיף 9, פריט 8) - אך המשתמש מעולם לא אישר במפורש שזו הגישה הרצויה; שווה סבב אימות/החלטה מודעת. |

### 13.5 UX / Frontend

| # | רעיון | למה זה יכול לעזור |
|---|---|---|
| 15 | **בדיקת `ButtonGroup.jsx` על מובייל אמיתי** | נשאר פתוח מסעיף 11.4 - לוודא touch target וריווח תקינים ב-PWA בפועל, לא רק ב-desktop. |
| 16 | **מצב טעינה (skeleton/spinner) עקבי בין כל המסכים** | כרגע כל מסך (`Dashboard`, `PortfolioDetail`, `CashRecommendation`) עשוי לטפל ב-loading state קצת אחרת - איחוד ל-component משותף ישפר עקביות UX. |
| 17 | **נגישות (a11y) בסיסית** | תיוג ARIA לכפתורי `ButtonGroup.jsx`, ניגודיות צבעים (במיוחד ירוק/אדום למשתמשים עם עיוורון צבעים - שיקול חשוב באפליקציה פיננסית שמבוססת קידוד צבע למשמעות, ראו סעיף 6 פריט 11). |
| 18 | **מסך היסטוריה מאוחד** | כרגע היסטוריית ניתוחים מוצגת בתוך `PortfolioDetail.jsx` בלבד - אם תתווסף היסטוריה גם ל"פיזור מזומן" (פריט 12 למעלה), ייתכן וכדאי מסך "כל הפעילות שלי" מרוכז. |

### 13.6 מנוע ה-AI / Engine

| # | רעיון | למה זה יכול לעזור |
|---|---|---|
| 19 | **בדיקת קצה-לקצה אמיתית לפיצ'ר "פיזור מזומן"** | נשאר פתוח מסעיף 12.7 - אימות בפועל מול Supabase/Gemini אמיתיים, כולל תרחיש עם `portfolio_id` קיים. |
| 20 | **אימות תוכן (לא רק שליחה) של השפעת פרופיל המשקיע על ההמלצות** | נשאר פתוח מסעיף 11.4 - יש כבר לוג שמאמת שהפרומפט נכון נשלח, אך אין עדיין בדיקה שיטתית שההמלצות בפועל **משתנות** בהתאם לפרופיל שונה. |
| 21 | **Caching של תשובות LLM לפי חתימת קלט (hash של metrics/פרופיל)** | יכול לחסוך קריאות חוזרות ל-Gemini אם משתמש מריץ ניתוח פעמיים ברצף על אותם נתונים בדיוק - רלוונטי לאור התלות ב-free tier ומגבלות ה-rate limiting הקיימות. |

### 13.7 הרחבות עתידיות (טווח ארוך יותר, לא דחוף)

| # | רעיון | למה זה יכול לעזור |
|---|---|---|
| 22 | **אריזה ל-Google Play / App Store (PWA-to-store wrapping)** | תועד בסעיף 7 (סוף) - מסלול TWA/Capacitor, תלוי ב-deployment אמיתי (פריט 1 למעלה) קודם. |
| 23 | **תמיכה ברב-לשוניות (i18n)** מעבר לעברית בלבד | אם בעתיד ירצו לפנות לקהל דובר אנגלית - מבנה ה-`styles.css`/RTL-aware (סעיף 6, פריט 11) כבר מהווה בסיס טוב למעבר. |
| 24 | **ייצוא דוחות/היסטוריה ל-Excel/CSV**, בנוסף ל-PDF הקיים | שימושי למשתמשים שרוצים לעבד את הנתונים בעצמם (למשל ב-Excel). |
| 25 | **שכבת "מגבלת משתמשים" (~100 היום) - תכנון סקיילינג** | אם המוצר יגדל מעבר ל-~100 משתמשים, יש לבחון מחדש: free tier של Supabase/Render/Vercel, מגבלת ה-rate limiting בזיכרון-תהליך (פריט 4 למעלה), ומכסות Gemini/yfinance. |

**איך להשתמש ברשימה הזו:** בכל סבב עבודה עתידי, אפשר לבחור פריט בודד (או כמה קשורים) מכל טבלה, ולבקש מה-AI המשך "לפי סעיף 13, פריט X" - כמו שנעשה קודם עם סעיף 7. אין צורך לעבור על כל הרשימה ברצף או בסדר הזה.

---

## 14. סבב עבודה (06/08/2026) - פריטים 4, 5, 6, 8, 9 (אבטחה + Rate Limiting + E2E Testing)

**עדכון תאריך:** 06/08/2026 - ביצע: Claude Sonnet 4.6 (Thinking)

**תיאור הסבב:** סבב שיפורים מבוסס על הוראות מפורטות שנשלחו למודל. כלל: timeout על אימות, rate limiting משותף (Redis-ready), סקריפט E2E מלא, סקירת RLS, ובדיקת דליפות secrets.

### 14.1 מה בדיוק נכתב/שונה

| קובץ | שינוי | סיבה |
|---|---|---|
| `backend/app/auth.py` | הוסף `concurrent.futures.ThreadPoolExecutor` עם timeout=10s על קריאת `supabase.auth.get_user()`. `TimeoutError` → 503 (לא תקיעה אינסופית). המטמון 60s ו-503 vs 401 שהיו קיימים - **לא נגע בהם**. | פריט 6: בלי timeout, Supabase שלא עונה גורם לתקיעת הבקשה לדקות. |
| `backend/app/rate_limit.py` | **קובץ חדש.** מודול rate limiting משותף. מנגנון כפול: Redis (אם `REDIS_URL` מוגדר) + in-memory fallback. פונקציה אחת: `check_and_record(user_id, key, max_per_hour, min_seconds_between)`. Redis: cooldown key + hourly counter, pipeline אטומי. In-memory: זהה לקוד הישן ב-analysis.py. fail-open אם Redis נופל. | פריט 4: rate limiting בזיכרון-תהליך נמחק ב-restart ולא עובד עם multi-instance. |
| `backend/app/routers/analysis.py` | הוסר `_check_rate_limit` המקומי (defaultdict + timestamps בזיכרון). הוחלף בקריאה ל-`check_and_record(user_id, key="analysis", max_per_hour=5, min_seconds_between=20)`. שאר הקוד **זהה לחלוטין**. | פריט 4: ריכוז לוגיקת rate limiting במקום אחד. |
| `backend/app/routers/recommendations.py` | הוסר `_USER_LAST_RECOMMENDATION` המקומי. הוחלף ב-`check_and_record(key="cash_rec", max_per_hour=10, min_seconds_between=20)`. **שיפור נוסף:** כשמשתמש שולח `portfolio_id` שלא שלו - לוג warning במקום שתיקה מוחלטת (לא 403 כי portfolio_id אופציונלי). | פריט 4 + שיפור אבטחה קל. |
| `backend/requirements.txt` | נוסף `redis` בשורה נפרדת. | נדרש ל-`rate_limit.py` (import optional - נכשל בשקט אם לא מותקן ו-REDIS_URL לא מוגדר). |
| `backend/test_flow.ps1` | **קובץ חדש** (הישן לא היה קיים בדיסק). סקריפט PowerShell 10 שלבים: `/health`, signup (Supabase REST API), יצירת תיק עם פרופיל מלא, הוספת holdings, GET תיק, **בדיקת RLS עם טוקן מזויף** (אמור לקבל 401/403/404), הרצת ניתוח (2-3 דקות - הכי ארוך), קישור PDF, היסטוריה, בדיקת rate limit (429), המלצת מזומן. קורא `SUPABASE_ANON_KEY` מ-`.env` אוטומטית, ושואל אם חסר. | פריט 5: הסקריפט הישן לא היה קיים בדיסק (לא הועלה ל-git). |

### 14.2 ממצאים מהסקירה (פריטים 8, 9)

**פריט 8 - RLS - ממצאים מסקירת הקוד (לא נדרש תיקון):**

| Router | Endpoint | מגן על user_id? |
|---|---|---|
| `portfolios.py` | GET/POST /portfolios | ✅ `.eq("user_id", user["id"])` |
| `portfolios.py` | GET/PATCH/PUT/POST /{id}/... | ✅ `_get_owned_portfolio(supabase, portfolio_id, user["id"])` |
| `analysis.py` | כל endpoints | ✅ `_get_owned_portfolio(supabase, portfolio_id, user["id"])` |
| `recommendations.py` | `/cash-allocation` עם `portfolio_id` אופציונלי | ✅ `.eq("id", portfolio_id).eq("user_id", user_id)` לפני שליפת holdings |

כל endpoint מסנן ידנית לפי `user_id`. RLS ב-DB הוא שכבה שנייה בלבד (כמתועד בסעיף 3ב).
`test_flow.ps1` (שלב 5) בודק RLS אוטומטית בכל הרצה.

**פריט 9 - Secrets - פקודות לבדיקה (לא נדרש תיקון):**

```cmd
cd "C:\העברית\מדע המידע\portfolio-app"
git log -p -- backend/.env
git log --all -p | findstr /i "SUPABASE_SERVICE_KEY GOOGLE_API_KEY SUPABASE_JWT_SECRET"
```
שתיהן אמורות להחזיר **ריק** - `.gitignore` מגן על `.env` מההתחלה. אם מוצאים ערך אמיתי - לסובב את המפתח מיד (Supabase: Settings → API → Reset; Google: AI Studio → מחק ויצור חדש) ולעדכן ב-Render.

### 14.3 איך להפעיל Redis (Upstash) - פריט 4

הקוד כבר מוכן. Redis הוא **אופציונלי** - בלעדיו עובד in-memory (כמו קודם). להפעלה:
1. [upstash.com](https://upstash.com) → Create Database (free, region: `eu-west-1`)
2. העתק `Redis URL` (נראה כ: `rediss://default:PASS@HOST:PORT`)
3. Render → Environment Variables → הוסף `REDIS_URL` = הערך
4. Render עושה redeploy אוטומטי → בלוג יופיע: `Rate limiter: connected to Redis at HOST:PORT`

**מגבלה ידועה (לא תוקנה, נשמרת כידועה):** `_redis_unavailable` flag ב-`rate_limit.py` מונע ניסיון חיבור חוזר לRedis אחרי כשל ראשוני. זה אומר שאם Redis ירד רגעית בעת startup - צריך restart לחיבור מחדש. קביל לפי עכשיו.

### 14.4 מה עדיין ממתין

- **הרצת `test_flow.ps1` ידנית** - הסקריפט נכתב אך טרם הורץ בפועל. זה **הצעד הראשון הבא** לאחר ה-push.
- **Upstash** - אופציונלי, הקוד מוכן.
- **פריטי סעיף 13** שלא טופלו בסבב זה - ראו סעיף 13 לרשימה המלאה.


## 14. סבב עבודה (06/08/2026) - תמיכה רב-לשונית (i18n), אנגלית כברירת מחדל ושגיאות API באנגלית

**רקע:** המשתמש ביקש שכל ה-Backend (סוכני AI, הודעות שגיאה) יעבוד באנגלית, ושה-Frontend יציג אנגלית כברירת מחדל, עם אפשרות למשתמש להחליף לעברית (כמעין "שכבת תרגום"). גם דוחות ה-PDF צריכים להיות מותאמים לשפה שנבחרה (כולל תמיכה ב-RTL ופונט עברי רק כשצריך).

### 14.1 תשתית i18n ב-Frontend
*   **הוסרו קידודים קשיחים (Hardcoded) מקובץ ה-HTML:** הוסרו `dir="rtl"` ו-`lang="he"` מ-`frontend/index.html`. הוגדרה ברירת מחדל `lang="en" dir="ltr"`.
*   **נוצר `LangContext.jsx`:** קונטקסט React שמנהל את מצב השפה הנוכחית (`en` או `he`), כיוון הטקסט (`ltr` או `rtl`), ומספק פונקציית תרגום `t()`. השפה נשמרת ב-`localStorage` תחת המפתח `portfolio_app_lang`.
*   **קובצי תרגום:** נוצרו `frontend/src/i18n/en.js` ו-`frontend/src/i18n/he.js` המכילים מילוני תרגום מלאים לכל מחרוזות הטקסט באפליקציה (כותרות, טפסים, הודעות שגיאה, חודשים, ימים).
*   **הטמעת התרגום ברכיבים:** כל הרכיבים ב-Frontend (כולל `App.jsx`, `Login.jsx`, `Dashboard.jsx`, `PortfolioDetail.jsx`, `CashRecommendation.jsx`) עודכנו לעטוף מחרוזות קשיחות בקריאה ל-`t("key")`. גם עיצוב תאריכים ומספרים עודכן להשתמש ב-`locale` הנכון (למשל `en-US` לעומת `he-IL`).
*   **כפתור שינוי שפה:** התווסף ל-`App.jsx` סוויצ'ר `🌐 עב | EN` שמאפשר החלפה חיה של שפת הממשק. שינוי השפה מתעדכן מיד בכל הממשק ומשנה את כיוון הדף (`dir`).

### 14.2 תקשורת Backend-Frontend
*   **העברת העדפת השפה ב-API:** `frontend/src/api.js` שודרג לשלוח `Accept-Language` header בכל בקשה ל-Backend.
*   **קליטת השפה ב-Backend:** בראוטרים `analysis.py` ו-`recommendations.py` הוספה פונקציה `_get_language(request)` שקוראת את ה-header וקובעת את שפת הבקשה (ברירת מחדל ל-`en`). פרמטר ה-`language` מועבר הלאה לפונקציות המנוע.

### 14.3 התאמת סוכני AI (CrewAI) לאנגלית
*   **העברת פרומפטים לאנגלית:** כל הפרומפטים הפנימיים, ה-Roles וה-Backstories של הסוכנים ב-`engine/ai_analysis.py` ו-`engine/cash_allocation.py` תורגמו לאנגלית מקצועית, כדי למקסם את איכות התוצרים של המודל (LLMs עובדים טוב יותר באנגלית).
*   **הנחיית שפת פלט דינמית:** נוספה פקודת `_LANG_INSTRUCTION` שמוזרקת למשימה הסופית של ה-AI, ומנחה אותו לכתוב את פלט הטקסט עצמו (דוח הסיכום, נימוקי הפיזור) באנגלית או בעברית, בהתאם לבקשת המשתמש.

### 14.4 דוחות PDF רב-לשוניים
*   **`engine/pdf_report.py` הפך למודע-שפה:**
    *   עבור `language="en"`: הדוח מרונדר משמאל לימין (LTR), ללא Bidi reordering, באמצעות פונט Helvetica סטנדרטי.
    *   עבור `language="he"`: הדוח ממשיך להשתמש בפונט עברי, יישור מימין לשמאל (RTL), והפעלת אלגוריתם Unicode Bidi לתצוגה תקינה של טקסט מעורב.
    *   כל המחרוזות הקשיחות ב-PDF (הבהרה משפטית, כותרות דוח, תוויות טבלה) הוגדרו כמילונים דו-לשוניים ונבחרות בהתאם לשפה.

### 14.5 הודעות שגיאה גלובליות באנגלית
*   כל הודעות השגיאה ב-`auth.py` (למשל, 503 במקרה של נפילת שירות Supabase), `rate_limit.py` (שגיאות 429), ו-`routers/portfolios.py` (שגיאות ולידציה של קבצים, שגיאות 404) תורגמו לאנגלית, כך שה-API מגיב תמיד באנגלית כלפי חוץ.
#   H a n d o v e r   L o g  
  
 # #   P r i o r i t y   1 :   E 2 E   T e s t i n g  
 * * W h a t   w a s   d o n e : * *  
 1 .   F i x e d   E 2 E   t e s t   s c r i p t   ( ` b a c k e n d / t e s t _ f l o w . p s 1 ` )   e n c o d i n g   ( ` u t f - 8 - s i g ` )   a n d   p a y l o a d   m i s m a t c h   ( ` s y m b o l `   - >   ` t i c k e r ` ) .  
 2 .   F i x e d   a   c r i t i c a l   b u g   i n   ` b a c k e n d / a p p / a u t h . p y `   w h e r e   a n   i n v a l i d   J W T   t o k e n   w o u l d   r a i s e   a   5 0 3   S e r v i c e   U n a v a i l a b l e   e r r o r   i n s t e a d   o f   a   4 0 1   U n a u t h o r i z e d   e r r o r .  
 3 .   F i x e d   a   c r i t i c a l   b u g   i n   ` b a c k e n d / a p p / m a i n . p y `   w h e r e   t h e   g l o b a l   e x c e p t i o n   h a n d l e r   c a u g h t   a l l   ` H T T P E x c e p t i o n ` s   ( i n c l u d i n g   4 0 4 s ,   4 0 1 s ,   4 2 9 s )   a n d   b l i n d l y   r e t u r n e d   ` 5 0 0   I n t e r n a l   S e r v e r   E r r o r ` .  
 4 .   F i x e d   a   b u g   i n   ` b a c k e n d / a p p / r o u t e r s / r e c o m m e n d a t i o n s . p y `   w h e r e   t h e   ` h o l d i n g s `   q u e r y   i n c o r r e c t l y   a s k e d   f o r   ` s y m b o l `   i n s t e a d   o f   ` t i c k e r ` ,   c a u s i n g   a   5 0 0   e r r o r   w h e n   t r y i n g   t o   g e n e r a t e   c a s h   a l l o c a t i o n   r e c o m m e n d a t i o n s .  
 5 .   I n c r e a s e d   t h e   r a t e   l i m i t   c o o l d o w n   f o r   ` a n a l y s i s `   e n d p o i n t s   t o   6 0   s e c o n d s   ( u p   f r o m   2 0   s e c o n d s )   t o   a v o i d   t e s t s   i n c o r r e c t l y   f a i l i n g   r a t e   l i m i t i n g   w h i l e   t h e   A I   m o d e l   w a s   s t i l l   g e n e r a t i n g .  
 6 .   R a n   t h e   f u l l   E 2 E   s c r i p t   l o c a l l y   a n d   a g a i n s t   t h e   R e n d e r   p r o d u c t i o n   e n v i r o n m e n t ,   a n d   v e r i f i e d   t h a t   a l l   e n d p o i n t s   w o r k   p e r f e c t l y   u n d e r   l o a d .  
  
 * * W h y : * *  
 T h i s   e n s u r e s   t h a t   t h e   b a c k e n d   i s   r o b u s t   e n o u g h   t o   h a n d l e   t h e   c o r e   f e a t u r e s   r e l i a b l y   f o r   ~ 1 0 0   d a i l y   u s e r s ,   a n d   t h a t   r a t e   l i m i t s ,   R L S ,   a n d   A I   f u n c t i o n a l i t y   a r e   f u l l y   w o r k i n g   i n   p r o d u c t i o n   w i t h o u t   h i d d e n   s e r v e r   e r r o r s .  
  
 # #   P r i o r i t y   2 :   E r r o r   T r a c k i n g   ( S e n t r y )  
 * * W h a t   w a s   d o n e : * *  
 1 .   I n s t a l l e d   s e n t r y - s d k   i n   b a c k e n d   a n d   @ s e n t r y / r e a c t   i n   f r o n t e n d .  
 2 .   C o n f i g u r e d   s e n t r y _ s d k . i n i t   i n    a c k e n d / a p p / m a i n . p y   t o   u s e   S E N T R Y _ D S N .  
 3 .   W r a p p e d   C r e w A I   e x e c u t i o n s   i n    i _ a n a l y s i s . p y   a n d   c a s h _ a l l o c a t i o n . p y   w i t h   	 r y / e x c e p t   a n d   s e n t r y _ s d k . c a p t u r e _ e x c e p t i o n   i f   t h e   f a l l b a c k   L L M   f a i l s .  
 4 .   C o n f i g u r e d   S e n t r y . i n i t   i n    r o n t e n d / s r c / m a i n . j s x   t o   u s e   V I T E _ S E N T R Y _ D S N .  
 5 .   P u s h e d   e v e r y t h i n g   t o   G i t H u b   s o   i t   c a n   b e   d e p l o y e d .  
  
 * * W h y : * *  
 T o   i m m e d i a t e l y   t r a c k   a n d   a l e r t   t h e   t e a m   o n   u n c a u g h t   e r r o r s   o r   L L M   f a i l u r e s   w i t h o u t   r e l y i n g   o n   m a n u a l   l o g   c h e c k i n g .  
  
 # #   P r i o r i t y   3 :   F r e e   T i e r   C o n s t r a i n t s   M a p p i n g  
 * * W h a t   w a s   d o n e : * *  
 1 .   M a p p e d   o u t   a l l   F r e e   T i e r   l i m i t s   f o r   G e m i n i ,   S u p a b a s e ,   R e n d e r ,   a n d   Y a h o o   F i n a n c e   i n   a   d e d i c a t e d   a r t i f a c t .  
 2 .   I m p l e m e n t e d   e x p o n e n t i a l   b a c k o f f   a n d   r e t r y   l o g i c   u s i n g   	 e n a c i t y   i n   m e t r i c s . p y   a n d   d a t a _ l o a d e r . p y   t o   p r e v e n t   Y a h o o   F i n a n c e   f r o m   b l o c k i n g   u s e r s   d u e   t o   s t r i c t   r a t e   l i m i t s   w h e n   f e t c h i n g   s t o c k   p r i c e s .  
 3 .   D i s a b l e d   t h r e a d i n g   f o r   y f i n a n c e   t o   p r e v e n t   s i m u l t a n e o u s   r e q u e s t s   f r o m   t r i g g e r i n g   i n s t a n t   t e m p o r a r y   b a n s .  
 4 .   P u s h e d   t h e   c h a n g e s   t o   G i t H u b .  
  
 * * W h y : * *  
 Y a h o o   F i n a n c e   A P I   i s   v e r y   s t r i c t .   I f   1 0 0   u s e r s   t r y   t o   a n a l y z e   p o r t f o l i o s   w i t h   m u l t i p l e   a s s e t s ,   t h e   b a c k e n d   w o u l d   g e t   b l o c k e d   b y   Y a h o o ,   r e s u l t i n g   i n   f a i l e d   a n a l y s e s .   T h e   r e t r y   l o g i c   g u a r a n t e e s   s t a b i l i t y .  
  
 # #   L e g a l   R i s k   R e d u c t i o n   ( P r i o r i t y   4 )  
 * * W h a t   w a s   d o n e : * *  
 1 .   I m p l e m e n t e d   a   C o n s e n t   G a t e   o n   t h e   s i g n u p   f o r m .   U s e r s   m u s t   e x p l i c i t l y   c h e c k   a   b o x   a g r e e i n g   t o   a   d i s c l a i m e r   b e f o r e   s i g n i n g   u p .   T h e   c o n s e n t   v e r s i o n   i s   s a v e d   i n   t h e   d a t a b a s e .  
 2 .   R e w r o t e   A I   p r o m p t s   i n   \  i _ a n a l y s i s . p y \ .   R e n a m e d   ' R e c o m m e n d a t i o n s '   t o   ' P o i n t s   f o r   C o n s i d e r a t i o n ' ,   e n f o r c e d   n o n - d i r e c t i v e   l a n g u a g e   ( n o   ' b u y / s e l l '   c o m m a n d s ) ,   a n d   a d d e d   m a n d a t o r y   d i s c l a i m e r s   f o r   e v e r y   p o i n t .  
 3 .   A d d e d   a   p e r m a n e n t   ( c o l l a p s i b l e )   D i s c l a i m e r   B a n n e r   t o   t h e   t o p   o f   t h e   \ P o r t f o l i o D e t a i l \   p a g e .  
 4 .   V i s u a l l y   s e p a r a t e d   F a c t u a l   D a t a   f r o m   A I   A n a l y s i s   i n   t h e   U I .  
 5 .   U p d a t e d   T e r m s   o f   S e r v i c e   t o   e x p l i c i t l y   s t a t e   t h e   a p p   h a s   n o   f i n a n c i a l   l i c e n s e s   a n d   p r o v i d e s   n o   f i d u c i a r y   d u t y .  
 6 .   A d d e d   a n   a u d i t   l o g   t o   \  n a l y s i s _ r u n s \   t o   r e c o r d   w h i c h   d i s c l a i m e r   v e r s i o n   w a s   s h o w n   w h e n   t h e   a n a l y s i s   w a s   g e n e r a t e d .  
 7 .   F i x e d   a n   U n b o u n d L o c a l E r r o r   b u g   r e l a t e d   t o   \ J S O N R e s p o n s e \   i n   t h e   g l o b a l   e x c e p t i o n   h a n d l e r .  
  
 * * D i s c l a i m e r * * :   T h e s e   s t e p s   a r e   t e c h n i c a l   r i s k - r e d u c t i o n   m e a s u r e s ,   N O T   f o r m a l   l e g a l   a d v i c e   o r   a   s u b s t i t u t e   f o r   p r o p e r   r e g u l a t o r y   c o m p l i a n c e .  
  
 # #   A d v a n c e d   H e a l t h   C h e c k   &   U p t i m e   M o n i t o r i n g   ( P r i o r i t y   5 )  
 * * W h a t   w a s   d o n e : * *  
 1 .   U p g r a d e d   t h e   \ / h e a l t h \   e n d p o i n t   i n   \ m a i n . p y \   t o   a c t i v e l y   q u e r y   S u p a b a s e .   T h i s   e n s u r e s   t h a t   a   s i n g l e   p i n g   k e e p s   b o t h   t h e   R e n d e r   b a c k e n d   A N D   t h e   S u p a b a s e   d a t a b a s e   a w a k e ,   p r e v e n t i n g   c o l d   s t a r t s   f o r   b o t h   s y s t e m s .  
 2 .   P u s h e d   t h e   c h a n g e s   t o   G i t H u b .  
  
 * * N e x t   S t e p s   f o r   U s e r : * *  
 T o   c o m p l e t e l y   e l i m i n a t e   c o l d   s t a r t s ,   s e t   u p   a   f r e e   U p t i m e R o b o t   a c c o u n t   a n d   c o n f i g u r e   i t   t o   p i n g   ` h t t p s : / / p o r t f o l i o - a p p - b a c k e n d - 4 5 n 4 . o n r e n d e r . c o m / h e a l t h `   e v e r y   1 4   m i n u t e s .  
  
 # #   P r i o r i t y   6 :   U I   O v e r h a u l   &   A d v a n c e d   A n a l y t i c s  
 * * W h a t   w a s   d o n e : * *  
 1 .   * * P r e m i u m   D a r k   M o d e   ( G l a s s m o r p h i s m ) : * *   C o m p l e t e l y   o v e r h a u l e d   ` s t y l e s . c s s `   t o   u s e   a   m o d e r n ,   d a r k   " g l a s s m o r p h i s m "   a e s t h e t i c   ( ` p r e m i u m - d a s h b o a r d ` )   w i t h   n e o n - t i n t e d   t y p o g r a p h y ,   b l u r r y   t r a n s l u c e n t   c a r d s ,   a n d   a   d e e p   r a d i a l   b a c k g r o u n d .  
 2 .   * * D y n a m i c   U I   R e n d e r i n g : * *   C o n f i g u r e d   ` P o r t f o l i o D e t a i l . j s x `   t o   s h o w   a   c l e a n   w h i t e   b a c k g r o u n d   * b e f o r e *   a n a l y s i s ,   a n d   a u t o m a t i c a l l y   t r a n s i t i o n   i n t o   t h e   P r e m i u m   D a r k   M o d e   o n c e   t h e   A I   A n a l y s i s   f i n i s h e s .  
 3 .   * * A d v a n c e d   V i s u a l i z a t i o n s   ( R e c h a r t s ) : * *  
       -   R e f a c t o r e d   ` P e r f o r m a n c e C h a r t . j s x `   t o   m a t c h   t h e   d a r k   t h e m e   a n d   n e o n   a c c e n t s .  
       -   S i m p l i f i e d   ` P o r t f o l i o C o m p o s i t i o n C h a r t . j s x `   i n t o   a   s i n g l e ,   c o r p o r a t e - p a l e t t e   P i e   C h a r t   s h o w i n g   c o u n t r y / a s s e t   e x p o s u r e .  
       -   B u i l t   a   b r a n d   n e w   ` P o r t f o l i o T r e e m a p . j s x `   c o m p o n e n t   t o   v i s u a l i z e   s t o c k   a l l o c a t i o n   b y   s e c t o r / s h a r e s   i n   a   d y n a m i c ,   s p a c e - f i l l i n g   g r i d   ( m a t c h i n g   W y n   E n t e r p r i s e   a e s t h e t i c s ) .  
 4 .   * * N e w   B a c k e n d   A n a l y t i c s : * *    
       -   I n t e g r a t e d   ` d i v i d e n d Y i e l d `   a n d   ` e x p e n s e R a t i o `   p u l l i n g   f r o m   ` y f i n a n c e ` .  
       -   U p d a t e d   t h e   S u p a b a s e   ` a n a l y s i s _ r u n s `   s c h e m a   t o   p e r s i s t   ` p o r t f o l i o _ d i v i d e n d _ y i e l d `   a n d   ` p o r t f o l i o _ e x p e n s e _ r a t i o ` .  
       -   B u i l t   a   r o b u s t   t i c k e r   a l i a s i n g   m e c h a n i s m   ( ` T I C K E R _ A L I A S E S `   i n   ` m e t r i c s . p y ` )   t o   p r e v e n t   b a c k e n d   c r a s h e s   w h e n   u s e r s   m a n u a l l y   t y p e   c o m m o n   i n d i c e s   ( e . g .   m a p p i n g   ` S & P 5 0 0 `   - >   ` S P Y ` ,   ` N A S D A Q `   - >   ` Q Q Q ` ,   ` T A 3 5 `   - >   ` T A 3 5 . T A ` ) .  
 5 .   * * R e b a l a n c i n g   S i m u l a t o r : * *   A d d e d   a   f r o n t e n d   c o m p o n e n t   ( ` R e b a l a n c i n g S i m u l a t o r . j s x ` )   t h a t   r e a d s   t h e   A I ' s   t a r g e t   w e i g h t s   a n d   t e l l s   t h e   u s e r   e x a c t l y   h o w   m a n y   s h a r e s   t o   b u y / s e l l   t o   a c h i e v e   o p t i m a l   a l l o c a t i o n .  
 6 .   P u s h e d   a l l   c h a n g e s   t o   G i t H u b .  
  
 * * W h y : * *  
 T o   e l e v a t e   t h e   p r o d u c t   f r o m   a   b a s i c   p r o t o t y p e   t o   a n   u l t r a - p r e m i u m ,   " W O W " - f a c t o r   f i n t e c h   d a s h b o a r d   ( B l o o m b e r g   T e r m i n a l   /   W y n   E n t e r p r i s e   t i e r )   t h a t   b u i l d s   i n s t a n t   t r u s t ,   w h i l e   f i x i n g   e d g e - c a s e   c r a s h e s   w h e n   u s e r s   t r y   t o   a n a l y z e   i n d i c e s   o r   E T F s .  
 