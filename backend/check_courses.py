import asyncio
import sys
sys.path.insert(0, '.')

async def main():
    from app.database import AsyncSessionFactory
    from sqlalchemy import text

    async with AsyncSessionFactory() as session:
        result = await session.execute(text("SELECT COUNT(*) FROM courses WHERE deleted_at IS NULL"))
        total = result.scalar()

        result2 = await session.execute(text(
            "SELECT id, title, status, price, created_at FROM courses WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 20"
        ))
        rows = result2.fetchall()

        print(f"Total courses in DB: {total}")
        for r in rows:
            print(f"  [{str(r[2])}] {r[1]} | price=${r[3]} | id={str(r[0])[:8]}...")

asyncio.run(main())
