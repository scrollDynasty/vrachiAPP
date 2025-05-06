import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import { Card, CardBody, Spinner } from '@nextui-org/react';
import GoogleProfileForm from '../components/GoogleProfileForm';

function GoogleAuthCallback() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState('processing');
  const [codeProcessed, setCodeProcessed] = useState(false); // Флаг обработки кода
  
  // Get auth functions and state from store
  const processGoogleAuth = useAuthStore(state => state.processGoogleAuth);
  const needsProfileUpdate = useAuthStore(state => state.needsProfileUpdate);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const error = useAuthStore(state => state.error);
  
  useEffect(() => {
    const processAuth = async () => {
      try {
        // Если пользователь уже аутентифицирован, просто переходим дальше
        if (isAuthenticated) {
          console.log("User already authenticated, skipping auth code processing");
          setStatus('success');
          if (!needsProfileUpdate) {
            setTimeout(() => {
              navigate('/');
            }, 1500);
          }
          return;
        }
        
        // Extract the authorization code from URL params
        const code = searchParams.get('code');
        
        if (!code) {
          console.error("No authorization code found in URL");
          setStatus('error');
          return;
        }
        
        // Проверяем, что код еще не был обработан
        if (codeProcessed) {
          console.log("Code already processed, skipping...");
          return;
        }
        
        // Устанавливаем флаг обработки
        setCodeProcessed(true);
        
        // Очищаем URL от параметров, чтобы предотвратить повторное использование кода
        setSearchParams({});
        
        // Call the store function to process the Google auth code
        await processGoogleAuth(code);
        
        // If successful, set status
        setStatus('success');
        
        // Если не требуется заполнение профиля, перенаправляем пользователя
        if (!needsProfileUpdate) {
          setTimeout(() => {
            navigate('/');
          }, 1500);
        }
      } catch (error) {
        console.error('Google auth processing failed:', error);
        
        // Проверяем, если пользователь уже аутентифицирован, несмотря на ошибку
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
          
          // Если ошибка связана с повторным использованием кода, перенаправляем на /login
          if (error && error.message && error.message.includes("invalid_grant")) {
            setTimeout(() => {
              navigate('/login');
            }, 2000);
          }
        }
      }
    };
    
    processAuth();
  }, [searchParams, processGoogleAuth, navigate, codeProcessed, isAuthenticated, needsProfileUpdate, error]);
  
  // Обработчик завершения заполнения профиля
  const handleProfileComplete = () => {
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
              {error || "Произошла ошибка при обработке авторизации через Google. Пожалуйста, попробуйте еще раз."}
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

export default GoogleAuthCallback; 