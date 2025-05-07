# backend/auth.py

import os
import requests  # Добавляем для HTTP-запросов к Google API
import time # Добавляем для работы с временем и задержками
import hashlib # Добавляем для хеширования
import secrets # Добавляем для генерации случайных строк
from datetime import datetime, timedelta
from typing import Optional, Annotated, Dict, List # Добавляем Dict для типизации словарей
from models import User, get_db

# Импорты для FastAPI зависимостей и обработки токена
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer # Для схемы Bearer токена

# Импорт для работы с базой данных в зависимости
from sqlalchemy.orm import Session

# Импорты для хеширования паролей
from passlib.context import CryptContext

# Импорты для работы с JWT
from jose import JWTError, jwt

# Импорт для загрузки переменных окружения из .env файла
from dotenv import load_dotenv

# Загружаем переменные окружения из .env файла.
# Это должно происходить ДО попытки чтения переменных типа SECRET_KEY.
# load_dotenv() ищет .env файл в текущей директории и родительских.
load_dotenv()

# --- Настройки для Google OAuth ---
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "735617581412-e8ceb269bj7qqrv9sl066q63g5dr5sne.apps.googleusercontent.com")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "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")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:5173/auth/google/callback")

# --- Настройки для JWT ---

# Секретный ключ для подписи JWT. Считывается из переменной окружения SECRET_KEY.
# Эту переменную нужно установить в вашем .env файле или в окружении сервера.
SECRET_KEY = os.getenv("SECRET_KEY")

# Проверяем, что SECRET_KEY установлен. Если нет, приложение не должно запускаться,
# так как подпись JWT является критически важной для безопасности.
# Проверяем, что SECRET_KEY установлен. Если нет, генерируем случайный ключ (только для разработки)
if SECRET_KEY is None:
    # Для разработки создаем случайный ключ, но ТОЛЬКО для разработки
    # В продакшене это не безопасно - ключ будет меняться при каждом перезапуске
    import secrets
    SECRET_KEY = secrets.token_hex(32)
    print(f"WARNING: SECRET_KEY not set in environment. Generated random key for development: {SECRET_KEY}")
    print("DO NOT USE THIS IN PRODUCTION. Set SECRET_KEY in .env file or environment variables.")

# Алгоритм шифрования для JWT. HS256 - распространенный выбор для HMAC подписи.
ALGORITHM = "HS256"

# Время жизни токена доступа в минутах.
ACCESS_TOKEN_EXPIRE_MINUTES = 30 # 30 минут - стандартное время для токенов доступа

# Время жизни CSRF токена в секундах (30 минут)
CSRF_TOKEN_EXPIRE_TIME = 1800

# Словарь для хранения CSRF токенов (user_id -> {token, expiry})
CSRF_TOKENS: Dict[str, Dict[str, any]] = {}

# Словарь для хранения попыток входа (email -> список временных меток)
LOGIN_ATTEMPTS: Dict[str, List[float]] = {}

# Максимальное количество попыток входа
MAX_LOGIN_ATTEMPTS = 5

# Время блокировки после превышения попыток в секундах (5 минут)
LOGIN_COOLDOWN_TIME = 300

# Длина безопасного токена (для верификации email и т.д.)
SECURE_TOKEN_LENGTH = 32

# --- Схема OAuth2 для получения токена из заголовка ---

# Настраиваем схему OAuth2 Bearer. FastAPI будет ожидать токен в заголовке "Authorization: Bearer <токен>".
# tokenUrl="/token" указывает клиенту (например, в Swagger UI), где получить новый токен, если требуется.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")


# --- Настройки для хеширования паролей ---

# Инициализируем контекст для работы с паролями. Используем алгоритм bcrypt - рекомендуемый и стойкий.
# schemes=["bcrypt"] - указываем используемый алгоритм.
# deprecated="auto" - позволяет библиотеке автоматически определять устаревшие хэши (если они есть).
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# --- Функции для работы с паролями ---

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Проверяет соответствие введенного (нехешированного) пароля
    сохраненному хешированному паролю.
    Использует алгоритм, настроенный в pwd_context (bcrypt).
    """
    # pwd_context.verify обрабатывает соль и сравнивает хэши
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Генерирует хэш для заданного пароля.
    Использует алгоритм, настроенный в pwd_context (bcrypt).
    """
    # pwd_context.hash автоматически генерирует соль и создает хэш
    return pwd_context.hash(password)


