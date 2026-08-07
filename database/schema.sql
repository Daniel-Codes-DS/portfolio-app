-- ============================================================
-- סכמת מסד הנתונים - אפליקציית ניתוח תיקי השקעות
-- הריצו את הקובץ הזה בלשונית "SQL Editor" בפרויקט Supabase שלכם
-- ============================================================

-- הרחבה ל-UUID (בדרך כלל כבר מופעלת ב-Supabase כברירת מחדל)
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- טבלה: portfolios - תיק השקעות אחד לכל משתמש (אפשר כמה תיקים)
-- ------------------------------------------------------------
create table portfolios (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid references auth.users(id) on delete cascade not null,
    name        text not null default 'התיק שלי',
    created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- טבלה: holdings - האחזקות הנוכחיות בכל תיק
-- ------------------------------------------------------------
create table holdings (
    id                       uuid primary key default gen_random_uuid(),
    portfolio_id             uuid references portfolios(id) on delete cascade not null,
    ticker                   text not null,
    quantity                 numeric not null,
    avg_price                numeric not null,
    asset_type               text,
    value_override           numeric,
    annual_return_override   numeric,
    annual_vol_override      numeric,
    created_at               timestamptz not null default now(),
    updated_at               timestamptz not null default now()
);

-- ------------------------------------------------------------
-- טבלה: analysis_runs - היסטוריית כל ניתוח שהורץ (תמונת מצב)
-- ------------------------------------------------------------
create table analysis_runs (
    id                       uuid primary key default gen_random_uuid(),
    portfolio_id             uuid references portfolios(id) on delete cascade not null,
    total_value              numeric,
    annual_return            numeric,
    annual_vol               numeric,
    sharpe_ratio             numeric,
    hhi_concentration        numeric,
    report_text              text,
    target_weights           jsonb,
    pdf_storage_path         text,
    -- Legal audit: which disclaimer version was shown when this analysis was presented.
    -- Bump the value in analysis.py if disclaimer text changes.
    disclaimer_version_shown text default 'v1.0',
    created_at               timestamptz not null default now()
);

-- ------------------------------------------------------------
-- טבלאה: user_consents - תיעוד הסכמת המשתמש לדיסקליימר בעת ההרשמה
-- שומר באיזו גרסה של הדיסקליימר המשתמש אישר (לצורך בדיקה עתידית אם הטקסט ישתנה)
-- ------------------------------------------------------------
create table user_consents (
    id                   uuid primary key default gen_random_uuid(),
    user_id              uuid references auth.users(id) on delete cascade not null,
    consent_given_at     timestamptz not null default now(),
    consent_text_version text not null,
    unique(user_id, consent_text_version)
);

-- ------------------------------------------------------------
-- אינדקסים לביצועים (שאילתות נפוצות: "כל התיקים שלי", "היסטוריה של תיק")
-- ------------------------------------------------------------
create index idx_portfolios_user_id on portfolios(user_id);
create index idx_holdings_portfolio_id on holdings(portfolio_id);
create index idx_analysis_runs_portfolio_id on analysis_runs(portfolio_id);
create index idx_analysis_runs_created_at on analysis_runs(created_at desc);

-- ============================================================
-- אבטחה: Row Level Security (RLS)
-- כל משתמש רואה ומעדכן רק את הנתונים שלו. אתם (הבעלים) עדיין
-- רואים הכל דרך Supabase Studio (שמשתמש בהרשאת מנהל, לא כפוף ל-RLS).
-- ============================================================

alter table portfolios enable row level security;
alter table holdings enable row level security;
alter table analysis_runs enable row level security;

-- portfolios: משתמש מנהל רק את התיקים שהוא הבעלים שלהם
create policy "portfolios_owner_all"
    on portfolios for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- holdings: משתמש מנהל רק אחזקות ששייכות לתיק שלו
create policy "holdings_owner_all"
    on holdings for all
    using (
        portfolio_id in (select id from portfolios where user_id = auth.uid())
    )
    with check (
        portfolio_id in (select id from portfolios where user_id = auth.uid())
    );

-- analysis_runs: משתמש רואה/יוצר רק ניתוחים ששייכים לתיק שלו
create policy "analysis_runs_owner_select"
    on analysis_runs for select
    using (
        portfolio_id in (select id from portfolios where user_id = auth.uid())
    );

create policy "analysis_runs_owner_insert"
    on analysis_runs for insert
    with check (
        portfolio_id in (select id from portfolios where user_id = auth.uid())
    );

-- ============================================================
-- Storage: מיכל (bucket) לשמירת קבצי PDF שנוצרים
-- הריצו את זה, או צרו ידנית ב-Supabase Studio > Storage > New bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

-- מדיניות: משתמש יכול לגשת רק לקבצים בתיקייה שהמשתמש שלו (לפי user_id בנתיב)
create policy "reports_owner_select"
    on storage.objects for select
    using (bucket_id = 'reports' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "reports_owner_insert"
    on storage.objects for insert
    with check (bucket_id = 'reports' and (storage.foldername(name))[1] = auth.uid()::text);
