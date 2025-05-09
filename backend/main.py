# backend/main.py
import os
import uuid  # Импортируем uuid для генерации токенов
import shutil  # Добавляем для работы с файлами
from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    status,
    APIRouter,
    BackgroundTasks,
    Query,
    File,
    UploadFile,
    Form,
    WebSocket,
    WebSocketDisconnect,
    Header,
    Request,
)  # Добавляем WebSocket и WebSocketDisconnect
from fastapi.security import (
    OAuth2PasswordRequestForm,
    OAuth2PasswordBearer,
)  # Добавляем OAuth2PasswordRequestForm и OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Annotated, List, Optional, Union, Dict, Any
from datetime import timedelta, datetime  # Импортируем timedelta и datetime
from fastapi.middleware.cors import CORSMiddleware
import smtplib  # Для SMTP-соединения
from email.mime.text import MIMEText  # Для создания email
from email.mime.multipart import MIMEMultipart  # Для создания составных email
from math import ceil
from pydantic import BaseModel, ValidationError  # Для моделей данных и валидации
from fastapi.staticfiles import StaticFiles  # Для раздачи статических файлов
import secrets
import time
import jwt as pyjwt  # Импортируем PyJWT как pyjwt
import asyncio  # Добавляем для асинхронного кода
from starlette.websockets import WebSocketState  # Импортируем WebSocketState из starlette

# Импортируем наши модели и функцию для получения сессии БД
from models import (
    User,
    PatientProfile,
    DoctorProfile,
    get_db,
    DATABASE_URL,
    engine,
    Base,
    DoctorApplication,
    SessionLocal,
    ViewedNotification,
    Consultation,
    Message,
    Review,
    UserNotificationSettings,
    PendingUser,
    Notification,
    WebSocketToken,  # Добавляем импорт новой модели
)  # Добавляем PendingUser и Notification

# Импортируем функции для работы с паролями и JWT, а также зависимости для аутентификации и ролей
# get_current_user и require_role используются как зависимости в эндпоинтах
from auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    SECRET_KEY,
    ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    get_current_user,
    require_role,
    authenticate_user,
    get_current_active_user,
    SECURE_TOKEN_LENGTH,
    Token as TokenModel,
    verify_google_token,
    authenticate_google_user,
    create_csrf_token,
    verify_csrf_token,
    check_login_attempts,
    LOGIN_ATTEMPTS,
    increment_login_attempts,
    reset_login_attempts,
)

# Импортируем pydantic модели для валидации данных запросов и ответов
from schemas import (
    UserCreate,
    UserResponse,
    Token,
    PatientProfileCreateUpdate,
    PatientProfileResponse,
    DoctorProfileCreateUpdate,
    DoctorProfileResponse,
    Field,
    DoctorFilter,
    DoctorBrief,
    DoctorDetail,
    DoctorListResponse,
    DoctorApplicationCreate,
    DoctorApplicationResponse,
    DoctorApplicationProcessRequest,
    DoctorApplicationListResponse,
)  # Импортируем Field (хотя он нужен только в schemas.py), DoctorFilter, DoctorBrief, DoctorDetail, DoctorListResponse

from dotenv import load_dotenv

load_dotenv()

# Создаем директорию для загрузки файлов, если она еще не существует
UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# Создаем поддиректории для разных типов файлов
PHOTO_DIR = os.path.join(UPLOAD_DIR, "photos")
DIPLOMA_DIR = os.path.join(UPLOAD_DIR, "diplomas")
LICENSE_DIR = os.path.join(UPLOAD_DIR, "licenses")

# Создаем директории, если они еще не существуют
for directory in [PHOTO_DIR, DIPLOMA_DIR, LICENSE_DIR]:
    if not os.path.exists(directory):
        os.makedirs(directory)


# Определяем базовый URL для подтверждения email (адрес страницы фронтенда, куда пользователь перейдет по ссылке из письма)
# В реальном проекте это должна быть переменная окружения, читаемая из .env!
VERIFICATION_BASE_URL = os.getenv(
    "VERIFICATION_BASE_URL", "http://localhost:5173/verify-email"
)  # <-- TODO: Замени на актуальный URL твоего фронтенда!

# Email конфигурация
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USERNAME = os.getenv("EMAIL_USERNAME", "your_email@gmail.com")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "your_app_password")
EMAIL_FROM = os.getenv("EMAIL_FROM", "your_email@gmail.com")


# Создаем таблицы в БД при старте приложения.
# Это удобно для разработки, чтобы не запускать 'alembic upgrade head' каждый раз при локальном старте.
# В продакшене лучше использовать только миграции (убрать этот вызов).
if DATABASE_URL is None:
    # Проверка на наличие DATABASE_URL происходит при импорте models.py, но дублируем на всякий случай.
    raise ValueError("DATABASE_URL environment variable is not set.")
try:
    # Попытка создать таблицы. Если они уже есть, SQLAlchemy просто проигнорирует это.
    # Может выбросить исключение, если нет соединения с БД.
    Base.metadata.create_all(bind=engine)
except Exception as e:
    # Логируем ошибку, если не удалось подключиться к БД при старте (например, БД не запущена).
    # Это полезно для отладки.
    print(f"Error creating database tables: {e}")
    # Можно также решить, стоит ли останавливать приложение, если БД недоступна при старте.
    # Для разработки можно просто вывести ошибку, для продакшена, возможно, лучше остановить.

# Создаем администратора при первом запуске приложения (если его еще нет)
try:
    with SessionLocal() as db:
        admin_exists = db.query(User).filter(User.role == "admin").first()
        if not admin_exists:
            # Создаем первого админа с дефолтным логином и паролем
            admin_password = get_password_hash("admin")
            admin_user = User(
                email="admin@medcare.com",
                hashed_password=admin_password,
                is_active=True,
                role="admin",
            )
            db.add(admin_user)
            db.commit()
            print("Администратор по умолчанию создан: admin@medcare.com / admin")
except Exception as e:
    print(f"Error creating default admin: {e}")


app = FastAPI()  # Создаем экземпляр FastAPI приложения
origins = [
    "http://localhost",  # Разрешаем доступ с localhost (обычно для статики)
    "http://localhost:5173",  # <--- РАЗРЕШАЕМ ДОСТУП С НАШЕГО ФРОНТЕНДА НА VITE!
    "http://127.0.0.1",  # Разрешаем доступ с 127.0.0.1 (аналог localhost)
    "http://127.0.0.1:5173",  # <--- РАЗРЕШАЕМ ДОСТУП С НАШЕГО ФРОНТЕНДА НА VITE (через 127.0.0.1)!
    # TODO: Добавить другие источники, если фронтенд будет доступен по другому адресу или порту
    # TODO: В продакшене здесь должен быть домен твоего сайта!
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Список разрешенных источников
    allow_credentials=True,  # Разрешаем использование cookie и учетных данных в запросах (например, для будущих сессий, хотя сейчас используем JWT)
    allow_methods=["*"],  # Разрешаем все HTTP методы (GET, POST, PUT, DELETE и т.д.)
    allow_headers=["*"],  # Разрешаем все заголовки в запросах (включая Authorization)
)

# Монтируем StaticFiles для доступа к загруженным файлам
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Dependency для получения сессии базы данных. Используется в роутах для взаимодействия с БД.
# Annotated - современный способ указания типа и зависимости.
DbDependency = Annotated[Session, Depends(get_db)]

# Dependency для получения текущего авторизованного пользователя. Используется в защищенных роутах.
CurrentUser = Annotated[User, Depends(get_current_user)]


