// frontend/src/stores/authStore.js
import { create } from 'zustand'; // Импортируем функцию create из zustand
import api, { setAuthToken } from '../api'; // Импортируем наш API сервис и функцию для установки токена
import { GOOGLE_CLIENT_ID } from '../config'; // Import Google client ID from config
import { toast } from 'react-toastify'; // Import toast for notifications
import { persist } from 'zustand/middleware';

// Ключи для Local Storage
const TOKEN_STORAGE_KEY = 'accessToken';
const USER_STORAGE_KEY = 'user';

// Создаем хранилище для отслеживания обработанных кодов
let processedCodes = new Set();

// Функция для загрузки начального состояния из Local Storage
const loadAuthFromStorage = () => {
  try {
    console.log("loadAuthFromStorage: Attempting to load auth data...");
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const userString = localStorage.getItem(USER_STORAGE_KEY);

    // Если нет токена или данных пользователя, возвращаем начальное состояние
    if (!token || !userString) {
      console.log("loadAuthFromStorage: No token or no user string found in localStorage.");
      setAuthToken(null);
      return { token: null, user: null, isAuthenticated: false, isLoading: false, error: null };
    }

    console.log("loadAuthFromStorage: Token and user string found in localStorage.");
    
    // Пытаемся распарсить данные пользователя
    let parsedUser;
    try {
      parsedUser = JSON.parse(userString);
    } catch (parseError) {
      console.log('loadAuthFromStorage: Failed to parse user data from localStorage:', parseError);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      setAuthToken(null);
      return { token: null, user: null, isAuthenticated: false, isLoading: false, error: null };
    }

    // Проверяем структуру данных пользователя
    if (!parsedUser || typeof parsedUser !== 'object') {
      console.log('loadAuthFromStorage: User data in localStorage is not an object');
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      setAuthToken(null);
      return { token: null, user: null, isAuthenticated: false, isLoading: false, error: null };
    }

    // Проверяем наличие обязательных полей
    if (!parsedUser.id || !parsedUser.email) {
      console.log('loadAuthFromStorage: User data in localStorage is missing required fields');
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      setAuthToken(null);
      return { token: null, user: null, isAuthenticated: false, isLoading: false, error: null };
    }

    // Устанавливаем токен аутентификации в заголовки запросов для дальнейших запросов
    // и проверяем успешность установки
    const tokenSetSuccess = setAuthToken(token);
    
    if (!tokenSetSuccess) {
      console.error('loadAuthFromStorage: Failed to set auth token');
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      return { token: null, user: null, isAuthenticated: false, isLoading: false, error: null };
    }
    
    // Если токен установлен успешно, возвращаем аутентифицированное состояние
    return {
      token,
      user: parsedUser,
      isAuthenticated: true,
      isLoading: false,
      error: null
    };
  } catch (e) {
    console.error('loadAuthFromStorage: Error loading auth from storage:', e);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setAuthToken(null);
    return { token: null, user: null, isAuthenticated: false, isLoading: false, error: null };
  }
};

