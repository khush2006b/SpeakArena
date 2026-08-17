import asyncio
import sys
sys.path.insert(0, 'D:/Desktop/web development/SpeakArena/backend')
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.config import settings

engine = create_async_engine(settings.DATABASE_URL)

TABLES = ['course_enrollments', 'chat_rooms', 'student_profiles', 'categories']

async def run():
    async with engine.connect() as conn:
        for table in TABLES:
            r = await conn.execute(text(
                f"SELECT column_name FROM information_schema.columns "
                f"WHERE table_name='{table}' ORDER BY ordinal_position"
            ))
            cols = [row[0] for row in r]
            print(f"{table}: {cols}")

asyncio.run(run())
