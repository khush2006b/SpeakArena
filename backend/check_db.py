import asyncio
from app.database import AsyncSessionFactory
from sqlalchemy import select
from app.models.meeting import Meeting
from app.models.user import User

async def main():
    async with AsyncSessionFactory() as s:
        m = (await s.execute(select(Meeting))).scalars().all()
        u = (await s.execute(select(User).where(User.role == 'teacher'))).scalars().all()
        print("=== TEACHERS ===")
        for usr in u:
            print(f"ID: {usr.id} | Email: {usr.email}")
        print("\n=== MEETINGS ===")
        for meeting in m:
            print(f"ID: {meeting.id} | Title: {meeting.title} | Teacher ID: {meeting.teacher_id} | Deleted At: {meeting.deleted_at}")

asyncio.run(main())