# --- Функция для отправки письма с помощью SMTP ---
def send_verification_email(email: str, token: str):
    """
    Отправляет email с ссылкой для подтверждения почты.

    Args:
        email (str): Email пользователя
        token (str): Токен для подтверждения

    Note:
        В продакшене данная функция должна использовать реальный SMTP сервер.
    """
    # Формируем ссылку для подтверждения
    verification_link = f"{VERIFICATION_BASE_URL}?token={token}"

    try:
        # Создаем объект сообщения
        msg = MIMEMultipart()
        msg["From"] = EMAIL_FROM
        msg["To"] = email
        msg["Subject"] = "Подтверждение регистрации в MedCare"

        # Создаем HTML-тело письма
        html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.5;">
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; border: 1px solid #e9ecef;">
                    <h2 style="color: #3b82f6; margin-bottom: 20px;">Подтверждение регистрации</h2>
                    <p>Спасибо за регистрацию в системе MedCare!</p>
                    <p>Для активации аккаунта, пожалуйста, перейдите по ссылке:</p>
                    <p style="margin: 30px 0;">
                        <a href="{verification_link}" 
                           style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                            Подтвердить email
                        </a>
                    </p>
                    <p>Если вы не регистрировались на нашем сайте, просто проигнорируйте это письмо.</p>
                    <p>С уважением,<br>Команда MedCare</p>
                </div>
            </body>
        </html>
        """

        # Добавляем HTML-часть к сообщению
        msg.attach(MIMEText(html, "html"))

        # Устанавливаем соединение с SMTP-сервером
        print(f"Trying to connect to SMTP server: {EMAIL_HOST}:{EMAIL_PORT}")
        server = smtplib.SMTP(EMAIL_HOST, EMAIL_PORT)
        server.starttls()  # Включаем шифрование

        # Авторизуемся на сервере
        print(f"Logging in to SMTP server with username: {EMAIL_USERNAME}")
        server.login(EMAIL_USERNAME, EMAIL_PASSWORD)

        # Отправляем письмо
        print(f"Sending email to: {email}")
        server.send_message(msg)

        # Закрываем соединение
        server.quit()

        print(f"Verification email successfully sent to: {email}")
        print(f"Link: {verification_link}")

    except Exception as e:
        # В случае ошибки отправки, выводим ошибку в консоль
        print(f"Error sending email: {str(e)}")
        print(f"SMTP settings: Host={EMAIL_HOST}, Port={EMAIL_PORT}, Username={EMAIL_USERNAME}")
        print(f"Make sure your email provider allows app passwords or less secure apps")

        # Выводим ссылку в консоль (как запасной вариант)
        print(f"\n--- EMAIL VERIFICATION FAILED, SHOWING LINK ---")
        print(f"To: {email}")
        print(f"Subject: Confirm your email address")
        print(f"Link: {verification_link}")
        print(f"--------------------------------------------\n")


# --- Роуты для базовых пользователей и аутентификации ---


# Эндпоинт для тестовой проверки статуса сервера. Не требует авторизации.
@app.get("/status")
def get_status():
    """
    Возвращает статус работы бэкенда.
    """
    return {"status": "Backend is running"}


# Эндпоинт для регистрации нового пользователя. Не требует авторизации.
@app.post(
    "/register", response_model=Token, status_code=status.HTTP_201_CREATED
)  # Изменяем ответ на Token вместо UserResponse
def register_user(
    user: UserCreate,  # Pydantic модель для валидации входных данных запроса
    db: DbDependency,  # Зависимость для получения сессии БД
    background_tasks: BackgroundTasks,  # Зависимость для выполнения задач в фоновом режиме (например, отправки письма)
):
    """
    Регистрация нового пользователя (Пациента, Врача или Администратора).
    Данные регистрации сохраняются во временной таблице pending_users.
    Пользователь будет создан только после подтверждения email.
    """
    try:
        print(f"Received registration request for email: {user.email}, role: {user.role}")
        
        # Проверяем, существует ли пользователь с таким email в базе данных
        db_user = db.query(User).filter(User.email == user.email).first()
        if db_user:
            # Проверяем, через какой провайдер был зарегистрирован пользователь
            if db_user.auth_provider == "google":
                print(f"User {user.email} already registered with Google")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Этот email уже зарегистрирован через Google. Пожалуйста, используйте вход через Google.",
                )
            else:
                print(f"User {user.email} already registered with email")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Этот email уже зарегистрирован. Пожалуйста, войдите или используйте восстановление пароля.",
                )
        
        # Проверяем, существует ли неподтвержденная регистрация с таким email
        pending_user = db.query(PendingUser).filter(PendingUser.email == user.email).first()
        if pending_user:
            # Если есть неподтвержденная регистрация, и она не истекла, возвращаем ошибку
            current_time = datetime.utcnow()
            if pending_user.expires_at > current_time:
                print(f"Pending registration found for {user.email}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Регистрация с этим email уже начата. Пожалуйста, подтвердите вашу почту или запросите повторную отправку письма."
                )
            else:
                # Если регистрация истекла, удаляем ее
                db.delete(pending_user)
                db.commit()
                print(f"Expired pending registration removed for {user.email}")
        
        # Проверяем, не занят ли телефон другим пользователем (если указан)
        if user.contact_phone:
            # Проверяем в таблице активных пользователей
            existing_phone_profile = (
                db.query(PatientProfile)
                .filter(PatientProfile.contact_phone == user.contact_phone)
                .first()
            )
            if existing_phone_profile:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Этот номер телефона уже зарегистрирован в системе."
                )
            
            # Проверяем в таблице ожидающих подтверждения
            existing_pending_with_phone = (
                db.query(PendingUser)
                .filter(PendingUser.contact_phone == user.contact_phone)
                .first()
            )
            if existing_pending_with_phone:
                # Проверяем, не истекла ли регистрация
                current_time = datetime.utcnow()
                if existing_pending_with_phone.expires_at > current_time:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Этот номер телефона уже используется в другой регистрации."
                    )
                else:
                    # Если регистрация истекла, удаляем ее
                    db.delete(existing_pending_with_phone)
                    db.commit()

        # Хешируем пароль перед сохранением в базе данных
        hashed_password = get_password_hash(user.password)

        # Проверяем сложность пароля
        if len(user.password) < 8:
            print(f"Password too short for {user.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пароль должен содержать минимум 8 символов",
            )

        # Проверяем, что указана допустимая роль
        if user.role not in ["patient", "doctor"]:
            print(f"Invalid role specified: {user.role}")
            # Устанавливаем роль "patient" по умолчанию
            user.role = "patient"
            print(f"Defaulting to patient role for {user.email}")

        # Генерируем уникальный токен подтверждения email
        verification_token = str(uuid.uuid4())
        
        # Вычисляем время истечения токена (24 часа)
        token_created_at = datetime.utcnow()
        token_expires_at = token_created_at + timedelta(hours=24)

        # Получаем данные для сохранения в PendingUser
        try:
            # В новых версиях Pydantic используется model_dump() вместо dict()
            user_data = user.model_dump()
        except AttributeError:
            # Для обратной совместимости со старыми версиями
            user_data = user.dict()
        
        # Создаем запись в таблице неподтвержденных пользователей
        new_pending_user = PendingUser(
            email=user.email,
            hashed_password=hashed_password,
            role=user.role,
            full_name=user_data.get("full_name", None),
            contact_phone=user_data.get("contact_phone", None),
            district=user_data.get("district", None),
            contact_address=user_data.get("contact_address", None),
            medical_info=user_data.get("medical_info", None),
            verification_token=verification_token,
            expires_at=token_expires_at
        )
        
        db.add(new_pending_user)
        db.commit()
        db.refresh(new_pending_user)
        
        print(f"Pending registration created for {user.email} with role: {user.role}")
        
        # Отправляем письмо с подтверждением email в фоновом режиме
        print(f"Adding background task to send verification email to {user.email}")
        background_tasks.add_task(
            send_verification_email, user.email, verification_token
        )
        
        # Возвращаем ответ с информацией о необходимости подтверждения email
        # В этом случае мы не возвращаем токен доступа, так как пользователь еще не создан
        print(f"Registration process started for {user.email}, email verification required")
        return {
            "access_token": "",  # Пустой токен, так как пользователь еще не создан
            "token_type": "bearer",
            "email_verification_required": True  # Флаг для фронтенда
        }
        
    except ValidationError as e:
        print(f"Validation error during registration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Ошибка валидации: {str(e)}"
        )
    except HTTPException as e:
        print(f"HTTP error during registration: {e.status_code} - {e.detail}")
        raise e
    except Exception as e:
        print(f"Unexpected error during registration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Произошла непредвиденная ошибка при регистрации. Пожалуйста, попробуйте позже."
        )


# Эндпоинт для авторизации (получения JWT токена). Не требует авторизации, но проверяет учетные данные.
# Используем стандартную форму OAuth2 Password Request Form (email/password).
@app.post(
    "/token", response_model=Token
)  # response_model=Token указывает, что в ответ ожидается Pydantic модель Token
async def login_for_access_token(
    form_data: Annotated[
        OAuth2PasswordRequestForm, Depends()
    ],  # Зависимость для получения стандартной формы email/password
    db: DbDependency,  # Зависимость для получения сессии БД
):
    """
    Аутентификация пользователя и получение JWT токена доступа.
    Используется стандартный OAuth2 формат для username/password (где username - это email).
    """
    try:
        # Rate limiting отключен, проверку check_login_attempts не выполняем
        
        # Проверяем, существует ли пользователь 
        db_user = db.query(User).filter(User.email == form_data.username).first()
        
        # Если пользователь не найден, возвращаем общую ошибку аутентификации
        if not db_user:
            # Не увеличиваем счетчик неудачных попыток
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный логин или пароль. Пожалуйста, проверьте введенные данные.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Проверяем правильность пароля
        if not verify_password(form_data.password, db_user.hashed_password):
            # Пользователь найден, но пароль неверный
            # Не увеличиваем счетчик неудачных попыток
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный логин или пароль. Пожалуйста, проверьте введенные данные.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Проверяем, что пользователь активен
        if not db_user.is_active:
            # Не увеличиваем счетчик неудачных попыток, это не ошибка входа
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Учетная запись не активирована. Пожалуйста, подтвердите свой email.",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        # Если у пользователя установлен auth_provider и это не "email", даем подсказку
        if db_user.auth_provider and db_user.auth_provider != "email":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"This account was registered with {db_user.auth_provider}. Please use {db_user.auth_provider} login instead.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Создаем WebSocket токен для пользователя при успешном входе
        websocket_token = await create_websocket_token(db_user.id, db)
        print(f"Login: Created WebSocket token for user {db_user.id}: {websocket_token[:10]}...")
            
        # Успешная аутентификация. Сбрасываем счетчик неудачных попыток (отключено)
        # reset_login_attempts(form_data.username)
        
        # Создаем JWT токен доступа с данными пользователя
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": db_user.email, "role": db_user.role},
            expires_delta=access_token_expires
        )
        
        # Проверяем, есть ли у пользователя профиль
        has_profile = False
        if db_user.role == "patient":
            profile = db.query(PatientProfile).filter(PatientProfile.user_id == db_user.id).first()
            has_profile = profile is not None
        elif db_user.role == "doctor":
            profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == db_user.id).first()
            has_profile = profile is not None
        
        # Возвращаем токен доступа
        print(f"Login successful for {db_user.email}")
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "need_profile": not has_profile,  # Если профиля нет, клиент должен перейти к созданию профиля
        }
        
    except HTTPException as e:
        # Пробрасываем исключение дальше
        raise e
    except Exception as e:
        # Логируем ошибку и возвращаем общее сообщение об ошибке
        print(f"Unexpected error during login: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Произошла непредвиденная ошибка. Пожалуйста, попробуйте позже."
        )


@app.get(
    "/users/me", response_model=UserResponse
)  # response_model=UserResponse для форматирования ответа
# Используем зависимость CurrentUser, которая сама использует get_current_user для проверки токена.
def read_users_me(current_user: CurrentUser):
    """
    Получить информацию о текущем авторизованном пользователе.
    Доступно для всех авторизованных пользователей.
    """
    # Если get_current_user успешно выполнился, current_user содержит объект SQLAlchemy модели User.
    # Возвращаем этот объект. Pydantic UserResponse с from_attributes=True преобразует его в JSON.
    return current_user


# --- НОВЫЙ ЭНДПОИНТ ДЛЯ ПОДТВЕРЖДЕНИЯ EMAIL ---
# Доступен по ссылке из письма, не требует авторизации.
@app.get("/verify-email", response_model=Token)
def verify_email(
    token: str, db: DbDependency
):  # Принимает токен как параметр запроса (?token=...)
    """
    Подтверждение email по токену из письма.
    Создает пользователя из данных в таблице pending_users.
    Возвращает JWT токен для автоматического входа.
    """
    # Ищем пользователя в базе данных по предоставленному токену подтверждения email
    pending_user = db.query(PendingUser).filter(PendingUser.verification_token == token).first()

    if pending_user is None:
        # Проверяем, возможно пользователь уже подтвердил email
        # Токен мог быть уже использован, проверяем по email
        existing_user = db.query(User).filter(User.email == pending_user.email).first() if pending_user else None
        
        if existing_user and existing_user.is_active:
            # Если пользователь уже существует и активен, значит email уже подтвержден
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email уже подтвержден. Вы можете войти в систему."
            )
        else:
            # Если токен не найден в базе данных
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Недействительный токен подтверждения или время его действия истекло."
            )

    # Проверяем, не истек ли срок действия токена
    current_time = datetime.utcnow()
    if current_time > pending_user.expires_at:
        # Удаляем просроченную запись
        db.delete(pending_user)
        db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Срок действия токена истек. Пожалуйста, запросите повторную отправку письма для подтверждения."
        )

    # Проверяем, не существует ли уже пользователь с таким email
    existing_user = db.query(User).filter(User.email == pending_user.email).first()
    if existing_user:
        # Если пользователь уже существует, удаляем pending_user
        db.delete(pending_user)
        db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже существует."
        )

    # Создаем нового пользователя на основе данных из pending_user
    new_user = User(
        email=pending_user.email,
        hashed_password=pending_user.hashed_password,
        is_active=True,  # Пользователь сразу активный, т.к. email подтвержден
        role=pending_user.role,
        auth_provider="email"
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    print(f"User {new_user.email} created with ID: {new_user.id} and role: {new_user.role}")

    # Если это пациент, создаем профиль пациента
    if pending_user.role == "patient":
        # Проверяем, есть ли данные для профиля
        has_profile_data = any([
            pending_user.full_name,
            pending_user.contact_phone,
            pending_user.district,
            pending_user.contact_address,
            pending_user.medical_info
        ])
        
        if has_profile_data:
            print(f"Creating patient profile for user {new_user.id}")
            patient_profile = PatientProfile(
                user_id=new_user.id,
                full_name=pending_user.full_name,
                contact_phone=pending_user.contact_phone,
                district=pending_user.district,
                contact_address=pending_user.contact_address,
                medical_info=pending_user.medical_info
            )
            db.add(patient_profile)
            db.commit()
            print(f"Patient profile created for user {new_user.id}")

    # Удаляем запись из таблицы pending_users
    db.delete(pending_user)
    db.commit()

    # Создаем WebSocket токен для нового пользователя
    websocket_token = asyncio.run(create_websocket_token(new_user.id, db))
    print(f"WebSocket token created for user {new_user.id}: {websocket_token[:10]}...")

    # Создаем и возвращаем JWT токен для автоматического входа
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": new_user.email, "role": new_user.role},
        expires_delta=access_token_expires
    )
    
    print(f"Email verification successful for {new_user.email}")
    return {"access_token": access_token, "token_type": "bearer"}


# Эндпоинт для создания или обновления профиля Пациента. Требует авторизацию и роли 'patient'.
@app.post(
    "/patients/profiles",
    response_model=PatientProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_patient_profile(
    profile_data: PatientProfileCreateUpdate,  # Данные профиля из запроса (Pydantic модель)
    db: DbDependency,  # Зависимость для сессии БД
    # Зависимость для получения текущего пользователя и проверки его роли.
    # Только пользователь с ролью 'patient' сможет успешно пройти эту зависимость.
    current_user: Annotated[User, Depends(require_role("patient"))],
):
    """
    Создать или обновить профиль Пациента для текущего авторизованного пользователя.
    Доступно только для пользователей с ролью 'patient'.
    """
    # Проверяем, существует ли профиль пациента для текущего пользователя (по user_id, связанному с current_user.id)
    db_profile = (
        db.query(PatientProfile)
        .filter(PatientProfile.user_id == current_user.id)
        .first()
    )

    if db_profile:
        # Если профиль уже есть, обновляем его поля на основе данных из запроса.
        # profile_data.model_dump(exclude_unset=True) создает словарь из Pydantic модели,
        # исключая поля, которые не были явно указаны в запросе (None поля включаются, если они указаны).
        for key, value in profile_data.model_dump(exclude_unset=True).items():
            # Обновляем атрибуты объекта SQLAlchemy db_profile
            setattr(db_profile, key, value)
        db.commit()  # Сохраняем изменения в БД
        db.refresh(db_profile)  # Обновляем объект из БД
        return db_profile  # Возвращаем обновленный профиль
    else:
        # Если профиля нет, создаем новый объект PatientProfile
        new_profile = PatientProfile(
            user_id=current_user.id,  # Связываем профиль с текущим пользователем
            **profile_data.model_dump(),  # Распаковываем данные из Pydantic модели PatientProfileCreateUpdate в аргументы конструктора PatientProfile
        )
        db.add(new_profile)  # Добавляем новый профиль в сессию
        db.commit()  # Сохраняем в БД
        db.refresh(new_profile)  # Обновляем объект
        return new_profile  # Возвращаем созданный профиль


# Эндпоинт для создания или обновления профиля Врача. Требует авторизацию и роли 'doctor'.
@app.post(
    "/doctors/profiles",
    response_model=DoctorProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_doctor_profile(
    profile_data: DoctorProfileCreateUpdate,  # Данные профиля из запроса
    db: DbDependency,  # Сессия БД
    current_user: Annotated[
        User, Depends(require_role("doctor"))
    ],  # Требуем роль 'doctor'
):
    """
    Создать или обновить профиль Врача для текущего авторизованного пользователя.
    Доступно только для пользователей с ролью 'doctor'.
    """
    # Проверяем, существует ли профиль врача для текущего пользователя
    db_profile = (
        db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    )

    if db_profile:
        # Если профиль уже есть, обновляем его
        for key, value in profile_data.model_dump(exclude_unset=True).items():
            # Если врач пытается изменить статус is_active, проверяем, что врач верифицирован
            if key == "is_active" and value is not None:
                # Если врач не верифицирован, он не может активировать свой профиль
                if not db_profile.is_verified and value == True:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Активировать профиль может только верифицированный врач",
                    )
                # Обновляем is_active только для верифицированных врачей или при деактивации
                if db_profile.is_verified or value == False:
                    setattr(db_profile, key, value)
            else:
                # Обновляем остальные поля без ограничений
                setattr(db_profile, key, value)
        db.commit()
        db.refresh(db_profile)
        return db_profile
    else:
        # Если профиля нет, создаем новый
        # Не позволяем создавать профиль со статусом is_active=True, пока не верифицирован
        new_profile_data = profile_data.model_dump()
        if "is_active" in new_profile_data and new_profile_data["is_active"] == True:
            new_profile_data["is_active"] = False  # По умолчанию профиль неактивен

        new_profile = DoctorProfile(user_id=current_user.id, **new_profile_data)
        db.add(new_profile)
        db.commit()
        db.refresh(new_profile)
        return new_profile


# Эндпоинт для получения профиля текущего авторизованного пользователя (Пациента или Врача). Требует авторизацию.
# response_model=Annotated[PatientProfileResponse | DoctorProfileResponse, ...] указывает, что эндпоинт может вернуть одну из двух Pydantic моделей.
@app.get(
    "/users/me/profile",
    response_model=Annotated[PatientProfileResponse | DoctorProfileResponse, ...],
)
def read_my_profile(
    db: DbDependency, current_user: CurrentUser
):  # Требует просто авторизации
    """
    Получить профиль текущего авторизованного пользователя (Пациента или Врача).
    Доступно для всех авторизованных пользователей с ролью 'patient' или 'doctor'.
    """
    # Проверяем роль текущего пользователя и ищем соответствующий профиль.
    if current_user.role == "patient":
        profile = (
            db.query(PatientProfile)
            .filter(PatientProfile.user_id == current_user.id)
            .first()
        )
        if profile is None:
            # Если профиль пациента не найден (хотя пользователь есть и роль 'patient')
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient profile not found",
            )
        # Возвращаем объект SQLAlchemy профиля пациента. FastAPI/Pydantic преобразует его в PatientProfileResponse.
        return profile
    elif current_user.role == "doctor":
        profile = (
            db.query(DoctorProfile)
            .filter(DoctorProfile.user_id == current_user.id)
            .first()
        )
        if profile is None:
            # Если профиль врача не найден
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found"
            )
        # Возвращаем объект SQLAlchemy профиля врача. FastAPI/Pydantic преобразует его в DoctorProfileResponse.
        return profile
    else:
        # Если у пользователя роль, для которой профиль не предусмотрен (например, 'admin')
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User role does not have a profile type",
        )


# Эндпоинт для получения публичного профиля Врача по ID пользователя Врача. Пока не требует авторизации.
@app.get("/doctors/{user_id}/profile", response_model=DoctorProfileResponse)
def read_doctor_profile_by_user_id(
    user_id: int, db: DbDependency
):  # Не требует авторизации (пока)
    """
    Получить публичный профиль Врача по ID пользователя Врача.
    Доступно без авторизации (пока).
    """
    # Ищем пользователя по предоставленному ID
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        # Если пользователь не найден
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Проверяем, что найденный пользователь является Врачом.
    if user.role != "doctor":
        # Если пользователь не врач, возвращаем 404 (или 400, в зависимости от того, хотим ли мы скрывать существование пользователя)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a doctor or their profile is not public",
        )

    # Ищем профиль Врача, связанный с этим пользователем.
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
    if profile is None:
        # Если профиль врача не найден (хотя пользователь есть и роль 'doctor')
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor profile not found for this user",
        )

    # Возвращаем объект SQLAlchemy профиля врача. FastAPI/Pydantic преобразует его в DoctorProfileResponse.
    return profile


# --- Эндпоинты для поиска врачей ---


# Получение списка всех врачей с опциональной фильтрацией
@app.get("/api/doctors", response_model=DoctorListResponse, tags=["doctors"])
async def get_doctors(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(
        get_current_user
    ),  # Опционально, может быть None для публичного доступа
    specialization: Optional[str] = Query(None, description="Фильтр по специализации"),
    district: Optional[str] = Query(
        None, description="Фильтр по району практики врача"
    ),
    min_price: Optional[int] = Query(None, description="Минимальная стоимость"),
    max_price: Optional[int] = Query(None, description="Максимальная стоимость"),
    page: int = Query(1, description="Номер страницы (начиная с 1)"),
    size: int = Query(10, description="Размер страницы (количество элементов)"),
):
    """
    Получение списка всех врачей с возможностью фильтрации по специализации, району практики и диапазону цен.
    Поддерживает пагинацию для большого количества результатов.
    """
    # Создаем базовый запрос на получение всех активных и верифицированных врачей
    query = db.query(DoctorProfile).filter(
        DoctorProfile.is_active == True, DoctorProfile.is_verified == True
    )

    # Применяем фильтры только если они явно указаны
    if specialization:
        # Используем точное совпадение специализации
        query = query.filter(DoctorProfile.specialization == specialization)

    if district:
        # Используем точное совпадение района
        query = query.filter(DoctorProfile.district == district)
    # Если пользователь авторизован как пациент и у него указан район, фильтруем по району
    elif current_user and current_user.role == "patient":
        patient_profile = (
            db.query(PatientProfile)
            .filter(PatientProfile.user_id == current_user.id)
            .first()
        )
        if patient_profile and patient_profile.district:
            query = query.filter(DoctorProfile.district == patient_profile.district)

    if min_price is not None:
        query = query.filter(DoctorProfile.cost_per_consultation >= min_price)

    if max_price is not None:
        query = query.filter(DoctorProfile.cost_per_consultation <= max_price)

    # Считаем общее количество записей после применения фильтров
    total = query.count()

    # Добавляем пагинацию
    pages = ceil(total / size) if total > 0 else 0

    # Проверка корректности номера страницы
    if page < 1:
        page = 1
    elif page > pages and pages > 0:
        page = pages

    # Применяем пагинацию
    offset = (page - 1) * size
    doctors = query.offset(offset).limit(size).all()

    # Формируем ответ
    return {
        "items": doctors,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages,
    }


# Модель для расширенной информации о враче
class DoctorDetailResponse(BaseModel):
    id: int
    user_id: int
    full_name: str
    specialization: str
    experience: str
    education: str
    cost_per_consultation: int
    practice_areas: str
    district: Optional[str] = None  # Делаем поле опциональным
    is_verified: bool
    is_active: bool
    rating: float = 0.0
    reviews_count: int = 0

    class Config:
        from_attributes = True


# Получение детальной информации о враче по ID
@app.get(
    "/api/doctors/{doctor_id}", response_model=DoctorDetailResponse, tags=["doctors"]
)
async def get_doctor_by_id(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(
        get_current_user
    ),  # Опционально для публичного доступа
):
    """
    Получение детальной информации о враче по ID.
    Доступно как для авторизованных, так и для неавторизованных пользователей.
    """
    doctor = db.query(DoctorProfile).filter(DoctorProfile.id == doctor_id).first()

    if not doctor:
        raise HTTPException(status_code=404, detail="Врач не найден")

    # Подготавливаем ответ
    doctor_detail = DoctorDetailResponse.model_validate(doctor)

    # Получаем средний рейтинг и количество отзывов
    # Сначала получаем все завершенные консультации этого врача
    consultation_ids = (
        db.query(Consultation.id)
        .filter(
            Consultation.doctor_id == doctor.user_id, Consultation.status == "completed"
        )
        .subquery()
    )

    # Затем получаем отзывы для этих консультаций
    reviews = (
        db.query(Review).filter(Review.consultation_id.in_(consultation_ids)).all()
    )

    # Рассчитываем средний рейтинг и количество отзывов
    if reviews:
        total_rating = sum(review.rating for review in reviews)
        doctor_detail.reviews_count = len(reviews)
        doctor_detail.rating = round(
            total_rating / len(reviews), 1
        )  # Округляем до 1 десятичной цифры

    return doctor_detail


# --- TODO: Добавить дополнительные эндпоинты (консультации, отзывы, платежи) ---


# Модель для Google OAuth запроса
class GoogleAuthRequest(BaseModel):
    code: str


# Добавляем новый маршрут для Google OAuth авторизации
@app.post("/auth/google", response_model=Token)
async def google_auth(data: GoogleAuthRequest, db: DbDependency):
    """
    Аутентификация через Google OAuth.
    Принимает код авторизации от клиента и обменивает его на данные пользователя.
    Если пользователь существует, выполняет вход, иначе регистрирует нового.
    """
    try:
        # Получаем данные пользователя от Google API
        google_user_data = await verify_google_token(data.code)
        
        # Проверяем, что получили email
        if not google_user_data.get("email"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Не удалось получить email из Google аккаунта"
            )
        
        # Ищем пользователя по email в базе данных
        user_email = google_user_data.get("email")
        db_user = db.query(User).filter(User.email == user_email).first()
        
        # Если пользователь не найден, регистрируем нового
        if not db_user:
            # Создаем нового пользователя
            # Генерируем случайный пароль, так как Google OAuth не использует пароли
            password = secrets.token_hex(16)
            hashed_password = get_password_hash(password)
            
            # Определяем имя из данных Google, если доступно
            user_name = google_user_data.get("name", "")
            
            # Создаем нового пользователя
            db_user = User(
                email=user_email,
                hashed_password=hashed_password,
                role="patient",  # По умолчанию роль "patient"
                auth_provider="google",
                is_active=True  # Пользователь сразу активен, так как подтвержден через Google
            )
            
            db.add(db_user)
            db.commit()
            db.refresh(db_user)
            
            # Создаем профиль пациента, если есть имя
            if user_name:
                patient_profile = PatientProfile(
                    user_id=db_user.id,
                    full_name=user_name
                )
                db.add(patient_profile)
            
            # Создаем настройки уведомлений для нового пользователя
            user_settings = UserNotificationSettings(
                user_id=db_user.id,
                email_notifications=True,
                push_notifications=True,
                appointment_reminders=True
            )
            db.add(user_settings)
            
            # Создаем WebSocket токен для нового пользователя
            try:
                ws_token = await create_websocket_token(db_user.id, db)
                print(f"Google Auth: Created WebSocket token for new user {db_user.id}: {ws_token[:10]}...")
            except Exception as e:
                print(f"Google Auth: Error creating WebSocket token: {str(e)}")
                # Не выбрасываем исключение, продолжаем выполнение
            
            # Создаем приветственное уведомление для нового пользователя
            welcome_notification = Notification(
                user_id=db_user.id,
                title="Добро пожаловать в систему!",
                message=f"Здравствуйте{' '+user_name if user_name else ''}! Благодарим за регистрацию в системе онлайн-консультаций vrachiAPP. Здесь вы можете найти врачей различных специальностей и получить консультацию.",
                type="system",
                is_viewed=False
            )
            db.add(welcome_notification)
            
            # Создаем уведомление с инструкциями
            help_notification = Notification(
                user_id=db_user.id,
                title="Как пользоваться системой",
                message="Для начала работы заполните свой профиль в разделе 'Мой профиль'. После этого вы сможете выбрать врача и начать консультацию.",
                type="system",
                is_viewed=False
            )
            db.add(help_notification)
            
            db.commit()
            
            print(f"Google Auth: Created new user {user_email} with ID {db_user.id}")
            print(f"Google Auth: Registration successful for {user_email}")
        else:
            # Если пользователь уже существует, проверяем auth_provider
            if db_user.auth_provider != "google":
                # Обновляем auth_provider на "google"
                db_user.auth_provider = "google"
                db.commit()
                print(f"Google Auth: Updated auth provider to Google for {user_email}")
            
            print(f"Google Auth: Login successful for {user_email}")
        
        # Создаем JWT токен для пользователя
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": db_user.email}, expires_delta=access_token_expires
        )
        
        # Проверяем наличие непрочитанных уведомлений для пользователя
        unread_notifications = db.query(Notification).filter(
            Notification.user_id == db_user.id,
            Notification.is_viewed == False
        ).count()
        
        if unread_notifications > 0:
            print(f"Google Auth: User {user_email} has {unread_notifications} unread notifications")
            
        # Проверяем, заполнен ли профиль пользователя
        has_profile = False
        if db_user.role == "patient":
            profile = db.query(PatientProfile).filter(PatientProfile.user_id == db_user.id).first()
            has_profile = profile is not None and profile.full_name is not None
        elif db_user.role == "doctor":
            profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == db_user.id).first()
            has_profile = profile is not None and profile.full_name is not None
        
        result = {
            "access_token": access_token, 
            "token_type": "bearer"
        }
        
        # Если профиль не заполнен, добавляем флаг для клиента
        if not has_profile:
            result["need_profile"] = True
            
        return result
    except HTTPException as e:
        # Логируем ошибку для отладки
        print(f"Google Auth: HTTP error - {e.status_code} {e.detail}")
        raise
    except Exception as e:
        # Логируем непредвиденную ошибку
        print(f"Google Auth: Unexpected error - {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Произошла ошибка при аутентификации через Google"
        )


# Класс для хранения данных профиля пользователя после Google регистрации
class UserProfileData(BaseModel):
    role: str = "patient"  # По умолчанию - пациент
    full_name: str
    contact_phone: Optional[str] = None
    contact_address: Optional[str] = None
    district: Optional[str] = None  # Район


# Эндпоинт для создания/обновления профиля пользователя после Google авторизации
@app.post(
    "/users/me/google-profile",
    response_model=Union[PatientProfileResponse, DoctorProfileResponse],
)
async def create_update_google_profile(
    profile_data: UserProfileData, db: DbDependency, current_user: CurrentUser
):
    """
    Создает или обновляет профиль пользователя после авторизации через Google.
    """
    # Проверяем, существует ли у пользователя профиль
    if profile_data.role == "patient":
        # Проверяем, существует ли профиль пациента
        profile = (
            db.query(PatientProfile)
            .filter(PatientProfile.user_id == current_user.id)
            .first()
        )

        if not profile:
            # Создаем новый профиль пациента
            profile = PatientProfile(
                user_id=current_user.id,
                full_name=profile_data.full_name,
                contact_phone=profile_data.contact_phone,
                contact_address=profile_data.contact_address,
            )
            db.add(profile)
        else:
            # Обновляем существующий профиль
            profile.full_name = profile_data.full_name
            if profile_data.contact_phone:
                profile.contact_phone = profile_data.contact_phone
            if profile_data.contact_address:
                profile.contact_address = profile_data.contact_address

        # Если роль пользователя отличается от указанной, обновляем её
        if current_user.role != "patient":
            current_user.role = "patient"

        db.commit()
        db.refresh(profile)
        return profile

    elif profile_data.role == "doctor":
        # Проверяем, существует ли профиль врача
        profile = (
            db.query(DoctorProfile)
            .filter(DoctorProfile.user_id == current_user.id)
            .first()
        )

        # Данные для профиля врача нужно будет запросить дополнительно
        # Здесь мы создаем только базовый профиль
        if not profile:
            profile = DoctorProfile(
                user_id=current_user.id,
                full_name=profile_data.full_name,
                specialization="Общая практика",  # Дефолтное значение
                experience="",
                education="",
                cost_per_consultation=1000,  # Дефолтное значение
                practice_areas=profile_data.district if profile_data.district else "",
            )
            db.add(profile)
        else:
            # Обновляем только имя, остальные данные нужно обновлять через другой эндпоинт
            profile.full_name = profile_data.full_name
            if profile_data.district:
                profile.practice_areas = profile_data.district

        # Если роль пользователя отличается от указанной, обновляем её
        if current_user.role != "doctor":
            current_user.role = "doctor"

        db.commit()
        db.refresh(profile)
        return profile

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role specified. Must be 'patient' or 'doctor'.",
        )


# Эндпоинт для получения списка районов Ташкента
@app.get("/api/districts", response_model=List[str])
async def get_districts():
    """Возвращает список районов Ташкента"""
    districts = [
        "Алмазарский район",
        "Бектемирский район",
        "Мирабадский район",
        "Мирзо-Улугбекский район",
        "Сергелийский район",
        "Учтепинский район",
        "Чиланзарский район",
        "Шайхантаурский район",
        "Юнусабадский район",
        "Яккасарайский район",
        "Яшнабадский район",
    ]
    return districts


@app.get("/api/specializations", response_model=List[str])
async def get_specializations():
    """Возвращает список специализаций врачей"""
    specializations = [
        "Терапевт",
        "Кардиолог",
        "Невролог",
        "Хирург",
        "Педиатр",
        "Офтальмолог",
        "Стоматолог",
        "Гинеколог",
        "Уролог",
        "Эндокринолог",
        "Дерматолог",
        "Психиатр",
        "Онколог",
        "Отоларинголог (ЛОР)",
        "Ортопед",
    ]
    return specializations


# --- Роуты для заявок на роль врача ---


# Эндпоинт для подачи заявки на роль врача
@app.post(
    "/doctor-applications",
    response_model=DoctorApplicationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_doctor_application(
    full_name: str = Form(...),
    specialization: str = Form(...),
    experience: str = Form(...),
    education: str = Form(...),
    license_number: str = Form(...),
    additional_info: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    diploma: Optional[UploadFile] = File(None),
    license_doc: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Создает новую заявку на получение роли врача.

    Args:
        form_data: Данные формы заявки
        photo: Фото врача
        diploma: Скан диплома
        license_doc: Скан лицензии
        db: Сессия базы данных
        current_user: Текущий пользователь

    Returns:
        DoctorApplicationResponse: Данные созданной заявки
    """
    # Проверяем, что пользователь не является уже врачом
    if current_user.role == "doctor":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="У вас уже есть роль врача"
        )

    # Проверяем, нет ли уже ожидающей заявки от этого пользователя
    existing_application = (
        db.query(DoctorApplication)
        .filter(
            DoctorApplication.user_id == current_user.id,
            DoctorApplication.status == "pending",
        )
        .first()
    )

    if existing_application:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="У вас уже есть ожидающая рассмотрения заявка",
        )

    # Создаем новую заявку
    new_application = DoctorApplication(
        user_id=current_user.id,
        full_name=full_name,
        specialization=specialization,
        experience=experience,
        education=education,
        license_number=license_number,
        additional_info=additional_info,
    )

    # Обрабатываем загруженные файлы
    if photo:
        file_extension = os.path.splitext(photo.filename)[1]
        filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(PHOTO_DIR, filename)

        # Сохраняем файл
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(photo.file, buffer)

        new_application.photo_path = f"/uploads/photos/{filename}"

    if diploma:
        file_extension = os.path.splitext(diploma.filename)[1]
        filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(DIPLOMA_DIR, filename)

        # Сохраняем файл
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(diploma.file, buffer)

        new_application.diploma_path = f"/uploads/diplomas/{filename}"

    if license_doc:
        file_extension = os.path.splitext(license_doc.filename)[1]
        filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(LICENSE_DIR, filename)

        # Сохраняем файл
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(license_doc.file, buffer)

        new_application.license_path = f"/uploads/licenses/{filename}"

    # Сохраняем заявку в базе данных
    db.add(new_application)
    db.commit()
    db.refresh(new_application)

    return new_application


