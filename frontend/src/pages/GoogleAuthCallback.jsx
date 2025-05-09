import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import { Card, CardBody, Spinner } from '@nextui-org/react';
import GoogleProfileForm from '../components/GoogleProfileForm';

function GoogleAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Get auth functions and state from store
  const processGoogleAuth = useAuthStore(state => state.processGoogleAuth);
  const needsProfileUpdate = useAuthStore(state => state.needsProfileUpdate);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const error = useAuthStore(state => state.error);
  
  useEffect(() => {
    // Функция для проверки, был ли код уже обработан
    const checkProcessedCodes = (code) => {
      try {
        const processedCodes = JSON.parse(sessionStorage.getItem('processedGoogleCodes') || '[]');
        return processedCodes.includes(code);
      } catch (e) {
        console.error('Error checking processed codes:', e);
        return false;
      }
    };
    
    // Функция для добавления кода в список обработанных
    const addToProcessedCodes = (code) => {
      try {
        const processedCodes = JSON.parse(sessionStorage.getItem('processedGoogleCodes') || '[]');
        if (!processedCodes.includes(code)) {
          processedCodes.push(code);
          sessionStorage.setItem('processedGoogleCodes', JSON.stringify(processedCodes));
        }
      } catch (e) {
        console.error('Error adding to processed codes:', e);
      }
    };
    
    const processAuth = async () => {
      // Если процесс уже запущен, прерываем выполнение
      if (isProcessing) {
        console.log('Authentication is already in progress, skipping');
        return;
      }
      
      // Если пользователь уже аутентифицирован, перенаправляем его
      if (isAuthenticated) {
        console.log("User already authenticated, redirecting");
        setStatus('success');
        if (!needsProfileUpdate) {
          setTimeout(() => {
            navigate('/');
          }, 1000);
        }
        return;
      }
      
      // Получаем код из URL
      const code = searchParams.get('code');
      
      // Если код отсутствует, показываем ошибку
      if (!code) {
        console.error("No authorization code found in URL");
        setStatus('error');
        setErrorMessage('Код авторизации отсутствует. Пожалуйста, попробуйте войти снова.');
        return;
      }
      
      // Проверяем, не обрабатывался ли уже этот код
      if (checkProcessedCodes(code)) {
        console.log('This auth code was already processed');
        
        // Если пользователь аутентифицирован, просто перенаправляем
        if (isAuthenticated) {
          setStatus('success');
          navigate('/', { replace: true });
          return;
        }
        
        // Иначе перенаправляем на страницу входа
        setStatus('error');
        setErrorMessage('Этот код авторизации уже был использован. Пожалуйста, войдите снова.');
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
        return;
      }
      
      // Помечаем код как обрабатываемый
      setIsProcessing(true);
      
      try {
        // Добавляем код в список обработанных перед отправкой запроса
        addToProcessedCodes(code);
        
        console.log(`Processing Google auth code: ${code.substring(0, 10)}...`);
        
        // Вызываем метод авторизации из стора
        await processGoogleAuth(code);
        
        // Если успешно, обновляем статус
        setStatus('success');
        
        // Если не требуется заполнение профиля, перенаправляем пользователя
        if (!needsProfileUpdate) {
          setTimeout(() => {
            navigate('/');
          }, 1500);
        }
      } catch (error) {
        console.error('Google auth processing failed:', error);
        
        // Если ошибка связана с истекшим кодом, перенаправляем на повторную авторизацию
        if (error.message?.includes('истек') || error.message?.includes('invalid_grant')) {
          setStatus('error');
          setErrorMessage(error.message || 'Код авторизации истек. Пожалуйста, попробуйте войти снова.');
          setTimeout(() => {
            navigate('/login', { replace: true });
          }, 2000);
          return;
        }
        
        // Если код уже был обработан, но пользователь не авторизован
        if (error.message?.includes('уже был обработан')) {
          setStatus('error');
          setErrorMessage(error.message);
          setTimeout(() => {
            navigate('/login', { replace: true });
          }, 2000);
          return;
        }
        
        // Проверяем, если пользователь все же аутентифицирован, несмотря на ошибку
        if (isAuthenticated) {
          console.log("Authentication succeeded despite error, continuing");
          setStatus('success');
          if (!needsProfileUpdate) {
            setTimeout(() => {
              navigate('/');
            }, 1500);
          }
        } else {
          setStatus('error');
          setErrorMessage(error.message || 'Произошла ошибка при обработке авторизации через Google');
        }
      } finally {
        setIsProcessing(false);
      }
    };
    
    // Очищаем старые коды (если прошло больше 24 часов)
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
    processAuth();
  }, [processGoogleAuth, navigate, isProcessing, isAuthenticated, needsProfileUpdate, searchParams]);
  
  // Обработчик завершения заполнения профиля
  const handleProfileComplete = async () => {
    // Ensure token is applied properly before navigation
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        const { setAuthToken } = await import('../api');
        setAuthToken(token);
        console.log("Re-applied auth token after profile completion");
      }
    } catch (err) {
      console.error("Error re-applying token:", err);
    }
    
    // Перенаправляем на главную
    navigate('/');
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      {status === 'processing' && (
        <Card className="max-w-md w-full mx-auto shadow-xl">
          <CardBody className="py-8 px-6 text-center">
            <Spinner size="lg" className="mb-4" />
            <h2 className="text-xl font-semibold text-gray-800">Завершение авторизации...</h2>
            <p className="mt-2 text-gray-600">Пожалуйста, подождите, мы обрабатываем вашу авторизацию через Google.</p>
          </CardBody>
        </Card>
      )}
      
      {status === 'success' && !needsProfileUpdate && (
        <Card className="max-w-md w-full mx-auto shadow-xl">
          <CardBody className="py-8 px-6 text-center">
            <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Авторизация успешна!</h2>
            <p className="mt-2 text-gray-600">Вы будете перенаправлены на главную страницу...</p>
          </CardBody>
        </Card>
      )}
      
      {status === 'success' && needsProfileUpdate && (
        <div className="w-full max-w-2xl">
          <GoogleProfileForm onCompleted={handleProfileComplete} />
        </div>
      )}
      
      {status === 'error' && (
        <Card className="max-w-md w-full mx-auto shadow-xl">
          <CardBody className="py-8 px-6 text-center">
            <div className="w-16 h-16 bg-danger rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Ошибка авторизации</h2>
            <p className="mt-2 text-gray-600">
              {errorMessage || error || "Произошла ошибка при обработке авторизации через Google. Пожалуйста, попробуйте еще раз."}
            </p>
            <button 
              onClick={() => navigate('/login')}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Вернуться на страницу входа
            </button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

export default GoogleAuthCallback; 