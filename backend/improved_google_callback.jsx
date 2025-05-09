/**
 * Улучшенный компонент GoogleAuthCallback.jsx
 * 
 * Основные проблемы, решаемые этим компонентом:
 * 1. Предотвращение двойных запросов с одним и тем же кодом авторизации
 * 2. Правильная обработка ошибок истекшего кода
 * 3. Использование sessionStorage для отслеживания обработанных кодов
 */

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const GoogleAuthCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { processGoogleAuth, isAuthenticated } = useAuthStore();
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Функция для обработки авторизации
  const processAuth = async () => {
    // Уже выполняется обработка - предотвращаем повторные запросы
    if (isProcessing) {
      console.log('Already processing auth, skipping duplicate request');
      return;
    }
    
    // Получаем код из URL
    const urlParams = new URLSearchParams(location.search);
    const code = urlParams.get('code');
    
    // Если код отсутствует, показываем ошибку
    if (!code) {
      console.log('No authorization code found in URL');
      setError('Код авторизации не найден в URL. Пожалуйста, попробуйте еще раз.');
      return;
    }

    // Проверяем, не обрабатывали ли мы уже этот код
    const processedCodes = JSON.parse(sessionStorage.getItem('processedGoogleCodes') || '[]');
    if (processedCodes.includes(code)) {
      console.log('This auth code was already processed, redirecting to home');
      navigate('/', { replace: true });
      return;
    }
    
    // Помечаем код как обрабатываемый
    setIsProcessing(true);
    
    try {
      console.log(`Processing Google auth code: ${code.substring(0, 10)}...`);
      
      // Добавляем код в список обработанных
      processedCodes.push(code);
      sessionStorage.setItem('processedGoogleCodes', JSON.stringify(processedCodes));
      
      // Пытаемся авторизоваться
      await processGoogleAuth(code);
      
      // Если успешно, перенаправляем на главную
      console.log('Google auth successful, redirecting to home');
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Google auth processing failed:', error);
      
      // Если ошибка связана с истекшим кодом, перенаправляем на повторную авторизацию
      if (error.message?.includes('истек') || error.message?.includes('invalid_grant')) {
        console.log('Redirecting to new Google auth due to expired code');
        // Перенаправляем пользователя на страницу авторизации
        window.location.href = '/login?auth_error=expired_code';
        return;
      }
      
      // Для других ошибок показываем сообщение
      setError(error.message || 'Ошибка при авторизации через Google');
    } finally {
      setIsProcessing(false);
    }
  };

  // Если пользователь уже авторизован, перенаправляем на главную
  useEffect(() => {
    // Очищаем старые коды (больше суток)
    const clearOldCodes = () => {
      try {
        const lastCleared = sessionStorage.getItem('lastCodeClearing');
        const now = Date.now();
        
        if (!lastCleared || now - parseInt(lastCleared, 10) > 24 * 60 * 60 * 1000) {
          sessionStorage.setItem('processedGoogleCodes', '[]');
          sessionStorage.setItem('lastCodeClearing', now.toString());
        }
      } catch (e) {
        // Игнорируем ошибки очистки
      }
    };
    
    clearOldCodes();
    
    if (isAuthenticated) {
      console.log('User already authenticated, navigating to home');
      navigate('/', { replace: true });
      return;
    }
    
    // Иначе пытаемся обработать код авторизации
    processAuth();
  }, [location.search, isAuthenticated]);

  // Показываем ошибку или индикатор загрузки
  return (
    <div className="auth-callback">
      {error ? (
        <div className="auth-error">
          <h2>Ошибка авторизации</h2>
          <p>{error}</p>
          <button onClick={() => window.location.href = '/login'}>
            Вернуться на страницу входа
          </button>
        </div>
      ) : (
        <div className="auth-loading">
          <p>Выполняется авторизация через Google...</p>
          {/* Здесь можно добавить анимацию загрузки */}
        </div>
      )}
    </div>
  );
};

export default GoogleAuthCallback; 