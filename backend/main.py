# backend/main.py

import os
import uuid # Импортируем uuid для генерации токенов
from fastapi import FastAPI, Depends, HTTPException, status, APIRouter, BackgroundTasks, Query # Добавляем BackgroundTasks для фоновых задач и Query для поиска
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer # Добавляем OAuth2PasswordRequestForm и OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Annotated, List, Optional, Union
from datetime import timedelta, datetime # Импортируем timedelta и datetime
from fastapi.middleware.cors import CORSMiddleware
import smtplib  # Для SMTP-соединения
from email.mime.text import MIMEText  # Для создания email
from email.mime.multipart import MIMEMultipart  # Для создания составных email
from math import ceil
from pydantic import BaseModel  # Для моделей данных

# Импортируем наши модели и функцию для получения сессии БД
from models import User, PatientProfile, DoctorProfile, get_db, DATABASE_URL, engine, Base # Добавляем модели профилей
# Импортируем функции для работы с паролями и JWT, а также зависимости для аутентификации и ролей
# get_current_user и require_role используются как зависимости в эндпоинтах
from auth import get_password_hash, verify_password, create_access_token, SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, get_current_user, require_role, authenticate_user, get_current_active_user, SECURE_TOKEN_LENGTH, Token as TokenModel, verify_google_token, authenticate_google_user

# Импортируем pydantic модели для валидации данных запросов и ответов
from schemas import UserCreate, UserResponse, Token, PatientProfileCreateUpdate, PatientProfileResponse, DoctorProfileCreateUpdate, DoctorProfileResponse, Field, DoctorFilter, DoctorBrief, DoctorDetail, DoctorListResponse # Импортируем Field (хотя он нужен только в schemas.py), DoctorFilter, DoctorBrief, DoctorDetail, DoctorListResponse


# Для загрузки .env файла (важно вызвать где-то в начале приложения, лучше в auth.py)
from dotenv import load_dotenv
# Убедимся, что load_dotenv() вызывается где-то перед использованием переменных окружения.
# В данном случае он вызывается и в models.py и в auth.py.
# Можно вызвать явно здесь, если уверены, что он не вызывается в импортируемых модулях:
load_dotenv()


# Определяем базовый URL для подтверждения email (адрес страницы фронтенда, куда пользователь перейдет по ссылке из письма)
# В реальном проекте это должна быть переменная окружения, читаемая из .env!
VERIFICATION_BASE_URL = os.getenv("VERIFICATION_BASE_URL", "http://localhost:5173/verify-email") # <-- TODO: Замени на актуальный URL твоего фронтенда!

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


app = FastAPI() # Создаем экземпляр FastAPI приложения
origins = [
    "http://localhost", # Разрешаем доступ с localhost (обычно для статики)
    "http://localhost:5173", # <--- РАЗРЕШАЕМ ДОСТУП С НАШЕГО ФРОНТЕНДА НА VITE!
    "http://127.0.0.1", # Разрешаем доступ с 127.0.0.1 (аналог localhost)
    "http://127.0.0.1:5173", # <--- РАЗРЕШАЕМ ДОСТУП С НАШЕГО ФРОНТЕНДА НА VITE (через 127.0.0.1)!
    # TODO: Добавить другие источники, если фронтенд будет доступен по другому адресу или порту
    # TODO: В продакшене здесь должен быть домен твоего сайта!
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # Список разрешенных источников
    allow_credentials=True, # Разрешаем использование cookie и учетных данных в запросах (например, для будущих сессий, хотя сейчас используем JWT)
    allow_methods=["*"], # Разрешаем все HTTP методы (GET, POST, PUT, DELETE и т.д.)
    allow_headers=["*"], # Разрешаем все заголовки в запросах (включая Authorization)
)


# Dependency для получения сессии базы данных. Используется в роутах для взаимодействия с БД.
# Annotated - современный способ указания типа и зависимости.
DbDependency = Annotated[Session, Depends(get_db)]

# Dependency для получения текущего авторизованного пользователя. Используется в защищенных роутах.
CurrentUser = Annotated[User, Depends(get_current_user)]


