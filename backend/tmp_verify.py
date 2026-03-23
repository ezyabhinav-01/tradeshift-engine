import asyncio
import websockets
import json
import time

async def verify_replay():
    url = "ws://localhost:8000/ws/ticker"
    print(f"Connecting to {url}...")
    try:
        async with websockets.connect(url) as websocket:
            print("Connected!")
            
            # Send START
            start_msg = {
                "command": "START",
                "symbols": ["RELIANCE"],
                "speed": 1.0,
                "date": "2026-03-11"
            }
            await websocket.send(json.dumps(start_msg))
            print("Sent START command")
            
            ticks_received = []
            start_time = time.time()
            
            while len(ticks_received) < 5 and (time.time() - start_time) < 30:
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=10)
                    data = json.loads(response)
                    
                    if data["type"] == "TICK":
                        now = time.time()
                        ticks_received.append(now)
                        print(f"Received TICK {len(ticks_received)} at {now}")
                        if len(ticks_received) > 1:
                            interval = ticks_received[-1] - ticks_received[-2]
                            print(f"Interval since last tick: {interval:.3f}s")
                    elif data["type"] == "ERROR":
                        print(f"Server Error: {data['message']}")
                        return
                except asyncio.TimeoutError:
                    print("Timeout waiting for tick")
                    break
            
            if len(ticks_received) >= 2:
                avg_interval = (ticks_received[-1] - ticks_received[0]) / (len(ticks_received) - 1)
                print(f"\nAverage Interval: {avg_interval:.3f}s")
                if 4.5 <= avg_interval <= 5.5:
                    print("SUCCESS: 5.0s interval verified!")
                else:
                    print(f"FAILURE: Interval is {avg_interval:.3f}s (expected 5.0s)")
            else:
                print("FAILURE: Not enough ticks received")

    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(verify_replay())
