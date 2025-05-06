# backend/models.py

import os
from sqlalchemy import create_engine, Column, Integer, String, Boolean, ForeignKey, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime # Импортируем datetime для работы с датой и временем

from dotenv import load_dotenv # Импортируем load_dotenv
load_dotenv() # Загружаем переменные из .env файла

# URL для подключения к базе данных.
# Порядок приоритета: переменная окружения DATABASE_URL, затем значение из .env, затем запасной вариант.
# Убедись, что в .env или в переменной окружения указана твоя локальная строка подключения с localhost.
DATABASE_URL = os.getenv("DATABASE_URL", os.getenv("DATABASE_URL", "mysql+pymysql://vrachi_user:1435111926Ss..@localhost:3306/online_doctors_db")) # <-- ТВОЯ СТРОКА ПОДКЛЮЧЕНИЯ. Убедись, что здесь 'localhost' и правильный пароль.


# Проверяем, что DATABASE_URL установлен. Если нет, выбрасываем ошибку при старте.
if DATABASE_URL is None:
    raise ValueError("DATABASE_URL environment variable is not set. Make sure you have a .env file with DATABASE_URL, or it's set otherwise.")


# Создание движка базы данных
# pool_pre_ping=True помогает избежать проблем с "отвалившимся" соединением после долгого простоя
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# Создание базового класса для декларативного определения моделей SQLAlchemy
Base = declarative_base()

# Создание фабрики сессий для работы с базой данных
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# --- Определение моделей (таблиц базы данных) ---

# Модель пользователя (базовая информация для всех ролей)
class User(Base):
    __tablename__ = "users" # Имя таблицы в базе данных

    id = Column(Integer, primary_key=True, index=True) # Первичный ключ, автоинкремент
    email = Column(String(255), unique=True, index=True, nullable=False) # Email, уникальный, индексированный, обязательный
    hashed_password = Column(String(255), nullable=False) # Хэш пароля
    is_active = Column(Boolean, default=False) # <--- ИЗМЕНЕНО: Пользователь неактивен по умолчанию после регистрации
    role = Column(String(50), nullable=False) # Роль пользователя ('patient', 'doctor', 'admin')

    # Поля для подтверждения email
    email_verification_token = Column(String(255), unique=True, nullable=True) # Токен подтверждения email (может быть NULL)
    email_verification_token_created_at = Column(DateTime, nullable=True) # Время создания токена (может быть NULL)


    # Отношения к профилям (один пользователь может иметь ОДИН профиль пациента или ОДИН профиль врача)
    # uselist=False указывает на отношение "один к одному"
    # ondelete="CASCADE" означает, что если пользователь удаляется, связанный профиль удаляется автоматически
    patient_profile = relationship("PatientProfile", back_populates="user", uselist=False)
    doctor_profile = relationship("DoctorProfile", back_populates="user", uselist=False)

    # Отношение к заявкам на роль врача
    doctor_applications = relationship("DoctorApplication", back_populates="user")


# Модель профиля Пациента
class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False) # Связь с таблицей users с CASCADE удалением

    # Поля профиля пациента (базовая информация по ТЗ)
    full_name = Column(String(255)) # ФИО пациента
    contact_phone = Column(String(50)) # Телефон пациента (опционально)
    contact_address = Column(String(255)) # Адрес пациента (опционально)
    district = Column(String(255)) # Район пациента (опционально)
    medical_info = Column(Text) # Медицинская информация пациента (опционально)
    # TODO: Добавить поля для истории консультаций и платежей (связи с другими моделями)


    # Отношение к пользователю (обратная связь)
    user = relationship("User", back_populates="patient_profile")


# Модель профиля Врача
class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False) # Связь с таблицей users с CASCADE удалением

    # Поля профиля врача (по ТЗ)
    full_name = Column(String(255)) # ФИО врача
    specialization = Column(String(255), nullable=False) # Специализация (обязательно)
    experience = Column(String(255)) # Опыт работы (например, "5 лет")
    education = Column(Text) # Образование (может быть длинным описанием)
    cost_per_consultation = Column(Integer, nullable=False) # Стоимость консультации в минимальных единицах (например, копейках), Integer лучше для денег
    practice_areas = Column(String(511)) # Районы практики (можно хранить как строку)
    district = Column(String(255)) # Основной район практики (указанный при регистрации)
    is_verified = Column(Boolean, default=False) # Статус верификации Администратором
    is_active = Column(Boolean, default=True) # Статус активности врача (доступен ли для консультаций)

    # TODO: Добавить связи с моделями Отзывов, Консультаций, Расписания

    # Отношение к пользователю (обратная связь)
    user = relationship("User", back_populates="doctor_profile")


# Модель заявки на получение роли врача
class DoctorApplication(Base):
    __tablename__ = "doctor_applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False) # Связь с таблицей users
    
    # Основная информация заявки
    full_name = Column(String(255), nullable=False) # ФИО врача
    specialization = Column(String(255), nullable=False) # Специализация
    experience = Column(String(255), nullable=False) # Опыт работы
    education = Column(Text, nullable=False) # Образование (вуз, год окончания)
    license_number = Column(String(255), nullable=False) # Номер лицензии/сертификата
    
    # Документы и фото
    photo_path = Column(String(512), nullable=True) # Путь к фото врача
    diploma_path = Column(String(512), nullable=True) # Путь к скану диплома
    license_path = Column(String(512), nullable=True) # Путь к скану лицензии
    
    # Дополнительная информация
    additional_info = Column(Text, nullable=True) # Дополнительная информация
    
    # Статус заявки
    status = Column(String(50), default="pending") # Статус: pending, approved, rejected
    admin_comment = Column(Text, nullable=True) # Комментарий администратора (особенно при отклонении)
    
    # Даты создания и обработки заявки
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True) # Дата обработки заявки
    
    # Отношение к пользователю (обратная связь)
    user = relationship("User", back_populates="doctor_applications")


# TODO: Определить модели для других сущностей:
# class Consultation(Base): ...
# class Message(Base): ...
# class Review(Base): ...


# --- Вспомогательная функция для получения сессии ---
# Эту функцию мы будем использовать в FastAPI для получения сессии БД через зависимость
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()