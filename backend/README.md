# Portfolio Analysis App - Backend (שלב 1 מתוך כמה)

זהו ה-**Backend** בלבד - השרת שמריץ את כל הלוגיקה. עדיין **אין Frontend** (המסך שאנשים רואים) - זה השלב הבא. השלב הזה נותן לכם API עובד שאפשר לבדוק ישירות, לפני שבונים מסך מעליו.

## מבנה הפרויקט

```
portfolio-app/
├── database/
│   └── schema.sql          # מבנה מסד הנתונים - מריצים פעם אחת ב-Supabase
└── backend/
    ├── app/
    │   ├── main.py          # נקודת הכניסה - כאן מריצים את השרת ממנה
    │   ├── config.py        # קורא את משתני ה-.env
    │   ├── db.py            # חיבור ל-Supabase
    │   ├── auth.py           # מוודא שהמשתמש מחובר (JWT)
    │   ├── models.py         # מבני הנתונים (מה ה-API מקבל/מחזיר)
    │   ├── engine/            # כל לוגיקת הניתוח (כבר נבדקה בגרסת המייל)
    │   │   ├── data_loader.py    # קריאת CSV/Excel/PDF/תמונה
    │   │   ├── metrics.py        # חישובי סיכון/תשואה + yfinance
    │   │   ├── ai_analysis.py    # צוות סוכני CrewAI
    │   │   ├── charts.py         # 4 הגרפים
    │   │   └── pdf_report.py     # ה-PDF המעוצב
    │   └── routers/            # ה-endpoints של ה-API
    │       ├── portfolios.py     # יצירה/עדכון/העלאת קובץ לתיק
    │       └── analysis.py       # הרצת ניתוח + היסטוריה
    ├── requirements.txt
    └── .env.example
```

## שלב 1: הקמת Supabase (מסד הנתונים) - כ-10 דקות

1. גשו ל-**https://supabase.com**, הרשמו (חינמי, בלי כרטיס אשראי)
2. **New Project** - תנו שם, בחרו סיסמה למסד הנתונים (שמרו אותה בצד), בחרו אזור קרוב (Europe)
3. חכו כ-2 דקות שהפרויקט "יתעורר"
4. בתפריט השמאלי: **SQL Editor** → **New query**
5. פתחו את `database/schema.sql`, העתיקו את **כל** התוכן, הדביקו בעורך, לחצו **Run**
   - זה יוצר את כל הטבלאות (portfolios, holdings, analysis_runs), ההרשאות (RLS), ואת מקום האחסון לקבצי ה-PDF
6. בתפריט השמאלי: **Storage** → ודאו שרואים bucket בשם `reports`

## שלב 2: איסוף המפתחות

בתפריט השמאלי: **Settings** (⚙️) → **API**

תעתיקו שלושה ערכים:
- **Project URL** → זה `SUPABASE_URL`
- **service_role key** (תחת "Project API keys" - **לא** ה-anon key!) → זה `SUPABASE_SERVICE_KEY`
- **JWT Secret** (גללו למטה, תחת "JWT Settings") → זה `SUPABASE_JWT_SECRET`

⚠️ **ה-service_role key הוא מפתח-על** - הוא עוקף את כל ההרשאות. הוא חייב להישאר רק בשרת (ב-`.env`), **לעולם לא** בקוד שרץ בדפדפן.

## שלב 3: הגדרת הסביבה

```bash
cd backend
cp .env.example .env
```

פתחו את `.env` ומלאו:
- שלושת ערכי ה-Supabase משלב 2
- `GOOGLE_API_KEY` - אותו מפתח Gemini שכבר יש לכם

## שלב 4: הרצה מקומית

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

השרת יעלה על `http://localhost:8000`. גשו ל-**http://localhost:8000/docs** - זה ממשק בדיקה אוטומטי (Swagger) שבו אפשר לנסות כל endpoint בלי לכתוב קוד.

## שלב 5: בדיקה ראשונית - איך "מתחברים" בלי Frontend עדיין

כל ה-endpoints (חוץ מ-`/health`) דורשים משתמש מחובר. כדי לבדוק לפני שיש Frontend, ניצור משתמש בדיקה ישירות מול Supabase:

```bash
curl -X POST 'https://your-project.supabase.co/auth/v1/signup' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123456"}'
```

(את `YOUR_ANON_KEY` לוקחים מ-Settings → API → "anon public" key - זה מפתח **ציבורי**, לא ה-service_role)

התשובה תכיל `access_token` - זהו ה-JWT. ב-http://localhost:8000/docs, לחצו על כפתור **Authorize** (🔓 למעלה מימין), הדביקו את ה-token, ואפשר להתחיל לבדוק:

1. `POST /portfolios` - יוצר תיק חדש
2. `POST /portfolios/{portfolio_id}/upload` - מעלים קובץ CSV לדוגמה
3. `POST /portfolios/{portfolio_id}/analysis` - מריץ את הניתוח המלא (ייקח כדקה - yfinance + 5 סוכני AI)
4. `GET /portfolios/{portfolio_id}/analysis` - רואים היסטוריית ניתוחים

## מה עדיין חסר (השלבים הבאים)

- **Frontend** - מסך אמיתי במקום Swagger UI (React + PWA)
- **הורדת ה-PDF בפועל** - כרגע השרת רק שומר את הנתיב ב-Storage; צריך endpoint שמייצר "קישור זמני" (signed URL) להורדה
- **Deployment** - העלאת השרת ל-Render כדי שיהיה זמין תמיד, לא רק במחשב שלכם

תבדקו את זה, תגידו לי מה עבד/לא עבד, ונמשיך לשלב הבא.