// Создаем наш стор (хранилище состояния) для аутентификации
// useAuthStore - это хук, который компоненты будут использовать для доступа к состоянию и функциям
const useAuthStore = create(
  persist(
    (set, get) => ({
      // Начальное состояние стора
      isAuthenticated: false,  // Флаг аутентификации пользователя
      isLoading: true,  // Флаг загрузки данных аутентификации
      token: null,  // Токен JWT
      user: null,  // Данные пользователя
      error: null,  // Ошибка аутентификации
      pendingVerificationEmail: null, // Email, ожидающий подтверждения
      // Added state for unread messages
      unreadChats: {},

      initializeAuth: () => {
        console.log('initializeAuth: Starting initialization');
        const initialState = loadAuthFromStorage(); 
        console.log('initializeAuth: Initial state loaded from storage', { 
          isAuthenticated: initialState.isAuthenticated,
          hasToken: !!initialState.token,
          hasUser: !!initialState.user
        });
        
        let needsProfileUpdate = false;
        if (initialState.user && (!initialState.user.role || !initialState.user.is_active)) {
          needsProfileUpdate = true;
          console.log('initializeAuth: User needs profile update');
        }
        
        // Устанавливаем начальное состояние
        set({...initialState, needsProfileUpdate});

        if (initialState.isAuthenticated && !get().isValidatingToken) {
             console.log('initializeAuth: Token found, validating');
             set({ isValidatingToken: true }); 
             
             api.get('/users/me') 
                .then(response => {
                    console.log('initializeAuth: Token valid, user data received', {
                      userId: response.data.id,
                      email: response.data.email,
                      role: response.data.role
                    });
                    
                    let profileUpdateNeeded = !response.data.role || !response.data.is_active;
                    set({ 
                      user: response.data, 
                      isAuthenticated: true, 
                      error: null,
                      needsProfileUpdate: profileUpdateNeeded,
                      isLoading: false
                    }); 
                    
                    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.data));
                    console.log('initializeAuth: Auth state updated with valid user data'); 
                })
                .catch(error => {
                    console.error('initializeAuth: Token validation failed:', error.response?.status, error.response?.data);
                    
                    // Очищаем данные авторизации
                    localStorage.removeItem(TOKEN_STORAGE_KEY); 
                    localStorage.removeItem(USER_STORAGE_KEY);
                    setAuthToken(null);
                    
                    // Сбрасываем состояние
                    set({ 
                      token: null, 
                      user: null, 
                      isAuthenticated: false, 
                      error: "Session expired or token invalid", 
                      needsProfileUpdate: false,
                      isLoading: false 
                    });
                    
                    console.log('initializeAuth: Auth state reset due to invalid token');
                })
                .finally(() => {
                     console.log('initializeAuth: Validation completed');
                     set({ isValidatingToken: false });
                });
        } else if (!initialState.isAuthenticated) {
            console.log('initializeAuth: No authentication data found, setting to not authenticated');
            set({ 
              isLoading: false, 
              isValidatingToken: false,
              isAuthenticated: false,
              user: null,
              token: null,
              error: null
            });
        }
      },

      // Функция для выполнения логина пользователя
      login: async (email, password) => {
        console.log("login: Starting login process for email:", email);
        
        // Сбрасываем все состояния перед началом логина
        set({ 
          isLoading: true, 
          error: null,
          isAuthenticated: false,
          user: null,
          token: null
        });
        
        try {
          console.log("login: Sending request to /token endpoint with data:", { username: email });
          
          // Создаем данные формы для запроса
          const formData = new URLSearchParams({ 
            username: email, 
            password: password 
          });
          
          // Выполняем запрос на получение токена с подробной отладкой
          const tokenResponse = await api.post('/token', formData, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          });
          
          console.log("login: Token response received:", {
            status: tokenResponse.status,
            statusText: tokenResponse.statusText,
            hasToken: !!tokenResponse.data.access_token
          });
          
          // Если мы здесь, значит, запрос /token был успешным (статус 2xx)
          const { access_token } = tokenResponse.data;
          const token = access_token;
          
          if (!token) {
            console.error("login: Token is missing in successful response");
            const errorMessage = "Ошибка: токен отсутствует в ответе сервера";
            set({ 
              token: null, 
              user: null, 
              isAuthenticated: false, 
              isLoading: false, 
              error: errorMessage 
            });
            toast.error(errorMessage);
            throw new Error(errorMessage);
          }
          
          setAuthToken(token); // Устанавливаем токен для Axios
          console.log("login: Token set for API requests");
          
          // Теперь пытаемся получить данные пользователя
          let userResponse;
          try {
            console.log("login: Getting user data from /users/me");
            userResponse = await api.get('/users/me');
            console.log("login: User data response:", {
              status: userResponse.status,
              hasData: !!userResponse.data,
              userId: userResponse.data?.id,
              userEmail: userResponse.data?.email
            });
          } catch (networkErrorUser) { // Ловим только СЕТЕВЫЕ ошибки на этом этапе
            console.error("login: Network error during /users/me request:", networkErrorUser);
            console.error("login: Error details:", {
              message: networkErrorUser.message,
              response: networkErrorUser.response ? {
                status: networkErrorUser.response.status,
                data: networkErrorUser.response.data
              } : 'No response'
            });
            
            const errorMessageUser = "Сетевая ошибка при получении данных пользователя.";
            set({ 
              token: null, 
              user: null, 
              isAuthenticated: false, 
              isLoading: false, 
              error: errorMessageUser 
            });
            setAuthToken(null); // Сбрасываем токен, так как сессия неполная
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            localStorage.removeItem(USER_STORAGE_KEY);
            toast.error(errorMessageUser);
            throw new Error(errorMessageUser);
          }
          
          // Проверяем статус ответа от /users/me
          if (!userResponse || userResponse.status >= 400) {
            console.error("login: Failed to get user data. Status:", userResponse?.status, "Data:", userResponse?.data);
            const errorMessageUser = userResponse?.data?.detail || "Не удалось получить данные пользователя после авторизации.";
            set({ 
              token: null, 
              user: null, 
              isAuthenticated: false, 
              isLoading: false, 
              error: errorMessageUser 
            });
            setAuthToken(null); // Сбрасываем токен
            localStorage.removeItem(TOKEN_STORAGE_KEY); // Удаляем токен, так как данные пользователя не получены
            localStorage.removeItem(USER_STORAGE_KEY);
            toast.error(errorMessageUser);
            throw new Error(errorMessageUser);
          }

          // Если мы здесь, значит, и /token, и /users/me были успешными
          const user = userResponse.data;
          console.log("login: User data received successfully", { userId: user.id, email: user.email });
          localStorage.setItem(TOKEN_STORAGE_KEY, token);
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
          set({ 
            token, 
            user, 
            isAuthenticated: true, 
            isLoading: false, 
            error: null 
          });
          console.log("login: Auth state updated to authenticated", { 
            isAuthenticated: true, 
            hasUser: true, 
            hasToken: true 
          });
          
          // Показываем уведомление об успехе
          toast.success('Вход выполнен успешно!');
          
          // Проверяем, есть ли данные профиля для создания после входа
          try {
            const storedProfileData = localStorage.getItem('vrach_registration_profile');
            if (storedProfileData && user.role === 'patient') {
              console.log('login: Found patient profile data, attempting to create profile');
              const profileData = JSON.parse(storedProfileData);
              await get().createOrUpdatePatientProfile(profileData);
              localStorage.removeItem('vrach_registration_profile');
            }
          } catch (profileError) {
            console.error('login: Error creating profile after login:', profileError);
          }
          
          return user;
        } catch (error) {
          console.error("login: Error during login:", error);
          console.error("login: Error details:", {
            message: error.message,
            response: error.response ? {
              status: error.response.status,
              statusText: error.response.statusText,
              data: error.response.data
            } : 'No response'
          });
          
          // Определяем соответствующее сообщение об ошибке
          let errorMessage = "Произошла ошибка при входе. Пожалуйста, попробуйте позже.";
          
          if (error.response) {
            // Если у нас есть ответ от сервера с ошибкой, обрабатываем его
            const status = error.response.status;
            const detail = error.response.data?.detail;
            
            if (status === 401) {
              errorMessage = "Неверный логин или пароль. Пожалуйста, проверьте введенные данные.";
            } else if (status === 403) {
              // Проверка специального случая - неподтвержденный email
              if (detail && 
                  (detail.includes("подтвердите") || 
                   detail.includes("verify") || 
                   detail.includes("confirm") ||
                   detail.includes("verification"))) {
                errorMessage = detail || "Пожалуйста, подтвердите ваш email перед входом.";
                console.log("login: Email verification required error detected");
                
                // Если сервер вернул email, сохраняем его для возможности повторной отправки
                if (error.response.data.email) {
                  set({
                    pendingVerificationEmail: error.response.data.email
                  });
                } else {
                  // Если email не вернулся с сервера, используем email из формы
                  set({
                    pendingVerificationEmail: email
                  });
                }
              } else {
                errorMessage = detail || "Доступ запрещен. Пожалуйста, свяжитесь с администратором.";
              }
            } else if (status === 429) {
              errorMessage = "Слишком много попыток входа. Пожалуйста, попробуйте позже.";
            } else if (detail) {
              errorMessage = detail;
            }
          } else if (error.request) {
            // Запрос был отправлен, но не получен ответ (сетевая проблема)
            errorMessage = "Сетевая ошибка при попытке входа. Проверьте подключение к интернету.";
          } else {
            // Что-то случилось при настройке запроса
            errorMessage = error.message || "Ошибка при попытке входа.";
          }
          
          set({ 
            token: null, 
            user: null, 
            isAuthenticated: false, 
            isLoading: false, 
            error: errorMessage 
          });
          setAuthToken(null); // Убедимся, что токен сброшен
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          localStorage.removeItem(USER_STORAGE_KEY);
          toast.error(errorMessage);
          throw new Error(errorMessage); // Пробрасываем, чтобы форма отреагировала
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

      // Функция для обработки авторизации через Google
      processGoogleAuth: async (code) => {
        try {
          // Проверка входных данных
          if (!code) {
            console.error('processGoogleAuth: No authorization code provided');
            throw new Error('Не указан код авторизации Google');
          }
          
          console.log('processGoogleAuth: Processing Google auth code');
          console.log(`processGoogleAuth: Code length: ${code.length}`);
          console.log(`processGoogleAuth: Code begins with: ${code.substring(0, 10)}...`);
          
          // Проверяем, не обрабатывали ли мы уже этот код
          if (processedCodes.has(code)) {
            console.warn('processGoogleAuth: This code was already processed');
            throw new Error('Этот код авторизации уже был обработан. Пожалуйста, попробуйте снова.');
          }
          
          // Добавляем код в список обработанных
          processedCodes.add(code);
          
          // Ограничиваем размер Set, чтобы не накапливать слишком много кодов
          if (processedCodes.size > 50) {
            processedCodes = new Set([...processedCodes].slice(-50));
          }
          
          // Отправляем запрос на сервер для обработки кода авторизации
          try {
            const response = await api.post('/auth/google', { code });
            
            console.log('processGoogleAuth: Google auth request status:', response.status);
            console.log('processGoogleAuth: Google auth response headers:', response.headers);
            console.log('processGoogleAuth: Google auth success, received token:', 
              response.data?.access_token ? 'Token received' : 'No token in response');
            
            // Проверяем, получили ли мы токен
            if (!response.data?.access_token) {
              throw new Error('Не получен токен авторизации от сервера');
            }
            
            // Сохраняем токен в localStorage
            localStorage.setItem(TOKEN_STORAGE_KEY, response.data.access_token);
            console.log('processGoogleAuth: Token saved to localStorage');
            
            // Устанавливаем токен в заголовки для API
            const tokenSetResult = setAuthToken(response.data.access_token);
            console.log('processGoogleAuth: Token set result:', tokenSetResult);
            
            // Получаем данные пользователя
            console.log('processGoogleAuth: Fetching user data with the new token');
            const userResponse = await api.get('/users/me');
            
            console.log('processGoogleAuth: User data request status:', userResponse.status);
            console.log('processGoogleAuth: User data response received');
            
            // Сохраняем данные пользователя в localStorage
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userResponse.data));
            console.log('processGoogleAuth: User data saved to localStorage');
            
            // Обновляем состояние приложения
            set({
              token: response.data.access_token,
              user: userResponse.data,
              isAuthenticated: true,
              isLoading: false,
              error: null
            });
            
            console.log('processGoogleAuth: Authentication completed successfully', userResponse.data);
            
            // Делаем тестовый запрос, чтобы убедиться, что токен работает
            console.log('processGoogleAuth: Making test request to verify token');
            const testResponse = await api.get('/notifications');
            console.log('processGoogleAuth: Test request successful, token is working properly');
            console.log('processGoogleAuth: Test request status:', testResponse.status);
            console.log('processGoogleAuth: Test request headers:', testResponse.headers);
            
            // Show success notification
            toast.success('Вход через Google выполнен успешно!');
            
            return userResponse.data;
          } catch (error) {
            // Обрабатываем ошибки запроса
            if (error.response) {
              // Сервер ответил с ошибкой
              console.error('processGoogleAuth: Server responded with error:', error.response.status);
              console.error('processGoogleAuth: Error data:', error.response.data);
              
              // Специфическая обработка ошибок
              if (error.response.status === 400 && error.response.data?.detail?.includes('истек')) {
                throw new Error('Код авторизации Google истек. Пожалуйста, попробуйте войти снова');
              }
              
              throw new Error(error.response.data?.detail || 'Ошибка аутентификации через Google');
            } else if (error.request) {
              // Запрос был отправлен, но ответа не получено
              console.error('processGoogleAuth: No response received:', error.request);
              throw new Error('Нет ответа от сервера. Проверьте ваше интернет-соединение.');
            } else {
              // Ошибка при настройке запроса
              console.error('processGoogleAuth: Error during request setup', error.message);
              throw error;
            }
          }
        } catch (error) {
          // Очищаем данные аутентификации в случае ошибки
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          localStorage.removeItem(USER_STORAGE_KEY);
          setAuthToken(null);
          
          // Обновляем состояние приложения
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error.message || 'unknown'
          });
          
          // Логируем ошибку
          console.error('processGoogleAuth: Google auth failed', error);
          
          // Показываем ошибку пользователю
          if (error.message?.includes('уже был обработан')) {
            toast.warning(error.message);
          } else if (error.message?.includes('истек')) {
            toast.info(error.message, {
              style: { background: '#EFF6FF', color: '#1E40AF', borderLeft: '4px solid #3B82F6' }
            });
          } else {
            toast.error(error.message || 'Ошибка авторизации через Google');
          }
          
          // Пробрасываем ошибку дальше
          throw error;
        }
      },

      // Функция для выполнения логаута пользователя
      logout: () => {
        setAuthToken(null); // Сбрасываем токен в заголовках Axios
        localStorage.removeItem(TOKEN_STORAGE_KEY); // Удаляем токен из Local Storage
        localStorage.removeItem(USER_STORAGE_KEY); // Удаляем данные пользователя из Local Storage
        // Сбрасываем состояние стора в исходное неавторизованное состояние
        set({ token: null, user: null, isAuthenticated: false, isLoading: false, error: null, pendingVerificationEmail: null }); // Сбрасываем ошибку и pendingVerificationEmail
      },

      // Функция для обработки подтверждения email
      handleEmailVerification: async (tokenData) => {
        console.log("handleEmailVerification: Processing email verification with token data:", tokenData);
        set({ isLoading: true, error: null });
        
        try {
          // Проверяем наличие токена доступа в данных
          if (!tokenData || !tokenData.access_token) {
            throw new Error("Токен доступа отсутствует в ответе сервера");
          }
          
          const accessToken = tokenData.access_token;
          console.log("handleEmailVerification: Received access token after verification");
          
          // Сохраняем токен и настраиваем axios
          localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
          setAuthToken(accessToken);
          
          // Получаем данные пользователя
          console.log("handleEmailVerification: Getting user data");
          const userResponse = await api.get('/users/me');
          const user = userResponse.data;
          
          // Сохраняем данные пользователя
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
          
          // Очищаем pendingVerificationEmail, так как email уже подтвержден
          // и устанавливаем флаг аутентификации
          set({ 
            token: accessToken, 
            user, 
            isAuthenticated: true, 
            isLoading: false, 
            error: null,
            pendingVerificationEmail: null
          });
          
          console.log("handleEmailVerification: Authentication successful after email verification");
          
          // Проверяем, сохранены ли данные профиля в localStorage
          const storedProfileData = localStorage.getItem('vrach_registration_profile');
          if (storedProfileData && user.role === 'patient') {
            console.log('handleEmailVerification: Found patient profile data, attempting to create profile');
            try {
              const profileData = JSON.parse(storedProfileData);
              await get().createOrUpdatePatientProfile(profileData);
              // После успешного создания профиля, удаляем сохраненные данные
              localStorage.removeItem('vrach_registration_profile');
            } catch (profileError) {
              console.error('handleEmailVerification: Error creating profile:', profileError);
              // Не выбрасываем ошибку, так как основная функция (подтверждение email) выполнена успешно
            }
          }
          
          // Показываем уведомление об успехе
          toast.success('Email успешно подтвержден!');
          
          return { success: true, user };
        } catch (error) {
          console.error("Email verification failed", error);
          
          // Определяем сообщение об ошибке
          let errorMessage = "Не удалось завершить процесс подтверждения email. Пожалуйста, попробуйте позже.";
          
          if (error.response) {
            // Если у нас есть ответ от сервера с ошибкой, обрабатываем его
            const status = error.response.status;
            const detail = error.response.data?.detail;
            
            if (detail) {
              errorMessage = detail;
            } else if (status === 400) {
              errorMessage = "Недействительный или истекший токен подтверждения.";
            } else if (status === 404) {
              errorMessage = "Токен подтверждения не найден.";
            }
          }
          
          // Показываем уведомление об ошибке
          toast.error(errorMessage);
          
          // Обновляем состояние с ошибкой, но не сбрасываем pendingVerificationEmail
          // чтобы пользователь мог запросить новую ссылку
          set({ 
            token: null, 
            user: null, 
            isAuthenticated: false, 
            isLoading: false, 
            error: errorMessage
          });
          
          return { success: false, error: errorMessage };
        }
      },

      // Функция для обновления данных пользователя в сторе (например, после обновления профиля на бэкенде)
      setUser: (user) => {
         set({ user }); // Обновляем объект пользователя в сторе
         localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user)); // Обновляем данные пользователя в Local Storage
      },

      // Функция для регистрации нового пользователя
      registerUser: async (userData) => {
        set({ isLoading: true, error: null, pendingVerificationEmail: null }); // Сброс ошибок и состояния проверки email

        let email, password, role, full_name, contact_phone, district, contact_address, medical_info;
        
        // Проверяем формат входных данных
        if (typeof userData === 'object') {
          // Если передан объект с данными
          email = userData.email;
          password = userData.password;
          role = userData.role;
          full_name = userData.full_name;
          contact_phone = userData.contact_phone;
          district = userData.district;
          contact_address = userData.contact_address;
          medical_info = userData.medical_info;
        } else {
          // Если переданы отдельные параметры (для обратной совместимости)
          email = arguments[0];
          password = arguments[1];
          role = arguments[2];
          // Для старого формата профиль может быть 4-м аргументом
          const profileData = arguments[3] || {};
          full_name = profileData.full_name;
          contact_phone = profileData.contact_phone;
          district = profileData.district;
          contact_address = profileData.contact_address;
          medical_info = profileData.medical_info;
        }
        
        try {
          console.log("registerUser: Starting registration process for email:", email);
          console.log("registerUser: Profile data:", { full_name, contact_phone, district, contact_address, medical_info });
          
          // Отправляем запрос регистрации на бэкенд со всеми данными профиля
          const response = await api.post('/register', { 
            email, 
            password, 
            role,
            full_name,
            contact_phone,
            district,
            contact_address,
            medical_info
          });
          
          // ВАЖНО: Проверяем, что ответ действительно успешный (статус 2xx)
          // Иначе api.post может вернуть ответ с ошибкой из-за настройки validateStatus: status => status < 500
          if (response.status >= 400) {
            console.error("registerUser: Error response received:", response.status, response.data);
            throw new Error(response.data?.detail || 'Ошибка регистрации');
          }
          
          // Если дошли до этой точки, значит запрос успешен (статус 2xx)
          console.log("registerUser: Backend responded with success:", response.status, response.data);
          
          const data = response.data;
          const accessToken = data.access_token;
          
          // Проверяем, требуется ли подтверждение email
          // Это может быть явный флаг или пустой/отсутствующий токен
          const emailVerificationRequired = data.email_verification_required === true || !accessToken;
          
          // Если требуется подтверждение email
          if (emailVerificationRequired) {
            console.log("registerUser: Registration successful, email verification required");
            
            // Сохраняем данные профиля для использования после подтверждения email
            const profileDataToStore = {
              email, // Добавляем email для возможности повторной отправки письма
              full_name,
              contact_phone,
              district,
              contact_address,
              medical_info
            };
            localStorage.setItem('vrach_registration_profile', JSON.stringify(profileDataToStore));
            console.log("registerUser: Profile data saved for later use after verification:", profileDataToStore);
            
            // Показываем уведомление
            toast.success('Регистрация выполнена успешно! Проверьте почту для подтверждения email.');
            
            // Устанавливаем состояние без аутентификации
            set({ 
              isLoading: false, 
              error: null,
              // Добавляем email в состояние для страницы верификации
              pendingVerificationEmail: email,
              // Не устанавливаем token и user
              isAuthenticated: false,
            });
            
            return { 
              success: true, 
              requiresEmailVerification: true, 
              email 
            };
          }
          
          // Если НЕ требуется подтверждение email (например, для специальных аккаунтов или в режиме разработки)
          console.log("registerUser: Registration successful, no email verification required");
          
          // Сохраняем токен в axios для автоматической авторизации последующих запросов
          setAuthToken(accessToken);
          
          try {
            // Получаем информацию о пользователе
            const userResponse = await api.get('/users/me');
            const user = userResponse.data;
            
            // Сохраняем данные в localStorage
            localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
            
            // Сохраняем данные профиля для последующего создания
            const profileDataToStore = {
              email,
              full_name,
              contact_phone,
              district,
              contact_address,
              medical_info
            };
            localStorage.setItem('vrach_registration_profile', JSON.stringify(profileDataToStore));
            console.log("registerUser: Profile data saved for later use:", profileDataToStore);
            
            // Show success notification
            toast.success('Регистрация выполнена успешно!');
            
            // Обновляем состояние
            set({ 
              token: accessToken, 
              user, 
              isAuthenticated: true, 
              isLoading: false, 
              error: null
            });
            
            return user;
          } catch (userError) {
            console.error("Error fetching user data after registration:", userError);
            
            // Если не удалось получить данные пользователя, но регистрация успешна
            // Показываем уведомление и просим пользователя войти
            toast.warning('Регистрация выполнена, но не удалось автоматически войти. Пожалуйста, войдите вручную.');
            
            set({ isLoading: false });
            return { success: true, requiresManualLogin: true };
          }
        } catch (error) {
          // Ошибка при регистрации
          console.error("Registration failed", error);
          
          // Извлекаем сообщение об ошибке из ответа бэкенда
          let errorMessage = "Ошибка регистрации. Пожалуйста, попробуйте позже.";
          
          // Если есть ответ от сервера, пытаемся получить детали ошибки
          if (error.response) {
            console.log("Registration error response:", error.response.status, error.response.data);
            
            // Полностью логируем ответ для отладки
            console.log("Registration error full response:", {
              status: error.response.status,
              statusText: error.response.statusText,
              data: error.response.data,
              detail: error.response.data?.detail
            });
            
            // Получаем сообщение об ошибке из ответа сервера
            if (error.response.data && error.response.data.detail) {
              let errorDetail = error.response.data.detail;
              console.log("Registration error detail:", errorDetail);
              
              // Используем оригинальное сообщение об ошибке с сервера, если оно есть
              errorMessage = errorDetail;
              
              // Более специфичная обработка разных типов ошибок
              if (errorDetail.toLowerCase().includes('email') && 
                  errorDetail.toLowerCase().includes('уже зарегистрирован')) {
                errorMessage = "Этот email уже зарегистрирован. Пожалуйста, используйте другой email или выполните вход.";
              } else if (errorDetail.toLowerCase().includes('телефон') && 
                         errorDetail.toLowerCase().includes('уже зарегистрирован')) {
                errorMessage = "Этот номер телефона уже зарегистрирован. Пожалуйста, используйте другой номер или выполните вход.";
              } else if (errorDetail.toLowerCase().includes('уже зарегистрирован')) {
                errorMessage = "Пользователь с этими данными уже зарегистрирован. Пожалуйста, используйте другие данные или выполните вход.";
              } else if (errorDetail.toLowerCase().includes('already registered')) {
                errorMessage = "Пользователь с этими данными уже зарегистрирован. Пожалуйста, используйте другие данные или выполните вход.";
              }
            }
          } else {
            // Если нет ответа - это сетевая ошибка
            console.log("Network error during registration:", error.message);
          }
          
          // Выводим детальный лог для отладки
          console.log("Final error message:", errorMessage);
          
          // Show error notification with appropriate styling based on error message
          if (errorMessage.includes('Google')) {
            toast.info(errorMessage, {
              style: { background: '#EFF6FF', color: '#1E40AF', borderLeft: '4px solid #3B82F6' }
            });
          } else if (errorMessage.includes('уже зарегистрирован') || errorMessage.includes('already registered')) {
            toast.warning(errorMessage, {
              style: { background: '#FEF9C3', color: '#854D0E', borderLeft: '4px solid #EAB308' }
            });
          } else {
            toast.error(errorMessage);
          }
          
          // Важно: сбрасываем pendingVerificationEmail, устанавливаем ошибку
          set({ 
            isLoading: false, 
            error: errorMessage,
            pendingVerificationEmail: null // Явно сбрасываем, чтобы предотвратить редирект
          });
          
          // Возвращаем результат с ошибкой
          return {
            success: false, 
            error: errorMessage
          };
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

          console.log('Создание/обновление профиля пациента. Исходные данные:', profileData);
          
          // Формируем данные профиля
          const patientProfileData = {
            full_name: profileData.full_name || '',
            contact_phone: profileData.contact_phone || '',
            district: profileData.district || '',
            contact_address: profileData.contact_address || '',
            medical_info: profileData.medical_info || ''
          };
          
          console.log('Данные профиля после обработки:', patientProfileData);
          
          // Отправляем запрос на создание/обновление профиля
          const response = await api.post('/patients/profiles', patientProfileData);
          console.log('Профиль пациента успешно создан/обновлен:', response.data);
          
          // Добавляем информацию о профиле в данные пользователя
          if (response.data && get().user) {
            const updatedUser = {
              ...get().user,
              profile: response.data
            };
            set({ user: updatedUser });
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
          }
          
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
          
          // Если получили 401 или 403, пользователь не авторизован или его сессия истекла
          if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            console.log('Получен статус 401/403. Выход из системы.');
            
            // Вызываем функцию logout для корректного сброса состояния
            get().logout();
            
            // Устанавливаем сообщение об ошибке
            set({
              error: 'Сессия истекла или учетные данные недействительны. Пожалуйста, войдите снова.',
              isAuthenticated: false // Явно устанавливаем isAuthenticated в false
            });
            
            // Показываем уведомление пользователю
            toast.error('Сессия истекла. Пожалуйста, войдите снова.');
            
            // Перенаправляем на страницу логина
            window.location.href = '/login';
          }
          
          return false;
        }
      }
    }),
    {
      name: 'auth-storage', // Имя для localStorage
      // Параметры для persist middleware
    }
  )
);

// Добавляем флаг isValidatingToken для контроля инициализации при hot-reload в development режиме
// Это необходимо, чтобы запрос api.get('/users/me') не выполнялся многократно
useAuthStore.setState({ isValidatingToken: false });

export default useAuthStore; // Экспортируем хук стора по умолчанию