# Эндпоинт для получения заявок на роль врача текущего пользователя
@app.get(
    "/users/me/doctor-applications", response_model=List[DoctorApplicationResponse]
)
async def get_my_doctor_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    # Параметр запроса для указания, нужно ли включать просмотренные заявки
    include_viewed: bool = Query(
        False, description="Включать уже просмотренные заявки"
    ),
):
    """
    Получает список заявок на роль врача текущего пользователя.

    Args:
        db: Сессия базы данных
        current_user: Текущий пользователь
        include_viewed: Флаг, указывающий, нужно ли включать уже просмотренные заявки

    Returns:
        List[DoctorApplicationResponse]: Список заявок
    """
    # Базовый запрос для получения заявок пользователя
    applications_query = db.query(DoctorApplication).filter(
        DoctorApplication.user_id == current_user.id
    )

    if not include_viewed:
        # Подзапрос для получения ID просмотренных заявок
        viewed_app_ids = (
            db.query(ViewedNotification.application_id)
            .filter(ViewedNotification.user_id == current_user.id)
            .subquery()
        )

        # Исключаем просмотренные заявки
        applications_query = applications_query.filter(
            ~DoctorApplication.id.in_(viewed_app_ids)
        )

    # Получаем заявки, отсортированные по дате создания
    applications = applications_query.order_by(
        DoctorApplication.created_at.desc()
    ).all()

    return applications


