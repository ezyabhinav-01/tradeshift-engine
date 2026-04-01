import sys
import os

# Add backend to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from app.market_service import market_service
    print("✅ Market service imported")
    indices = market_service.get_indices()
    print(f"✅ Indices fetched: {len(indices)} items")
    print(indices[0] if indices else "No data")
except Exception as e:
    import traceback
    print(f"❌ Error: {e}")
    traceback.print_exc()
