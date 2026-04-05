# ══════════════════════════════════════════════════════════════
#  TRADESHIFT ENGINE — FULL SYSTEM AUDIT REPORT
#  Confidential · Internal Use Only
#  Date: 2026-04-05
#  Auditor: Senior System Architect (AI-Assisted)
#  Verdict: ⚠️  NOT PRODUCTION-READY — Critical fixes required
# ══════════════════════════════════════════════════════════════


---


# SECTION 1: WHAT IS THIS SYSTEM?

TradeShift Engine is a full-stack Indian stock market simulation and
education platform. It is NOT a real brokerage.

It replays historical 1-minute OHLCV candle data (stored as Parquet
files) through WebSockets. A custom Brownian Bridge algorithm generates
realistic sub-second ticks to simulate a live trading floor.

Users can:
  • Paper trade with MARKET, LIMIT, STOP, GTT orders (with SL/TP)
  • Replay any historical date tick-by-tick at adjustable speed
  • Learn trading via a structured academy (Tracks → Modules → Chapters → Lessons)
  • Earn XP, badges, and streaks (gamification layer)
  • Read AI-explained financial news
  • Research stocks with AI analysis (Gemini-powered)
  • Chat in community channels or DMs
  • Use TradingView-style charts with 26+ drawing tools
  • Talk to a platform-aware RAG chatbot

The system has:
  • 50+ REST API endpoints
  • 3 WebSocket endpoints (ticker, orders, live indices)
  • 25 database tables
  • 10+ email templates
  • 6 external API integrations


---


# SECTION 2: TECH STACK SUMMARY

FRONTEND:
  • React 19 + TypeScript + Vite 7
  • TailwindCSS 4
  • Zustand (state) + React Context (auth/theme/game/notifications)
  • lightweight-charts (TradingView) + custom drawing tools
  • Framer Motion + GSAP (animations)
  • Axios (HTTP) via Vite dev proxy
  • Radix UI + shadcn/ui components

BACKEND:
  • FastAPI (Python)
  • SQLAlchemy 2.0 (async) + asyncpg
  • PyJWT + bcrypt (auth)
  • APScheduler (background jobs)
  • Google Gemini AI (6 keys rotating)
  • FastAPI-Mail (10+ email templates)
  • SlowAPI (rate limiting)
  • Prometheus (metrics)
  • Redis (caching)

DATABASE:
  • Supabase PostgreSQL (primary — pooler port 6543)
  • Redis (cache layer)

EXTERNAL SERVICES:
  • Google Gemini       → AI analysis, news explainer, chatbot, badges
  • Shoonya/Finvasia    → Live NSE WebSocket data (falls back to yfinance)
  • yfinance            → Market indices, sectors, options, fundamentals
  • NewsData + NewsAPI  → Financial news aggregation
  • Alpha Vantage       → Additional market data
  • Gmail SMTP          → All transactional emails

UNUSED BUT STILL IN DOCKER-COMPOSE:
  • TimescaleDB         → Legacy local DB, superseded by Supabase   ← REMOVE
  • MinIO               → Object storage, never used by the app     ← REMOVE
  • RabbitMQ            → Message queue, never used by the app      ← REMOVE


---


# SECTION 3: ARCHITECTURE OVERVIEW

┌──────────────────────────────────────────────────────────────┐
│                     FRONTEND (Vite + React 19)                │
│  Pages: Landing, Login, Signup, Trade, Markets, Portfolio,   │
│         Learn, News, Community, Research, Screener, Settings │
│  Charts: lightweight-charts + 26 custom drawing components   │
│  State: AuthContext + GameContext + 6 Zustand stores         │
└─────────────────┬────────────────────────────────────────────┘
                  │ Vite Proxy
                  │ /api, /auth, /ws → localhost:8000
                  │ /api/chat       → localhost:8001