# --- Функции для работы с JWT ---

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Создает JWT токен доступа.

    Args:
        data (dict): Словарь данных для включения в payload токена.
                     Обычно включает идентификатор пользователя ('sub') и, возможно, роль ('role').
        expires_delta (Optional[timedelta]): Объекту timedelta, определяющий
                                             время жизни токена.
                                             Если None, используется ACCESS_TOKEN_EXPIRE_MINUTES.

    Returns:
        str: Кодированный JWT токен (строка).
    """
    # Копируем исходные данные, чтобы не изменять переданный словарь
    to_encode = data.copy()

    # Устанавливаем время истечения токена
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        # Если время жизни не указано, используем дефолтное значение из настроек
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    # Добавляем метку времени истечения 'exp' (timestamp) в payload.
    # JWT стандарты используют Unix Timestamp. jwt.encode делает это автоматически.
    to_encode.update({"exp": expire})
    
    # Добавляем время создания токена и случайный идентификатор для защиты от replay-атак
    to_encode.update({"iat": datetime.utcnow(), "jti": secrets.token_hex(16)})

    # Кодируем payload в JWT токен, используя секретный ключ и алгоритм.
    # SECRET_KEY должен быть известен только серверу, который подписывает токены,
    # и серверам, которые их проверяют.
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return encoded_jwt


# --- Функция для Google OAuth ---
async def verify_google_token(token: str) -> dict:
    """
    Верифицирует код авторизации Google OAuth и получает данные пользователя
    
    Args:
        token (str): Код авторизации от Google OAuth

    Returns:
        dict: Данные пользователя, полученные от Google
        
    Raises:
        HTTPException: Если токен невалидный или произошла ошибка
    """
    try:
        # Обмен кода авторизации на токены
        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            "code": token,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code"
        }
        
        token_response = requests.post(token_url, data=token_data)
        token_response.raise_for_status()  # Проверка на ошибки HTTP
        tokens = token_response.json()
        
        # Получение данных пользователя с помощью access token
        userinfo_url = "https://www.googleapis.com/oauth2/v3/userinfo"
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        
        userinfo_response = requests.get(userinfo_url, headers=headers)
        userinfo_response.raise_for_status()
        
        return userinfo_response.json()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate Google credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

# --- Функция для аутентификации через Google ---
async def authenticate_google_user(google_data: dict, db: Session) -> User:
    """
    Аутентифицирует или создает пользователя на основе данных от Google OAuth
    
    Args:
        google_data (dict): Данные пользователя от Google
        db (Session): Сессия базы данных
        
    Returns:
        User: Объект пользователя
    """
    # Извлекаем email пользователя из данных Google
    email = google_data.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Google user data: email is required"
        )
    
    # Проверяем, существует ли пользователь с таким email
    user = db.query(User).filter(User.email == email).first()
    
    # Если пользователь существует, проверяем его auth_provider
    if user:
        # Если пользователь зарегистрирован через email (не Google)
        if user.auth_provider == "email":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email is already registered with password. Please login with email and password instead."
            )
            
        # Убедимся, что пользователь активирован (так как Google подтверждает email)
        if not user.is_active:
            user.is_active = True
            db.commit()
            db.refresh(user)  # Обновляем объект пользователя после изменений
        
        return user
    
    # Если пользователя нет, создаем нового с ролью "patient" по умолчанию
    # Пароль не нужен, так как вход через Google
    hashed_password = get_password_hash(os.urandom(32).hex())  # Генерируем случайный пароль
    
    # Создаем информацию о пользователе из данных Google
    name = google_data.get("name", "")
    
    new_user = User(
        email=email,
        hashed_password=hashed_password,
        is_active=True,  # Пользователь сразу активирован, так как Google подтверждает email
        role="patient",  # По умолчанию роль - пациент
        auth_provider="google"  # Устанавливаем провайдер аутентификации Google
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


# --- Зависимости FastAPI для аутентификации и проверки ролей ---

# TokenData - это Pydantic модель для payload токена.
# Можно использовать для более явного определения данных, которые мы ожидаем в токене.
# Пока не используем ее в get_current_user для простоты, но это хорошая практика для больших проектов.
from pydantic import BaseModel
class TokenData(BaseModel):
    username: str | None = None
    role: str | None = None # Добавляем поле role, т.к. мы его кладем в токен

# Модель для токена аутентификации
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --- Дополнительные настройки безопасности ---

# Функция для проверки попыток входа и блокировки
def check_login_attempts(email: str) -> bool:
    """
    Проверяет, не превышено ли количество попыток входа для данного email.
    Если превышено, проверяет, не истекло ли время блокировки.
    
    Args:
        email (str): Email пользователя
        
    Returns:
        bool: True, если вход разрешен, иначе False
    """
    # Полностью отключаем проверку rate limit и всегда возвращаем True
    print(f"Rate limiting check disabled for {email}")
    return True

# Функция для создания CSRF-токена
def create_csrf_token(user_id: int) -> str:
    """
    Создает CSRF-токен для защиты форм.
    
    Args:
        user_id (int): ID пользователя
        
    Returns:
        str: CSRF-токен
    """
    token = secrets.token_hex(32)
    expiry = time.time() + CSRF_TOKEN_EXPIRE_TIME
    
    # Сохраняем токен и время его истечения
    CSRF_TOKENS[str(user_id)] = {
        "token": token,
        "expiry": expiry
    }
    
    return token

# Функция для проверки CSRF-токена
def verify_csrf_token(user_id: int, token: str) -> bool:
    """
    Проверяет валидность CSRF-токена.
    
    Args:
        user_id (int): ID пользователя
        token (str): CSRF-токен для проверки
        
    Returns:
        bool: True, если токен валидный и не истек, иначе False
    """
    user_id_str = str(user_id)
    
    # Проверяем, существует ли токен для данного пользователя
    if user_id_str not in CSRF_TOKENS:
        return False
    
    token_data = CSRF_TOKENS[user_id_str]
    
    # Проверяем, не истек ли токен
    if time.time() > token_data["expiry"]:
        # Удаляем устаревший токен
        del CSRF_TOKENS[user_id_str]
        return False
    
    # Проверяем совпадение токенов
    if token_data["token"] != token:
        return False
    
    return True

# Функция для получения текущего пользователя (используется как зависимость)
async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: Session = Depends(get_db)):
    """
    Получение текущего пользователя на основе JWT токена.
    Используется как зависимость для защищенных эндпоинтов.

    Args:
        token (str): JWT токен, полученный из HTTP заголовка
        db (Session): Сессия БД

    Returns:
        User: Объект пользователя, если токен валиден
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Декодируем JWT токен
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        
        # Проверяем, не истек ли токен
        expiry = payload.get("exp")
        if expiry is None or datetime.fromtimestamp(expiry) < datetime.utcnow():
            raise credentials_exception
        
        # Проверяем наличие JTI (JWT ID) для защиты от replay-атак
        if "jti" not in payload:
            raise credentials_exception
            
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    # Ищем пользователя в БД по email из токена
    user = db.query(User).filter(User.email == token_data.username).first()
    if user is None:
        raise credentials_exception
    return user


