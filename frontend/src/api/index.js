import axios from 'axios';

// Определяем базовый URL нашего бэкенда
// В реальном проекте это должна быть переменная окружения Vite!
const API_BASE_URL = 'http://127.0.0.1:8000'; // TODO: Замени на реальный URL бэкенда, если он отличается

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json', // По умолчанию отправляем JSON
  },
  // Изменяем параметры для правильной обработки ошибок
  validateStatus: status => status >= 200 && status < 300, // Считаем успешными только 2xx ответы
});

// Добавляем интерцепторы для логирования запросов
api.interceptors.request.use(
  config => {
    // Проверяем запросы к несуществующим эндпоинтам
    if (config.url && config.url.includes('/token/ws')) {
      console.error('🔴 Попытка запроса к несуществующему эндпоинту /token/ws. Запрос отменен.');
      // Создаем ошибку для отмены запроса
      const error = new Error('Запрос к несуществующему эндпоинту /token/ws отменен');
      return Promise.reject(error);
    }
    
    // Ensure authorization token is included with every request if it exists
    const token = localStorage.getItem('accessToken');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
      
      // Only log token application if it wasn't already set
      if (config.url && !config.url.includes('/token') && !config.url.includes('/auth/google')) {
        console.log(`🔐 Applied auth token from localStorage to request: ${config.method} ${config.url}`);
      }
    }
    
    // Полноценное логирование запроса
    const logLevel = config.url.includes('csrf-token') || config.url.includes('change-password') 
      ? 'info' // Важные запросы логируем с уровнем info
      : 'debug'; // Остальные с уровнем debug

    if (logLevel === 'info') {
      console.info(`🌐 REQUEST: ${config.method.toUpperCase()} ${config.url}`);
      console.info('Headers:', config.headers);
      
      // Для методов с телом логируем данные
      if (config.data) {
        try {
          // Маскируем пароли в логах для безопасности
          const safeData = { ...config.data };
          if (safeData.current_password) safeData.current_password = '********';
          if (safeData.new_password) safeData.new_password = '********';
          console.info('Data:', safeData);
        } catch (e) {
          console.info('Data: [Cannot stringify request data]');
        }
      }
    }
    
    return config;
  },
  error => {
    console.error('🛑 REQUEST ERROR:', error);
    return Promise.reject(error);
  }
);

// Добавляем интерцепторы для логирования ответов
api.interceptors.response.use(
  response => {
    // Логируем только важные ответы
    if (response.config.url.includes('csrf-token') || response.config.url.includes('change-password')) {
      console.info(`✅ RESPONSE: ${response.config.method.toUpperCase()} ${response.config.url}`);
      console.info('Status:', response.status);
      console.info('Data:', response.data);
    }
    return response;
  },
  error => {
    console.error(`🛑 RESPONSE ERROR: ${error.message}`);
    if (error.response) {
      console.error(`Статус ошибки: ${error.response.status}`);
      
      // Обработка 401 Unauthorized - проверяем токен и пытаемся восстановить сессию
      if (error.response.status === 401 && 
          !error.config.url.includes('/token') && 
          !error.config.url.includes('/auth/google')) {
        
        // Проверяем наличие токена в localStorage
        const token = localStorage.getItem('accessToken');
        
        // Если токен есть, но запрос вернул 401, значит токен истек или недействителен
        if (token) {
          console.warn('🔑 Обнаружен 401 ответ с существующим токеном в localStorage. Пробуем переустановить токен...');
          
          // Пытаемся переустановить токен
          const success = setAuthToken(token);
          
          if (success) {
            console.log('🔄 Токен переустановлен. Повторяем запрос...');
            
            // Если токен успешно установлен, повторяем запрос (без рекурсии)
            // Обновляем конфигурацию с новым токеном
            error.config.headers['Authorization'] = `Bearer ${token}`;
            
            // Если запрос не помечен как повторный, выполняем его снова
            if (!error.config._isRetry) {
              // Устанавливаем флаг, что это повторный запрос
              error.config._isRetry = true;
              return axios(error.config);
            }
          } else {
            console.error('🛑 Не удалось переустановить токен');
          }
        }
      }
      
      // Более подробный вывод для ошибок смены пароля
      if (error.config.url.includes('change-password')) {
        console.error('Детальная информация об ошибке смены пароля:');
        console.error('Статус:', error.response.status);
        console.error('Заголовки:', error.response.headers);
        console.error('Данные ответа:', error.response.data);
        
        // Если есть конкретная причина ошибки
        if (error.response.data && error.response.data.detail) {
          console.error('Причина ошибки:', error.response.data.detail);
        }
      } else {
        console.error('Данные ответа:', error.response.data);
      }
    } else if (error.request) {
      console.error('Запрос был отправлен, но ответ не получен:', error.request);
    } else {
      console.error('Ошибка при подготовке запроса:', error.message);
    }
    return Promise.reject(error);
  }
);

