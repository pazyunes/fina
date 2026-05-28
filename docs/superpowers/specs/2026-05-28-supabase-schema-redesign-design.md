# Supabase schema redesign for multi-channel CRUD

**Status:** Draft for approval
**Date:** 2026-05-28
**Branch:** `feat/pr5-supabase-schema-redesign`

## Background

Today every piece of onboarding data lives inside a single `reports.user_data`
jsonb blob. A "report" row is the only unit of persistence — every time a user
finishes the onboarding, a new immutable row is inserted. There is no concept
of a live, editable financial profile, and there is no way for an outside
client (e.g. a WhatsApp bot) to do granular CRUD on individual fields.

The product wants two new things at once:

1. **Edit profile data from anywhere.** Both the FINA web app and a planned
   WhatsApp chatbot need to view, edit, delete and add records (incomes,
   fixed expenses, goals, etc.) without having to re-run the entire
   onboarding.
2. **Daily expense ledger.** A separate write-heavy stream where users log
   their day-to-day movements through WhatsApp ("hoy gasté $5.000 en
   farmacia"). The FINA report then shows estimated (from onboarding) vs.
   real (from the ledger).

This spec covers the database redesign that makes those two things possible.

It does **not** cover:
- The WhatsApp bot itself (intent parsing, the conversational interface,
  the Twilio/Meta webhook). That is a separate project that will consume
  the API contracts this design exposes.
- AI categorization of free-text transactions.
- UX redesign of the existing onboarding screens beyond what is needed to
  capture the phone number and write to the new tables.

## Goals

- Replace the jsonb-monolith model with a relational schema where every
  meaningful entity (income, expense, goal, transaction) is its own row.
- Allow two clients (web app via anon key + RLS; WhatsApp via service-role
  edge function) to read and write the same data safely.
- Add a `phone` column tied to `auth.users` so the WhatsApp bot can match
  inbound messages to a user.
- Keep `reports` as an immutable historical snapshot — generating a report
  freezes the live state at that moment for later comparison.
- Migrate existing reports' jsonb into the new live tables so current users
  don't lose their data.

## Non-goals

- Real-time sync between web and WhatsApp clients. Eventual consistency at
  the row level is fine; both clients hit the same DB.
- Multi-currency normalization beyond what already exists (every monetary
  amount is stored as `amount_ars` and an optional `original_amount` +
  `currency` + `exchange_rate_id`, mirroring the current convention).
- Partitioning, time-series databases, or any "BACKUP" archive table.
  Postgres handles tens of millions of rows in a single indexed table; we
  revisit partitioning only if `transactions` actually outgrows that.

## Section 1 — Data model

Seven tables, all keyed by `user_id uuid references auth.users(id)` with a
matching RLS policy (`auth.uid() = user_id`).

### 1.1 `user_profiles` — one row per user

Personal data + WhatsApp link. Created when the user signs up.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | = `auth.uid()` |
| `name` | text | |
| `age` | int | |
| `gender` | text | 'femenino' \| 'masculino' \| 'prefiero_no_decir' |
| `lives_alone` | boolean | |
| `works_or_studies` | text | 'works' \| 'studies' \| 'both' \| 'neither' |
| `banks` | text[] | |
| `phone` | text UNIQUE | E.164 format. NULL until the user adds it. |
| `phone_verified_at` | timestamptz | NULL until verified |
| `income_type` | text | 'fixed' \| 'freelance' \| 'both' (denormalized for fast checks) |
| `created_at` | timestamptz | default now() |
| `updated_at` | timestamptz | default now() (trigger to keep in sync) |

`phone` has a unique partial index `(phone) where phone is not null` so the
WhatsApp lookup is O(1) without preventing multiple rows with NULL phone.

### 1.2 `incomes` — N rows per user

Each source of income. Replaces what is today scattered between
`monthlyIncome`, `incomeRange`, `incomeOriginalAmount`, `freelanceIncome.month1/2/3`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `type` | text | 'fixed' \| 'freelance' |
| `source` | text | 'sueldo' \| 'freelance' \| 'rent' \| 'other' |
| `period` | text | NULL for fixed; 'month1' / 'month2' / 'month3' for freelance |
| `amount_ars` | numeric | |
| `currency` | text | default 'ARS' |
| `original_amount` | numeric | NULL if loaded directly in ARS |
| `exchange_rate_id` | uuid FK exchange_rates(id) | NULL if ARS |
| `range_label` | text | e.g. '$500.000 – $1.000.000' or 'Monto exacto' for fixed |
| `active` | boolean | default true |
| `created_at` / `updated_at` | timestamptz | |

### 1.3 `fixed_expenses` — N rows per user

Each recurring fixed expense. Replaces the current `expenses.{housing,health,
beauty,therapy,gym,transport}` numbers plus `installments[]` and
`subscriptions[]` arrays.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `category` | text | 'housing' \| 'health' \| 'beauty' \| 'therapy' \| 'gym' \| 'transport' \| 'subscription' \| 'installment' \| 'other' |
| `merchant` | text | NULL or e.g. 'Nails', 'Netflix', 'SportClub' |
| `amount_ars` | numeric | |
| `currency` | text | default 'ARS' |
| `original_amount` | numeric | |
| `exchange_rate_id` | uuid FK | |
| `metadata` | jsonb | e.g. for installments: `{remaining: 6}`; for therapy: `{session_price, sessions_per_month}` |
| `active` | boolean | default true. Soft delete: an expense the user stopped paying stays as historical context. |
| `not_paying` | boolean | default false. The "no lo pago yo" toggle. |
| `created_at` / `updated_at` | timestamptz | |

Each onboarding category produces one row (housing → 1 row with
`category='housing'`, etc.). Subscriptions and installments produce one row
per item, same as today's arrays.

### 1.4 `variable_expense_estimates` — up to 3 rows per user

The averages the user gives during onboarding (frequency × amount for
salidas / delivery / súper). These are explicitly distinct from the actual
expenses logged in `transactions`. They feed the report's "estimated"
column; the ledger feeds the "real" column.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `category` | text | 'entertainment' \| 'delivery' \| 'supermarket' |
| `weekly_frequency` | int | |
| `average_amount_ars` | numeric | |
| `created_at` / `updated_at` | timestamptz | |

Unique constraint on `(user_id, category)`.

### 1.5 `goals` — N rows per user

Replaces `userData.goals[]`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `title` | text | |
| `amount_ars` | numeric | |
| `timeframe_months` | int | |
| `status` | text | 'active' \| 'achieved' \| 'cancelled' |
| `created_at` / `updated_at` | timestamptz | |

### 1.6 `transactions` — the daily ledger (libro contable)

Append-mostly. Each row is a real-world money movement logged by the user
through WhatsApp or the web.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `occurred_at` | timestamptz | when the spend actually happened (user-provided, not when the row was inserted) |
| `type` | text | 'expense' \| 'income' |
| `amount_ars` | numeric | |
| `currency` | text | default 'ARS' |
| `original_amount` | numeric | |
| `exchange_rate_id` | uuid FK | |
| `category` | text | free for now: 'food', 'transport', 'entertainment', 'salary', etc. (we can lock down to an enum later once the bot is live) |
| `merchant` | text | |
| `description` | text | the free-text the user wrote |
| `source` | text | 'whatsapp' \| 'web' \| 'manual' |
| `metadata` | jsonb | raw bot intent payload, etc. |
| `created_at` | timestamptz | |

Indexes:
- `(user_id, occurred_at desc)` — primary list/scroll
- `(user_id, type, occurred_at desc)` — gastos vs ingresos del mes
- `(user_id, category, occurred_at desc)` — categoría del mes

This is the only write-heavy table. With those three indexes Postgres
handles tens of millions of rows per Supabase project before partitioning
matters; we explicitly defer partitioning until that becomes a real
bottleneck.

### 1.7 `reports` — historical snapshots (existing table, lightly tweaked)

Stays mostly as-is. It is **immutable**: each row is the snapshot of the
user's live state at the moment "Generar informe" was tapped.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | existing |
| `user_id` | uuid FK | existing |
| `email`, `name` | text | existing; will be backfilled from profile |
| `user_data` | jsonb | existing; we keep dumping the full live profile here for backwards compat with old reports |
| `analysis` | jsonb | existing; the AI/heuristic output |
| `ai_reasoning` | jsonb | existing |
| `created_at` | timestamptz | existing |

No structural change. The point of keeping the jsonb is that a 2026 report
should still render exactly as it did then, regardless of how the live
schema evolves.

## Section 2 — Identity and RLS

### Two channels, one DB

- **Web app** uses the Supabase **anon key** + the user's JWT. All policies
  apply: `auth.uid() = user_id`.
- **WhatsApp bot** uses the Supabase **service-role key** through a thin
  Edge Function (`/functions/v1/whatsapp-webhook`). Service role bypasses
  RLS; the Edge Function is responsible for authenticating that the request
  came from the WhatsApp provider (Twilio HMAC signature, Meta WABA
  signature, or whatever provider we pick).

### Phone linking flow

1. In the FINA onboarding (after `PersonalData`), a new step `PhoneLink`
   asks the user for their WhatsApp number.
2. The app calls `POST /api/phone-verification/send` with the phone. Server
   inserts a row into a small `phone_verification_codes` table
   (`user_id`, `code`, `expires_at`) and sends a WhatsApp message with the
   6-digit code.
3. User taps a confirmation link in the WhatsApp message (or replies with
   the code). The Edge Function verifies and sets
   `user_profiles.phone_verified_at = now()`.
4. From there on, any inbound WhatsApp message is matched to the user via
   `user_profiles.phone = sender_phone AND phone_verified_at is not null`.

`phone_verification_codes` lives outside this spec (it is a 5-line table
with a TTL cleanup job; mention it for completeness).

### RLS policies (one block per table)

For every new table (`user_profiles`, `incomes`, `fixed_expenses`,
`variable_expense_estimates`, `goals`, `transactions`):

```sql
alter table <t> enable row level security;

create policy "<t> owner read"   on <t> for select using   (auth.uid() = user_id);
create policy "<t> owner insert" on <t> for insert with check (auth.uid() = user_id);
create policy "<t> owner update" on <t> for update using   (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "<t> owner delete" on <t> for delete using   (auth.uid() = user_id);
```

`user_profiles` is special — the `id` column is itself `auth.uid()`, so the
policy uses `id = auth.uid()` instead of `user_id`.

The service role bypasses RLS, so the WhatsApp Edge Function does not need
its own policies; instead it does the phone → user lookup itself before
calling tables.

## Section 3 — Migration plan

### 3.1 Goal

Existing users (those who have at least one row in `reports`) should land
on FINA after the migration and see their last onboarding answers
pre-filled — without re-doing the flow. New reports go through the new
tables; old reports keep rendering from their frozen jsonb.

### 3.2 Phases

**Phase 0 — schema (SQL migration `0003_live_profile.sql`)**
- Create the seven tables above.
- Add `user_profiles` row for every existing `auth.users.id` (lazy: a
  trigger on `auth.users insert` plus a one-off seed query for existing
  users).
- All RLS policies enabled from day 1.

**Phase 1 — backfill (`0004_backfill_from_reports.sql`)**
- For each `auth.users.id`, pick the latest `reports` row (`order by
  created_at desc limit 1`).
- Parse its `user_data` jsonb and INSERT into:
  - `user_profiles` (name, age, gender, lives_alone, works_or_studies,
    banks, income_type — but NOT phone, that comes later)
  - `incomes` (fixed + 3 freelance months)
  - `fixed_expenses` (housing/health/beauty/therapy/gym/transport +
    installments[] + subscriptions[])
  - `variable_expense_estimates` (entertainment, delivery, supermarket)
  - `goals`
- The script is idempotent: re-running it is a no-op for users that
  already have a `user_profiles` row.

**Phase 2 — dual-write from the app (code change)**
- The web app starts writing to the new tables on every onboarding step
  finish (not just at "Generar informe" time).
- It also keeps inserting the `reports` row with the full jsonb dump on
  "Generar informe" — that becomes the snapshot.
- A small `lib/profile.ts` exposes:
  - `loadLiveProfile(userId)` → reads all 6 live tables, returns a single
    `UserData`-shaped object the rest of the app already knows.
  - `saveIncomeStep(userId, payload)`, `saveFixedExpensesStep(...)`, etc.
    — one write helper per onboarding step.
- The existing onboarding step components are repointed at these helpers.
  No UX change.

**Phase 3 — `/perfil` and report editing (code change)**
- The Profile screen gains a new "Mi situación financiera" section that
  shows live values from the new tables and lets the user edit them
  (CRUD over `incomes`, `fixed_expenses`, `goals`).
- Editing a value on `/perfil` does **not** create a new report; it just
  updates the live profile. The user must tap "Generar informe
  nuevamente" to snapshot.

**Phase 4 — WhatsApp integration (separate project, out of scope here)**
- Edge Function consumes the same new tables. This spec only guarantees
  the schema/RLS are ready.

### 3.3 Rollback

Phase 0–1 are SQL-only and reversible: a single `drop table ... cascade`
brings us back. Phase 2 is feature-flagged behind a `VITE_USE_LIVE_PROFILE`
env var — turning it off makes the app read/write only `reports` again.

## Section 4 — App changes summary

This spec is about the DB. The corresponding app changes that come with
phase 2 are tracked here for context; the detailed plan lives in the
follow-up writing-plans pass.

- `src/app/lib/profile.ts` — new helpers (`loadLiveProfile`,
  `saveIncomeStep`, `saveFixedExpensesStep`, `saveGoalsStep`,
  `saveVariableEstimatesStep`).
- `src/app/Main.tsx` — each `handle*` calls the matching `save*Step`.
- `src/app/components/Profile.tsx` — add a "Mi situación financiera"
  accordion that does CRUD on live tables.
- `src/app/components/PhoneLink.tsx` — new onboarding step.
- `src/app/onboarding/steps.ts` — add `/phone-link` between
  `/personal-data` and `/context`.
- `src/app/lib/reports.ts` — `saveReport` reads from live tables and
  dumps a jsonb snapshot, instead of building `userData` ad-hoc.
- New env: `VITE_USE_LIVE_PROFILE=true` once we are happy.

## Open questions to resolve later

These do not block writing the implementation plan but should be flagged:

- **Categorization vocabulary for `transactions.category`.** Free-text for
  now; lock to an enum once the WhatsApp bot is parsing real users'
  messages and we know the distribution.
- **Soft delete vs hard delete for `fixed_expenses`.** Spec uses `active`
  boolean to preserve history. Confirm before implementing.
- **`exchange_rates` per-row is settled by this spec, not open.** Every
  monetary table (incomes, fixed_expenses, transactions) carries its own
  `exchange_rate_id` column. This is a deliberate departure from PR4's
  report-wide snapshot: the WhatsApp bot stamps individual transactions
  hours apart, and there is no enclosing "report run" to share a single
  snapshot with. Listed here only as a callout because it changes the
  PR4 convention.
- **Phone verification UX.** This spec sketches "send code, user replies
  in WhatsApp." Final UX (link vs code, expiry, retry) to be decided in a
  separate doc.