# --- Функция для отправки письма с помощью SMTP ---
def send_verification_email(email: str, token: str):
    """
    Функция для отправки письма с подтверждением email через SMTP.
    
    Args:
        email (str): Email пользователя.
        token (str): Токен подтверждения email.
    """
    # Формируем полную ссылку для подтверждения email
    verification_link = f"{VERIFICATION_BASE_URL}?token={token}"
    
    # Создаем объект для составного сообщения (HTML + текст)
    message = MIMEMultipart("alternative")
    message["Subject"] = "Подтверждение email для платформы онлайн-консультаций с врачами"
    message["From"] = EMAIL_FROM
    message["To"] = email
    
    # Создаем простой текстовый вариант письма
    text = f"""
    Здравствуйте!
    
    Спасибо за регистрацию на платформе онлайн-консультаций с врачами.
    Для подтверждения вашего email, пожалуйста, перейдите по следующей ссылке:
    
    {verification_link}
    
    Если вы не регистрировались на нашем сайте, просто проигнорируйте это письмо.
    
    С уважением,
    Команда платформы онлайн-консультаций с врачами
    """
    
    # Создаем HTML версию письма (с красивым форматированием)
    html = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #1976d2; color: white; padding: 20px; text-align: center; }}
            .content {{ padding: 20px; }}
            .button {{ display: inline-block; background-color: #1976d2; color: white; 
                      padding: 10px 20px; text-decoration: none; border-radius: 5px; 
                      margin: 20px 0; }}
            .footer {{ font-size: 12px; color: #888; margin-top: 30px; text-align: center; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Подтверждение Email</h1>
            </div>
            <div class="content">
                <p>Здравствуйте!</p>
                <p>Спасибо за регистрацию на платформе онлайн-консультаций с врачами.</p>
                <p>Для подтверждения вашего email, пожалуйста, нажмите на кнопку ниже:</p>
                <p style="text-align: center;">
                    <a href="{verification_link}" class="button">Подтвердить Email</a>
                </p>
                <p>Или перейдите по следующей ссылке:</p>
                <p><a href="{verification_link}">{verification_link}</a></p>
                <p>Если вы не регистрировались на нашем сайте, просто проигнорируйте это письмо.</p>
            </div>
            <div class="footer">
                <p>С уважением,<br>Команда платформы онлайн-консультаций с врачами</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    # Прикрепляем текстовую и HTML части к сообщению
    part1 = MIMEText(text, "plain")
    part2 = MIMEText(html, "html")
    message.attach(part1)
    message.attach(part2)
    
    try:
        # Создаем соединение с SMTP-сервером
        server = smtplib.SMTP(EMAIL_HOST, EMAIL_PORT)
        server.starttls()  # Включаем шифрование
        
        # Авторизуемся на сервере
        server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
        
        # Отправляем сообщение
        server.sendmail(EMAIL_FROM, email, message.as_string())
        
        # Закрываем соединение
        server.quit()
        
        print(f"Email verification sent to {email}")
    except Exception as e:
        # В случае ошибки выводим сообщение в консоль
        # В продакшене здесь должна быть реализована система логирования ошибок
        print(f"Error sending email: {e}")
        
        # В случае ошибки отправки, выводим ссылку в консоль (как запасной вариант)
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
@app.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED) # 201 Created - стандартный статус для успешного создания
def register_user(
    user: UserCreate, # Pydantic модель для валидации входных данных запроса
    db: DbDependency, # Зависимость для получения сессии БД
    background_tasks: BackgroundTasks # Зависимость для выполнения задач в фоновом режиме (например, отправки письма)
):
    """
    Регистрация нового пользователя (Пациента, Врача или Администратора).
    Пользователь будет создан как неактивный и получит ссылку для подтверждения email.
    """
    # Проверяем, существует ли пользователь с таким email в базе данных
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        # Если пользователь с таким email уже зарегистрирован, возвращаем ошибку 400 Bad Request
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    # Хешируем пароль перед сохранением в базе данных. НИКОГДА не храните пароли в открытом виде!
    hashed_password = get_password_hash(user.password)

    # Генерируем уникальный токен подтверждения email (используем UUID - Universally Unique Identifier)
    verification_token = str(uuid.uuid4())
    # Сохраняем метку времени создания токена (для проверки срока действия)
    token_created_at = datetime.utcnow()

    # Создаем новый объект пользователя SQLAlchemy на основе данных из запроса и сгенерированных полей
    new_user = User(
        email=user.email,
        hashed_password=hashed_password,
        is_active=False, # <--- Новый пользователь создается как НЕАКТИВНЫЙ
        role=user.role,
        email_verification_token=verification_token, # Сохраняем токен подтверждения в БД
        email_verification_token_created_at=token_created_at # Сохраняем время создания токена в БД
    )

    # Добавляем нового пользователя в сессию базы данных и сохраняем изменения (commit)
    db.add(new_user)
    db.commit()
    # Обновляем объект new_user, чтобы получить сгенерированный базой данных id и другие актуальные поля
    db.refresh(new_user)

    # Отправляем письмо с подтверждением email в фоновом режиме.
    # BackgroundTasks позволяют выполнить функцию асинхронно, не блокируя ответ на запрос регистрации.
    background_tasks.add_task(send_verification_email, new_user.email, verification_token)

    # Возвращаем ответ с данными созданного пользователя.
    # Pydantic UserResponse с from_attributes=True автоматически преобразует объект SQLAlchemy в Pydantic модель.
    return new_user


# Эндпоинт для авторизации (получения JWT токена). Не требует авторизации, но проверяет учетные данные.
# Используем стандартную форму OAuth2 Password Request Form (email/password).
@app.post("/token", response_model=Token) # response_model=Token указывает, что в ответ ожидается Pydantic модель Token
def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()], # Зависимость для получения стандартной формы email/password
    db: DbDependency # Зависимость для получения сессии БД
):
    """
    Авторизация пользователя по email и паролю и получение JWT токена доступа.
    Доступ разрешен только для АКТИВНЫХ пользователей.
    """
    # Ищем пользователя в базе данных по email (который в OAuth2PasswordRequestForm приходит как username)
    user = db.query(User).filter(User.email == form_data.username).first()

    # Проверяем, найден ли пользователь и совпадает ли введенный пароль с хешированным паролем в БД.
    if not user or not verify_password(form_data.password, user.hashed_password):
        # Если пользователь не найден или пароль неверный, возвращаем ошибку 401 Unauthorized
        # headers={"WWW-Authenticate": "Bearer"} указывает клиенту, что требуется аутентификация по Bearer токену.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # <--- НОВАЯ ПРОВЕРКА: пользователь должен быть активен (подтвердил email)
    if not user.is_active:
         # Если пользователь неактивен, возвращаем ошибку 401 Unauthorized
         # Сообщение об ошибке указывает на причину.
         raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, # Можно также использовать 403 Forbidden, в зависимости от бизнес-логики. 401 более подходит, если это часть процесса аутентификации.
            detail="Email not confirmed. Please check your inbox for verification link.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # ---> Конец новой проверки

    # Если все проверки пройдены (пользователь найден, пароль верный, пользователь активен), создаем JWT токен.
    # Время жизни токена доступа.
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    # Создаем токен, включая email ('sub') и роль ('role') пользователя в payload.
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role},
        expires_delta=access_token_expires
    )

    # Возвращаем ответ с токеном доступа и его типом.
    return {"access_token": access_token, "token_type": "bearer"}


