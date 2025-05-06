from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv
from models import Base

# Загружаем переменные окружения из .env
load_dotenv()

# Получаем данные для подключения из переменных окружения
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "vracht_db")

# Формируем URL подключения к базе данных
DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"

try:
    # Создаем движок SQLAlchemy
    engine = create_engine(DATABASE_URL)
    
    # Проверяем, существует ли колонка avatar_path в таблице users
    with engine.connect() as connection:
        result = connection.execute(text(f"""
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = '{DB_NAME}' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_path'
        """))
        column_exists = result.scalar()
        
        # Если колонка не существует, добавляем ее
        if column_exists == 0:
            print("Добавление колонки avatar_path в таблицу users...")
            connection.execute(text("""
                ALTER TABLE users 
                ADD COLUMN avatar_path VARCHAR(255) NULL
            """))
            connection.commit()
            print("Колонка avatar_path успешно добавлена!")
        else:
            print("Колонка avatar_path уже существует в таблице users.")
    
    print("Операция успешно завершена!")
    
except Exception as e:
    print(f"Произошла ошибка: {e}") 