# Эндпоинт для получения списка всех заявок (для администраторов)
@app.get("/admin/doctor-applications", response_model=DoctorApplicationListResponse)
async def get_all_doctor_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
    status: Optional[str] = Query(
        None, description="Фильтр по статусу заявки: pending, approved, rejected"
    ),
    page: int = Query(1, description="Номер страницы", ge=1),
    size: int = Query(10, description="Размер страницы", ge=1, le=100),
):
    """
    Получает список всех заявок на роль врача (для администраторов).

    Args:
        status: Фильтр по статусу заявки
        page: Номер страницы для пагинации
        size: Размер страницы для пагинации
        db: Сессия базы данных
        current_user: Текущий пользователь (администратор)

    Returns:
        DoctorApplicationListResponse: Список заявок с пагинацией
    """
    # Создаем базовый запрос
    query = db.query(DoctorApplication)

    # Применяем фильтры, если они указаны
    if status:
        query = query.filter(DoctorApplication.status == status)

    # Получаем общее количество заявок
    total = query.count()

    # Вычисляем общее количество страниц
    pages = ceil(total / size) if total > 0 else 1

    # Применяем пагинацию
    query = query.order_by(DoctorApplication.created_at.desc())
    query = query.offset((page - 1) * size).limit(size)

    # Получаем заявки
    applications = query.all()

    # Формируем ответ
    return {
        "items": applications,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages,
    }


# Эндпоинт для обработки заявки администратором
@app.put(
    "/admin/doctor-applications/{application_id}",
    response_model=DoctorApplicationResponse,
)
async def process_doctor_application(
    application_id: int,
    application_data: DoctorApplicationProcessRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """
    Обрабатывает заявку на роль врача (одобрение или отклонение).

    Args:
        application_id: ID заявки
        application_data: Данные обработки заявки
        db: Сессия базы данных
        current_user: Текущий пользователь (администратор)

    Returns:
        DoctorApplicationResponse: Обновленные данные заявки
    """
    # Получаем заявку
    application = (
        db.query(DoctorApplication)
        .filter(DoctorApplication.id == application_id)
        .first()
    )

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Заявка не найдена"
        )

    # Проверяем, не обработана ли уже заявка
    if application.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Заявка уже обработана со статусом {application.status}",
        )

    # Обновляем статус заявки
    application.status = application_data.status
    application.admin_comment = application_data.admin_comment
    application.processed_at = datetime.utcnow()

    # Если заявка одобрена, обновляем роль пользователя на "doctor"
    if application_data.status == "approved":
        user = db.query(User).filter(User.id == application.user_id).first()
        if user:
            user.role = "doctor"

            # Получаем профиль пациента, чтобы узнать район
            patient_profile = (
                db.query(PatientProfile)
                .filter(PatientProfile.user_id == user.id)
                .first()
            )
            district = (
                patient_profile.district
                if patient_profile and patient_profile.district
                else "Яшнабадский район"
            )  # Дефолт, если не указан

            # Создаем профиль врача, если его еще нет
            doctor_profile = (
                db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
            )
            if not doctor_profile:
                doctor_profile = DoctorProfile(
                    user_id=user.id,
                    full_name=application.full_name,
                    specialization=application.specialization,
                    experience=application.experience,
                    education=application.education,
                    cost_per_consultation=1000,  # Значение по умолчанию
                    practice_areas=district,
                    district=district,  # Явно устанавливаем район
                    is_verified=True,
                    is_active=True,  # Автоматически активируем профиль
                )
                db.add(doctor_profile)
            else:
                # Обновляем существующий профиль и активируем его
                doctor_profile.full_name = application.full_name
                doctor_profile.specialization = application.specialization
                doctor_profile.experience = application.experience
                doctor_profile.education = application.education
                doctor_profile.district = district
                doctor_profile.practice_areas = district
                doctor_profile.is_verified = True
                doctor_profile.is_active = True
    elif application_data.status == "rejected":
        # Если заявка отклонена, проверяем существует ли профиль врача и деактивируем его
        user = db.query(User).filter(User.id == application.user_id).first()
        if user:
            # Если у пользователя роль "doctor", меняем на "patient"
            if user.role == "doctor":
                user.role = "patient"

            # Деактивируем профиль врача, если он существует
            doctor_profile = (
                db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
            )
            if doctor_profile:
                doctor_profile.is_active = False
                doctor_profile.is_verified = False

    db.commit()
    db.refresh(application)

    return application


# Эндпоинт для создания админа с заданным логином и паролем
@app.post("/setup_admin_m5kL9sP2q7", status_code=status.HTTP_201_CREATED)
async def create_admin_user(email: str, password: str, db: Session = Depends(get_db)):
    """
    Создает нового администратора с указанными email и паролем.
    Этот эндпоинт должен использоваться только при начальной настройке системы.
    В продакшене его следует отключить.
    """
    # Проверяем режим работы приложения - эндпоинт доступен только в режиме разработки
    ENV = os.getenv("APP_ENV", "development")
    if ENV != "development":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Этот эндпоинт доступен только в режиме разработки",
        )

    # Проверяем, есть ли уже пользователь с таким email
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Пользователь с email {email} уже существует",
        )

    # Создаем нового админа
    hashed_password = get_password_hash(password)
    admin_user = User(
        email=email, hashed_password=hashed_password, is_active=True, role="admin"
    )

    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)

    return {"message": f"Администратор {email} успешно создан"}


# Эндпоинт для получения списка всех пользователей (для админов)
@app.get("/admin/users", response_model=List[UserResponse])
async def get_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
    page: int = Query(1, description="Номер страницы", ge=1),
    size: int = Query(10, description="Размер страницы", ge=1, le=100),
):
    """
    Получает список всех пользователей (для администраторов).

    Args:
        page: Номер страницы для пагинации
        size: Размер страницы для пагинации
        db: Сессия базы данных
        current_user: Текущий пользователь (администратор)

    Returns:
        List[UserResponse]: Список пользователей
    """
    # Получаем всех пользователей с пагинацией
    users = db.query(User).order_by(User.id).offset((page - 1) * size).limit(size).all()

    return users


# Эндпоинт для получения профиля пользователя по ID (для админов)
@app.get(
    "/admin/users/{user_id}/profile",
    response_model=Union[PatientProfileResponse, DoctorProfileResponse, dict],
)
async def get_user_profile_by_id(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """
    Получает профиль любого пользователя по ID (для администраторов).

    Args:
        user_id: ID пользователя
        db: Сессия базы данных
        current_user: Текущий пользователь (администратор)

    Returns:
        Union[PatientProfileResponse, DoctorProfileResponse, dict]: Профиль пользователя
    """
    # Проверяем, существует ли пользователь
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден"
        )

    # В зависимости от роли пользователя, получаем соответствующий профиль
    if user.role == "patient":
        profile = (
            db.query(PatientProfile).filter(PatientProfile.user_id == user.id).first()
        )
        if not profile:
            return {
                "message": "Профиль пациента не найден",
                "user_role": "patient",
                "user_email": user.email,
            }
        return profile

    elif user.role == "doctor":
        profile = (
            db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
        )
        if not profile:
            return {
                "message": "Профиль врача не найден",
                "user_role": "doctor",
                "user_email": user.email,
            }
        return profile

    else:
        return {
            "message": "У данного пользователя нет профиля",
            "user_role": user.role,
            "user_email": user.email,
        }


# Модель для изменения роли пользователя
class ChangeUserRoleRequest(BaseModel):
    role: str = Field(..., description="Новая роль пользователя")


# Эндпоинт для изменения роли пользователя (для админов)
@app.put("/admin/users/{user_id}/role", response_model=UserResponse)
async def change_user_role(
    user_id: int,
    role_data: ChangeUserRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """
    Изменяет роль пользователя (для администраторов).

    Args:
        user_id: ID пользователя
        role_data: Данные с новой ролью
        db: Сессия базы данных
        current_user: Текущий пользователь (администратор)

    Returns:
        UserResponse: Обновленные данные пользователя
    """
    # Проверяем, существует ли пользователь
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден"
        )

    # Проверяем, что роль допустима
    valid_roles = ["patient", "doctor", "admin"]
    if role_data.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недопустимая роль. Допустимые роли: {', '.join(valid_roles)}",
        )

    # Проверяем текущую роль пользователя
    old_role = user.role

    # Изменяем роль пользователя
    user.role = role_data.role

    # Обрабатываем изменение роли с doctor на другую
    if old_role == "doctor" and role_data.role != "doctor":
        # Деактивируем профиль врача, но не удаляем его
        doctor_profile = (
            db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
        )
        if doctor_profile:
            doctor_profile.is_active = False
            doctor_profile.is_verified = False  # Также снимаем верификацию

    # Обрабатываем изменение роли с другой на doctor
    if old_role != "doctor" and role_data.role == "doctor":
        # Проверяем, существует ли профиль врача
        doctor_profile = (
            db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
        )

        # Получаем профиль пациента, чтобы узнать район
        patient_profile = (
            db.query(PatientProfile).filter(PatientProfile.user_id == user.id).first()
        )
        district = (
            patient_profile.district
            if patient_profile and patient_profile.district
            else "Яшнабадский район"
        )  # Дефолт, если не указан

        if doctor_profile:
            # Активируем профиль врача
            doctor_profile.is_active = True
            doctor_profile.is_verified = (
                True  # Автоматически верифицируем при назначении админом
            )

            # Обновляем район если он есть в профиле пациента
            if patient_profile and patient_profile.district:
                doctor_profile.district = district
                doctor_profile.practice_areas = district
        else:
            # Создаем профиль врача с районом из профиля пациента
            full_name = patient_profile.full_name if patient_profile else None

            doctor_profile = DoctorProfile(
                user_id=user.id,
                full_name=full_name,
                specialization="Общая практика",  # Значение по умолчанию
                cost_per_consultation=1000,  # Значение по умолчанию
                is_active=True,
                is_verified=True,  # Автоматически верифицируем при назначении админом
                district=district,
                practice_areas=district,
            )
            db.add(doctor_profile)

    db.commit()
    db.refresh(user)

    return user


# --- НОВЫЙ ЭНДПОИНТ ДЛЯ ПОВТОРНОЙ ОТПРАВКИ ПИСЬМА ПОДТВЕРЖДЕНИЯ ---
@app.post("/resend-verification")
def resend_verification_email(
    email_data: dict, db: DbDependency, background_tasks: BackgroundTasks
):
    """
    Повторная отправка письма с подтверждением email.
    Проверяет наличие неподтвержденной регистрации в таблице pending_users,
    генерирует новый токен и отправляет новое письмо с ссылкой активации.

    Args:
        email_data (dict): Словарь с email пользователя.
        db (Session): Сессия базы данных.
        background_tasks (BackgroundTasks): Объект для выполнения задач в фоновом режиме.

    Returns:
        dict: Сообщение об успешной отправке письма или ошибка.
    """
    print(f"Received request for resend verification. Data: {email_data}")
    
    try:
        email = email_data.get("email")
        if not email:
            print("Email not provided in request")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Email не указан"
            )

        # Ищем существующего активного пользователя
        user = db.query(User).filter(User.email == email).first()
        if user and user.is_active:
            print(f"User {email} is already active")
            return {"message": "Ваш email уже подтвержден. Вы можете войти в систему."}
        
        # Ищем pending_user в базе данных
        pending_user = db.query(PendingUser).filter(PendingUser.email == email).first()
        if not pending_user:
            print(f"No pending registration found for {email}")
            # Для безопасности не сообщаем, что регистрация не начата
            return {
                "message": "Если этот email зарегистрирован в системе, на него будет отправлено письмо с инструкциями."
            }

        print(f"Generating new verification token for {email}")
        
        # Генерируем новый токен для подтверждения email
        verification_token = secrets.token_urlsafe(32)
        token_expires_at = datetime.utcnow() + timedelta(hours=24)

        # Обновляем токен в базе данных
        pending_user.verification_token = verification_token
        pending_user.expires_at = token_expires_at
        db.commit()

        print(f"Token updated in database for {email}")
        
        # Отправляем письмо с подтверждением email в фоновом режиме
        background_tasks.add_task(send_verification_email, email, verification_token)
        
        print(f"Background task added to send verification email to {email}")

        return {
            "message": "Новое письмо с инструкциями для подтверждения email отправлено."
        }
    except Exception as e:
        print(f"Error in resend_verification_email: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Произошла ошибка при обработке запроса. Пожалуйста, попробуйте позже."
            )


# Модель для запроса отметки уведомления как просмотренного
class MarkNotificationRequest(BaseModel):
    application_id: int


# Эндпоинт для отметки уведомления как просмотренного
@app.post("/users/me/notifications/viewed", status_code=status.HTTP_204_NO_CONTENT)
async def mark_notification_viewed(
    request: MarkNotificationRequest, db: DbDependency, current_user: CurrentUser
):
    """
    Отмечает уведомление о заявке как просмотренное пользователем.

    Args:
        request: Данные запроса с ID заявки
        db: Сессия базы данных
        current_user: Текущий пользователь

    Returns:
        204 No Content
    """
    # Проверяем, существует ли заявка
    application = (
        db.query(DoctorApplication)
        .filter(DoctorApplication.id == request.application_id)
        .first()
    )
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Заявка не найдена"
        )

    # Проверяем, не была ли заявка уже отмечена как просмотренная
    existing_notification = (
        db.query(ViewedNotification)
        .filter(
            ViewedNotification.user_id == current_user.id,
            ViewedNotification.application_id == request.application_id,
        )
        .first()
    )

    if not existing_notification:
        # Если нет, создаем новую запись
        viewed_notification = ViewedNotification(
            user_id=current_user.id, application_id=request.application_id
        )
        db.add(viewed_notification)
        db.commit()

    # Возвращаем 204 No Content (успешно, но без тела ответа)
    return None


# --- Модели для консультаций и сообщений ---


# Модель для создания консультации
class ConsultationCreate(BaseModel):
    doctor_id: int
    patient_note: Optional[str] = None


# Модель для ответа по консультации
class ConsultationResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    status: str
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    message_limit: int
    message_count: int
    patient_note: Optional[str] = None

    class Config:
        from_attributes = True


