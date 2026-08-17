import asyncio
import asyncpg

async def update_db():
    conn = await asyncpg.connect("postgresql://speakarena:speakarena_dev_password@127.0.0.1:5432/speakarena_db")
    hash_val = "$argon2id$v=19$m=65536,t=3,p=4$WTaCSlYWpbPh9WSNQKZwLg$9Vxnk1JVpFCJnysitHvjPrxBPJP5ZhxwJbdDINTaKDI"
    await conn.execute(
        """
        UPDATE users 
        SET hashed_password = $1,
            failed_login_count = 0,
            locked_until = NULL
        WHERE email = 'teacher@speakarena.com'
        """,
        hash_val
    )
    await conn.close()
    print("SUCCESS: Updated teacher@speakarena.com password hash in DB to Teacher@2024!")

if __name__ == "__main__":
    asyncio.run(update_db())
