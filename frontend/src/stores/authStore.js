// frontend/src/stores/authStore.js
import { create } from 'zustand'; // Импортируем функцию create из zustand
import api, { setAuthToken } from '../api'; // Импортируем наш API сервис и функцию для установки токена
import { GOOGLE_CLIENT_ID } from '../config'; // Import Google client ID from config

// Ключи для Local Storage
const TOKEN_STORAGE_KEY = 'accessToken';
const USER_STORAGE_KEY = 'user';

// Функция для загрузки начального состояния из Local Storage
const loadAuthFromStorage = () => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const user = localStorage.getItem(USER_STORAGE_KEY);

  if (token && user) {
    // Если нашли токен и данные пользователя в Local Storage
    setAuthToken(token); // Устанавливаем токен для Axios по умолчанию
    try {
        // Пытаемся распарсить данные пользователя из JSON
        const parsedUser = JSON.parse(user);
         // Проверяем базовую структуру распарсенных данных
        if (parsedUser && typeof parsedUser === 'object' && parsedUser.id && parsedUser.email) {
             return { token, user: parsedUser, isAuthenticated: true, isLoading: false, error: null }; // Убедимся, что error сброшен
        } else {
             // Если распарсенные данные не соответствуют ожидаемой структуре
             console.error("User data in local storage is corrupted.");
             // Очищаем Local Storage и сбрасываем состояние
             localStorage.removeItem(TOKEN_STORAGE_KEY);
             localStorage.removeItem(USER_STORAGE_KEY);
             setAuthToken(null);
             return { token: null, user: null, isAuthenticated: false, isLoading: false, error: null };
        }

    } catch (e) {
        // Если не удалось распарсить JSON
        console.error("Failed to parse user from local storage", e);
        // Очищаем Local Storage, если данные повреждены
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
        setAuthToken(null);
        return { token: null, user: null, isAuthenticated: false, isLoading: false, error: null };
    }
  }
  // Если ничего не нашли в Local Storage
  setAuthToken(null); // Убеждаемся, что токен Axios сброшен
  return { token: null, user: null, isAuthenticated: false, isLoading: false, error: null }; // Убедимся, что error сброшен
};

