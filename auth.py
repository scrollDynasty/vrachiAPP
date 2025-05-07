import os

# Секретный ключ для подписи JWT. Считывается из переменной окружения SECRET_KEY.
# Эту переменную нужно установить в вашем .env файле или в окружении сервера.
SECRET_KEY = os.getenv("SECRET_KEY")

# Проверяем, что SECRET_KEY установлен. Если нет, генерируем случайный ключ (только для разработки)
if SECRET_KEY is None:
    # Для разработки создаем случайный ключ, но ТОЛЬКО для разработки
    # В продакшене это не безопасно - ключ будет меняться при каждом перезапуске
    import secrets
    SECRET_KEY = secrets.token_hex(32)
    print(f"WARNING: SECRET_KEY not set in environment. Generated random key for development: {SECRET_KEY}")
    print("DO NOT USE THIS IN PRODUCTION. Set SECRET_KEY in .env file or environment variables.")
    # В продакшене лучше использовать raise ValueError для остановки приложения 