┌─────────────────▼────────────────────────────────────────────┐
│                    BACKEND (FastAPI :8000)                     │
│                                                               │
│  main.py (1,436 lines — GOD FILE, needs refactoring)         │
│  ├── REST endpoints (search, historical, market, research)   │
│  ├── WebSocket handlers (ticker, orders, live_indices)       │
│  ├── Background jobs (APScheduler)                           │
│  └── Middleware (user activity tracking, CORS)               │
│                                                               │
│  11 Routers: auth, trading, portfolio, history, learn,       │
│              news, community, user, notifications,           │
│              analytics, inngest                              │
│                                                               │
│  4 Services: badge_service, email_service,                   │
│              order_management, risk_engine                   │
│                                                               │
│  25 SQLAlchemy Models                                        │
└──────┬──────────────┬──────────────┬─────────────────────────┘
       │              │              │
  ┌────▼─────┐  ┌─────▼─────┐  ┌────▼────────┐
  │ Supabase │  │   Redis   │  │   Parquet   │
  │ Postgres │  │  (Cache)  │  │   Files     │
  │ 25 tables│  │           │  │ 7-day data  │
  └──────────┘  └───────────┘  └─────────────┘

SEPARATE SERVICE:
  AI ChatBot (port 8001) — Gemini RAG + ChromaDB


---


# SECTION 4: COMPLETE FEATURE STATUS