# Эндпоинт для получения информации о текущем авторизованном пользователе. Требует авторизации.
@app.get("/users/me", response_model=UserResponse) # response_model=UserResponse для форматирования ответа
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
@app.get("/verify-email")
def verify_email(token: str, db: DbDependency): # Принимает токен как параметр запроса (?token=...)
    """
    Подтверждение email по токену из письма.
    Активирует пользователя, если токен валиден и не просрочен.
    """
    # Настройки времени жизни токена подтверждения email (например, 24 часа)
    # TODO: Вынести это в настройки или переменные окружения
    VERIFICATION_TOKEN_EXPIRE_HOURS = 24

    # Ищем пользователя в базе данных по предоставленному токену подтверждения email
    user = db.query(User).filter(User.email_verification_token == token).first()

    if user is None:
        # Если токен не найден в базе данных, он недействителен.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, # 400 Bad Request - некорректный запрос/токен
            detail="Invalid verification token"
        )

    # Проверяем, не истек ли срок действия токена.
    # Сравниваем текущее время (UTC) с временем создания токена.
    token_lifetime = datetime.utcnow() - user.email_verification_token_created_at
    if token_lifetime > timedelta(hours=VERIFICATION_TOKEN_EXPIRE_HOURS):
        # Если разница во времени превышает установленный срок жизни токена.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, # 400 Bad Request - просроченный токен
            detail="Verification token expired"
        )

    # Если токен найден, не просрочен и связан с существующим пользователем, активируем пользователя.
    user.is_active = True
    # Очищаем поля токена после использования для безопасности (токен становится одноразовым).
    user.email_verification_token = None
    user.email_verification_token_created_at = None

    # Сохраняем изменения в базе данных
    db.commit()
    db.refresh(user) # Обновляем объект пользователя, чтобы убедиться, что изменения сохранены

    # Возвращаем сообщение об успешном подтверждении.
    # В реальном приложении фронтенд может перенаправить пользователя на страницу логина после этого запроса.
    return {"message": "Email successfully verified. You can now log in."}


