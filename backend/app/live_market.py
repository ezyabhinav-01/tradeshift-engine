import asyncio
import json
import logging
import os
import datetime
from typing import Dict, Any, Optional

# Wait for NorenApiPy
try:
    from NorenRestApiPy.NorenApi import NorenApi
except ImportError:
    NorenApi = None
    logging.warning("NorenRestApiPy not installed. Live Shoonya WebSocket will not work.")

import pyotp

logger = logging.getLogger(__name__)

class ShoonyaLiveService:
    def __init__(self):
        self.api = None
        self.connected = False
        self.callbacks = []
        
        # We will subscribe to NIFTY, BANKNIFTY, SENSEX, INDIA VIX
        self.subscription_tokens = {
            "NSE|26000": "NIFTY 50",
            "NSE|26009": "BANK NIFTY",
            "BSE|1": "SENSEX",  # Approximation, getting exact BSE SENSEX token from shoonya may require checking master db
            "NSE|26017": "INDIA VIX"
        }
        
        self.latest_data: Dict[str, Any] = {}
        
    def add_callback(self, callback):
        self.callbacks.append(callback)

    def remove_callback(self, callback):
        if callback in self.callbacks:
            self.callbacks.remove(callback)

    async def _notify_callbacks(self, data):
        # 🔥 Trigger OMS Price Monitoring
        from app.services.order_management import oms_service
        if "price" in data and "name" in data:
            asyncio.create_task(oms_service.on_price_update(data["name"], data["price"]))

        for cb in self.callbacks:
            try:
                if asyncio.iscoroutinefunction(cb):
                    await cb(data)
                else:
                    cb(data)
            except Exception as e:
                logger.error(f"Error in callback: {e}")

    def on_feed(self, msg):
        """Callback for Shoonya websocket feed"""
        if "tk" in msg and "e" in msg:
            token_key = f"{msg['e']}|{msg['tk']}"
            name = self.subscription_tokens.get(token_key, token_key)
            
            update = {"name": name, "symbol": token_key, "timestamp": datetime.datetime.now().isoformat()}
            
            if "lp" in msg:
                update["price"] = float(msg["lp"])
            
            if "pc" in msg:
                 update["change_percent"] = float(msg["pc"])

            if "c" in msg and "price" in update:
               update["change"] = round(update["price"] - float(msg["c"]), 2)
               update["is_positive"] = update["change"] >= 0

            self.latest_data[name] = {**self.latest_data.get(name, {}), **update}
            
            if "price" in update:
               asyncio.create_task(self._notify_callbacks(self.latest_data[name]))

    def on_open(self):
        logger.info("🟢 Shoonya WebSocket Connected")
        self.connected = True
        self._subscribe()

    def on_close(self, code, reason):
        logger.warning(f"🔴 Shoonya WebSocket Closed: {code} - {reason}")
        self.connected = False

    def on_error(self, err):
        logger.error(f"⚠️ Shoonya WebSocket Error: {err}")

    def _subscribe(self):
        if self.connected and self.api:
            for token in self.subscription_tokens.keys():
                logger.info(f"Subscribing to {token}")
                self.api.subscribe(token)

    async def connect(self):
        if not NorenApi:
            logger.error("Cannot connect to Shoonya: NorenRestApiPy missing")
            return
            
        user_id = os.getenv('SHOONYA_USER_ID')
        password = os.getenv('SHOONYA_PASSWORD')
        vendor_code = os.getenv('SHOONYA_VENDOR_CODE')
        api_secret = os.getenv('SHOONYA_API_SECRET')
        totp_secret = os.getenv('SHOONYA_TOTP_SECRET')
        
        if not all([user_id, password, vendor_code, api_secret, totp_secret]):
            logger.error("Missing Shoonya credentials in .env")
            return
            
        class CustomNoren(NorenApi):
           def __init__(self, host, websocket):
               super().__init__(host=host, websocket=websocket)
               
        API_ENDPOINT = "https://api.shoonya.com/NorenWClientTP/"
        self.api = CustomNoren(host=API_ENDPOINT, websocket=API_ENDPOINT)
        
        try:
            # Need to run in executor to not block async loop if it takes time
            totp = pyotp.TOTP(totp_secret).now()
            login_resp = await asyncio.to_thread(
                self.api.login,
                userid=user_id,
                password=password,
                twoFA=totp,
                vendor_code=vendor_code,
                api_secret=api_secret,
                imei="abc1234"
            )
            
            if login_resp and login_resp.get("stat") == "Ok":
                logger.info("✅ Shoonya API Login Successful")
                self.api.start_websocket(
                    subscribe_callback=self.on_feed,
                    socket_open_callback=self.on_open,
                    socket_close_callback=self.on_close,
                    socket_error_callback=self.on_error
                )
            else:
                logger.error(f"❌ Shoonya API Login Failed: {login_resp}")
        except Exception as e:
            logger.error(f"❌ Error connecting to Shoonya: {e}")

shoonya_live = ShoonyaLiveService()