Feature                          Status    Endpoints
─────────────────────────────────────────────────────
Auth (Email/OTP/PIN)             ✅        /auth/* (15 endpoints)
Trading Engine                   ✅        /api/trade/* (7) + WS /ws/ticker
Portfolio Tracking               ✅        /api/portfolio/* (4)
Trade History + CSV Export       ✅        /api/history/* (4)
Market Data (indices, sectors)   ✅        /api/market/* (6) + WS /ws/live_indices
Learning Academy                 ✅        /api/learn/* (15+)
Gamification (XP/Streaks/Badges) ✅        Integrated
Market Secrets (reveal-to-earn)  ✅        /api/learn/secrets/*
News + AI Explainer              ✅        /api/news/* (2)
Stock Research + AI Chat         ✅        /api/stock/* (4) + /api/screener/*
Community Chat (Channels + DMs)  ✅        /api/community/* (5)
Notifications (User + Broadcast) ✅        /api/notifications/* (4)
User Settings & Chart Persistence✅        /api/user/* (7)
Analytics (heartbeat, page time) ✅        /analytics/* (2)
AI Chatbot (RAG)                 ✅        Separate service :8001
Email System (10+ templates)     ✅        Background tasks
7-Day Rolling Data Pipeline      ✅        APScheduler daily job


---


# SECTION 5: DATA FLOWS

TRADE EXECUTION:
  User clicks BUY/SELL
  → Frontend sends WebSocket cmd or POST /api/trade/
  → RiskEngine.check_order() — validates qty limits, daily loss (Redis)
  → TradeLog created in DB (status: OPEN or PENDING)
  → If MARKET: linked SL/TP child orders created as PENDING
  → WebSocket order_update emitted to user
  → Email confirmation sent in background
  → OMS continuously monitors price → triggers PENDING orders
  → On close: PnL calculated, linked orders cancelled

MARKET REPLAY:
  User selects symbol + date → START
  → Backend loads e.g. NIFTY_2026-03-30.parquet
  → Filters to market hours (9:15 AM – 3:30 PM)
  → Sends BACKFILL (300 pre-market candles)
  → For each 1-min candle:
      TickSynthesizer generates 60 ticks (Brownian Bridge)
      Each tick sent as TICK + INDICES_TICK via WebSocket
      News injected at matching timestamps
      OMS checks for conditional order triggers
  → End of minute: CANDLE event sent

LEARNING PROGRESS:
  User reads lesson → clicks "Complete"
  → POST /api/learn/progress
  → LearningProgress record created (duplicate check)
  → UserStreak updated
  → Background: check_and_grant_badges(user_id)
  → If new badge earned: UserBadge + Notification + Email


---


# SECTION 6: DATABASE TABLES (25 total)

CORE:
  users                  User accounts (email, hashed password, PIN, profile)
  user_sessions          Persistent login sessions (token, expiry, IP)
  user_settings          Risk limits, trading preferences
  user_events            Analytics event log
  page_engagement        Time-on-page tracking
  notifications          User + broadcast notifications
  broadcast_reads        Per-user read status for broadcasts
  help_requests          Support tickets

TRADING:
  trade_logs             All orders & trades with linked SL/TP
  portfolio_holdings     Active held positions
  instruments_master     Searchable stock/index/option catalogue
  stock_fundamentals     Key financial ratios
  stock_financials       Yearly revenue/profit snapshots
  market_candles         7-day rolling 1-min candle history

LEARNING:
  tracks                 Learning tracks
  modules                Modules within tracks
  sub_modules            Chapters within modules
  lessons                Lesson content (TipTap JSON)
  learning_progress      Per-user lesson completion
  user_streaks           Daily streak tracking
  user_badges            Earned badge records
  market_secrets         Gamified "reveal-to-earn" cards
  user_secret_reveals    Secret reveal + quiz tracking
  topic_tags             Knowledge graph topic links
  chapter_comments       Discussion on chapters

COMMUNITY:
  community_channels     Chat channels
  community_messages     Channel + DM messages

CHARTS:
  user_chart_settings    Persisted indicators, drawings
  drawing_templates      Saved reusable chart templates
  replay_scenes          Saved replay scenarios (unclear if populated)


---


# SECTION 7: SYSTEM HEALTH SCORE

                Overall Score: 5.5 / 10

  ┌──────────────────────┬───────┬────────────────────────────────────┐
  │ Dimension            │ Score │ Notes                              │
  ├──────────────────────┼───────┼────────────────────────────────────┤
  │ Feature Completeness │  9/10 │ Impressive for a vibe-coded project│
  │ Code Quality         │  4/10 │ main.py = 1,436 lines, duplicates │
  │ Security             │  2/10 │ CRITICAL vulnerabilities           │
  │ Performance          │  5/10 │ OK for small user base, N+1 issues │
  │ Test Coverage        │  0/10 │ ZERO automated tests               │
  │ DevOps/Deployment    │  3/10 │ Docker exists, no CI/CD            │
  │ Documentation        │  6/10 │ README + FastAPI autodocs          │
  │ Maintainability      │  4/10 │ God file problem, ~15% dead code   │
  └──────────────────────┴───────┴────────────────────────────────────┘


---


# SECTION 8: DEAD / UNUSED CODE

Dead code percentage: ~15-18% of total files

BACKEND FILES TO DELETE (27 files):
  ❌ check_learn_data_raw.py      Debug script
  ❌ check_learn_schema.py        Debug script
  ❌ check_schemas.py             Debug script
  ❌ create_test_user.py          Dev utility
  ❌ diagnose_tracks.py           Debug script
  ❌ fix_hierarchy.py             One-time fix (applied)
  ❌ fix_learn_schema_v2.py       One-time fix (applied)
  ❌ gen_migration_sql.py         One-time tool (used)
  ❌ grant_perms.py               One-time fix
  ❌ mock_portfolio_data.py       Dev test data
  ❌ populate_instruments.py      One-time population
  ❌ seed_learn.py                Dev seeding
  ❌ seed_trades.py               Dev seeding
  ❌ sync_docker_to_supabase.py   Migration tool (23KB)
  ❌ verify_badges.py             Debug
  ❌ verify_supabase_data.py      Debug
  ❌ test_moneycontrol.py         Test
  ❌ test_supa_6543.py            Test
  ❌ test_supa_ip.py              Test
  ❌ apply_schema_updates.sql     Applied
  ❌ fix_permissions.sql          Applied
  ❌ fix_supabase_schema.sql      Applied
  ❌ setup.sql                    Superseded
  ❌ supabase_migration.sql       Applied
  ❌ dev_8000.log                 59KB log file in repo!
  ❌ test_main_import.py          Test stub (root)
  ❌ test_market_service.py       Test stub (root)

FRONTEND FILES TO DELETE (4 files):
  ❌ pages/Home1.tsx              Unused variant (route exists but never linked)
  ❌ pages/Home3.tsx              Unused variant (no route)
  ❌ components/ui/tabs 2.tsx     Duplicate of tabs.tsx
  ❌ features/SymbolSearchExample.tsx  Demo component

BACKEND DUPLICATE/REDUNDANT CODE:
  ⚠️  schemas.py has DUPLICATE class definitions:
      • User class defined TWICE (lines 28-48 and 172-186)
      • Token class defined TWICE (lines 21-23 and 189-191)
      • SignupVerifyRequest defined TWICE (lines 111-113 and 157-159)
      • SignupPinRequest defined TWICE (lines 115-123 and 161-169)

  ⚠️  app/oms.py (3.9KB) is superseded by services/order_management.py (9.8KB)
      The old one should be verified and deleted.


---


# SECTION 9: KNOWN BUGS

BUG 1 — CRASH RISK
  File: main.py, line ~1081
  Issue: `current_symbol` is undefined in SELL WebSocket handler
  Should be: `primary_symbol`
  Severity: 🔴 Will crash on SELL in certain flows

BUG 2 — RUNTIME ERROR
  File: trading.py, line 73
  Issue: Code passes `message=` but Notification model field is `content`
  Severity: 🔴 Notification creation fails silently or crashes

BUG 3 — POTENTIAL CRASH
  File: main.py, line ~1219
  Issue: `np.isnan()` used but numpy not explicitly imported at module level
  Severity: 🟡 May crash depending on import order

BUG 4 — CONFUSING BEHAVIOR
  File: schemas.py
  Issue: 4 duplicate class definitions cause confusing import behavior
  Severity: 🟡 Python uses the LAST definition, which may differ

BUG 5 — POTENTIAL CRASH
  File: learn.py, line ~380
  Issue: `TopicTag` used in endpoint but imported model may be missing
  Severity: 🟡 Endpoint will crash if TopicTag model isn't available


---


# SECTION 10: SECURITY AUDIT — CRITICAL FINDINGS

╔══════════════════════════════════════════════════════════════════╗
║  🔴 CRITICAL — These BLOCK any production deployment            ║
╚══════════════════════════════════════════════════════════════════╝

ISSUE 1: ALL SECRETS COMMITTED TO GIT
  Location: backend/.env, frontend/.env, root .env
  What's exposed:
    • 6 Gemini API keys
    • Shoonya broker credentials (user, password, API secret, TOTP)
    • Gmail SMTP app passwords (2 accounts)
    • Supabase database password (visible in URL: "RiteshDheeraj")
    • NewsData, NewsAPI, Alpha Vantage, HuggingFace keys
    • Supabase anon key
  Impact: FULL credential compromise. Anyone with repo access has
          everything needed to access your database, send emails as
          you, and use your API quotas.
  Fix: Rotate ALL keys immediately. Purge .env from git history
       using `git filter-repo` or BFG Repo Cleaner.

ISSUE 2: JWT SECRET_KEY DEFAULTS TO "supersecretkey"
  Location: config.py, line 21
  Code: SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")
  Impact: If the environment variable isn't set, anyone can forge
          valid JWT tokens and impersonate any user.
  Fix: Remove the default. Fail-fast on startup if SECRET_KEY
       is not set.

ISSUE 3: SECURITY PINs STORED IN PLAINTEXT
  Location: users table → security_pin column
  Impact: If the database is breached, all PINs are immediately
          visible. This is a data protection violation.
  Fix: Hash PINs with bcrypt (same as passwords). Write a
       migration script to hash all existing PINs.

ISSUE 4: AUTH COOKIES SET secure=False
  Location: auth.py (set_cookie calls)
  Impact: Session cookies can be intercepted over HTTP connections.
          Session hijacking is trivial on shared/public networks.
  Fix: Set secure=True for production. Use an env flag to keep
       False for local development only.

ISSUE 5: BROADCAST ENDPOINT HAS NO AUTHENTICATION
  Location: POST /api/notifications/broadcast
  Impact: ANYONE (no login needed) can send a notification to
          every user on the platform.
  Fix: Add admin-only authentication check.


╔══════════════════════════════════════════════════════════════════╗
║  🟡 HIGH PRIORITY — Should fix before or shortly after launch   ║
╚══════════════════════════════════════════════════════════════════╝

ISSUE 6: No CSRF protection
  Cookie-based auth without CSRF tokens is vulnerable to cross-site
  request forgery attacks.

ISSUE 7: No rate limiting on OTP/login attempts
  No brute-force protection. Attackers can try unlimited OTP codes.

ISSUE 8: CORS allows all methods and headers
  allow_methods=["*"], allow_headers=["*"] is overly permissive.

ISSUE 9: Error responses leak stack traces
  detail=str(e) exposes internal implementation details.

ISSUE 10: No input sanitization on community messages
  XSS risk — users can inject scripts in chat messages.

ISSUE 11: Email validation only allows @gmail.com
  Unnecessarily restrictive. Should be configurable.


---


# SECTION 11: PRODUCTION READINESS CHECKLIST

  ❌ Secrets management      — All secrets in committed .env files
  ❌ HTTPS / TLS             — Not configured
  ❌ Database migrations     — No Alembic, uses create_all()
  ❌ Automated tests         — Zero test coverage
  ❌ CI/CD pipeline          — No GitHub Actions
  ❌ Error tracking          — No Sentry or equivalent
  ❌ Structured logging      — Mix of print() and logger
  ❌ Rate limiting (auth)    — Not on login/OTP/PIN endpoints
  ⚠️ Monitoring              — Prometheus exists, no alerting
  ⚠️ Health checks           — /health doesn't verify DB or Redis
  ⚠️ Input validation        — Pydantic covers structure, no XSS protection
  ⚠️ Backup strategy         — Supabase built-in, no app-level plan

  VERDICT: NOT DEPLOYABLE in current state.


---


# SECTION 12: PERFORMANCE CONCERNS

1. PARQUET DATA LOADED INTO MEMORY
   Each WebSocket replay session loads an entire day's Parquet file
   into memory. No connection pooling for data files. At scale with
   many concurrent users, this will OOM.

2. N+1 QUERIES IN COMMUNITY MESSAGES
   get_channel_messages() queries the sender's name SEPARATELY for
   each message instead of using a JOIN. Loading a channel with 100
   messages = 101 database queries.

3. NO PAGINATION ON COMMUNITY MESSAGES
   Entire channel history loaded in one request.

4. BACKGROUND SCHEDULER IN-PROCESS
   APScheduler runs inside the FastAPI process. Long-running yfinance
   calls can block the event loop.

5. WEBSOCKET SENDS ALL SYMBOLS SIMULTANEOUSLY
   Multi-symbol replay sends data for ALL subscribed symbols + index
   ticks on every update. High bandwidth for complex sessions.


---


# SECTION 13: CODE ARCHITECTURE ISSUES

THE GOD FILE PROBLEM:
  backend/main.py is 1,436 lines and does EVERYTHING:
    • Database initialization and table creation
    • CORS and middleware setup
    • User activity tracking middleware
    • REST endpoints for search, historical data, market data
    • REST endpoints for stock research and AI analysis
    • WebSocket handler for market replay (ticker)
    • WebSocket handler for order updates
    • WebSocket handler for live index prices
    • Background job scheduling (APScheduler)
    • Parquet file loading and processing
    • Brownian Bridge tick synthesis integration
    • News injection during replay

  This must be split into at least 4 separate router modules.

INCONSISTENT AUTH PATTERNS:
  • dependencies.py uses session cookies + JWT fallback
  • portfolio.py has its OWN auth function using JWT only
  • Some endpoints have no auth at all (broadcast, tracks, markets)

DATABASE INTEGRITY GAPS:
  These tables have user_id columns but NO foreign key to users:
    • trade_logs
    • portfolio_holdings
    • learning_progress
    • user_streaks
    • user_badges
    • page_engagement
    • help_requests
    • user_secret_reveals

  This means if a user is deleted, all their data becomes orphaned
  with no referential integrity enforcement.

MISSING DATABASE INDEXES:
  • trade_logs needs composite index on (user_id, status, session_type)
  • learning_progress needs unique constraint on (user_id, lesson_id)
  • market_candles needs composite index on (symbol, timestamp)


---


# SECTION 14: ACTION PLAN

═══════════════════════════════════════════════════
  DAY 1 — CRITICAL SECURITY FIXES (4-6 hours)
═══════════════════════════════════════════════════

  □ Rotate ALL credentials (Gemini, Shoonya, SMTP, Supabase, etc.)
  □ Purge .env from git history (git filter-repo or BFG)
  □ Create .env.example files with placeholder values only
  □ Hash security PINs with bcrypt + migration for existing PINs
  □ Make SECRET_KEY required (fail-fast on startup if missing)
  □ Set secure=True on auth cookies (with env flag for local dev)
  □ Add authentication to broadcast endpoint
  □ Add rate limiting to OTP verification (max 5 per 10 min)
  □ Fix Bug #1: current_symbol → primary_symbol
  □ Fix Bug #2: Notification message → content
  □ Fix Bug #3: Add numpy import


═══════════════════════════════════════════════════
  DAY 2 — CODE CLEANUP (4-6 hours)
═══════════════════════════════════════════════════

  □ Delete all 27 dead backend files
  □ Delete 4 dead frontend files
  □ Delete or archive app/oms.py
  □ Delete dev_8000.log
  □ Update .gitignore: *.log, output.css, *.parquet

  □ Refactor main.py into:
      → app/routers/market.py (market data endpoints)
      → app/routers/search.py (instrument search)
      → app/routers/replay.py (WebSocket ticker handler)
      → app/routers/stock_research.py (AI analysis endpoints)
      → main.py keeps only: app factory, middleware, startup

  □ Fix schemas.py — remove all 4 duplicate class definitions
  □ Clean docker-compose.yml — remove MinIO, RabbitMQ, TimescaleDB


═══════════════════════════════════════════════════
  WEEK 2 — FOUNDATION
═══════════════════════════════════════════════════

  □ Set up Alembic + generate initial migration
  □ Add foreign key constraints to 8 tables
  □ Add composite database indexes
  □ Add unique constraint on (user_id, lesson_id)
  □ Write minimum test suite (auth, trading, learning flows)
  □ Set up CI pipeline (GitHub Actions: lint → test → build)


═══════════════════════════════════════════════════
  WEEK 3+ — POLISH & SCALE
═══════════════════════════════════════════════════

  □ Fix N+1 queries in community messages
  □ Add pagination to chat history
  □ Set up Sentry for error tracking
  □ Configure Prometheus + Grafana alerting
  □ Replace all print() with structured logger
  □ Add WebSocket authentication
  □ Consider Celery instead of in-process APScheduler
  □ Migrate from datetime.utcnow() to datetime.now(UTC)


---


# SECTION 15: KEY DECISIONS NEEDED FROM TEAM

These are questions that need human judgment before executing:

1. CREDENTIAL ROTATION
   Who owns each API key? We need to coordinate rotation so
   nothing breaks during the switch.

2. PIN HASHING MIGRATION
   Hashing existing PINs is a BREAKING CHANGE. Users with
   existing PINs will need to reset. How do we handle this?
   Options:
     a) Force all users to reset PIN on next login
     b) Run a one-time migration to hash in-place
     c) Support both plaintext and hashed during transition

3. DEPLOYMENT TARGET
   Where are we deploying?
     a) Supabase + Railway / Render
     b) AWS (ECS, EC2, etc.)
     c) Docker on a VPS
   This affects HTTPS setup, secrets management, and CI/CD config.

4. UNUSED INFRASTRUCTURE
   MinIO, RabbitMQ, and Inngest are configured but unused.
   Delete them entirely? Or are there future plans?

5. SHOONYA INTEGRATION
   Live market data via Shoonya is partially working (falls back
   to yfinance). Is live data critical for MVP, or can we launch
   with yfinance only?

6. EMAIL RESTRICTION
   Registration is limited to @gmail.com emails. Do we want to
   open this up to any email provider?

7. TESTING STRATEGY
   Current coverage is 0%. What's our minimum target before
   deploying? Suggested: at least auth flow + trade execution +
   learning progress.

8. MONOLITH REFACTOR SCOPE
   Do we refactor main.py within the monolith (extract to new
   routers), or begin splitting into microservices now?


---


# SECTION 16: PROJECT STATS

  Total Backend Files ........... ~65
  Total Frontend Files .......... ~120+
  Backend Lines (estimated) ..... ~12,000+
  Frontend Lines (estimated) .... ~25,000+
  Database Tables ............... 25
  API Endpoints ................. 50+
  WebSocket Endpoints ........... 3
  Email Templates ............... 10+
  External API Integrations ..... 6
  Dead/Unused Files ............. ~31 (15-18%)
  Test Coverage ................. 0%
  Largest File (Frontend) ....... LandingPage.tsx (76KB)
  Largest File (Backend) ........ main.py (65KB / 1,436 lines)


---


# END OF REPORT

Next steps: Review this document as a team, prioritize the
Day 1 security fixes, and assign ownership for each action item.

Questions? Reach out to the auditor or discuss in your team channel.
