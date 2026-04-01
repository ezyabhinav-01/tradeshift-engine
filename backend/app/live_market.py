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
        self.loop = None
        
        # We will subscribe to NIFTY, BANKNIFTY, SENSEX, INDIA VIX
        self.subscription_tokens = {
            "NSE|26000": "NIFTY 50",
            "NSE|26009": "BANK NIFTY",
            "BSE|1": "SENSEX",  # Approximation, getting exact BSE SENSEX token from shoonya may require checking master db
            "NSE|26017": "INDIA VIX"
        }
        
        self.latest_data: Dict[str, Any] = {}
        
        # Status tracking
        self.status = "disconnected" # disconnected, connecting, connected, error
        self.error_message = None
        self._reconnect_task = None
        
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
               if self.loop:
                   asyncio.run_coroutine_threadsafe(self._notify_callbacks(self.latest_data[name]), self.loop)
               else:
                   logger.warning("Event loop not capture, cannot notify callbacks")

    def on_open(self, *args):
        logger.info("🟢 Shoonya WebSocket Connected")
        self.connected = True
        self.status = "connected"
        self.error_message = None
        self._subscribe()

    def on_close(self, *args):
        # NorenApi might pass (code, reason) or nothing depending on version
        logger.warning(f"🔴 Shoonya WebSocket Closed. Args: {args}")
        self.connected = False
        self.status = "disconnected"
        # Trigger reconnection if not intentional
        self._ensure_reconnect_loop()

    def on_error(self, err):
        # Some versions might pass (ws, err), but NorenApi usually wraps it
        logger.error(f"⚠️ Shoonya WebSocket Error: {err}")
        self.status = "error"
        self.error_message = str(err)

    def _subscribe(self):
        if self.connected and self.api:
            for token in self.subscription_tokens.keys():
                logger.info(f"Subscribing to {token}")
                self.api.subscribe(token)

    def _ensure_reconnect_loop(self):
        if self._reconnect_task is None or self._reconnect_task.done():
            self._reconnect_task = asyncio.create_task(self._reconnect_loop())

    async def _reconnect_loop(self):
        """Background loop to attempt reconnection every 60 seconds if disconnected."""
        while not self.connected:
            logger.info("Retrying Shoonya connection in 60 seconds...")
            await asyncio.sleep(60)
            await self.connect()

    async def connect(self):
        if not NorenApi:
            logger.error("Cannot connect to Shoonya: NorenRestApiPy missing")
            return
            
        if self.status == "connecting":
            return
            
        self.status = "connecting"
        try:
            self.loop = asyncio.get_running_loop()
        except RuntimeError:
            self.loop = None
            
        user_id = os.getenv('SHOONYA_USER_ID', '').strip()
        password = os.getenv('SHOONYA_PASSWORD', '').strip()
        vendor_code = os.getenv('SHOONYA_VENDOR_CODE', '').strip()
        api_secret = os.getenv('SHOONYA_API_SECRET', '').strip()
        totp_secret = os.getenv('SHOONYA_TOTP_SECRET', '').strip()
        imei = os.getenv('SHOONYA_IMEI', 'abc1234').strip()
        
        if not all([user_id, password, vendor_code, api_secret, totp_secret]):
            missing = [k for k,v in {'user_id': user_id, 'password': password, 'vendor_code': vendor_code, 'api_secret': api_secret, 'totp_secret': totp_secret}.items() if not v]
            logger.error(f"Missing Shoonya credentials in .env: {missing}")
            self.status = "error"
            self.error_message = f"Missing credentials: {missing}"
            return
            
        class CustomNoren(NorenApi):
           def __init__(self, host, websocket):
               super().__init__(host=host, websocket=websocket)
               
        # Normalize endpoints (ensure trailing slash)
        API_ENDPOINT = "https://api.shoonya.com/NorenWClientTP/"
        WS_ENDPOINT = "wss://api.shoonya.com/NorenWSTP/"
        
        # Ensure we don't have double slashes if using some SDK versions
        self.api = CustomNoren(host=API_ENDPOINT.rstrip('/'), websocket=WS_ENDPOINT)
        
        try:
            # Time synchronization check
            now = datetime.datetime.now()
            totp = pyotp.TOTP(totp_secret).now()
            
            logger.info(f"Attempting Shoonya login for ID: {user_id}")
            
            login_resp = await asyncio.to_thread(
                self.api.login,
                userid=user_id,
                password=password,
                twoFA=totp,
                vendor_code=vendor_code,
                api_secret=api_secret,
                imei=imei
            )
            
            if login_resp and login_resp.get("stat") == "Ok":
                logger.info("✅ Shoonya API Login Successful")
                self.connected = True
                self.status = "connected"
                self.error_message = None
                self.api.start_websocket(
                    subscribe_callback=self.on_feed,
                    socket_open_callback=self.on_open,
                    socket_close_callback=self.on_close,
                    socket_error_callback=self.on_error
                )
            else:
                self.status = "error"
                self.connected = False
                self.error_message = f"Login failed: {login_resp.get('emsg', 'Unknown error') if login_resp else 'None'}"
                logger.error(f"❌ Shoonya API Login Failed: {self.error_message}")
                self._ensure_reconnect_loop()
        except Exception as e:
            self.connected = False
            self.status = "error"
            
            # Specific handling for JSON/HTML error (502 Gateway)
            if "Expecting value" in str(e):
                self.error_message = "Shoonya API returned 502/HTML (Service unavailable or down for maintenance)"
                logger.error(f"🛑 Shoonya Connectivity: {self.error_message}")
            else:
                self.error_message = str(e)
                logger.error(f"❌ Exception during Shoonya login: {e}")
                import traceback
                logger.debug(traceback.format_exc())
            
            self._ensure_reconnect_loop()


shoonya_live = ShoonyaLiveService()
