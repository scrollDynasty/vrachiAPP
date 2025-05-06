# backend/auth.py

import os
import requests  # Добавляем для HTTP-запросов к Google API
from datetime import datetime, timedelta
from typing import Optional, Annotated # Добавляем Annotated
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
if SECRET_KEY is None:
     # В продакшене лучше использовать более надежный способ обработки отсутствия ключа.
     # raise ValueError при импорте приведет к остановке приложения при старте.
     raise ValueError("SECRET_KEY environment variable is not set. Make sure you have a .env file with SECRET_KEY, or it's set otherwise.")


# Алгоритм шифрования для JWT. HS256 - распространенный выбор для HMAC подписи.
ALGORITHM = "HS256"

# Время жизни токена доступа в минутах.
ACCESS_TOKEN_EXPIRE_MINUTES = 30 # 30 минут - стандартное время для токенов доступа

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
    
    # Если пользователь существует, возвращаем его
    if user:
        # Убедимся, что пользователь активирован (так как Google подтверждает email)
        if not user.is_active:
            user.is_active = True
            db.commit()
            db.refresh(user)  # Обновляем объект пользователя после изменений
            
        # Если пользователь ранее зарегистрировался с помощью email/пароля,
        # обновляем его auth_provider на google
        if user.auth_provider == "email":
            user.auth_provider = "google"
            db.commit()
            db.refresh(user)
            
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
# from pydantic import BaseModel
# class TokenData(BaseModel):
#     email: Optional[str] = None
#     role: Optional[str] = None # Добавляем поле role, т.к. мы его кладем в токен

# Модель для токена аутентификации
from pydantic import BaseModel

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


async def get_current_user(
    # FastAPI автоматически предоставляет токен, извлекая его из заголовка "Authorization: Bearer ..."
    token: Annotated[str, Depends(oauth2_scheme)],
    # FastAPI автоматически предоставляет сессию БД, используя зависимость get_db (импортирована из models.py)
    db: Annotated[Session, Depends(get_db)]
# Возвращаемый тип - модель User SQLAlchemy
) -> User:
    """
    Зависимость FastAPI. Выполняет аутентификацию пользователя по JWT токену.
    Извлекает токен, проверяет его валидность, извлекает идентификатор пользователя (email)
    и роль из payload токена, загружает объект пользователя из базы данных.

    Args:
        token (str): JWT токен, извлеченный из заголовка Authorization (Bearer <токен>).
        db (Session): Сессия базы данных, предоставленная зависимостью get_db().

    Returns:
        User: Объект пользователя SQLAlchemy, соответствующий токену.

    Raises:
        HTTPException: С кодом 401 (Unauthorized), если токен невалидный, истек,
                       или пользователь не найден/неактивен.
    """
    # Определяем исключение, которое будет выброшено в случае невалидных учетных данных (токена)
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, # 401 - Неавторизован
        detail="Could not validate credentials", # Сообщение об ошибке
        headers={"WWW-Authenticate": "Bearer"}, # Указываем, что требуется Bearer токен (по стандарту OAuth2)
    )

    try:
        # Декодируем токен. jwt.decode автоматически проверяет подпись, срок действия ('exp'), и т.д.
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        # Извлекаем email пользователя из стандартного поля 'sub' (subject) payload.
        # Это поле должно содержать уникальный идентификатор пользователя. Мы используем email.
        email: str = payload.get("sub")
        # Извлекаем роль пользователя из нашего кастомного поля 'role', которое мы добавили при создании токена.
        user_role: str = payload.get("role")

        if email is None or user_role is None:
            # Если в токене отсутствуют необходимые поля (email или роль), считаем его невалидным.
            raise credentials_exception

        # Если бы использовали TokenData Pydantic модель:
        # token_data = TokenData(email=email, role=user_role) # Валидируем payload токена

    except JWTError:
        # Если токен невалидный (неправильная подпись, истек срок действия, неверный формат и т.д.),
        # библиотека jwt выбрасывает JWTError. Мы перехватываем ее и выбрасываем HTTPException.
        raise credentials_exception

    # Ищем пользователя в базе данных по email, извлеченному из токена.
    # Это необходимо, чтобы убедиться, что пользователь все еще существует в системе.
    user = db.query(User).filter(User.email == email).first()

    if user is None:
        # Если пользователь из токена не найден в базе данных (например, был удален после выдачи токена).
        raise credentials_exception

    # TODO: Можно добавить проверку user.is_active здесь, если нужно блокировать пользователей
    # даже при наличии валидного токена (например, если администратор деактивировал пользователя).
    # if not user.is_active:
    #     raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is inactive")


    # Если все проверки пройдены (токен валидный, пользователь найден), возвращаем объект пользователя SQLAlchemy.
    # Этот объект будет доступен в эндпоинте, который использует эту зависимость.
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
    Аутентифицирует пользователя по email и паролю.
    
    Args:
        email (str): Email пользователя.
        password (str): Пароль пользователя.
        db (Session): Сессия базы данных.
        
    Returns:
        Optional[User]: Объект пользователя, если аутентификация успешна, иначе None.
    """
    # Ищем пользователя в базе данных по email
    user = db.query(User).filter(User.email == email).first()
    
    # Если пользователь не найден, возвращаем None
    if not user:
        return None
    
    # Проверяем, что пользователь не зарегистрирован через Google OAuth
    # Если пользователь зарегистрирован через Google, не позволяем входить с паролем
    if user.auth_provider == "google":
        return None
    
    # Если пользователь найден, проверяем пароль
    # Используем verify_password, чтобы сравнить переданный пароль с хэшем из БД
    if not verify_password(password, user.hashed_password):
        return None  # Если пароль неверный, возвращаем None
    
    # Если пользователь найден и пароль верный, возвращаем объект пользователя
    return user

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