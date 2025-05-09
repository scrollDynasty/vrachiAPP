/**
 * Рекомендации по улучшению authStore.js
 * 
 * Этот файл содержит советы по улучшению файла authStore.js для решения
 * проблем с авторизацией Google OAuth.
 */

/**
 * Улучшенная функция processGoogleAuth
 * 
 * Основные изменения:
 * 1. Блокировка повторной обработки одного и того же кода
 * 2. Добавление проверки кода перед отправкой запроса
 * 3. Более подробное логирование
 * 4. Корректная обработка ошибок
 */

/*
// В файле authStore.js найдите функцию processGoogleAuth и замените её на следующую:

import { create } from 'zustand';
import api from '../api';

// ... остальной код файла authStore.js ...

// Создаем хранилище для отслеживания обработанных кодов
let processedCodes = new Set();

// Функция для обработки авторизации через Google
const processGoogleAuth = async (code) => {
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
      localStorage.setItem('token', response.data.access_token);
      console.log('processGoogleAuth: Token saved to localStorage');
      
      // Устанавливаем токен в заголовки для API
      api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;
      const tokenSetResult = Boolean(api.defaults.headers.common['Authorization']);
      console.log('processGoogleAuth: Token set result:', tokenSetResult);
      
      // Получаем данные пользователя
      console.log('processGoogleAuth: Fetching user data with the new token');
      const userResponse = await api.get('/users/me');
      
      console.log('processGoogleAuth: User data request status:', userResponse.status);
      console.log('processGoogleAuth: User data response received');
      
      // Сохраняем данные пользователя в localStorage
      localStorage.setItem('user', JSON.stringify(userResponse.data));
      console.log('processGoogleAuth: User data saved to localStorage');
      
      // Обновляем состояние приложения
      set({
        isAuthenticated: true,
        userData: userResponse.data,
        hasUser: true,
        hasToken: true,
        isLoading: false,
        authError: 'none'
      });
      
      console.log('processGoogleAuth: Authentication completed successfully', userResponse.data);
      
      // Делаем тестовый запрос, чтобы убедиться, что токен работает
      console.log('processGoogleAuth: Making test request to verify token');
      const testResponse = await api.get('/notifications');
      console.log('processGoogleAuth: Test request successful, token is working properly');
      console.log('processGoogleAuth: Test request status:', testResponse.status);
      console.log('processGoogleAuth: Test request headers:', testResponse.headers);
      
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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    api.defaults.headers.common['Authorization'] = '';
    
    // Обновляем состояние приложения
    set({
      isAuthenticated: false,
      userData: null,
      hasUser: false,
      hasToken: false,
      isLoading: false,
      authError: error.message || 'unknown'
    });
    
    // Логируем ошибку
    console.error('processGoogleAuth: Google auth failed', error);
    
    // Пробрасываем ошибку дальше
    throw error;
  }
};
*/

/**
 * Рекомендации по интеграции
 * 
 * 1. Скопируйте функцию processGoogleAuth из этого файла и вставьте в ваш файл authStore.js
 * 2. Обновите компонент GoogleAuthCallback как указано в файле improved_google_callback.jsx
 * 3. Убедитесь, что запрос к API выполняется ОДИН РАЗ для каждого кода авторизации
 * 4. Перед отправкой запроса добавляйте код в Set обработанных кодов
 * 5. Обрабатывайте ошибки "код истек" не как ошибки, а как нормальное состояние
 * 
 * Важно: проверка на повторное использование кода должна выполняться как во фронтенде,
 * так и на бэкенде для максимальной защиты.
 */

if (typeof window !== 'undefined') {
  console.log('Loaded improved_auth_store.js - reference implementation');
}

// Этот файл - только рекомендации, его не нужно импортировать напрямую 