def require_role(role: str):
    """
    Фабрика зависимостей FastAPI. Создает зависимость, которая проверяет,
    имеет ли текущий авторизованный пользователь указанную роль.
    Эта зависимость ДОЛЖНА использоваться ПОСЛЕ зависимости get_current_user.

    Args:
        role (str): Требуемая роль пользователя (например, 'patient', 'doctor', 'admin').

    Returns:
        Callable: Зависимость FastAPI, которая принимает текущего пользователя
                  и проверяет его роль. Возвращает объект пользователя, если роль совпадает,
                  иначе выбрасывает HTTPException 403 Forbidden.
    """
    # Это внутренняя функция (замыкание), которая будет возвращена фабрикой require_role.
    # Она сама использует зависимость get_current_user для получения объекта пользователя.
    async def role_checker(
        # Получаем текущего пользователя, используя зависимость get_current_user.
        # FastAPI позаботится о вызове get_current_user перед вызовом role_checker.
        current_user: Annotated[User, Depends(get_current_user)]
    ) -> User:
        """Проверяет, совпадает ли роль текущего пользователя с требуемой."""
        if current_user.role != role:
            # Если роль пользователя не совпадает с требуемой, выбрасываем ошибку 403 (Forbidden).
            # Это означает, что пользователь авторизован, но у него нет прав на этот ресурс.
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, # 403 - Доступ запрещен
                detail=f"User must have '{role}' role to access this resource",
            )
        # Если роль совпадает, просто возвращаем объект пользователя.
        # Этот объект пользователя будет доступен в эндпоинте.
        return current_user

    # Фабрика require_role возвращает саму функцию role_checker,
    # которую затем можно использовать в Depends() в определениях эндпоинтов.
    return role_checker