# --- Роуты для профилей ---

# Эндпоинт для создания или обновления профиля Пациента. Требует авторизации и роли 'patient'.
@app.post("/patients/profiles", response_model=PatientProfileResponse, status_code=status.HTTP_201_CREATED)
def create_patient_profile(
    profile_data: PatientProfileCreateUpdate, # Данные профиля из запроса (Pydantic модель)
    db: DbDependency, # Зависимость для сессии БД
    # Зависимость для получения текущего пользователя и проверки его роли.
    # Только пользователь с ролью 'patient' сможет успешно пройти эту зависимость.
    current_user: Annotated[User, Depends(require_role("patient"))]
):
    """
    Создать или обновить профиль Пациента для текущего авторизованного пользователя.
    Доступно только для пользователей с ролью 'patient'.
    """
    # Проверяем, существует ли профиль пациента для текущего пользователя (по user_id, связанному с current_user.id)
    db_profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()

    if db_profile:
        # Если профиль уже есть, обновляем его поля на основе данных из запроса.
        # profile_data.model_dump(exclude_unset=True) создает словарь из Pydantic модели,
        # исключая поля, которые не были явно указаны в запросе (None поля включаются, если они указаны).
        for key, value in profile_data.model_dump(exclude_unset=True).items():
            # Обновляем атрибуты объекта SQLAlchemy db_profile
            setattr(db_profile, key, value)
        db.commit() # Сохраняем изменения в БД
        db.refresh(db_profile) # Обновляем объект из БД
        return db_profile # Возвращаем обновленный профиль
    else:
        # Если профиля нет, создаем новый объект PatientProfile
        new_profile = PatientProfile(
            user_id=current_user.id, # Связываем профиль с текущим пользователем
            **profile_data.model_dump() # Распаковываем данные из Pydantic модели PatientProfileCreateUpdate в аргументы конструктора PatientProfile
        )
        db.add(new_profile) # Добавляем новый профиль в сессию
        db.commit() # Сохраняем в БД
        db.refresh(new_profile) # Обновляем объект
        return new_profile # Возвращаем созданный профиль


