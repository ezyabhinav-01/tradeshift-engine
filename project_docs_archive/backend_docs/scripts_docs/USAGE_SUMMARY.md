# Scripts Usage Summary

This directory contains utility scripts for the Tradeshift Engine platform.

## Available Scripts

### 1. `update_master_db.py` - NSE Master Database Updater

Downloads NSE Equity master file and populates the `instruments_master` table.

**Usage:**
```bash
python scripts/update_master_db.py
```

**What it does:**
- Downloads `NSE_symbols.txt.zip` from Shoonya API
- Extracts and processes the data using Pandas
- Creates `instruments_master` table with schema:
  - `token` (Primary Key)
  - `symbol` (e.g., 'RELIANCE-EQ')
  - `name`
  - `instrument_type`
- Bulk inserts data with duplicate handling (`ON CONFLICT DO NOTHING`)

**Requirements:** None (uses existing database connection)

---

### 2. `fetch_history.py` - Historical Data Downloader

Fetches historical time-price series data from Shoonya API for NIFTY and BANKNIFTY.

**Usage:**
```bash
# First time setup
cp .env.example .env
# Edit .env with your credentials

# Run the script
python scripts/fetch_history.py
```

**What it does:**
- Logs in to Shoonya API using TOTP 2FA
- Downloads 30 days of 1-minute candle data for:
  - NIFTY (Token: 26000)
  - BANKNIFTY (Token: 26009)
- Saves data as Parquet files in `data/` directory:
  - `data/NIFTY_2026.parquet`
  - `data/BANKNIFTY_2026.parquet`

**Requirements:**
- Create `.env` file with Shoonya credentials (see `.env.example`)
- Install dependencies: `NorenRestApiPy`, `pyotp`, `python-dotenv`

**Credentials needed in `.env`:**
- `SHOONYA_USER_ID`
- `SHOONYA_PASSWORD`
- `SHOONYA_VENDOR_CODE`
- `SHOONYA_API_SECRET`
- `SHOONYA_TOTP_SECRET`

---

## Quick Start

### Docker Environment

```bash
# Update master database
docker-compose exec backend python scripts/update_master_db.py

# Fetch historical data (after setting up .env)
docker-compose exec backend python scripts/fetch_history.py
```

### Local Environment

```bash
cd backend

# Update master database
python scripts/update_master_db.py

# Fetch historical data
python scripts/fetch_history.py
```

## Dependencies

All required dependencies are in `requirements.txt`:
- `pandas` - Data processing
- `psycopg2-binary` - PostgreSQL adapter
- `sqlalchemy` - Database ORM
- `requests` - HTTP requests
- `pyarrow` - Parquet file support
- `NorenRestApiPy` - Shoonya API client
- `pyotp` - TOTP generation
- `python-dotenv` - Environment variable management
