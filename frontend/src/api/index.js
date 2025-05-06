import axios from 'axios';

// Определяем базовый URL нашего бэкенда
// В реальном проекте это должна быть переменная окружения Vite!
const API_BASE_URL = 'http://127.0.0.1:8000'; // TODO: Замени на реальный URL бэкенда, если он отличается

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json', // По умолчанию отправляем JSON
  },
  // Добавляем параметры для улучшения отладки
  validateStatus: status => status < 500, // Не считаем 4xx ошибками для более гибкой обработки
});

// Добавляем интерцепторы для логирования запросов
api.interceptors.request.use(
  config => {
    // Логируем информацию о запросе
    console.log(`REQUEST: ${config.method.toUpperCase()} ${config.url}`, { 
      headers: config.headers,
      data: config.data,
      params: config.params
    });
    return config;
  },
  error => {
    console.error('REQUEST ERROR:', error);
    return Promise.reject(error);
  }
);

// Добавляем интерцепторы для логирования ответов
api.interceptors.response.use(
  response => {
    // Логируем информацию об успешном ответе
    console.log(`RESPONSE: ${response.status} - ${response.config.method.toUpperCase()} ${response.config.url}`, { 
      data: response.data,
      headers: response.headers,
    });
    return response;
  },
  error => {
    // Логируем информацию об ошибке
    if (error.response) {
      console.error(`RESPONSE ERROR: ${error.response.status} - ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
        data: error.response.data,
        headers: error.response.headers,
      });
    } else if (error.request) {
      console.error('REQUEST MADE BUT NO RESPONSE', error.request);
    } else {
      console.error('REQUEST SETUP ERROR', error.message);
    }
    return Promise.reject(error);
  }
);

// Функция для добавления токена в заголовок запросов (для защищенных эндпоинтов)
// Будет использоваться после логина
export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
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
  }
};

export default api;