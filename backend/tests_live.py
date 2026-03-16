import asyncio
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

async def test_live():
    from app.live_market import shoonya_live
    await shoonya_live.connect()
    
    def on_tick(data):
        print(f"Tick received: {data}")
        
    shoonya_live.add_callback(on_tick)
    
    await asyncio.sleep(20)

if __name__ == "__main__":
    asyncio.run(test_live())