// Создаем наш стор (хранилище состояния) для аутентификации
// useAuthStore - это хук, который компоненты будут использовать для доступа к состоянию и функциям
const useAuthStore = create((set, get) => ({ // Добавляем 'get' для доступа к текущему состоянию стора
  // Начальное состояние стора
  token: null, // JWT токен доступа
  user: null, // Объект пользователя {id, email, role, is_active}
  isAuthenticated: false, // Флаг, авторизован ли пользователь (наличие валидного токена и пользователя)
  isLoading: true, // Флаг, идет ли загрузка (например, при проверке токена при старте или при выполнении запросов)
  error: null, // Для хранения последней ошибки (например, при логине или регистрации)
  needsProfileUpdate: false, // Флаг, требуется ли заполнение/обновление профиля пользователя

  // --- Функции для управления состоянием ---

  // Инициализация стора при старте приложения
  // Загружает состояние из Local Storage и, если токен есть, проверяет его валидность на бэкенде
  initializeAuth: () => {
    const initialState = loadAuthFromStorage(); // Загружаем начальное состояние из Local Storage
    
    // Проверяем, требуется ли обновление профиля
    let needsProfileUpdate = false;
    if (initialState.user && (!initialState.user.role || !initialState.user.is_active)) {
      needsProfileUpdate = true;
    }
    
    // Устанавливаем начальное состояние
    set({...initialState, needsProfileUpdate});

    // Если нашли токен в Local Storage и пользователь не находится в состоянии загрузки (например, при hot-reload)
    // isValidatingToken флаг поможет избежать многократных запросов при инициализации в development режиме
    if (initialState.isAuthenticated && !get().isLoading && !get().isValidatingToken) {
         console.log('Инициализация auth store: токен найден, проверяем его валидность');
         set({ isLoading: true, isValidatingToken: true }); // Устанавливаем флаги загрузки и валидации токена
         api.get('/users/me') // Отправляем запрос на бэкенд, чтобы убедиться, что токен все еще валиден и получить актуальные данные пользователя
            .then(response => {
                // Если запрос успешен (токен валиден)
                console.log('Токен валиден, получены данные пользователя:', response.data);
                
                // Проверяем, требуется ли обновление профиля
                let profileUpdateNeeded = !response.data.role || !response.data.is_active;
                
                set({ 
                  user: response.data, 
                  isAuthenticated: true, 
                  error: null,
                  needsProfileUpdate: profileUpdateNeeded
                }); // Обновляем данные пользователя в сторе, сбрасываем ошибку
                
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.data)); // Обновляем данные пользователя в Local Storage
            })
            .catch(error => {
                // Если запрос с токеном не удался (например, 401 Unauthorized - токен невалиден или истек, или 404 Not Found)
                console.error('Ошибка при валидации токена:', error.response?.status, error.response?.data);
                
                // Сбрасываем состояние авторизации
                set({ token: null, user: null, isAuthenticated: false, error: "Session expired or token invalid", needsProfileUpdate: false });
                localStorage.removeItem(TOKEN_STORAGE_KEY); // Удаляем невалидный токен из Local Storage
                localStorage.removeItem(USER_STORAGE_KEY);
                setAuthToken(null); // Сбрасываем токен в Axios
            })
            .finally(() => {
                 // Завершаем загрузку и валидацию токена
                 console.log('Инициализация auth store завершена');
                 set({ isLoading: false, isValidatingToken: false });
            });
    } else if (!initialState.isAuthenticated) {
        // Если токена нет в Local Storage, сразу завершаем загрузку
        console.log('Инициализация auth store: токен не найден, пользователь не авторизован');
        set({ isLoading: false, isValidatingToken: false });
    } else {
        // Если isLoading или isValidatingToken уже true (например, при быстрой перезагрузке)
        // Просто устанавливаем флаг isLoading в false, т.к. процесс уже идет
        console.log('Инициализация auth store: процесс загрузки уже запущен');
        set({ isLoading: false });
    }
  },

  // Функция для выполнения логина пользователя
  login: async (email, password) => {
    set({ isLoading: true, error: null }); // Начинаем загрузку для процесса логина, сбрасываем предыдущие ошибки
    try {
      // Отправляем запрос на эндпоинт бэкенда /token для получения JWT токена.
      // Важно: эндпоинт /token ожидает данные в формате x-www-form-urlencoded (username и password),
      // а не JSON по умолчанию. Используем URLSearchParams для формирования данных и явно указываем Content-Type.
      const response = await api.post('/token', new URLSearchParams({ username: email, password: password }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token, token_type } = response.data; // Получаем токен и его тип из ответа
      const token = access_token; // Сохраняем сам токен

      setAuthToken(token); // Устанавливаем полученный токен в заголовки Axios по умолчанию для всех последующих запросов к защищенным эндпоинтам

      // Получаем информацию о пользователе сразу после успешного получения токена.
      // Это необходимо, чтобы иметь актуальные данные пользователя (id, email, role, is_active).
      const userResponse = await api.get('/users/me');
      const user = userResponse.data; // Получаем данные пользователя из ответа

      // Сохраняем полученный токен и данные пользователя в Local Storage, чтобы они сохранялись между сессиями браузера.
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));

      // Обновляем состояние стора с полученными данными.
      set({ token, user, isAuthenticated: true, isLoading: false, error: null }); // Сбрасываем ошибку

      // Проверяем, нужно ли создать профиль пациента
      // Получаем данные профиля из localStorage, которые были сохранены при регистрации
      try {
        const storedProfileData = localStorage.getItem('vrach_registration_profile');
        if (storedProfileData && user.role === 'patient') {
          console.log('Найдены данные для профиля пациента, пробуем создать профиль');
          const profileData = JSON.parse(storedProfileData);
          
          // Вызываем функцию создания профиля пациента ПОСЛЕ обновления состояния
          // state.isAuthenticated и state.token уже обновлены
          await get().createOrUpdatePatientProfile(profileData);
          
          // После успешного создания профиля удаляем сохраненные данные
          localStorage.removeItem('vrach_registration_profile');
        }
      } catch (profileError) {
        console.error('Ошибка при создании профиля после входа:', profileError);
        // Не прерываем процесс логина из-за ошибки создания профиля
      }

      return user; // Возвращаем данные пользователя из функции (может быть полезно в компоненте для перенаправления)

    } catch (error) {
      // Обработка ошибок при логине (например, неверные учетные данные, email не подтвержден)
      console.error("Login failed", error);
      setAuthToken(null); // В случае ошибки сбрасываем токен в Axios
      localStorage.removeItem(TOKEN_STORAGE_KEY); // Удаляем потенциально неверный или старый токен из Local Storage
      localStorage.removeItem(USER_STORAGE_KEY);
      // Извлекаем сообщение об ошибке из ответа бэкенда, если оно есть.
      const errorMessage = error.response?.data?.detail || "Login failed. Please check your credentials.";
      set({ token: null, user: null, isAuthenticated: false, isLoading: false, error: errorMessage }); // Обновляем состояние стора с ошибкой
      throw new Error(errorMessage); // Пробрасываем ошибку дальше, чтобы компонент мог ее обработать (например, показать сообщение пользователю)
    }
  },

  // Функция для аутентификации через Google
  loginWithGoogle: async () => {
    // Redirect to Google OAuth - this function is called when the Google button is clicked
    try {
      // Define Google OAuth parameters
      const REDIRECT_URI = "http://localhost:5173/auth/google/callback";
      const SCOPE = "email profile";
      
      // Create Google authorization URL
      const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPE)}&response_type=code&access_type=offline&prompt=consent`;
      
      // Redirect user to Google authentication page
      window.location.href = authUrl;
    } catch (error) {
      console.error("Failed to redirect to Google OAuth", error);
      set({ error: "Failed to redirect to Google authentication." });
      throw new Error("Failed to redirect to Google authentication.");
    }
  },

  // New function to process the Google OAuth callback
  processGoogleAuth: async (code) => {
    // Проверяем, не запущен ли уже процесс аутентификации
    if (get().isLoading) {
      console.log("Authentication is already in progress, skipping duplicate request");
      return; // Предотвращаем двойную обработку
    }
    
    set({ isLoading: true, error: null });
    try {
      // Обмен кода авторизации на JWT токен через наш бэкенд
      console.log("Processing Google auth code");
      
      // Отправляем код авторизации на наш бэкенд
      const response = await api.post('/auth/google', { code });
      
      const { access_token } = response.data;
      const token = access_token;
      
      setAuthToken(token);
      
      // Получаем информацию о пользователе
      const userResponse = await api.get('/users/me');
      const user = userResponse.data;
      
      // Сохраняем токен и данные пользователя в localStorage
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      
      // Обновляем состояние в сторе
      set({ 
        token, 
        user, 
        isAuthenticated: true, 
        isLoading: false, 
        error: null,
        needsProfileUpdate: !user.is_active || !user.role
      });
      
      return user;
    } catch (error) {
      console.error("Failed to process Google authentication", error);
      setAuthToken(null);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      
      let errorMessage = error.response?.data?.detail || "Не удалось завершить аутентификацию через Google.";
      
      // Проверяем, связана ли ошибка с повторным использованием кода (invalid_grant)
      if (error.response?.data?.detail && error.response.data.detail.includes("invalid_grant")) {
        // Если это ошибка повторного использования кода, попробуем автоматически перезагрузить страницу
        console.log("Google auth code already used, refreshing page to start new auth flow");
        errorMessage = "Для входа через Google требуется новая аутентификация. Перенаправление...";
        
        // Задержка, чтобы пользователь мог увидеть сообщение
        setTimeout(() => {
          window.location.href = '/login'; // Перенаправляем на страницу логина
        }, 1500);
      }
      
      set({ token: null, user: null, isAuthenticated: false, isLoading: false, error: errorMessage, needsProfileUpdate: false });
      throw new Error(errorMessage);
    }
  },

  // Функция для выполнения логаута пользователя
  logout: () => {
    setAuthToken(null); // Сбрасываем токен в заголовках Axios
    localStorage.removeItem(TOKEN_STORAGE_KEY); // Удаляем токен из Local Storage
    localStorage.removeItem(USER_STORAGE_KEY); // Удаляем данные пользователя из Local Storage
    // Сбрасываем состояние стора в исходное неавторизованное состояние
    set({ token: null, user: null, isAuthenticated: false, isLoading: false, error: null }); // Сбрасываем ошибку
  },

  // Функция для обновления данных пользователя в сторе (например, после обновления профиля на бэкенде)
  setUser: (user) => {
     set({ user }); // Обновляем объект пользователя в сторе
     localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user)); // Обновляем данные пользователя в Local Storage
  },

  // Функция для регистрации нового пользователя
  registerUser: async (userData) => {
     set({ isLoading: true, error: null });
     try {
        // Извлекаем основные данные для регистрации
        const { email, password, role, profile } = userData;
        
        // Валидируем и форматируем email перед отправкой
        if (!email || typeof email !== 'string') {
          throw new Error("Необходим корректный email адрес");
        }
        
        // Очищаем и нормализуем email для предотвращения ошибок
        const cleanEmail = email.trim().toLowerCase();
        
        // Проверяем формат email с помощью регулярного выражения
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(cleanEmail)) {
          throw new Error("Пожалуйста, введите корректный email адрес");
        }
        
        // Сохраняем профиль в localStorage для последующего создания после активации
        if (profile) {
          console.log('Сохраняем данные профиля в localStorage для последующего создания', profile);
          localStorage.setItem('vrach_registration_profile', JSON.stringify(profile));
        }
        
        // Отправляем запрос на эндпоинт бэкенда /register с данными пользователя (email, password, role)
        console.log('Отправка запроса на регистрацию с данными:', { email: cleanEmail, password: password ? '********' : null, role });
        
        const response = await api.post('/register', { 
          email: cleanEmail, 
          password, 
          role 
        });
        
        const newUser = response.data;

        set({ isLoading: false, error: null });
        return newUser;
     } catch (error) {
        console.error('Registration failed', error);
        // Более детальная обработка ошибок
        let errorMessage;
        
        if (error.response) {
          // Если есть ответ от сервера с ошибкой
          if (error.response.data && error.response.data.detail) {
            errorMessage = error.response.data.detail;
          } else if (error.response.status === 400) {
            errorMessage = "Ошибка при регистрации: неверные данные. Проверьте формат email и пароля.";
          } else if (error.response.status === 409 || error.response.data?.detail?.includes('already registered')) {
            errorMessage = "Этот email уже зарегистрирован в системе.";
          } else {
            errorMessage = `Ошибка сервера: ${error.response.status}`;
          }
        } else if (error.request) {
          // Запрос был сделан, но не получен ответ
          errorMessage = "Сервер не отвечает. Пожалуйста, попробуйте позже.";
        } else {
          // Что-то произошло при настройке запроса
          errorMessage = error.message || "Ошибка регистрации. Попробуйте еще раз.";
        }
        
        set({ isLoading: false, error: errorMessage });
        throw new Error(errorMessage);
     }
  },

  // Функция для создания или обновления профиля пациента
  createOrUpdatePatientProfile: async (profileData) => {
    try {
      // Проверяем, аутентифицирован ли пользователь
      if (!get().isAuthenticated || !get().token) {
        console.error('Попытка создать профиль без аутентификации');
        return false;
      }

      console.log('Создание/обновление профиля пациента:', profileData);
      
      // Формируем данные профиля
      const patientProfileData = {
        full_name: profileData.firstName && profileData.lastName ? 
          `${profileData.lastName} ${profileData.firstName} ${profileData.middleName || ''}`.trim() : 
          (profileData.full_name || null),
        contact_phone: profileData.phone || profileData.contact_phone || null,
        contact_address: profileData.address || profileData.contact_address || null,
        district: profileData.district || null,
        medical_info: profileData.additionalInfo || profileData.medical_info || null
      };
      
      // Отправляем запрос на создание/обновление профиля
      const response = await api.post('/patients/profiles', patientProfileData);
      console.log('Профиль пациента успешно создан/обновлен:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('Ошибка при создании/обновлении профиля пациента:', error);
      return false;
    }
  },

  // Функция для преобразования данных регистрации в данные профиля
  parseProfileFromRegistration: () => {
    try {
      const storedProfileData = localStorage.getItem('vrach_registration_profile');
      if (!storedProfileData) {
        return null;
      }
      
      const profileData = JSON.parse(storedProfileData);
      if (!profileData || typeof profileData !== 'object') {
        return null;
      }
      
      // Преобразуем данные в формат, подходящий для создания профиля
      return {
        firstName: profileData.firstName || '',
        lastName: profileData.lastName || '',
        middleName: profileData.middleName || '',
        phone: profileData.phone || '',
        address: profileData.address || '',
        district: profileData.district || '',
        additionalInfo: profileData.additionalInfo || ''
      };
    } catch (e) {
      console.error('Ошибка при разборе данных профиля:', e);
      return null;
    }
  },

  // Функция для обновления данных пользователя 
  // (например, после подтверждения email или обновления профиля)
  refreshUserData: async () => {
    try {
      const currentToken = get().token;
      
      // Если токен отсутствует, не выполняем запрос
      if (!currentToken) {
        console.error('Попытка обновить данные без токена');
        return false;
      }
      
      // Убеждаемся, что токен установлен в заголовках запросов
      setAuthToken(currentToken);
      
      // Получаем актуальные данные пользователя с сервера
      const response = await api.get('/users/me');
      const updatedUser = response.data;
      
      // Обновляем данные пользователя в локальном хранилище
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
      
      // Обновляем состояние стора
      set({
        user: updatedUser,
        isAuthenticated: true,
        error: null
      });
      
      return updatedUser;
    } catch (error) {
      console.error('Ошибка при обновлении данных пользователя:', error);
      
      // Если получили 401, пользователь больше не авторизован
      if (error.response && error.response.status === 401) {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          error: 'Сессия истекла. Пожалуйста, войдите снова.'
        });
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
        setAuthToken(null);
      }
      
      return false;
    }
  }
}));

// Добавляем флаг isValidatingToken для контроля инициализации при hot-reload в development режиме
// Это необходимо, чтобы запрос api.get('/users/me') не выполнялся многократно
useAuthStore.setState({ isValidatingToken: false });


export default useAuthStore; // Экспортируем хук стора по умолчанию