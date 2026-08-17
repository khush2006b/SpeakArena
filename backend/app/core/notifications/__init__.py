"""Notification delivery sub-package.

Currently provides email delivery via SMTP using fastapi-mail.
Future extensions may add push notifications, in-app notifications,
or SMS delivery through this package.

All notification functions are async and designed to run inside
FastAPI ``BackgroundTasks`` so they never block the API response path.
"""
