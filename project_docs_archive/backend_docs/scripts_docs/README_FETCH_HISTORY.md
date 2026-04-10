# Historical Data Fetching Script

This script fetches historical data from Shoonya/Finvasia API for NIFTY and BANKNIFTY indices.

## Setup Instructions

### 1. Install Dependencies

First, install the required Python packages:

```bash
cd backend
pip install -r requirements.txt
```

Or if using Docker:

```bash
docker-compose exec backend pip install -r requirements.txt
```

### 2. Configure Credentials

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and fill in your Shoonya credentials:
   - `SHOONYA_USER_ID`: Your Shoonya user ID
   - `SHOONYA_PASSWORD`: Your Shoonya password
   - `SHOONYA_VENDOR_CODE`: Vendor code provided by Shoonya
   - `SHOONYA_API_SECRET`: API secret provided by Shoonya
   - `SHOONYA_TOTP_SECRET`: Your TOTP secret (Base32 encoded secret from 2FA setup)

**Important**: The `SHOONYA_TOTP_SECRET` is the secret key shown when you first set up 2FA (usually a long Base32 string like `JBSWY3DPEHPK3PXP`), NOT the 6-digit code from your authenticator app.

### 3. Run the Script

```bash
# From backend directory
python scripts/fetch_history.py

# Or using Docker
docker-compose exec backend python scripts/fetch_history.py
```

## What the Script Does

1. **Login**: Authenticates to Shoonya API using your credentials and generates TOTP for 2FA
2. **Fetch Data**: Downloads 30 days of 1-minute historical data for:
   - NIFTY (Token: 26000)
   - BANKNIFTY (Token: 26009)
3. **Save**: Converts data to Pandas DataFrame and saves as Parquet files in `data/` directory:
   - `data/NIFTY_2026.parquet`
   - `data/BANKNIFTY_2026.parquet`
   - Files are organized by year automatically

## Customization

### Add More Instruments

Edit the `INSTRUMENTS` dictionary in `fetch_history.py`:

```python
INSTRUMENTS = {
    'NIFTY': {
        'token': '26000',
        'exchange': 'NSE'
    },
    'BANKNIFTY': {
        'token': '26009',
        'exchange': 'NSE'
    },
    'RELIANCE': {
        'token': '2885',  # Example token
        'exchange': 'NSE'
    }
}
```

### Change Time Period

Modify the `days` parameter in the `main()` function:

```python
df = download_history(
    api=api,
    symbol=symbol,
    symbol_token=config['token'],
    exchange=config['exchange'],
    days=60  # Change from 30 to 60 days
)
```

## Output Format

The Parquet files contain the following data (columns may vary based on API response):
- `time`: Timestamp of the candle
- `into`: Open price
- `inth`: High price
- `intl`: Low price
- `intc`: Close price
- `v`: Volume
- `oi`: Open Interest (if applicable)

## Troubleshooting

### Login Fails
- Verify your credentials in `.env` file
- Ensure TOTP secret is correct (use the Base32 secret, not the 6-digit code)
- Check if your Shoonya account has API access enabled

### Data Not Available
- Check if the token IDs are correct
- Verify the exchange name is correct
- Check if data exists for the requested date range

### Permission Denied
- Ensure the `data/` directory exists and is writable
- Check file permissions

## Security Notes

- **Never commit the `.env` file to version control**
- The `.env` file is already in `.gitignore`
- Keep your API credentials secure
