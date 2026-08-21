import asyncio
from app.database import AsyncSessionFactory
from sqlalchemy import select
from app.models.meeting import Meeting

async def main():
    async with AsyncSessionFactory() as s:
        m = (await s.execute(select(Meeting).where(Meeting.deleted_at.is_(None)))).scalars().all()
        for x in m:
            print(f"Meeting: '{x.title}' | ScheduledAt: {x.scheduled_at} | Duration: {x.duration_minutes} | Status: {x.status}")

asyncio.run(main())