// Функция для добавления токена в заголовок запросов (для защищенных эндпоинтов)
// Будет использоваться после логина
export const setAuthToken = (token) => {
  if (token) {
    // Ensure the token is properly formatted and valid
    if (typeof token !== 'string' || token.trim() === '') {
      console.error('🛑 Invalid auth token provided:', token);
      return false;
    }
    
    // Set the token in axios defaults
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    // Also explicitly set it for each method to ensure it propagates
    api.defaults.headers.get['Authorization'] = `Bearer ${token}`;
    api.defaults.headers.post['Authorization'] = `Bearer ${token}`;
    api.defaults.headers.put['Authorization'] = `Bearer ${token}`;
    api.defaults.headers.delete['Authorization'] = `Bearer ${token}`;
    api.defaults.headers.patch['Authorization'] = `Bearer ${token}`;
    
    console.info('🔑 Auth token set in API headers', { token: token.substring(0, 10) + '...' });
    
    // Verify token is set correctly
    console.info('🔍 Authorization header after setting:', api.defaults.headers.common['Authorization']);
    
    return true;
  } else {
    // Remove token from all headers
    delete api.defaults.headers.common['Authorization'];
    delete api.defaults.headers.get['Authorization'];
    delete api.defaults.headers.post['Authorization'];
    delete api.defaults.headers.put['Authorization'];
    delete api.defaults.headers.delete['Authorization'];
    delete api.defaults.headers.patch['Authorization'];
    
    console.info('🔑 Auth token removed from API headers');
    return false;
  }
};

// Вспомогательная функция для получения CSRF токена
export const getCsrfToken = async () => {
  try {
    console.info('🔒 Requesting new CSRF token...');
    const response = await api.get('/csrf-token');
    console.info('🔒 CSRF token received');
    return response.data.csrf_token;
  } catch (error) {
    console.error('🛑 Failed to get CSRF token:', error);
    throw error;
  }
};