# Модель для создания сообщения
class MessageCreate(BaseModel):
    content: str


# Модель для ответа по сообщению
class MessageResponse(BaseModel):
    id: int
    consultation_id: int
    sender_id: int
    content: str
    sent_at: datetime
    is_read: bool

    class Config:
        from_attributes = True


# Модель для создания отзыва
class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


# Модель для ответа по отзыву
class ReviewResponse(BaseModel):
    id: int
    consultation_id: int
    rating: int
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Роуты для консультаций ---


# Эндпоинт для создания новой консультации
@app.post(
    "/api/consultations", response_model=ConsultationResponse, tags=["consultations"]
)
async def create_consultation(
    consultation_data: ConsultationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("patient")),
):
    """
    Создает новую консультацию между пациентом и врачом.
    Доступно только для пациентов.
    """
    # Проверяем существование врача
    doctor = (
        db.query(User)
        .filter(User.id == consultation_data.doctor_id, User.role == "doctor")
        .first()
    )
    if not doctor:
        raise HTTPException(status_code=404, detail="Врач не найден")

    # Получаем профиль пациента
    patient_profile = (
        db.query(PatientProfile)
        .filter(PatientProfile.user_id == current_user.id)
        .first()
    )
    if not patient_profile:
        raise HTTPException(status_code=400, detail="Профиль пациента не найден")

    # Получаем профиль врача
    doctor_profile = (
        db.query(DoctorProfile)
        .filter(DoctorProfile.user_id == consultation_data.doctor_id)
        .first()
    )
    if not doctor_profile:
        raise HTTPException(status_code=400, detail="Профиль врача не найден")

    # Проверяем, находятся ли врач и пациент в одном районе
    if (
        patient_profile.district
        and doctor_profile.district
        and patient_profile.district != doctor_profile.district
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Врач находится в районе {doctor_profile.district}, а вы в районе {patient_profile.district}. Консультация возможна только с врачами вашего района.",
        )

    # Проверяем, нет ли уже активной консультации с этим врачом
    existing_consultation = (
        db.query(Consultation)
        .filter(
            Consultation.patient_id == current_user.id,
            Consultation.doctor_id == consultation_data.doctor_id,
            Consultation.status.in_(["pending", "active"]),
        )
        .first()
    )

    if existing_consultation:
        raise HTTPException(
            status_code=400, detail="У вас уже есть активная консультация с этим врачом"
        )

    # Создаем новую консультацию
    new_consultation = Consultation(
        patient_id=current_user.id,
        doctor_id=consultation_data.doctor_id,
        status="pending",
        message_limit=30,  # 30 сообщений по умолчанию
        message_count=0,  # Начинаем с 0 сообщений
        patient_note=consultation_data.patient_note  # Сохраняем сопроводительное письмо
    )

    db.add(new_consultation)
    db.commit()
    db.refresh(new_consultation)

    return new_consultation


# Эндпоинт для получения списка консультаций пользователя
@app.get(
    "/api/consultations",
    response_model=List[ConsultationResponse],
    tags=["consultations"],
)
async def get_consultations(
    status: Optional[str] = Query(
        None, description="Фильтр по статусу: pending, active, completed, cancelled"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Получает список консультаций текущего пользователя.
    """
    # Базовый запрос в зависимости от роли пользователя
    if current_user.role == "patient":
        query = db.query(Consultation).filter(
            Consultation.patient_id == current_user.id
        )
    elif current_user.role == "doctor":
        query = db.query(Consultation).filter(Consultation.doctor_id == current_user.id)
    else:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    # Применяем фильтр по статусу
    if status:
        query = query.filter(Consultation.status == status)

    # Получаем консультации, сортируя по дате создания (новые сначала)
    consultations = query.order_by(Consultation.created_at.desc()).all()

    return consultations


# Эндпоинт для получения деталей консультации
@app.get(
    "/api/consultations/{consultation_id}",
    response_model=ConsultationResponse,
    tags=["consultations"],
)
async def get_consultation(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Получает детали конкретной консультации.
    """
    # Получаем консультацию
    consultation = (
        db.query(Consultation).filter(Consultation.id == consultation_id).first()
    )

    if not consultation:
        raise HTTPException(status_code=404, detail="Консультация не найдена")

    # Проверяем права доступа (только участники консультации могут видеть детали)
    if (
        current_user.id != consultation.patient_id
        and current_user.id != consultation.doctor_id
        and current_user.role != "admin"
    ):
        raise HTTPException(
            status_code=403, detail="У вас нет доступа к этой консультации"
        )

    return consultation


# Эндпоинт для начала консультации (активация)
@app.post(
    "/api/consultations/{consultation_id}/start",
    response_model=ConsultationResponse,
    tags=["consultations"],
)
async def start_consultation(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Начинает консультацию, меняя ее статус на 'active'.
    Только врач может начать консультацию.
    """
    # Получаем консультацию
    consultation = (
        db.query(Consultation).filter(Consultation.id == consultation_id).first()
    )

    if not consultation:
        raise HTTPException(status_code=404, detail="Консультация не найдена")

    # Проверяем права доступа (только врач может начать консультацию)
    if current_user.id != consultation.doctor_id:
        raise HTTPException(
            status_code=403, detail="Только врач может начать консультацию"
        )

    # Проверяем, что консультация в статусе pending
    if consultation.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Невозможно начать консультацию в статусе {consultation.status}",
        )

    # Обновляем статус консультации
    consultation.status = "active"
    consultation.started_at = datetime.utcnow()

    db.commit()
    db.refresh(consultation)

    # Создаем уведомление для пациента о начале консультации
    try:
        # Получаем пациента для персонализации уведомления
        patient = db.query(User).filter(User.id == consultation.patient_id).first()
        # Получаем профиль врача для персонализации уведомления
        doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == consultation.doctor_id).first()
        
        doctor_name = "Врач"
        if doctor_profile:
            doctor_name = doctor_profile.full_name
        
        # Создаем уведомление с ярким, привлекающим внимание заголовком
        await create_notification(
            db=db,
            user_id=consultation.patient_id,
            title="🔴 Консультация началась!",
            message=f"{doctor_name} начал(а) консультацию и готов(а) ответить на ваши вопросы. Перейдите в чат, чтобы продолжить общение.",
            notification_type="consultation_started",
            related_id=consultation.id
        )
        
        print(f"Уведомление о начале консультации отправлено пациенту {consultation.patient_id}")
    except Exception as e:
        print(f"Ошибка при отправке уведомления о начале консультации: {str(e)}")

    # Отправляем уведомление через WebSocket
    if consultation_id in consultation_websocket_connections:
        for connection in consultation_websocket_connections[consultation_id]:
            try:
                await connection.send_json({
                    "type": "status_changed",
                    "consultation_id": consultation_id,
                    "status": "active",
                    "updated_at": consultation.started_at.isoformat()
                })
            except:
                # Если возникла ошибка при отправке, пропускаем
                pass

    return consultation


# Эндпоинт для завершения консультации
@app.post(
    "/api/consultations/{consultation_id}/complete",
    response_model=ConsultationResponse,
    tags=["consultations"],
)
async def complete_consultation(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Завершает консультацию (переводит в статус completed).
    Доступно как для пациента, так и для врача.
    """
    # Получаем консультацию
    consultation = (
        db.query(Consultation).filter(Consultation.id == consultation_id).first()
    )

    if not consultation:
        raise HTTPException(status_code=404, detail="Консультация не найдена")

    # Проверяем права доступа
    if (
        current_user.id != consultation.patient_id
        and current_user.id != consultation.doctor_id
    ):
        raise HTTPException(
            status_code=403, detail="У вас нет доступа к этой консультации"
        )

    # Проверяем, что консультация в статусе active
    if consultation.status != "active":
        raise HTTPException(
            status_code=400,
            detail=f"Невозможно завершить консультацию в статусе {consultation.status}",
        )

    # Обновляем статус консультации
    consultation.status = "completed"
    consultation.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(consultation)

    # Отправляем уведомление о завершении консультации обоим участникам
    try:
        # Получаем профили участников для персонализации уведомлений
        doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == consultation.doctor_id).first()
        patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == consultation.patient_id).first()
        
        doctor_name = "Врач"
        if doctor_profile:
            doctor_name = doctor_profile.full_name
        
        patient_name = "Пациент"
        if patient_profile:
            patient_name = patient_profile.full_name
        
        # Определяем инициатора завершения для корректного формирования сообщения
        initiator_name = doctor_name if current_user.id == consultation.doctor_id else patient_name
        
        # Создаем уведомление для врача (если завершил пациент)
        if current_user.id == consultation.patient_id:
            await create_notification(
                db=db,
                user_id=consultation.doctor_id,
                title="🔴 Консультация завершена",
                message=f"{patient_name} завершил(а) консультацию. Просмотрите историю для деталей.",
                notification_type="consultation_completed",
                related_id=consultation.id
            )
        
        # Создаем уведомление для пациента (если завершил врач)
        if current_user.id == consultation.doctor_id:
            await create_notification(
                db=db,
                user_id=consultation.patient_id,
                title="🔴 Консультация завершена",
                message=f"{doctor_name} завершил(а) консультацию. Вы можете оставить отзыв о консультации.",
                notification_type="consultation_completed",
                related_id=consultation.id
            )
        
        print(f"Уведомления о завершении консультации отправлены. Инициатор: {initiator_name}")
    except Exception as e:
        print(f"Ошибка при отправке уведомлений о завершении консультации: {str(e)}")

    # Отправляем WebSocket уведомление
    try:
        await broadcast_consultation_update(consultation_id, {
            "type": "status_changed",
            "consultation_id": consultation_id,
            "status": "completed",
            "updated_at": consultation.completed_at.isoformat(),
            "initiator_id": current_user.id
        })
    except Exception as e:
        print(f"Ошибка при отправке WebSocket-уведомления о завершении консультации: {str(e)}")

    return consultation


# Эндпоинт для отправки сообщения в чате консультации
@app.post(
    "/api/consultations/{consultation_id}/messages",
    response_model=MessageResponse,
    tags=["consultations"],
)
async def send_message(
    consultation_id: int,
    message_data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Отправляет сообщение в чате консультации.
    Учитывает лимит в 30 сообщений.
    """
    # Получаем консультацию
    consultation = (
        db.query(Consultation).filter(Consultation.id == consultation_id).first()
    )

    if not consultation:
        raise HTTPException(status_code=404, detail="Консультация не найдена")

    # Проверяем права доступа (только участники консультации могут отправлять сообщения)
    if (
        current_user.id != consultation.patient_id
        and current_user.id != consultation.doctor_id
    ):
        raise HTTPException(
            status_code=403, detail="У вас нет доступа к этой консультации"
        )

    # Проверяем, что консультация активна
    if consultation.status != "active":
        raise HTTPException(
            status_code=400,
            detail="Отправка сообщений возможна только в активной консультации",
        )

    # Проверяем лимит сообщений
    if consultation.message_count >= consultation.message_limit:
        raise HTTPException(
            status_code=400,
            detail=f"Достигнут лимит сообщений ({consultation.message_limit}). Необходимо продлить консультацию.",
        )

    # Создаем новое сообщение
    new_message = Message(
        consultation_id=consultation_id,
        sender_id=current_user.id,
        content=message_data.content,
        is_read=False,
    )

    # Увеличиваем счетчик сообщений
    consultation.message_count += 1

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    # Добавляем уведомление получателю о новом сообщении
    try:
        # Определяем получателя (если отправитель - врач, то получатель - пациент и наоборот)
        recipient_id = consultation.patient_id if current_user.id == consultation.doctor_id else consultation.doctor_id
        
        # Получаем профиль отправителя для персонализации уведомления
        sender_name = "Пользователь"
        if current_user.role == "doctor":
            doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
            if doctor_profile:
                sender_name = doctor_profile.full_name
        elif current_user.role == "patient":
            patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
            if patient_profile:
                sender_name = patient_profile.full_name
        
        # Подготавливаем текст сообщения для уведомления (укорачиваем для предпросмотра)
        message_preview = new_message.content
        if len(message_preview) > 50:
            message_preview = message_preview[:47] + "..."
        
        # Создаем уведомление
        await create_notification(
            db=db,
            user_id=recipient_id,
            title="📩 Новое сообщение в консультации",
            message=f"{sender_name}: {message_preview}",
            notification_type="new_message",
            related_id=consultation.id
        )
        
        print(f"Уведомление о новом сообщении отправлено пользователю {recipient_id}")
    except Exception as e:
        # Логируем ошибку, но не блокируем основной функционал
        print(f"Ошибка при отправке уведомления о новом сообщении: {str(e)}")

    return new_message


# Эндпоинт для получения сообщений консультации
@app.get(
    "/api/consultations/{consultation_id}/messages",
    response_model=List[MessageResponse],
    tags=["consultations"],
)
async def get_messages(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Получает все сообщения конкретной консультации.
    Автоматически отмечает непрочитанные сообщения как прочитанные.
    """
    # Получаем консультацию
    consultation = (
        db.query(Consultation).filter(Consultation.id == consultation_id).first()
    )

    if not consultation:
        raise HTTPException(status_code=404, detail="Консультация не найдена")

    # Проверяем права доступа
    if (
        current_user.id != consultation.patient_id
        and current_user.id != consultation.doctor_id
        and current_user.role != "admin"
    ):
        raise HTTPException(
            status_code=403, detail="У вас нет доступа к сообщениям этой консультации"
        )

    # Получаем сообщения, сортируя по времени отправки
    messages = (
        db.query(Message)
        .filter(Message.consultation_id == consultation_id)
        .order_by(Message.sent_at)
        .all()
    )

    # Определяем ID другого участника консультации
    other_participant_id = consultation.patient_id if current_user.id == consultation.doctor_id else consultation.doctor_id

    # Отмечаем сообщения как прочитанные, если их отправитель не текущий пользователь
    unread_messages_updated = False
    for message in messages:
        if message.sender_id != current_user.id and not message.is_read:
            message.is_read = True
            unread_messages_updated = True

    if unread_messages_updated:
        db.commit()
        
        # Отправляем уведомление через WebSocket о прочтении сообщений
        if consultation_id in consultation_websocket_connections:
            for connection in consultation_websocket_connections.get(consultation_id, []):
                try:
                    await connection.send_json({
                        "type": "messages_read",
                        "reader_id": current_user.id,
                        "consultation_id": consultation_id
                    })
                except:
                    # Если возникла ошибка при отправке, пропускаем
                    pass

    return messages


# Эндпоинт для создания отзыва о консультации
@app.post(
    "/api/consultations/{consultation_id}/review",
    response_model=ReviewResponse,
    tags=["consultations"],
)
async def create_review(
    consultation_id: int,
    review_data: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("patient")),
):
    """
    Создает отзыв о консультации.
    Доступно только для пациента, участвовавшего в консультации.
    """
    # Получаем консультацию
    consultation = (
        db.query(Consultation).filter(Consultation.id == consultation_id).first()
    )

    if not consultation:
        raise HTTPException(status_code=404, detail="Консультация не найдена")

    # Проверяем, что текущий пользователь является пациентом в этой консультации
    if current_user.id != consultation.patient_id:
        raise HTTPException(
            status_code=403, detail="Вы не можете оставить отзыв о чужой консультации"
        )

    # Проверяем, что консультация завершена
    if consultation.status != "completed":
        raise HTTPException(
            status_code=400,
            detail="Отзыв можно оставить только о завершенной консультации",
        )

    # Проверяем, нет ли уже отзыва о данной консультации
    existing_review = (
        db.query(Review).filter(Review.consultation_id == consultation_id).first()
    )

    if existing_review:
        raise HTTPException(
            status_code=400, detail="Вы уже оставили отзыв об этой консультации"
        )

    # Создаем новый отзыв
    new_review = Review(
        consultation_id=consultation_id,
        rating=review_data.rating,
        comment=review_data.comment,
    )

    db.add(new_review)
    db.commit()
    db.refresh(new_review)
    
    # Отправляем уведомление всем участникам через WebSocket о добавлении отзыва
    try:
        await broadcast_consultation_update(consultation_id, {
            "type": "review_added",
            "review_id": new_review.id,
            "consultation_id": consultation_id
        })
    except Exception as e:
        print(f"Ошибка при отправке уведомления об отзыве: {str(e)}")
        # Продолжаем выполнение, так как это не критическая ошибка

    return new_review


# Эндпоинт для получения отзыва о консультации
@app.get(
    "/api/consultations/{consultation_id}/review",
    response_model=ReviewResponse,
    tags=["consultations"],
)
async def get_review(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Получает отзыв о конкретной консультации.
    """
    # Получаем консультацию
    consultation = (
        db.query(Consultation).filter(Consultation.id == consultation_id).first()
    )

    if not consultation:
        raise HTTPException(status_code=404, detail="Консультация не найдена")

    # Проверяем права доступа
    if (
        current_user.id != consultation.patient_id
        and current_user.id != consultation.doctor_id
        and current_user.role != "admin"
    ):
        raise HTTPException(
            status_code=403, detail="У вас нет доступа к этой консультации"
        )

    # Получаем отзыв
    review = db.query(Review).filter(Review.consultation_id == consultation_id).first()

    if not review:
        raise HTTPException(status_code=404, detail="Отзыв не найден")

    return review


# Эндпоинт для получения всех отзывов о враче
@app.get(
    "/api/doctors/{doctor_id}/reviews",
    response_model=List[ReviewResponse],
    tags=["doctors"],
)
async def get_doctor_reviews(doctor_id: int, db: Session = Depends(get_db)):
    """
    Получает все отзывы о конкретном враче.
    Доступно без авторизации.
    """
    # Проверяем существование врача
    doctor = db.query(User).filter(User.id == doctor_id, User.role == "doctor").first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Врач не найден")

    # Получаем все завершенные консультации этого врача
    consultation_ids = (
        db.query(Consultation.id)
        .filter(Consultation.doctor_id == doctor_id, Consultation.status == "completed")
        .subquery()
    )

    # Получаем отзывы по этим консультациям
    reviews = (
        db.query(Review).filter(Review.consultation_id.in_(consultation_ids)).all()
    )

    return reviews


# НОВЫЙ ЭНДПОИНТ ДЛЯ РУЧНОЙ АКТИВАЦИИ АККАУНТА (ТОЛЬКО ДЛЯ РАЗРАБОТКИ)
@app.post("/manual-activate")
def manual_activate_user(activation_data: dict, db: DbDependency):
    """
    Ручная активация аккаунта пользователя (только для тестирования и разработки).
    В продакшене этот эндпоинт должен быть отключен.

    Args:
        activation_data (dict): Словарь с email пользователя.
        db (Session): Сессия базы данных.

    Returns:
        dict: Сообщение об успешной активации или ошибка.
    """
    email = activation_data.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email не указан"
        )

    # Ищем пользователя в базе данных
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь с таким email не найден",
        )

    # Если пользователь уже активирован, сообщаем об этом
    if user.is_active:
        return {"message": "Этот аккаунт уже активирован"}

    # Активируем пользователя
    user.is_active = True
    user.email_verification_token = None
    user.email_verification_token_created_at = None
    db.commit()

    # Получаем верификационный токен из логов
    token = user.email_verification_token

    return {
        "message": "Аккаунт успешно активирован",
        "user_email": user.email,
        "is_active": user.is_active,
    }


# Эндпоинт для загрузки аватара пользователя
@app.post("/users/me/avatar", response_model=UserResponse)
async def upload_avatar(
    avatar: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Загружает и обновляет аватар пользователя.

    Args:
        avatar: Файл изображения аватара
        db: Сессия базы данных
        current_user: Текущий аутентифицированный пользователь

    Returns:
        UserResponse: Обновленные данные пользователя с путём к аватару
    """
    # Проверяем тип файла (только изображения)
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    file_type = avatar.content_type

    if file_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Только изображения форматов JPEG, PNG, GIF и WEBP разрешены для аватара",
        )

    # Создаем директорию для аватаров, если она не существует
    avatar_dir = os.path.join(UPLOAD_DIR, "avatars")
    if not os.path.exists(avatar_dir):
        os.makedirs(avatar_dir)

    # Генерируем уникальное имя файла
    file_extension = os.path.splitext(avatar.filename)[1]
    filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(avatar_dir, filename)

    # Сохраняем файл
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(avatar.file, buffer)

    # Если у пользователя уже есть аватар, удаляем старый файл
    if current_user.avatar_path:
        old_file_path = os.path.join(os.getcwd(), current_user.avatar_path.lstrip("/"))
        if os.path.exists(old_file_path):
            try:
                os.remove(old_file_path)
            except Exception as e:
                print(f"Error removing old avatar: {e}")

    # Обновляем путь к аватару в базе данных
    current_user.avatar_path = f"/uploads/avatars/{filename}"
    db.commit()
    db.refresh(current_user)

    return current_user


# Модель для получения списка уведомлений
class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    type: str
    is_viewed: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Класс для списка уведомлений
class NotificationList(BaseModel):
    items: List[NotificationResponse]


# Эндпоинт для получения уведомлений пользователя
@app.get("/notifications", response_model=NotificationList)
async def get_notifications(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """
    Получает список уведомлений для текущего пользователя.
    Возвращает последние 30 уведомлений, отсортированные по дате создания (новые сверху).
    """
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(30)
        .all()
    )
    
    return {"items": notifications}

@app.get("/notifications/unread-count", response_model=dict)
async def get_unread_notifications_count(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """
    Возвращает количество непрочитанных уведомлений для текущего пользователя.
    """
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_viewed == False
    ).count()
    
    return {"count": count}

# Добавляем функцию для создания уведомления
async def create_notification(
    db: Session, 
    user_id: int, 
    title: str, 
    message: str, 
    notification_type: str = "system",
    related_id: int = None
) -> Notification:
    """
    Создает новое уведомление для пользователя.
    
    Args:
        db (Session): Сессия базы данных
        user_id (int): ID пользователя
        title (str): Заголовок уведомления
        message (str): Текст уведомления
        notification_type (str): Тип уведомления (system, message, consultation)
        related_id (int): ID связанного объекта (опционально)
        
    Returns:
        Notification: Созданное уведомление
    """
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notification_type,
        is_viewed=False,
        related_id=related_id
    )
    
    db.add(notification)
    db.commit()
    db.refresh(notification)
    
    print(f"Created notification for user {user_id}: {title}")
    return notification

