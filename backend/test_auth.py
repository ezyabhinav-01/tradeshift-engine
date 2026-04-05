try:
    from typing import Optional
    print(f"Optional is defined: {Optional}")
    import app.auth
    print("app.auth imported successfully")
except Exception as e:
    import traceback
    traceback.print_exc()