// API для работы с врачами
export const doctorsApi = {
  // Получение списка врачей с возможностью фильтрации
  getDoctors: async (filters = {}, page = 1, size = 10) => {
    try {
      // Формируем параметры запроса из переданных фильтров
      const params = { page, size, ...filters };
      const response = await api.get('/api/doctors', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching doctors:', error);
      throw error;
    }
  },

  // Получение детальной информации о враче по ID
  getDoctorById: async (doctorId) => {
    try {
      const response = await api.get(`/api/doctors/${doctorId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching doctor with ID ${doctorId}:`, error);
      throw error;
    }
  },
  
  // Получение списка специализаций
  getSpecializations: async () => {
    try {
      const response = await api.get('/api/specializations');
      return response.data;
    } catch (error) {
      console.error('Error fetching specializations:', error);
      throw error;
    }
  }
};

// API для работы с уведомлениями и статусами заявок
export const notificationsApi = {
  // Получение обновлений статуса заявок на роль врача для текущего пользователя
  checkDoctorApplicationUpdates: async () => {
    try {
      const response = await api.get('/users/me/doctor-applications');
      return response.data;
    } catch (error) {
      console.error('Error checking doctor application updates:', error);
      throw error;
    }
  },
  
  // Получение всех непрочитанных уведомлений для текущего пользователя
  // Примечание: этот эндпоинт нужно будет реализовать на бэкенде
  getUnreadNotifications: async () => {
    try {
      const response = await api.get('/users/me/notifications?unread=true');
      return response.data;
    } catch (error) {
      console.error('Error fetching unread notifications:', error);
      // Возвращаем пустой массив, если эндпоинт еще не реализован на бэкенде
      return [];
    }
  },
  
  // Отметка уведомления как прочитанного
  // Примечание: этот эндпоинт нужно будет реализовать на бэкенде
  markNotificationAsRead: async (notificationId) => {
    try {
      const response = await api.put(`/users/me/notifications/${notificationId}/read`);
      return response.data;
    } catch (error) {
      console.error(`Error marking notification ${notificationId} as read:`, error);
      throw error;
    }
  },
  
  // Отметка уведомления о заявке как просмотренного
  markAsViewed: async (applicationId) => {
    try {
      await api.post('/users/me/notifications/viewed', { application_id: applicationId });
      return true; // Успешно
    } catch (error) {
      console.error(`Ошибка при отметке уведомления о заявке ${applicationId} как просмотренного:`, error);
      return false; // Ошибка
    }
  },
  
  // Получение настроек уведомлений пользователя
  getNotificationSettings: async () => {
    try {
      const response = await api.get('/users/me/notification-settings');
      console.info('Настройки уведомлений получены:', response.data);
      return response.data;
    } catch (error) {
      console.error('Ошибка при получении настроек уведомлений:', error);
      // Возвращаем настройки по умолчанию, если произошла ошибка
      console.warn('Возвращаем настройки уведомлений по умолчанию');
      return {
        push_notifications: true,
        appointment_reminders: true
      };
    }
  },
  
  // Обновление настроек уведомлений пользователя
  updateNotificationSettings: async (settings) => {
    try {
      console.info('Отправка настроек уведомлений:', {
        ...settings,
        csrf_token: settings.csrf_token ? '[MASKED]' : 'missing'
      });
      
      // Проверяем наличие CSRF токена
      if (!settings.csrf_token) {
        console.error('CSRF токен отсутствует в запросе на обновление настроек');
        throw new Error('CSRF токен обязателен для обновления настроек');
      }
      
      // Выполняем запрос
      const response = await api.put('/users/me/notification-settings', settings);
      console.info('Настройки уведомлений успешно обновлены');
      
      return response.data;
    } catch (error) {
      console.error('Ошибка при обновлении настроек уведомлений:', error);
      
      // Проверяем, можно ли повторить запрос
      if (error.response && error.response.status === 403) {
        console.warn('Получена ошибка CSRF. Попытка повторного получения токена и отправки...');
        try {
          // Получаем новый CSRF токен
          const tokenResponse = await api.get('/csrf-token');
          const freshToken = tokenResponse.data.csrf_token;
          
          // Повторяем запрос с новым токеном
          console.info('Повторная отправка с новым CSRF токеном');
          const retryResponse = await api.put('/users/me/notification-settings', {
            ...settings,
            csrf_token: freshToken
          });
          console.info('Настройки уведомлений успешно обновлены при повторной попытке');
          return retryResponse.data;
        } catch (retryError) {
          console.error('Ошибка при повторной попытке обновления настроек:', retryError);
          throw retryError;
        }
      }
      
      throw error;
    }
  },
  
  // Функция для проверки и отладки статуса уведомлений
  checkNotificationsStatus: async () => {
    try {
      // Проверяем настройки из sessionStorage
      console.info('Проверка статуса уведомлений');
      
      let clientSettings = {
        patient: null,
        doctor: null
      };
      
      try {
        const patientSettings = sessionStorage.getItem('notificationSettings');
        if (patientSettings) {
          clientSettings.patient = JSON.parse(patientSettings);
        }
        
        const doctorSettings = sessionStorage.getItem('doctorNotificationSettings');
        if (doctorSettings) {
          clientSettings.doctor = JSON.parse(doctorSettings);
        }
      } catch (e) {
        console.error('Ошибка при чтении настроек из sessionStorage:', e);
      }
      
      console.info('Локальные настройки уведомлений:', clientSettings);
      
      // Получаем настройки с сервера
      const serverSettings = await api.get('/users/me/notification-settings');
      console.info('Настройки уведомлений на сервере:', serverSettings.data);
      
      return {
        clientSettings,
        serverSettings: serverSettings.data,
        mismatch: JSON.stringify(clientSettings) !== JSON.stringify(serverSettings.data)
      };
    } catch (error) {
      console.error('Ошибка при проверке статуса уведомлений:', error);
      return {
        error: error.message,
        status: 'error'
      };
    }
  }
};

// Получение списка районов Ташкента
api.getDistricts = async () => {
  try {
    const response = await api.get('/api/districts');
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении списка районов:', error);
    // Возвращаем статический список районов в случае ошибки
    return [
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
    ];
  }
};

// Функция для получения валидного токена для WebSocket соединений
export const getValidTokenForWS = () => {
  // Заглушка: просто возвращаем токен из localStorage без запросов к серверу
  const token = localStorage.getItem('accessToken');
  return Promise.resolve(token);
};

// Функции для работы с консультациями
export const consultationsApi = {
  // Получение списка консультаций
  getConsultations: async (filters = {}, page = 1, size = 10) => {
    try {
      const params = { page, size, ...filters };
      const response = await api.get('/api/consultations', { params });
      return response.data;
    } catch (error) {
      console.error('Ошибка при получении списка консультаций:', error);
      throw error;
    }
  },

  // Получение детальной информации о консультации
  getConsultationById: async (consultationId) => {
    try {
      const response = await api.get(`/api/consultations/${consultationId}`);
      return response.data;
    } catch (error) {
      console.error(`Ошибка при получении консультации с ID ${consultationId}:`, error);
      throw error;
    }
  },
  
  // Получение всех сообщений консультации
  getConsultationMessages: async (consultationId) => {
    try {
      const response = await api.get(`/api/consultations/${consultationId}/messages`);
      return response.data;
    } catch (error) {
      console.error(`Ошибка при получении сообщений консультации ${consultationId}:`, error);
      throw error;
    }
  },
  
  // Получение только новых сообщений после указанного времени
  getConsultationMessagesSince: async (consultationId, timestamp) => {
    try {
      const params = { since: timestamp };
      const response = await api.get(`/api/consultations/${consultationId}/messages`, { params });
      return response.data;
    } catch (error) {
      console.error(`Ошибка при получении новых сообщений консультации ${consultationId}:`, error);
      throw error;
    }
  },
  
  // Завершение консультации через API (запасной метод)
  completeConsultation: async (consultationId) => {
    try {
      console.log(`Завершение консультации ${consultationId} через REST API`);
      const response = await api.post(`/api/consultations/${consultationId}/complete`, {
        status: 'completed'
      });
      return response.data;
    } catch (error) {
      // Пробуем альтернативный метод, если у бэкенда нет /complete эндпоинта
      console.warn('Ошибка при завершении через POST, пробуем PUT запрос');
      try {
        const putResponse = await api.put(`/api/consultations/${consultationId}`, {
          status: 'completed'
        });
        return putResponse.data;
      } catch (secondError) {
        console.error('Обе попытки завершения консультации через API не удались');
        throw secondError;
      }
    }
  }
};

export default api;