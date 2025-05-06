#!/usr/bin/env python
# backend/alembic_migration.py

from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

# Загружаем переменные окружения из .env
load_dotenv()

# Получаем URL базы данных из переменной окружения или используем значение по умолчанию
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://vrachi_user:1435511926Ss..@localhost:3306/online_doctors_db")

print(f"Используем URL базы данных: {DATABASE_URL}")

# Подключаемся к базе данных
engine = create_engine(DATABASE_URL)

# Создаем соединение
with engine.connect() as conn:
    # Проверяем существование колонки district в patient_profiles
    result = conn.execute(text("SHOW COLUMNS FROM patient_profiles LIKE 'district'"))
    if result.rowcount == 0:
        print("Добавляем колонку 'district' в таблицу patient_profiles...")
        conn.execute(text("ALTER TABLE patient_profiles ADD COLUMN district VARCHAR(255)"))
        print("Колонка 'district' успешно добавлена.")
    else:
        print("Колонка 'district' уже существует в таблице patient_profiles.")

    # Проверяем существование колонки medical_info в patient_profiles
    result = conn.execute(text("SHOW COLUMNS FROM patient_profiles LIKE 'medical_info'"))
    if result.rowcount == 0:
        print("Добавляем колонку 'medical_info' в таблицу patient_profiles...")
        conn.execute(text("ALTER TABLE patient_profiles ADD COLUMN medical_info TEXT"))
        print("Колонка 'medical_info' успешно добавлена.")
    else:
        print("Колонка 'medical_info' уже существует в таблице patient_profiles.")
        
    # Проверяем существование колонки district в doctor_profiles
    result = conn.execute(text("SHOW COLUMNS FROM doctor_profiles LIKE 'district'"))
    if result.rowcount == 0:
        print("Добавляем колонку 'district' в таблицу doctor_profiles...")
        conn.execute(text("ALTER TABLE doctor_profiles ADD COLUMN district VARCHAR(255)"))
        print("Колонка 'district' успешно добавлена в таблицу doctor_profiles.")
    else:
        print("Колонка 'district' уже существует в таблице doctor_profiles.")
        
    # Проверяем существование колонки is_active в doctor_profiles
    result = conn.execute(text("SHOW COLUMNS FROM doctor_profiles LIKE 'is_active'"))
    if result.rowcount == 0:
        print("Добавляем колонку 'is_active' в таблицу doctor_profiles...")
        conn.execute(text("ALTER TABLE doctor_profiles ADD COLUMN is_active BOOLEAN DEFAULT 1"))
        print("Колонка 'is_active' успешно добавлена в таблицу doctor_profiles.")
    else:
        print("Колонка 'is_active' уже существует в таблице doctor_profiles.")

print("Миграция успешно завершена!") 