@app.post(
    "/notifications/{notification_id}/view", status_code=status.HTTP_204_NO_CONTENT
)
async def mark_notification_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Отмечает уведомление как прочитанное.
    """
    # Проверяем, существует ли уведомление и принадлежит ли оно текущему пользователю
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Уведомление не найдено или у вас нет к нему доступа"
        )
    
    # Отмечаем уведомление как прочитанное
    notification.is_viewed = True
    db.commit()
    
    # Возвращаем 204 No Content
    return None

@app.post("/notifications/mark-all-read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Отмечает все уведомления пользователя как прочитанные.
    """
    # Получаем все непрочитанные уведомления
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_viewed == False
    ).all()
    
    # Отмечаем все как прочитанные
    for notification in notifications:
        notification.is_viewed = True
    
    db.commit()
    
    # Возвращаем 204 No Content
    return None

# Модель для запроса с CSRF токеном для защиты форм
class CsrfProtectedRequest(BaseModel):
    csrf_token: str


# Класс для смены пароля с CSRF защитой
class ChangePasswordRequest(CsrfProtectedRequest):
    current_password: str
    new_password: str


# Эндпоинт для получения CSRF токена для защиты форм
@app.get("/csrf-token")
async def get_csrf_token(current_user: CurrentUser):
    """
    Генерирует и возвращает CSRF токен для текущего пользователя.
    Используется для защиты форм от CSRF атак.
    """
    csrf_token = create_csrf_token(current_user.id)
    return {"csrf_token": csrf_token}


# Эндпоинт для смены пароля пользователя
@app.post("/users/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    password_data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Изменяет пароль текущего пользователя.
    """
    # Проверяем, что пользователь не использует OAuth
    if current_user.auth_provider != "email":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password change is not available for OAuth users",
        )

    # Проверяем CSRF токен
    if not verify_csrf_token(current_user.id, password_data.csrf_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or expired CSRF token",
        )

    # Проверяем текущий пароль
    if not verify_password(
        password_data.current_password, current_user.hashed_password
    ):
        # Защита от перебора: не раскрываем информацию о корректности текущего пароля
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password change failed. Please check your input and try again.",
        )

    # Проверяем требования к новому паролю
    if len(password_data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters long",
        )

    # Хешируем новый пароль и обновляем в БД
    hashed_password = get_password_hash(password_data.new_password)
    current_user.hashed_password = hashed_password
    db.commit()

    # Возвращаем 204 No Content (успешно, но без тела ответа)
    return None


# Модель для запроса обновления настроек уведомлений
class NotificationSettingsUpdate(CsrfProtectedRequest):
    email_notifications: bool = True
    push_notifications: bool = True
    appointment_reminders: bool = True


# Модель для ответа с настройками уведомлений
class NotificationSettingsResponse(BaseModel):
    email_notifications: bool
    push_notifications: bool
    appointment_reminders: bool
    updated_at: datetime

    class Config:
        from_attributes = True


# Эндпоинт для получения настроек уведомлений пользователя
@app.get("/users/me/notification-settings", response_model=NotificationSettingsResponse)
async def get_notification_settings(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """
    Получает настройки уведомлений для текущего пользователя.
    """
    # Проверяем, есть ли у пользователя настройки уведомлений
    settings = (
        db.query(UserNotificationSettings)
        .filter(UserNotificationSettings.user_id == current_user.id)
        .first()
    )

    # Если настроек нет, создаем настройки по умолчанию
    if not settings:
        settings = UserNotificationSettings(
            user_id=current_user.id,
            email_notifications=True,
            push_notifications=True,
            appointment_reminders=True,
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings


# Эндпоинт для обновления настроек уведомлений пользователя
@app.put("/users/me/notification-settings", response_model=NotificationSettingsResponse)
async def update_notification_settings(
    settings_data: NotificationSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Обновляет настройки уведомлений для текущего пользователя.
    """
    # Проверяем CSRF токен
    if not verify_csrf_token(current_user.id, settings_data.csrf_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Invalid CSRF token"
        )

    # Проверяем, есть ли у пользователя настройки уведомлений
    settings = (
        db.query(UserNotificationSettings)
        .filter(UserNotificationSettings.user_id == current_user.id)
        .first()
    )

    # Если настроек нет, создаем новые с переданными данными
    if not settings:
        settings = UserNotificationSettings(
            user_id=current_user.id,
            email_notifications=settings_data.email_notifications,
            push_notifications=settings_data.push_notifications,
            appointment_reminders=settings_data.appointment_reminders,
        )
        db.add(settings)
    else:
        # Обновляем существующие настройки
        settings.email_notifications = settings_data.email_notifications
        settings.push_notifications = settings_data.push_notifications
        settings.appointment_reminders = settings_data.appointment_reminders

    db.commit()
    db.refresh(settings)

    return settings


# Эндпоинт для проверки существования email
@app.post("/users/check-email")
def check_email_exists(email_data: dict, db: DbDependency):
    """
    Проверяет, существует ли пользователь с указанным email.
    Используется при регистрации для предотвращения дублирования email.
    
    Args:
        email_data (dict): Словарь с email пользователя
        db (Session): Сессия базы данных
        
    Returns:
        dict: Информация о существовании email и провайдере аутентификации
    """
    email = email_data.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email не указан"
        )
    
    # Ищем пользователя в базе данных
    user = db.query(User).filter(User.email == email).first()
    
    if user:
        return {
            "exists": True,
            "auth_provider": user.auth_provider
        }
    
    return {
        "exists": False,
        "auth_provider": None
    }

# Модель для запроса на удаление аккаунта с CSRF защитой
class DeleteAccountRequest(CsrfProtectedRequest):
    confirmation: str  # Строка подтверждения, должна быть равна "удалить"

