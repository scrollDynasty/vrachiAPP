@app.post("/token", response_model=Token) # response_model=Token указывает, что в ответ ожидается Pydantic модель Token
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()], # Зависимость для получения стандартной формы email/password
    db: DbDependency # Зависимость для получения сессии БД
):
    """
    Аутентификация пользователя и получение JWT токена доступа.
    Используется стандартный OAuth2 формат для username/password (где username - это email).
    """
    try:
        # Проверяем, существует ли пользователь 
        db_user = db.query(User).filter(User.email == form_data.username).first()
        
        # Если пользователь не найден, возвращаем общую ошибку аутентификации
        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Проверяем, не пытается ли пользователь Google войти с паролем
        if db_user.auth_provider == "google":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This account was registered with Google. Please use Google login instead."
            )
        
        # Проверяем пароль
        if not verify_password(form_data.password, db_user.hashed_password):
            # Неверный пароль
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Проверяем активацию аккаунта
        if not db_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Please verify your email address before logging in.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Если все проверки пройдены успешно, создаем токен доступа
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": db_user.email, "id": db_user.id, "role": db_user.role},
            expires_delta=access_token_expires
        )
        
        return {"access_token": access_token, "token_type": "bearer"}
    
    except Exception as e:
        # Логируем ошибку и возвращаем общую ошибку аутентификации
        print(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        ) 