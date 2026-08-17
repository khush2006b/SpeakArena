"""Environment variable verification script.

This script runs before the FastAPI server starts in the production entrypoint.
It asserts that all absolutely critical environment variables are present and
not empty. If any are missing, it crashes the container immediately with a
clear error message, preventing silent failures at runtime.
"""

import os
import sys

CRITICAL_ENV_VARS = [
    "DATABASE_URL",
    "REDIS_URL",
    "JWT_SECRET_KEY",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "RESEND_API_KEY",
]

def verify_environment() -> None:
    """Verify all required environment variables are set."""
    print("Verifying critical environment variables...")
    missing = []
    
    for var in CRITICAL_ENV_VARS:
        val = os.environ.get(var)
        if not val or not val.strip():
            missing.append(var)
            
    if missing:
        print("\n❌ CRITICAL STARTUP ERROR: Missing required environment variables!", file=sys.stderr)
        for var in missing:
            print(f"  - {var}", file=sys.stderr)
        print("\nFix your deployment configuration and restart the container.", file=sys.stderr)
        sys.exit(1)
        
    print("✅ All critical environment variables are present.")

if __name__ == "__main__":
    verify_environment()
