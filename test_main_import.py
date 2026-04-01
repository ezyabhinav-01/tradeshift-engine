import sys
import os

# Add backend to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from main import app
    print("✅ App imported successfully")
except Exception as e:
    import traceback
    print(f"❌ Error: {e}")
    traceback.print_exc()
