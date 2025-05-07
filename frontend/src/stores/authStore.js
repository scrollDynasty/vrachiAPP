// frontend/src/stores/authStore.js
import { create } from 'zustand'; // Импортируем функцию create из zustand
import api, { setAuthToken } from '../api'; // Импортируем наш API сервис и функцию для установки токена
import { GOOGLE_CLIENT_ID } from '../config'; // Import Google client ID from config
import { toast } from 'react-toastify'; // Import toast for notifications

// Ключи для Local Storage
const TOKEN_STORAGE_KEY = 'accessToken';
const USER_STORAGE_KEY = 'user';

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

    // Если все проверки пройдены, устанавливаем токен и возвращаем состояние
    console.log("loadAuthFromStorage: User data parsed successfully:", {id: parsedUser.id, email: parsedUser.email});
    setAuthToken(token);
    return { 
      token, 
      user: parsedUser, 
      isAuthenticated: true, 
      isLoading: false, 
      error: null 
    };

  } catch (error) {
    // Обработка любых других ошибок
    console.log('loadAuthFromStorage: Error loading auth state from storage:', error);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setAuthToken(null);
    return { token: null, user: null, isAuthenticated: false, isLoading: false, error: null };
  }
};

// Создаем наш стор (хранилище состояния) для аутентификации
// useAuthStore - это хук, который компоненты будут использовать для доступа к состоянию и функциям
const useAuthStore = create((set, get) => ({
  // Начальное состояние стора
  isAuthenticated: false,  // Флаг аутентификации пользователя
  isLoading: true,  // Флаг загрузки данных аутентификации
  token: null,  // Токен JWT
  user: null,  // Данные пользователя
  error: null,  // Ошибка аутентификации
  pendingVerificationEmail: null, // Email, ожидающий подтверждения

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
    
    let tokenResponse;
    try {
      console.log("login: Sending request to /token endpoint with data:", { username: email });
      
      // Создаем данные формы для запроса
      const formData = new URLSearchParams({ 
        username: email, 
        password: password 
      });
      
      // Выполняем запрос на получение токена с подробной отладкой
      tokenResponse = await api.post('/token', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      console.log("login: Token response received:", {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        hasToken: !!tokenResponse.data.access_token
      });
      
    } catch (networkError) { // Ловим только СЕТЕВЫЕ ошибки на этом этапе
      console.error("login: Network error during /token request:", networkError);
      console.error("login: Error details:", {
        message: networkError.message,
        response: networkError.response ? {
          status: networkError.response.status,
          data: networkError.response.data
        } : 'No response'
      });
      
      const errorMessage = "Сетевая ошибка при попытке входа. Проверьте подключение.";
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

    // Проверяем статус ответа от /token
    if (!tokenResponse || tokenResponse.status >= 400) {
      console.error("login: Failed to get token. Status:", tokenResponse?.status, "Data:", tokenResponse?.data);
      let errorMessage = "Неверный логин или пароль."; // По умолчанию
      
      if (tokenResponse?.status === 401) {
        errorMessage = "Неверный логин или пароль.";
      } else if (tokenResponse?.status === 403) {
        // Проверка специального случая - неподтвержденный email
        if (tokenResponse?.data?.detail && 
            (tokenResponse.data.detail.includes("подтвердите") || 
             tokenResponse.data.detail.includes("verify") || 
             tokenResponse.data.detail.includes("confirm") ||
             tokenResponse.data.detail.includes("verification"))) {
          errorMessage = tokenResponse.data.detail || "Пожалуйста, подтвердите ваш email перед входом.";
          console.log("login: Email verification required error detected");
          
          // Если сервер вернул email, сохраняем его для возможности повторной отправки
          if (tokenResponse.data.email) {
            set({
              pendingVerificationEmail: tokenResponse.data.email
            });
          } else {
            // Если email не вернулся с сервера, используем email из формы
            set({
              pendingVerificationEmail: email
            });
          }
        } else {
          errorMessage = tokenResponse.data.detail || "Доступ запрещен. Пожалуйста, свяжитесь с администратором.";
        }
      } else if (tokenResponse?.status === 429) {
        errorMessage = "Слишком много попыток входа. Пожалуйста, попробуйте позже.";
      } else if (tokenResponse?.data?.detail) {
        errorMessage = tokenResponse.data.detail;
      }
      
      set({ 
        token: null, 
        user: null, 
        isAuthenticated: false, 
        isLoading: false, 
        error: errorMessage 
      });
      setAuthToken(null);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      toast.error(errorMessage);
      throw new Error(errorMessage); // Пробрасываем ошибку
    }

    // Если мы здесь, значит, запрос /token был успешным (статус 2xx)
    console.log("login: Token request successful. Status:", tokenResponse.status);
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
      
      // Show success notification
      toast.success('Вход через Google выполнен успешно!');
      
      // Обновляем состояние
      set({ 
        token, 
        user, 
        isAuthenticated: true, 
        isLoading: false, 
        error: null
      });
      
      return user;
    } catch (error) {
      console.error("Google auth failed", error);
      setAuthToken(null);
      
      // Извлекаем сообщение об ошибке
      let errorMessage = "Google authentication failed. Please try again.";
      
      if (error.response) {
        errorMessage = error.response?.data?.detail || errorMessage;
        
        // Проверка на ошибки с существующим аккаунтом
        if (errorMessage.includes("already registered with password")) {
          console.log("Email already registered with password error detected");
          errorMessage = "This email is already registered with a password. Please use email and password to login.";
        }
      }
      
      // Show error notification
      if (errorMessage.includes('already registered with password')) {
        toast.info(errorMessage, {
          style: { background: '#EFF6FF', color: '#1E40AF', borderLeft: '4px solid #3B82F6' }
        });
      } else {
        toast.error(errorMessage);
      }
      
      set({ 
        token: null, 
        user: null, 
        isAuthenticated: false, 
        isLoading: false, 
        error: errorMessage 
      });
      
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
    set({ isLoading: true, error: null }); // Начинаем загрузку, сбрасываем ошибки
    
    let email, password, role, profileData;
    
    // Проверяем формат входных данных
    if (typeof userData === 'object') {
      // Если передан объект с данными
      email = userData.email;
      password = userData.password;
      role = userData.role;
      profileData = userData.profile;
    } else {
      // Если переданы отдельные параметры (для обратной совместимости)
      email = arguments[0];
      password = arguments[1];
      role = arguments[2];
      profileData = arguments[3];
    }
    
    try {
      console.log("registerUser: Starting registration process for email:", email);
      
      // Отправляем запрос регистрации на бэкенд
      const response = await api.post('/register', { email, password, role });
      
      // Проверяем ответ и наличие флага требования подтверждения email
      const emailVerificationRequired = response.data.email_verification_required === true;
      
      // Если требуется подтверждение email
      if (emailVerificationRequired) {
        console.log("registerUser: Registration successful, email verification required");
        
        // Если переданы данные профиля, сохраняем их в localStorage для использования после подтверждения
        if (profileData) {
          const profileDataToStore = {
            ...profileData,
            email, // Добавляем email для возможности повторной отправки письма
          };
          localStorage.setItem('vrach_registration_profile', JSON.stringify(profileDataToStore));
          console.log("registerUser: Profile data saved for later use after verification");
        }
        
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
      // Получаем токен из ответа сервера и выполняем вход
      console.log("registerUser: Registration successful, no email verification required");
      const { access_token } = response.data;
      const token = access_token;
      
      // Сохраняем токен в axios для автоматической авторизации последующих запросов
      setAuthToken(token);
      
      // Получаем информацию о пользователе
      const userResponse = await api.get('/users/me');
      const user = userResponse.data;
      
      // Сохраняем данные в localStorage
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      
      // Если нужно, сохраняем данные профиля для последующего создания
      if (profileData) {
        localStorage.setItem('vrach_registration_profile', JSON.stringify(profileData));
      }
      
      // Show success notification
      toast.success('Регистрация выполнена успешно!');
      
      // Обновляем состояние
      set({ 
        token, 
        user, 
        isAuthenticated: true, 
        isLoading: false, 
        error: null
      });
      
      return user;
    } catch (error) {
      console.error("Registration failed", error);
      
      // Извлекаем сообщение об ошибке из ответа бэкенда
      let errorMessage = "Ошибка регистрации. Пожалуйста, попробуйте позже.";
      
      if (error.response) {
        errorMessage = error.response?.data?.detail || errorMessage;
        
        // Проверка на ошибки, связанные с дублированием почты
        if (errorMessage.includes("already registered")) {
          console.log("Email already registered error detected");
          
          // Если в сообщении есть упоминание о Google
          if (errorMessage.includes("Google")) {
            console.log("Google account already exists error detected");
          }
        }
      }
      
      // Show error notification
      if (errorMessage.includes('Google')) {
        toast.info(errorMessage, {
          style: { background: '#EFF6FF', color: '#1E40AF', borderLeft: '4px solid #3B82F6' }
        });
      } else if (errorMessage.includes('already registered')) {
        toast.warning(errorMessage, {
          style: { background: '#FEF9C3', color: '#854D0E', borderLeft: '4px solid #EAB308' }
        });
      } else {
        toast.error(errorMessage);
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

      console.log('Создание/обновление профиля пациента. Исходные данные:', profileData);
      
      // Убедимся, что district правильно передается
      if (!profileData.district && profileData.profile && profileData.profile.district) {
        profileData.district = profileData.profile.district;
      }
      
      // Формируем данные профиля
      const patientProfileData = {
        full_name: profileData.firstName && profileData.lastName ? 
          `${profileData.lastName} ${profileData.firstName} ${profileData.middleName || ''}`.trim() : 
          (profileData.full_name || profileData.profile?.full_name || null),
        contact_phone: profileData.phone || profileData.contact_phone || profileData.profile?.contact_phone || null,
        contact_address: profileData.address || profileData.contact_address || profileData.profile?.contact_address || null,
        district: profileData.district || profileData.profile?.district || null,
        medical_info: profileData.additionalInfo || profileData.medical_info || profileData.profile?.medical_info || null
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
}));

// Добавляем флаг isValidatingToken для контроля инициализации при hot-reload в development режиме
// Это необходимо, чтобы запрос api.get('/users/me') не выполнялся многократно
useAuthStore.setState({ isValidatingToken: false });


export default useAuthStore; // Экспортируем хук стора по умолчанию