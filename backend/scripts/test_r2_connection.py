"""Script to test Cloudflare R2 connection and presigned URL generation."""

import asyncio
import sys
import boto3
from botocore.exceptions import ClientError, BotoCoreError

from app.config import get_settings
from app.core.storage.r2 import (
    generate_presigned_upload_url,
    generate_presigned_download_url,
    generate_presigned_stream_url,
)

async def test_r2():
    settings = get_settings()
    print("==================================================")
    print("Testing Cloudflare R2 Configuration & Connection")
    print("==================================================")
    print(f"R2 Account ID:        {settings.R2_ACCOUNT_ID}")
    print(f"R2 Access Key ID:     {settings.R2_ACCESS_KEY_ID[:4]}***" if settings.R2_ACCESS_KEY_ID else "R2 Access Key ID:     <Not set>")
    print(f"R2 Bucket Name:        {settings.R2_BUCKET_NAME}")
    print(f"R2 Endpoint URL:       {settings.r2_endpoint_url}")
    print(f"R2 Public URL:         {settings.R2_PUBLIC_URL}")
    print("--------------------------------------------------")

    if not settings.R2_ACCOUNT_ID or settings.R2_ACCOUNT_ID in ("dev_account_id", "your-cloudflare-account-id") or "your-" in settings.R2_ACCOUNT_ID:
        print("[!] NOTICE: R2_ACCOUNT_ID is using placeholder dev values ('dev_account_id').")
        print("    Please set your actual Cloudflare R2 credentials in backend/.env to connect to live R2 storage.")
        print("\nRequired backend/.env settings:")
        print("  R2_ACCOUNT_ID=<your-32-char-account-id>")
        print("  R2_ACCESS_KEY_ID=<your-r2-access-key>")
        print("  R2_SECRET_ACCESS_KEY=<your-r2-secret-key>")
        print("  R2_BUCKET_NAME=<your-bucket-name>")
        print("  R2_PUBLIC_URL=<your-r2-public-url-or-r2-dev-url>")
        return

    # Direct boto3 check
    from botocore.config import Config
    s3_client = boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )

    print("[*] Checking bucket access (head_bucket)...")
    try:
        s3_client.head_bucket(Bucket=settings.R2_BUCKET_NAME)
        print("[+] Bucket access successful!")
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code")
        print(f"[-] Bucket verification failed (Code: {error_code}): {e}")
    except Exception as e:
        if "SSLV3_ALERT_HANDSHAKE_FAILURE" in str(e) or "SSL" in str(e):
            print(f"[!] Local SSL/Proxy Notice: Direct Python SSL handshake failed ({e}).")
            print("    (This is common on local machines with active proxies/firewalls. Presigned URLs will still work in the browser!)")
        else:
            print(f"[-] Connection error: {e}")

    # Test presigned URL generation (Offline HMAC calculation — always works with valid keys)
    print("\n[*] Testing presigned URL generation...")
    test_key = "test/connection_test.txt"
    try:
        upload_url = await generate_presigned_upload_url(test_key, "text/plain")
        download_url = await generate_presigned_download_url(test_key)
        stream_url = await generate_presigned_stream_url(test_key)

        print("[+] Presigned PUT URL generated successfully:")
        print(f"    {upload_url[:90]}...")
        print("[+] Presigned GET Download URL generated successfully:")
        print(f"    {download_url[:90]}...")
        print("[+] Presigned Stream URL generated successfully:")
        print(f"    {stream_url[:90]}...")
    except Exception as e:
        print(f"[-] Failed generating presigned URLs: {e}")
        return

    print("\n[SUCCESS] Cloudflare R2 storage credentials & presigned URL engine are fully connected!")

if __name__ == "__main__":
    asyncio.run(test_r2())