# Примеры использования в main.py:
# Чтобы эндпоинт требовал просто аутентификации:
# @app.get("/some-data/", dependencies=[Depends(get_current_user)])
# async def get_data(current_user: User = Depends(get_current_user)):
#     # Код здесь выполнится только для любого авторизованного пользователя.
#     pass

# Чтобы эндпоинт требовал аутентификации И роли 'patient':
# @app.get("/patient-data/", dependencies=[Depends(require_role("patient"))])
# async def get_patient_data(current_user: User = Depends(get_current_user)):
#     # Код здесь выполнится только для авторизованного пользователя с ролью 'patient'.
#     # current_user уже прошел проверку роли.
#     pass

# Альтернативный (более явный) способ использования require_role:
# @app.get("/patient-data/")
# async def get_patient_data(current_user: Annotated[User, Depends(require_role("patient"))]):
#     # Этот синтаксис Annotated также явно указывает, что current_user - это User,
#     # полученный через зависимость require_role("patient").
#     pass

# Добавляем недостающую функцию authenticate_user
async def authenticate_user(email: str, password: str, db: Session) -> Optional[User]:
    """
    Функция аутентификации пользователя.
    Возвращает объект пользователя, если креды верны, иначе None.
    """
    try:
        # Проверка rate limiting отключена
        
        # Ищем пользователя с нужным email
        user = db.query(User).filter(User.email == email).first()
        
        # Если пользователь не найден
        if not user:
            # Не регистрируем попытку входа для несуществующего email
            print(f"User not found: {email}")
            # Бросаем исключение вместо возврата None
            raise ValueError("User not found")
        
        # Если пользователь аутентифицирован через Google, не позволяем ему использовать пароль
        if user.auth_provider == "google":
            # Бросаем исключение вместо возврата None
            raise ValueError("User authenticated via Google")

        # Проверяем пароль. Если неверный, возвращаем None.
        if not verify_password(password, user.hashed_password):
            # Не регистрируем неудачную попытку входа
            print(f"Invalid password for user: {email}")
            # Бросаем исключение вместо возврата None
            raise ValueError("Invalid password")
        
        # Не сбрасываем историю попыток входа - rate limiting отключен
        
        # Если все проверки прошли, возвращаем пользователя.
        return user
    except ValueError as e:
        # Перехватываем только ValueError, которые генерируем сами
        print(f"Authentication error: {e}")
        return None
    except Exception as e:
        # Логируем другие ошибки для отладки, но не показываем её пользователю
        # (из соображений безопасности)
        print(f"Authentication error: {e}")
        return None

# Добавляем функцию get_current_active_user
async def get_current_active_user(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    """
    Зависимость FastAPI. Проверяет, что текущий пользователь активен.
    
    Args:
        current_user (User): Объект пользователя, предоставленный зависимостью get_current_user.
        
    Returns:
        User: Объект пользователя, если он активен.
        
    Raises:
        HTTPException: С кодом 400 (Bad Request), если пользователь неактивен.
    """
    # Проверяем, активен ли пользователь
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user

# Функция для сброса счетчика неудачных попыток входа
def reset_login_attempts(username: str) -> None:
    """
    Сбрасывает счетчик неудачных попыток входа для заданного пользователя.
    """
    # Функция отключена
    print(f"Login attempts reset disabled for {username}")

def increment_login_attempts(username: str) -> None:
    """
    Увеличивает счетчик неудачных попыток входа для заданного пользователя.
    """
    # Функция отключена 
    print(f"Login attempt tracking disabled for {username}")