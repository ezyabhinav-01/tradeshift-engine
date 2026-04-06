import asyncio
import socket
from app.database import get_database_url_async

async def check_connection():
    url = get_database_url_async()
    print(f"URL: {url}")
    host = "aws-1-ap-south-1.pooler.supabase.com"
    ports = [6543, 5432]
    
    for port in ports:
        print(f"Checking port {port}...")
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(5)
        try:
            s.connect((host, port))
            print(f"✅ Port {port} is OPEN")
        except Exception as e:
            print(f"❌ Port {port} is CLOSED: {e}")
        finally:
            s.close()

if __name__ == "__main__":
    asyncio.run(check_connection())
