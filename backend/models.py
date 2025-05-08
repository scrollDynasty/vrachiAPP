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
    
    # Роль пользователя: patient (пациент), doctor (врач), admin (администратор)
    role = Column(String(50), nullable=False, default="patient")
    
    # Активен ли пользователь (например, после подтверждения email)
    is_active = Column(Boolean, default=True)
    
    # Время создания аккаунта
    created_at = Column(DateTime, default=datetime.utcnow)
    # Время последнего обновления
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # OAuth провайдер (google, facebook, null для обычной регистрации)
    auth_provider = Column(String(50), nullable=True)
    # Идентификатор пользователя в системе провайдера
    auth_provider_id = Column(String(255), nullable=True)
    
    # Поле для аватарки пользователя
    avatar_path = Column(String(255), nullable=True)  # Путь к файлу аватарки
    
    # Отношения с другими таблицами
    patient_profile = relationship("PatientProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    doctor_profile = relationship("DoctorProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    
    # Отношение к заявкам на роль врача
    doctor_applications = relationship("DoctorApplication", back_populates="user", cascade="all, delete-orphan")
    
    # Отношение к просмотренным уведомлениям
    viewed_notifications = relationship("ViewedNotification", back_populates="user", cascade="all, delete-orphan")
    
    # Отношение к настройкам уведомлений
    notification_settings = relationship("UserNotificationSettings", backref="user_ref", uselist=False, cascade="all, delete-orphan")


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


# Модель для хранения настроек уведомлений пользователя
class UserNotificationSettings(Base):
    __tablename__ = "user_notification_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    email_notifications = Column(Boolean, default=True) # Уведомления по email
    push_notifications = Column(Boolean, default=True) # Push-уведомления в браузере
    appointment_reminders = Column(Boolean, default=True) # Напоминания о консультациях
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Отношение к пользователю
    # Это отношение удаляем, так как оно определено в модели User с cascade
    # user = relationship("User", backref="notification_settings_rel")


# Модель для хранения информации о просмотренных уведомлениях
class ViewedNotification(Base):
    __tablename__ = "viewed_notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    application_id = Column(Integer, ForeignKey("doctor_applications.id", ondelete="CASCADE"), nullable=False)
    viewed_at = Column(DateTime, default=datetime.utcnow)

    # Отношения
    user = relationship("User", back_populates="viewed_notifications")
    application = relationship("DoctorApplication")


# Модель для консультаций между пациентом и врачом
class Consultation(Base):
    __tablename__ = "consultations"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Статус консультации
    status = Column(String(50), default="pending") # pending, active, completed, cancelled
    
    # Даты создания и завершения
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True) # Когда начата
    completed_at = Column(DateTime, nullable=True) # Когда завершена
    
    # Лимит и счетчик сообщений
    message_limit = Column(Integer, default=30) # 30 сообщений по умолчанию
    message_count = Column(Integer, default=0) # Текущее количество сообщений
    
    # Сопроводительное письмо от пациента
    patient_note = Column(Text, nullable=True) # Сопроводительное письмо от пациента
    
    # Отношения
    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("User", foreign_keys=[doctor_id])
    messages = relationship("Message", back_populates="consultation", cascade="all, delete-orphan")
    review = relationship("Review", back_populates="consultation", uselist=False)


# Модель для сообщений в чате
class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    consultation_id = Column(Integer, ForeignKey("consultations.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Текст сообщения
    content = Column(Text, nullable=False)
    
    # Дата отправки
    sent_at = Column(DateTime, default=datetime.utcnow)
    is_read = Column(Boolean, default=False) # Прочитано ли сообщение
    
    # Отношения
    consultation = relationship("Consultation", back_populates="messages")
    sender = relationship("User")


# Модель для отзывов о консультации
class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    consultation_id = Column(Integer, ForeignKey("consultations.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    # Оценка (от 1 до 5)
    rating = Column(Integer, nullable=False)
    
    # Текст отзыва
    comment = Column(Text, nullable=True)
    
    # Дата создания
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Отношение к консультации
    consultation = relationship("Consultation", back_populates="review")


# Модель для уведомлений пользователей
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Заголовок и содержание уведомления
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    
    # Тип уведомления: system, consultation, review, etc.
    type = Column(String(50), default="system")
    
    # Прочитано ли уведомление
    is_viewed = Column(Boolean, default=False)
    
    # Ссылка на связанный объект (опционально)
    related_id = Column(Integer, nullable=True)
    
    # Дата создания
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Отношение к пользователю
    user = relationship("User")


# Модель для ожидающих подтверждения пользователей (до активации)
class PendingUser(Base):
    __tablename__ = "pending_users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="patient")
    
    # Данные профиля
    full_name = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    district = Column(String(255), nullable=True)
    contact_address = Column(String(255), nullable=True)
    medical_info = Column(Text, nullable=True)
    
    # Токен для подтверждения
    verification_token = Column(String(255), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Время жизни токена - 24 часа
    expires_at = Column(DateTime, nullable=False)


# TODO: Определить модели для других сущностей:


# --- Вспомогательная функция для получения сессии ---
# Эту функцию мы будем использовать в FastAPI для получения сессии БД через зависимость
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()