from sqlalchemy import text
import os
from dotenv import load_dotenv
from models import User, Base, engine, SessionLocal

# Загружаем переменные окружения из .env
load_dotenv()

def update_auth_provider():
    """
    Обновляет значения auth_provider для всех пользователей, 
    у которых это поле равно NULL (устанавливает "email" по умолчанию)
    """
    try:
        print("Запуск обновления auth_provider...")
        # Создаем сессию
        session = SessionLocal()
        
        # Получаем всех пользователей с auth_provider = NULL
        users_with_null = session.query(User).filter(User.auth_provider.is_(None)).all()
        
        if not users_with_null:
            print("Пользователей с NULL значением auth_provider не найдено.")
            return
        
        print(f"Найдено {len(users_with_null)} пользователей с NULL значением auth_provider.")
        
        # Обновляем auth_provider для каждого пользователя
        for user in users_with_null:
            user.auth_provider = "email"
            print(f"Обновлен пользователь {user.email} (ID: {user.id})")
        
        # Сохраняем изменения
        session.commit()
        print("Обновление auth_provider успешно завершено!")
        
    except Exception as e:
        print(f"Ошибка при обновлении auth_provider: {e}")
    finally:
        # Закрываем сессию
        if 'session' in locals():
            session.close()

if __name__ == "__main__":
    update_auth_provider() 