# Эндпоинт для удаления аккаунта пользователя
@app.post("/users/me/delete-account", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    delete_data: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Удаляет аккаунт текущего пользователя.
    Требует CSRF токен и подтверждение "удалить".
    """
    # Проверяем, что пользователь не является врачом
    if current_user.role == "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctors cannot delete their accounts. Please contact support."
        )
    
    # Проверяем CSRF токен
    if not verify_csrf_token(current_user.id, delete_data.csrf_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or expired CSRF token"
        )
    
    # Проверяем строку подтверждения
    if delete_data.confirmation != "удалить":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation text does not match 'удалить'"
        )
    
    # Явно удаляем настройки уведомлений пользователя до удаления самого пользователя
    notification_settings = db.query(UserNotificationSettings).filter(
        UserNotificationSettings.user_id == current_user.id
    ).first()
    if notification_settings:
        db.delete(notification_settings)
        db.commit()
    
    # Удаляем пользователя из базы данных
    # Каскадное удаление связанных записей настроено в моделях (cascade="all, delete-orphan")
    db.delete(current_user)
    db.commit()
    
    # Возвращаем 204 No Content (успешно, но без тела ответа)
    return None

# Класс для запроса продления консультации
class ExtendConsultationRequest(BaseModel):
    payment_info: Optional[str] = None  # В будущем здесь будет информация об оплате

# Эндпоинт для продления консультации
@app.post(
    "/api/consultations/{consultation_id}/extend",
    response_model=ConsultationResponse,
    tags=["consultations"],
)
async def extend_consultation(
    consultation_id: int,
    extend_data: ExtendConsultationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Продлевает консультацию, добавляя еще 30 сообщений к лимиту.
    В будущем здесь будет проверка оплаты.
    """
    # Получаем консультацию
    consultation = (
        db.query(Consultation).filter(Consultation.id == consultation_id).first()
    )

    if not consultation:
        raise HTTPException(status_code=404, detail="Консультация не найдена")

    # Проверяем права доступа (только пациент может продлить консультацию)
    if current_user.id != consultation.patient_id:
        raise HTTPException(
            status_code=403, detail="Только пациент может продлить консультацию"
        )

    # Проверяем, что консультация активна или достигла лимита сообщений
    if consultation.status != "active":
        raise HTTPException(
            status_code=400, detail="Продление возможно только для активной консультации"
        )

    # В будущем здесь будет проверка оплаты
    # payment_result = check_payment(extend_data.payment_info)

    # Добавляем 30 сообщений к лимиту
    consultation.message_limit += 30

    db.commit()
    db.refresh(consultation)

    return consultation

# Эндпоинт для отправки уведомления пациенту о консультации
@app.post(
    "/api/consultations/{consultation_id}/notify",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["consultations"],
)
async def notify_about_consultation(
    consultation_id: int,
    message_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Отправляет уведомление участнику консультации.
    """
    # Получаем консультацию
    consultation = (
        db.query(Consultation).filter(Consultation.id == consultation_id).first()
    )

    if not consultation:
        raise HTTPException(status_code=404, detail="Консультация не найдена")

    # Проверяем права доступа
    if (
        current_user.id != consultation.patient_id
        and current_user.id != consultation.doctor_id
    ):
        raise HTTPException(
            status_code=403, detail="У вас нет доступа к этой консультации"
        )

    # Определяем получателя уведомления (если отправитель - врач, то получатель - пациент и наоборот)
    recipient_id = consultation.patient_id if current_user.id == consultation.doctor_id else consultation.doctor_id
    
    # Создаем уведомление
    notification = Notification(
        user_id=recipient_id,
        title="Обновление по консультации",
        message=message_data.get("message", "Есть обновление по вашей консультации."),
        type="consultation_update",
        is_viewed=False
    )
    
    db.add(notification)
    db.commit()
    
    return None

# Глобальное хранилище активных WebSocket соединений (user_id -> list of connections)
active_websocket_connections = {}
# Глобальное хранилище соединений для консультаций (consultation_id -> list of connections)
consultation_websocket_connections = {}

# WebSocket эндпоинт для чата консультаций
@app.websocket("/ws/consultations/{consultation_id}")
async def websocket_consultation_endpoint(
    websocket: WebSocket, 
    consultation_id: int,
    db: Session = Depends(get_db),
    token: str = Query(None)
):
    # Проверяем авторизацию через токен
    if token is None:
        await websocket.close(code=4001, reason="Authentication required")
        return
    
    try:
        # Ищем токен в базе данных
        db_token = (
            db.query(WebSocketToken)
            .filter(WebSocketToken.token == token)
            .filter(WebSocketToken.expires_at > datetime.utcnow())
            .first()
        )
        
        if not db_token:
            await websocket.close(code=4001, reason="Invalid or expired token")
            return
        
        # Получаем пользователя по ID из токена
        user = db.query(User).filter(User.id == db_token.user_id).first()
        if user is None:
            await websocket.close(code=4001, reason="User not found")
            return
        
        # Получаем консультацию
        consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
        # Проверяем, имеет ли пользователь доступ к этой консультации
        if consultation is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Consultation not found")
            return
        
        if user.id != consultation.patient_id and user.id != consultation.doctor_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Access denied")
            return
        
        # Принимаем WebSocket соединение
        await websocket.accept()
        
        # Сохраняем соединение в глобальных словарях
        if user.id not in active_websocket_connections:
            active_websocket_connections[user.id] = []
        
        # Проверяем, не добавлено ли уже это соединение (избегаем дублирования)
        if websocket not in active_websocket_connections[user.id]:
            active_websocket_connections[user.id].append(websocket)
        
        if consultation_id not in consultation_websocket_connections:
            consultation_websocket_connections[consultation_id] = []
        
        # Проверяем, не добавлено ли уже это соединение (избегаем дублирования)
        if websocket not in consultation_websocket_connections[consultation_id]:
            consultation_websocket_connections[consultation_id].append(websocket)
        
        # Ожидаем сообщения
        try:
            while True:
                data = await websocket.receive_json()
                
                # Если это текстовое сообщение
                if data.get("type") == "message":
                    content = data.get("content")
                    temp_id = data.get("temp_id")  # ID временного сообщения с фронтенда
                    
                    if not content:
                        continue
                    
                    # Попытка создать сообщение с несколькими попытками при ошибке конфликта
                    attempts = 0
                    max_attempts = 3
                    success = False
                    
                    while attempts < max_attempts and not success:
                        try:
                            # Важно: получаем новую (свежую) копию объекта консультации перед каждой попыткой
                            # чтобы избежать ошибки "Record has changed since last read"
                            fresh_consultation = (
                                db.query(Consultation)
                                .filter(Consultation.id == consultation_id)
                                .with_for_update()  # Блокируем строку для обновления
                                .first()
                            )
                            
                            if not fresh_consultation:
                                await websocket.send_json({
                                    "type": "error",
                                    "message": "Консультация не найдена или была удалена"
                                })
                                break
                            
                            # Создаем новое сообщение
                            new_message = Message(
                                consultation_id=consultation_id,
                                sender_id=user.id,
                                content=content,
                                is_read=False,
                            )
                            
                            # Увеличиваем счетчик сообщений для контроля лимита
                            # Только если отправитель - пациент (у врача нет лимита)
                            if user.id == fresh_consultation.patient_id:
                                fresh_consultation.message_count += 1
                            
                            # Сначала добавляем сообщение
                            db.add(new_message)
                            # Затем сохраняем изменения
                            db.commit()
                            # Обновляем объект из БД
                            db.refresh(new_message)
                            
                            # Если успешно, выходим из цикла
                            success = True
                            
                            # Преобразуем сообщение в JSON для отправки
                            message_data = {
                                "id": new_message.id,
                                "consultation_id": new_message.consultation_id,
                                "sender_id": new_message.sender_id,
                                "content": new_message.content,
                                "sent_at": new_message.sent_at.isoformat(),
                                "is_read": new_message.is_read
                            }
                            
                            # Отправляем подтверждение отправителю
                            await websocket.send_json({
                                "type": "message",
                                "message": message_data,
                                "temp_id": temp_id
                            })
                            
                            # Отправляем сообщение всем подключенным к консультации
                            await broadcast_consultation_update(consultation_id, {
                                "type": "message", 
                                "message": message_data
                            })
                            
                        except Exception as e:
                            # Увеличиваем счетчик попыток
                            attempts += 1
                            
                            # Логируем ошибку
                            print(f"Ошибка при сохранении сообщения (попытка {attempts}/{max_attempts}): {str(e)}")
                            
                            # Если это ошибка конфликта записи или другая ошибка транзакции
                            if "Record has changed" in str(e) or "transaction has been rolled back" in str(e):
                                # Выполняем откат транзакции
                                db.rollback()
                                
                                # Если это не последняя попытка, ждем небольшую паузу
                                if attempts < max_attempts:
                                    await asyncio.sleep(0.2 * attempts)  # увеличиваем время ожидания с каждой попыткой
                            else:
                                # Другие ошибки - просто логируем и откатываем
                                db.rollback()
                                
                                # Если мы уже сделали максимальное количество попыток, прекращаем
                                if attempts >= max_attempts:
                                    # Отправляем сообщение об ошибке клиенту
                                    try:
                                        await websocket.send_json({
                                            "type": "error",
                                            "message": "Не удалось сохранить сообщение. Пожалуйста, попробуйте позже."
                                        })
                                    except:
                                        pass
                    
                    # Если все попытки неудачны, переходим к следующей итерации
                    if not success:
                        continue
                
                # Если это уведомление о прочтении сообщений
                elif data.get("type") == "read_receipt":
                    message_id = data.get("message_id")
                    
                    if message_id:
                        # Помечаем конкретное сообщение как прочитанное
                        message = (
                            db.query(Message)
                            .filter(
                                Message.consultation_id == consultation_id,
                                Message.id == message_id,
                                Message.sender_id != user.id  # Не отмечаем собственные сообщения
                            )
                            .first()
                        )
                        
                        if message and not message.is_read:
                            message.is_read = True
                            db.commit()
                            
                            # Отправляем уведомление о прочтении сообщения
                            await broadcast_consultation_update(consultation_id, {
                                "type": "read_receipt",
                                "message_id": message_id
                            })
                
                # Если это уведомление об изменении статуса консультации
                elif data.get("type") == "status_update":
                    # Проверяем, что только врачи могут изменить статус
                    if user.id == consultation.doctor_id or user.role == "admin":
                        new_status = data.get("status")
                        if new_status in ["completed"]:
                            consultation.status = new_status
                            consultation.completed_at = datetime.utcnow()
                            db.commit()
                            db.refresh(consultation)
                            
                            # Отправляем уведомление об изменении статуса
                            await broadcast_consultation_update(consultation_id, {
                                "type": "status_update",
                                "consultation": {
                                    "id": consultation.id,
                                    "status": consultation.status,
                                    "completed_at": consultation.completed_at.isoformat() if consultation.completed_at else None
                                }
                            })
                
                # Если это запрос на отметку всех сообщений как прочитанных
                elif data.get("type") == "mark_read":
                    # Обновляем статус всех сообщений как прочитанных
                    # Получаем все непрочитанные сообщения, отправленные не этим пользователем
                    unread_messages = (
                        db.query(Message)
                        .filter(
                            Message.consultation_id == consultation_id,
                            Message.sender_id != user.id,
                            Message.is_read == False
                        )
                        .all()
                    )
                    
                    if unread_messages:
                        for message in unread_messages:
                            message.is_read = True
                        
                        db.commit()
                
                # Если это пинг для проверки соединения
                elif data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                
                # Если это запрос на получение истории сообщений
                elif data.get("type") == "get_messages_bulk":
                    try:
                        print(f"[WebSocket] Получен запрос на историю сообщений для консультации {consultation_id}")
                        
                        # Получаем все сообщения для консультации
                        messages = (
                            db.query(Message)
                            .filter(Message.consultation_id == consultation_id)
                            .order_by(Message.sent_at.asc())
                            .all()
                        )
                        
                        # Форматируем сообщения для JSON
                        formatted_messages = []
                        for msg in messages:
                            formatted_messages.append({
                                "id": msg.id,
                                "consultation_id": msg.consultation_id,
                                "sender_id": msg.sender_id,
                                "content": msg.content,
                                "sent_at": msg.sent_at.isoformat(),
                                "is_read": msg.is_read
                            })
                        
                        # Добавляем подробную информацию о консультации
                        consultation_data = {
                            "id": consultation.id,
                            "status": consultation.status,
                            "message_count": consultation.message_count,
                            "message_limit": consultation.message_limit,
                            "patient_id": consultation.patient_id,
                            "doctor_id": consultation.doctor_id,
                            "created_at": consultation.created_at.isoformat() if consultation.created_at else None,
                            "started_at": consultation.started_at.isoformat() if consultation.started_at else None,
                            "completed_at": consultation.completed_at.isoformat() if consultation.completed_at else None
                        }
                        
                        # Получаем информацию о пользователях
                        patient = db.query(User).filter(User.id == consultation.patient_id).first()
                        doctor = db.query(User).filter(User.id == consultation.doctor_id).first()
                        
                        patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == consultation.patient_id).first()
                        doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == consultation.doctor_id).first()
                        
                        participants = {
                            "patient": {
                                "id": patient.id if patient else None,
                                "name": patient_profile.full_name if patient_profile else "Пациент",
                                "avatar": patient.avatar_path if patient and patient.avatar_path else None
                            },
                            "doctor": {
                                "id": doctor.id if doctor else None,
                                "name": doctor_profile.full_name if doctor_profile else "Врач",
                                "avatar": doctor.avatar_path if doctor and doctor.avatar_path else None
                            }
                        }
                        
                        # Отправляем ответ с более полными данными
                        await websocket.send_json({
                            "type": "messages_bulk",
                            "messages": formatted_messages,
                            "consultation": consultation_data,
                            "participants": participants
                        })
                        
                        # Если есть непрочитанные сообщения, отмечаем их как прочитанные
                        unread_messages = [m for m in messages if m.sender_id != user.id and not m.is_read]
                        if unread_messages:
                            for msg in unread_messages:
                                msg.is_read = True
                            db.commit()
                            
                            # Отправляем уведомление о прочтении всех сообщений
                            await broadcast_consultation_update(consultation_id, {
                                "type": "messages_read",
                                "reader_id": user.id
                            })
                        
                        print(f"[WebSocket] Отправлена история сообщений ({len(formatted_messages)} сообщений) для консультации {consultation_id}")
                    except Exception as e:
                        print(f"[WebSocket] Ошибка при получении истории сообщений: {str(e)}")
                        # Записываем полную трассировку для отладки
                        import traceback
                        traceback.print_exc()
                        
                        await websocket.send_json({
                            "type": "error",
                            "message": "Не удалось загрузить историю сообщений"
                        })
                
        except WebSocketDisconnect:
            print(f"WebSocket отключен пользователем {user.id} из консультации {consultation_id}")
        except Exception as e:
            print(f"Ошибка в WebSocket: {str(e)}")
        finally:
            # В любом случае удаляем соединение из списков при завершении
            if user.id in active_websocket_connections:
                if websocket in active_websocket_connections.get(user.id, []):
                    active_websocket_connections[user.id].remove(websocket)
                    if not active_websocket_connections[user.id]:
                        del active_websocket_connections[user.id]
            
            if consultation_id in consultation_websocket_connections:
                if websocket in consultation_websocket_connections.get(consultation_id, []):
                    consultation_websocket_connections[consultation_id].remove(websocket)
                    if not consultation_websocket_connections[consultation_id]:
                        del consultation_websocket_connections[consultation_id]
    
    except Exception as e:
        print(f"WebSocket ошибка глобальная: {str(e)}")
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason="Internal error")
        except:
            pass


# Функция для отправки уведомления пользователям через WebSocket
async def broadcast_consultation_update(
    consultation_id: int, 
    update_data: dict
):
    """
    Отправляет обновления всем пользователям, подключенным к определенной консультации.
    Надежно обрабатывает закрытые соединения.
    """
    success_count = 0
    error_count = 0
    closed_connections = []
    
    if consultation_id not in consultation_websocket_connections:
        return 0
    
    # Создаем копию списка соединений, чтобы избежать изменения во время итерации
    connections = consultation_websocket_connections[consultation_id].copy()
    
    # Нет соединений для этой консультации, просто выходим
    if not connections:
        return 0
    
    for connection in connections:
        try:
            # Проверяем, не закрыто ли соединение с помощью safe_check
            # Функция getattr обеспечивает безопасное получение атрибута, 
            # возвращая None, если атрибут отсутствует
            client_state = getattr(connection, "client_state", None)
            if client_state is None or not hasattr(WebSocketState, "DISCONNECTED"):
                # Если нет атрибута client_state или WebSocketState.DISCONNECTED не определен,
                # мы просто пытаемся отправить сообщение
                pass
            elif client_state == WebSocketState.DISCONNECTED:
                closed_connections.append(connection)
                error_count += 1
                continue
            
            # Отправляем сообщение
            await connection.send_json(update_data)
            success_count += 1
        except WebSocketDisconnect:
            # Соединение закрыто клиентом
            closed_connections.append(connection)
            error_count += 1
            print("WebSocket отключен клиентом при отправке сообщения")
        except RuntimeError as e:
            # Ошибки типа "Cannot call send after a close message" и подобные
            closed_connections.append(connection)
            error_count += 1
            print(f"Ошибка при отправке WebSocket сообщения: {str(e)}")
        except Exception as e:
            error_count += 1
            print(f"Непредвиденная ошибка при отправке WebSocket сообщения: {str(e)}")
            
            # Предполагаем, что соединение с ошибкой должно быть закрыто
            # Добавляем его в список закрытых соединений
            closed_connections.append(connection)
    
    # Удаляем закрытые соединения
    if closed_connections:
        # Создаем список уникальных закрытых соединений (избегаем дублирования)
        unique_closed = list(set(closed_connections))
        
        for closed_conn in unique_closed:
            # Находим соединения в списках и удаляем их
            for user_id in list(active_websocket_connections.keys()):
                user_connections = active_websocket_connections.get(user_id, [])
                if closed_conn in user_connections:
                    try:
                        user_connections.remove(closed_conn)
                        if not user_connections:
                            del active_websocket_connections[user_id]
                    except (ValueError, KeyError):
                        # Игнорируем ошибки, если соединение уже удалено
                        pass
            
            if consultation_id in consultation_websocket_connections:
                consultation_connections = consultation_websocket_connections.get(consultation_id, [])
                if closed_conn in consultation_connections:
                    try:
                        consultation_connections.remove(closed_conn)
                        if not consultation_connections:
                            del consultation_websocket_connections[consultation_id]
                    except (ValueError, KeyError):
                        # Игнорируем ошибки, если соединение уже удалено
                        pass
    
    if error_count > 0:
        print(f"WebSocket статистика: успешно {success_count}, ошибок {error_count}, удалено соединений {len(closed_connections)}")
    
    return success_count

# Документирование WebSocket-маршрута в OpenAPI
@app.get("/docs/websocket", tags=["WebSocket"])
def get_websocket_docs():
    """
    Документация по WebSocket API
    
    Маршрут: /ws/consultations/{consultation_id}?token={jwt_token}
    
    Сообщения от клиента:
    - {"type": "message", "content": "текст сообщения"} - отправка нового сообщения
    - {"type": "read_receipt", "message_id": 123} - отметка о прочтении сообщения
    - {"type": "status_update", "status": "completed"} - изменение статуса консультации (только для врачей)
    - {"type": "ping"} - проверка соединения
    
    Сообщения от сервера:
    - {"type": "message", "message": {...}} - новое сообщение
    - {"type": "read_receipt", "message_id": 123, "user_id": 456} - кто-то прочитал сообщение
    - {"type": "status_update", "consultation": {...}} - изменение статуса консультации
    - {"type": "user_joined", "user_id": 123} - пользователь подключился к чату
    - {"type": "user_left", "user_id": 123} - пользователь отключился от чата
    - {"type": "error", "message": "текст ошибки"} - сообщение об ошибке
    - {"type": "pong"} - ответ на ping
    """
    return {
        "websocket_url": "/ws/consultations/{consultation_id}?token={jwt_token}",
        "message_types": {
            "client_to_server": [
                "message",
                "read_receipt",
                "status_update",
                "ping"
            ],
            "server_to_client": [
                "message",
                "read_receipt", 
                "status_update",
                "user_joined",
                "user_left",
                "error",
                "pong"
            ]
        }
    }

## Добавляю новый эндпоинт для WebSocket токена
@app.get("/api/ws-token", response_model=dict)
async def get_websocket_token(
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db),
    request: Request = None
):
    """
    Создает и возвращает специальный токен для WebSocket соединения.
    Токен сохраняется в базе данных и имеет ограниченный срок действия.
    """
    try:
        # Удаляем устаревшие токены для этого пользователя
        expired_tokens = db.query(WebSocketToken).filter(
            WebSocketToken.user_id == current_user.id,
            WebSocketToken.expires_at < datetime.utcnow()
        ).all()
        
        if expired_tokens:
            for token in expired_tokens:
                db.delete(token)
            db.commit()
        
        # Генерируем новый случайный токен
        token_value = secrets.token_urlsafe(32)
        
        # Устанавливаем срок действия токена (5 минут)
        expires_at = datetime.utcnow() + timedelta(minutes=5)
        
        # Создаем запись в базе данных
        db_token = WebSocketToken(
            user_id=current_user.id,
            token=token_value,
            expires_at=expires_at
        )
        
        # Сохраняем в базе данных
        db.add(db_token)
        db.commit()
        db.refresh(db_token)
        
        # Возвращаем токен клиенту
        return {"token": token_value, "expires_in": 300}  # 300 секунд = 5 минут
    except HTTPException as e:
        # Специальная обработка ошибки "пользователь не найден"
        if e.status_code == 401 and "X-Registration-Required" in e.headers:
            # Если это эндпоинт вызван из WebSocket соединения,
            # возвращаем информацию о необходимости заново авторизоваться
            print("Требуется регистрация/авторизация для получения WebSocket токена")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Требуется регистрация или повторная авторизация. Обновите страницу и войдите снова.",
                headers={"WWW-Authenticate": "Bearer", "X-Registration-Required": "true"},
            )
        # Для других ошибок просто передаем исключение дальше
        raise
    except Exception as e:
        print(f"Непредвиденная ошибка при создании WebSocket токена: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Произошла ошибка при создании токена. Пожалуйста, попробуйте позже."
        )

# Эндпоинт для получения публичного профиля Пациента по ID пользователя Пациента. Не требует авторизации.
@app.get("/patients/{user_id}/profile", response_model=PatientProfileResponse)
def read_patient_profile_by_user_id(user_id: int, db: DbDependency):
    """
    Получить публичный профиль Пациента по ID пользователя Пациента.
    Доступно без авторизации (пока).
    """
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Для любого пользователя можно получить профиль, если пациент существует
    profile = db.query(PatientProfile).filter(PatientProfile.user_id == user.id).first()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found for this user")
    return profile


# Add unread messages endpoint
@app.get(
    "/api/consultations/unread",
    response_model=dict,  # Явно указываем, что ответ - словарь
    tags=["consultations"],
)
async def get_unread_messages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Получить количество непрочитанных сообщений для каждой консультации пользователя.
    
    Returns:
        Dict[str, int]: Словарь, где ключи - ID консультаций, значения - количество непрочитанных сообщений
    """
    try:
        # Инициализируем пустой словарь для хранения результатов
        result = {}
            
        # Получаем все активные консультации пользователя
        consultations = []
        
        if current_user.role == "patient":
            consultations = (
                db.query(Consultation)
                .filter(
                    Consultation.patient_id == current_user.id,
                    Consultation.status.in_(["active", "completed"])
                )
                .all()
            )
        elif current_user.role == "doctor":
            consultations = (
                db.query(Consultation)
                .filter(
                    Consultation.doctor_id == current_user.id,
                    Consultation.status.in_(["active", "completed"])
                )
                .all()
            )
        else:
            # Если роль не patient и не doctor, возвращаем пустой объект
            return {"unread_counts": {}}
        
        # Словарь для хранения количества непрочитанных сообщений по консультациям
        unread_counts = {}
        
        # Для каждой консультации получаем количество непрочитанных сообщений
        for consultation in consultations:
            try:
                # Получаем непрочитанные сообщения, отправленные НЕ текущим пользователем
                unread_count = (
                    db.query(Message)
                    .filter(
                        Message.consultation_id == consultation.id,
                        Message.sender_id != current_user.id,
                        Message.is_read == False
                    )
                    .count()
                )
                
                # Если есть непрочитанные сообщения, добавляем их в словарь
                if unread_count > 0:
                    unread_counts[str(consultation.id)] = unread_count
            except Exception as inner_e:
                # Если возникла ошибка с конкретной консультацией, пропускаем ее
                print(f"Error processing consultation {consultation.id}: {str(inner_e)}")
                continue
        
        # Возвращаем структурированный объект вместо прямого словаря
        return {"unread_counts": unread_counts}
    except Exception as e:
        # Логируем ошибку для отладки
        print(f"Error getting unread messages: {str(e)}")
        # Возвращаем пустой объект вместо 500 ошибки
        return {"unread_counts": {}}


# Новый эндпоинт для получения полной истории сообщений консультации с оптимизацией
@app.get(
    "/api/consultations/{consultation_id}/messages/bulk",
    response_model=Dict[str, Any],
    tags=["consultations"],
)
async def get_consultation_messages_bulk(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Получить полную информацию о сообщениях консультации за один запрос.
    Это оптимизирует загрузку, получая все нужные данные за один запрос.
    """
    try:
        # Получаем информацию о консультации
        consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
        
        if not consultation:
            raise HTTPException(status_code=404, detail="Консультация не найдена")
        
        # Проверяем права доступа
        if current_user.id != consultation.patient_id and current_user.id != consultation.doctor_id:
            raise HTTPException(status_code=403, detail="У вас нет доступа к этой консультации")
        
        # Загружаем все сообщения консультации
        messages = db.query(Message).filter(Message.consultation_id == consultation_id).order_by(Message.sent_at.asc()).all()
        
        # Получаем данные профилей участников
        doctor = db.query(User).filter(User.id == consultation.doctor_id).first()
        patient = db.query(User).filter(User.id == consultation.patient_id).first()
        
        doctor_profile = None
        patient_profile = None
        
        if doctor:
            doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == doctor.id).first()
        
        if patient:
            patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == patient.id).first()
        
        # Помечаем непрочитанные сообщения как прочитанные
        unread_messages = db.query(Message).filter(
            Message.consultation_id == consultation_id,
            Message.sender_id != current_user.id,
            Message.is_read == False
        ).all()
        
        if unread_messages:
            for message in unread_messages:
                message.is_read = True
            db.commit()
        
        # Формируем информацию о последней активности
        last_activity = None
        if messages:
            last_message = messages[-1]
            last_activity = {
                "timestamp": last_message.sent_at.isoformat(),
                "sender_id": last_message.sender_id,
                "is_current_user": last_message.sender_id == current_user.id
            }
        
        # Собираем данные для ответа
        response_data = {
            "messages": [
                {
                    "id": message.id,
                    "consultation_id": message.consultation_id,
                    "sender_id": message.sender_id,
                    "content": message.content,
                    "sent_at": message.sent_at.isoformat(),
                    "is_read": message.is_read
                }
                for message in messages
            ],
            "consultation": {
                "id": consultation.id,
                "patient_id": consultation.patient_id,
                "doctor_id": consultation.doctor_id,
                "status": consultation.status,
                "created_at": consultation.created_at.isoformat(),
                "started_at": consultation.started_at.isoformat() if consultation.started_at else None,
                "completed_at": consultation.completed_at.isoformat() if consultation.completed_at else None,
                "message_limit": consultation.message_limit,
                "message_count": consultation.message_count,
                "patient_note": consultation.patient_note
            },
            "participants": {
                "doctor": {
                    "id": doctor.id if doctor else None,
                    "full_name": doctor_profile.full_name if doctor_profile else "Врач",
                    "avatar_path": doctor.avatar_path if doctor else None
                },
                "patient": {
                    "id": patient.id if patient else None,
                    "full_name": patient_profile.full_name if patient_profile else "Пациент",
                    "avatar_path": patient.avatar_path if patient else None
                }
            },
            "last_activity": last_activity
        }
        
        return response_data
    except HTTPException:
        # Пробрасываем HTTP исключения дальше
        raise
    except Exception as e:
        print(f"Ошибка при получении информации о консультации: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка сервера при получении данных консультации")

# Добавляем функцию для создания WebSocket токена после импортов и основных настроек
# Добавляем примерно на строке 120, перед существующими определениями функций

async def create_websocket_token(user_id: int, db: Session) -> str:
    """
    Создает новый WebSocket токен для пользователя и сохраняет его в базе данных.
    
    Args:
        user_id (int): ID пользователя
        db (Session): сессия базы данных
        
    Returns:
        str: Значение созданного токена
    """
    # Удаляем устаревшие токены для этого пользователя
    expired_tokens = db.query(WebSocketToken).filter(
        WebSocketToken.user_id == user_id,
        WebSocketToken.expires_at < datetime.utcnow()
    ).all()
    
    if expired_tokens:
        for token in expired_tokens:
            db.delete(token)
        db.commit()
    
    # Генерируем новый случайный токен
    token_value = secrets.token_urlsafe(32)
    
    # Устанавливаем срок действия токена (30 минут)
    expires_at = datetime.utcnow() + timedelta(minutes=30)
    
    # Создаем запись в базе данных
    db_token = WebSocketToken(
        user_id=user_id,
        token=token_value,
        expires_at=expires_at
    )
    
    # Сохраняем в базе данных
    db.add(db_token)
    db.commit()
    
    return token_value

@app.post(
    "/api/consultations/{consultation_id}/messages",
    response_model=MessageResponse,
    tags=["consultations"],
)
async def send_message(
    consultation_id: int,
    message_data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Отправляет сообщение в консультацию.
    Проверяет, есть ли у пользователя права на отправку сообщений в эту консультацию.
    """
    # Проверяем существование консультации
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not consultation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Консультация не найдена"
        )

    # Проверяем, что текущий пользователь является участником консультации
    if current_user.id != consultation.patient_id and current_user.id != consultation.doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="У вас нет доступа к этой консультации",
        )

    # Проверяем статус консультации
    if consultation.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Отправка сообщений доступна только для активных консультаций",
        )

    # Проверяем, не превышено ли максимальное количество сообщений
    if consultation.message_count >= consultation.message_limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Превышен лимит сообщений для этой консультации",
        )

    # Создаем сообщение
    db_message = Message(
        consultation_id=consultation_id,
        sender_id=current_user.id,
        content=message_data.content,
        is_read=False,  # Новое сообщение не прочитано
    )

    # Увеличиваем счетчик сообщений
    consultation.message_count += 1

    # Сохраняем сообщение и обновленную консультацию
    db.add(db_message)
    db.commit()
    db.refresh(db_message)

    # Определяем получателя сообщения
    recipient_id = consultation.patient_id if current_user.id == consultation.doctor_id else consultation.doctor_id

    # Определяем типы пользователей для уведомления
    sender_type = "доктор" if current_user.id == consultation.doctor_id else "пациент"
    
    # Получаем данные об отправителе
    sender_name = "Доктор"
    if current_user.id == consultation.doctor_id:
        doctor = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
        if doctor and doctor.full_name:
            sender_name = f"Доктор {doctor.full_name}"
    else:
        patient = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
        if patient and patient.full_name:
            sender_name = patient.full_name

    # Создаем уведомление о новом сообщении
    await create_notification(
        db=db,
        user_id=recipient_id,
        title="Новое сообщение",
        message=f"{sender_name}: {message_data.content[:50]}{'...' if len(message_data.content) > 50 else ''}",
        notification_type="message",
        related_id=consultation_id
    )

    # Пытаемся отправить сообщение через WebSocket
    try:
        # Формируем данные сообщения
        message_data = {
            "id": db_message.id,
            "consultation_id": db_message.consultation_id,
            "sender_id": db_message.sender_id,
            "content": db_message.content,
            "sent_at": db_message.sent_at.isoformat(),
            "is_read": db_message.is_read
        }
        
        # Отправляем через broadcast функцию
        await broadcast_consultation_update(
            consultation_id=consultation_id,
            update_data={
                "type": "new_message",
                "message": message_data
            }
        )
    except Exception as e:
        print(f"Error broadcasting message: {str(e)}")
        # Не выбрасываем исключение, продолжаем выполнение

    return db_message
