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
        status: error.response.status,
        statusText: error.response.statusText,
        url: error.config?.url,
        data: error.response.data,
        detail: error.response.data?.detail,
        headers: error.response.headers,
      });
      
      // Для отладки - показываем текст ошибки более заметно для 400-x ошибок
      if (error.response.status >= 400 && error.response.status < 500) {
        console.error("API ERROR DETAILS:", error.response.data?.detail || "No detail provided");
      }
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
      return response.data;
    } catch (error) {
      console.error('Ошибка при получении настроек уведомлений:', error);
      // Возвращаем настройки по умолчанию, если произошла ошибка
      return {
        email_notifications: true,
        push_notifications: true,
        appointment_reminders: true
      };
    }
  },
  
  // Обновление настроек уведомлений пользователя
  updateNotificationSettings: async (settings) => {
    try {
      const response = await api.put('/users/me/notification-settings', settings);
      return response.data;
    } catch (error) {
      console.error('Ошибка при обновлении настроек уведомлений:', error);
      throw error;
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

export default api;