# Эндпоинт для создания или обновления профиля Врача. Требует авторизации и роли 'doctor'.
@app.post("/doctors/profiles", response_model=DoctorProfileResponse, status_code=status.HTTP_201_CREATED)
def create_doctor_profile(
    profile_data: DoctorProfileCreateUpdate, # Данные профиля из запроса
    db: DbDependency, # Сессия БД
    current_user: Annotated[User, Depends(require_role("doctor"))] # Требуем роль 'doctor'
):
    """
    Создать или обновить профиль Врача для текущего авторизованного пользователя.
    Доступно только для пользователей с ролью 'doctor'.
    """
    # Проверяем, существует ли профиль врача для текущего пользователя
    db_profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()

    if db_profile:
        # Если профиль уже есть, обновляем его
        for key, value in profile_data.model_dump(exclude_unset=True).items():
            setattr(db_profile, key, value)
        db.commit()
        db.refresh(db_profile)
        return db_profile
    else:
        # Если профиля нет, создаем новый
        new_profile = DoctorProfile(user_id=current_user.id, **profile_data.model_dump())
        db.add(new_profile)
        db.commit()
        db.refresh(new_profile)
        return new_profile


# Эндпоинт для получения профиля текущего авторизованного пользователя (Пациента или Врача). Требует авторизации.
# response_model=Annotated[PatientProfileResponse | DoctorProfileResponse, ...] указывает, что эндпоинт может вернуть одну из двух Pydantic моделей.
@app.get("/users/me/profile", response_model=Annotated[PatientProfileResponse | DoctorProfileResponse, ...])
def read_my_profile(db: DbDependency, current_user: CurrentUser): # Требует просто авторизации
    """
    Получить профиль текущего авторизованного пользователя (Пациента или Врача).
    Доступно для всех авторизованных пользователей с ролью 'patient' или 'doctor'.
    """
    # Проверяем роль текущего пользователя и ищем соответствующий профиль.
    if current_user.role == "patient":
        profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
        if profile is None:
            # Если профиль пациента не найден (хотя пользователь есть и роль 'patient')
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
        # Возвращаем объект SQLAlchemy профиля пациента. FastAPI/Pydantic преобразует его в PatientProfileResponse.
        return profile
    elif current_user.role == "doctor":
        profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
        if profile is None:
            # Если профиль врача не найден
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")
        # Возвращаем объект SQLAlchemy профиля врача. FastAPI/Pydantic преобразует его в DoctorProfileResponse.
        return profile
    else:
        # Если у пользователя роль, для которой профиль не предусмотрен (например, 'admin')
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User role does not have a profile type")


# Эндпоинт для получения публичного профиля Врача по ID пользователя Врача. Пока не требует авторизации.
@app.get("/doctors/{user_id}/profile", response_model=DoctorProfileResponse)
def read_doctor_profile_by_user_id(user_id: int, db: DbDependency): # Не требует авторизации (пока)
    """
    Получить публичный профиль Врача по ID пользователя Врача.
    Доступно без авторизации (пока).
    """
    # Ищем пользователя по предоставленному ID
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        # Если пользователь не найден
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Проверяем, что найденный пользователь является Врачом.
    if user.role != "doctor":
        # Если пользователь не врач, возвращаем 404 (или 400, в зависимости от того, хотим ли мы скрывать существование пользователя)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User is not a doctor or their profile is not public")

    # Ищем профиль Врача, связанный с этим пользователем.
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
    if profile is None:
        # Если профиль врача не найден (хотя пользователь есть и роль 'doctor')
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found for this user")

    # Возвращаем объект SQLAlchemy профиля врача. FastAPI/Pydantic преобразует его в DoctorProfileResponse.
    return profile


# --- Эндпоинты для поиска врачей ---

# Получение списка всех врачей с опциональной фильтрацией
@app.get("/api/doctors", response_model=DoctorListResponse, tags=["doctors"])
async def get_doctors(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),  # Опционально, может быть None для публичного доступа
    specialization: Optional[str] = Query(None, description="Фильтр по специализации"),
    practice_area: Optional[str] = Query(None, description="Фильтр по району практики"),
    min_price: Optional[int] = Query(None, description="Минимальная стоимость"),
    max_price: Optional[int] = Query(None, description="Максимальная стоимость"),
    page: int = Query(1, description="Номер страницы (начиная с 1)"),
    size: int = Query(10, description="Размер страницы (количество элементов)")
):
    """
    Получение списка всех врачей с возможностью фильтрации по специализации, району практики и диапазону цен.
    Поддерживает пагинацию для большого количества результатов.
    """
    # Создаем базовый запрос на получение всех врачей
    query = db.query(DoctorProfile)
    
    # Применяем фильтры, если они указаны
    if specialization:
        query = query.filter(DoctorProfile.specialization.ilike(f"%{specialization}%"))
    if practice_area:
        query = query.filter(DoctorProfile.practice_areas.ilike(f"%{practice_area}%"))
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
        "pages": pages
    }

# Получение детальной информации о враче по ID
@app.get("/api/doctors/{doctor_id}", response_model=DoctorDetail, tags=["doctors"])
async def get_doctor_by_id(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)  # Опционально для публичного доступа
):
    """
    Получение детальной информации о враче по ID.
    Доступно как для авторизованных, так и для неавторизованных пользователей.
    """
    doctor = db.query(DoctorProfile).filter(DoctorProfile.id == doctor_id).first()
    
    if not doctor:
        raise HTTPException(status_code=404, detail="Врач не найден")
    
    # Создаем объект с расширенной информацией
    doctor_detail = doctor.__dict__.copy()
    
    # Добавляем заглушки для рейтинга и количества отзывов
    # В реальном приложении эти данные будут получены из соответствующих таблиц
    doctor_detail["rating"] = 4.5  # Заглушка, в будущем будет рассчитываться из таблицы отзывов
    doctor_detail["reviews_count"] = 10  # Заглушка, в будущем будет считаться из таблицы отзывов
    
    return doctor_detail


# --- TODO: Добавить дополнительные эндпоинты (консультации, отзывы, платежи) ---

# Модель для Google OAuth запроса
class GoogleAuthRequest(BaseModel):
    code: str

# Добавляем новый маршрут для Google OAuth авторизации
@app.post("/auth/google", response_model=Token)
async def google_auth(
    data: GoogleAuthRequest,
    db: DbDependency
):
    """
    Обработка авторизации через Google OAuth.
    Принимает код авторизации от Google, получает данные пользователя,
    создает/обновляет пользователя в БД и возвращает JWT-токен.
    """
    try:
        # Верифицируем код авторизации и получаем данные пользователя от Google
        try:
            google_data = await verify_google_token(data.code)
        except HTTPException as e:
            if "invalid_grant" in str(e):
                # Это часто происходит при повторном использовании кода авторизации
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Google authorization code has already been used or expired. Please try again with a new authentication flow.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            # Пробрасываем исходное исключение, если это не invalid_grant
            raise
        
        # Аутентифицируем или создаем пользователя на основе данных Google
        user = await authenticate_google_user(google_data, db)
        
        # Создаем JWT токен для пользователя
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email, "role": user.role},
            expires_delta=access_token_expires
        )
        
        # Возвращаем токен
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google authentication failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


# Класс для хранения данных профиля пользователя после Google регистрации
class UserProfileData(BaseModel):
    role: str = "patient"  # По умолчанию - пациент
    full_name: str
    contact_phone: Optional[str] = None
    contact_address: Optional[str] = None
    district: Optional[str] = None  # Район


# Эндпоинт для создания/обновления профиля пользователя после Google авторизации
@app.post("/users/me/google-profile", response_model=Union[PatientProfileResponse, DoctorProfileResponse])
async def create_update_google_profile(
    profile_data: UserProfileData,
    db: DbDependency,
    current_user: CurrentUser
):
    """
    Создает или обновляет профиль пользователя после авторизации через Google.
    """
    # Проверяем, существует ли у пользователя профиль
    if profile_data.role == "patient":
        # Проверяем, существует ли профиль пациента
        profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
        
        if not profile:
            # Создаем новый профиль пациента
            profile = PatientProfile(
                user_id=current_user.id,
                full_name=profile_data.full_name,
                contact_phone=profile_data.contact_phone,
                contact_address=profile_data.contact_address
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
        profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
        
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
                practice_areas=profile_data.district if profile_data.district else ""
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
            detail="Invalid role specified. Must be 'patient' or 'doctor'."
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
        "Яшнабадский район"
    ]
    return districts