// frontend/src/pages/VerifyEmailPage.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { Button, Spinner, Card, CardHeader, CardBody, Input } from '@nextui-org/react';
import useAuthStore from '../stores/authStore';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading'); // loading, success, error, expired, no_token
  const [error, setError] = useState('');
  const [verificationAttempted, setVerificationAttempted] = useState(false);
  const [hasProfileData, setHasProfileData] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendError, setResendError] = useState('');
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  // Проверка наличия токена и данных профиля
  useEffect(() => {
    // Проверяем, есть ли сохраненные данные профиля
    const profileData = localStorage.getItem('vrach_registration_profile');
    if (profileData) {
      try {
        const parsedData = JSON.parse(profileData);
        if (parsedData && typeof parsedData === 'object') {
          setHasProfileData(true);
          
          // Если у нас есть email из регистрации, используем его
          if (parsedData.email) {
            setResendEmail(parsedData.email);
          }
        }
      } catch (e) {
        console.error('Ошибка при попытке прочитать данные профиля:', e);
      }
    }

    if (!token) {
      setStatus('no_token');
      setError('Токен подтверждения отсутствует в URL');
      return;
    }

    // Функция для проверки токена
    const verifyToken = async () => {
      try {
        // Если верификация уже выполнялась, не повторяем
        if (verificationAttempted) return;
        
        setVerificationAttempted(true);
        const response = await api.get(`/verify-email?token=${token}`);
        
        if (response.status === 200) {
          setStatus('success');
          // Если пользователь уже вошел в систему, обновляем его статус
          if (isAuthenticated) {
            useAuthStore.getState().refreshUserData();
          }
          
          // Сохраняем токен подтверждения в localStorage, чтобы показывать страницу ожидания даже после перезагрузки
          localStorage.setItem('emailVerificationToken', token);
          localStorage.setItem('emailVerificationStartTime', Date.now().toString());
        }
      } catch (err) {
        // Если верификация не удалась, проверяем причину
        if (err.response && err.response.status === 400) {
          if (err.response.data.detail.includes('expired')) {
            setStatus('expired');
          } else {
            setStatus('error');
            setError(err.response.data.detail || 'Ошибка подтверждения email');
          }
        } else {
          setStatus('error');
          setError('Произошла ошибка при подтверждении email. Пожалуйста, попробуйте позже.');
        }
      }
    };

    // Проверяем, есть ли уже сохраненный токен
    const savedToken = localStorage.getItem('emailVerificationToken');
    const startTime = localStorage.getItem('emailVerificationStartTime');
    
    if (savedToken === token) {
      // Если прошло более 24 часов с начала верификации, считаем токен просроченным
      const now = Date.now();
      const hoursElapsed = (now - parseInt(startTime || '0')) / (1000 * 60 * 60);
      
      if (hoursElapsed > 24) {
        setStatus('expired');
        return;
      }
      
      // Токен уже в процессе верификации, показываем экран ожидания
      setStatus('loading');
      // Периодически проверяем статус верификации
      const interval = setInterval(verifyToken, 10000); // каждые 10 секунд
      
      return () => clearInterval(interval);
    } else {
      // Первая попытка верификации
      verifyToken();
    }
  }, [token, isAuthenticated, verificationAttempted]);

  // Функция для перехода на страницу входа
  const goToLogin = () => {
    // Очищаем сохраненные данные верификации
    localStorage.removeItem('emailVerificationToken');
    localStorage.removeItem('emailVerificationStartTime');
    navigate('/login');
  };

  // Функция для запроса новой ссылки подтверждения email (для авторизованных пользователей)
  const resendVerificationEmail = async () => {
    if (isAuthenticated && user) {
      setIsResendingEmail(true);
      try {
        const response = await api.post('/resend-verification', { email: user.email });
        if (response.status === 200) {
          setResendSuccess(true);
          setTimeout(() => {
            setResendSuccess(false);
          }, 5000);
        }
          } catch (error) {
        console.error('Ошибка при запросе новой ссылки подтверждения:', error);
        setError('Не удалось отправить новую ссылку. Пожалуйста, попробуйте позже.');
      } finally {
        setIsResendingEmail(false);
      }
    } else {
      // Для неавторизованных пользователей запрашиваем email
      setResendError('');
      
      if (!resendEmail || !resendEmail.includes('@')) {
        setResendError('Пожалуйста, введите корректный email');
        return;
      }
      
      setIsResendingEmail(true);
      try {
        const response = await api.post('/resend-verification', { email: resendEmail });
        if (response.status === 200) {
          setResendSuccess(true);
          setTimeout(() => {
            setResendSuccess(false);
          }, 5000);
        }
      } catch (error) {
        console.error('Ошибка при запросе новой ссылки подтверждения:', error);
        setResendError('Не удалось отправить новую ссылку. Проверьте введенный email или попробуйте позже.');
      } finally {
        setIsResendingEmail(false);
      }
    }
  };

  // Рендер страницы в зависимости от статуса
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="flex flex-col pb-0 pt-6">
          <div className="flex justify-center w-full">
            <div className="bg-primary rounded-full w-16 h-16 flex items-center justify-center mb-4">
              {(status === 'loading' || status === 'no_token') && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {status === 'success' && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {(status === 'error' || status === 'expired') && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center">Подтверждение Email</h1>
        </CardHeader>
        
        <CardBody className="py-8 flex flex-col items-center">
          {status === 'loading' && (
            <div className="text-center">
              <Spinner size="lg" color="primary" className="mb-4" />
              <p className="text-gray-700 mb-6">
                Ожидаем подтверждения вашего email-адреса.<br/>
                Пожалуйста, проверьте вашу почту и нажмите на ссылку подтверждения.
              </p>
              <div className="bg-blue-50 p-4 rounded-lg text-blue-700 text-sm mb-6">
                Эта страница будет автоматически обновлена после подтверждения вашего email.<br/>
                Не закрывайте её до завершения процесса.
              </div>
              <Button
                color="primary"
                variant="flat"
                onClick={goToLogin}
              >
                Вернуться на страницу входа
              </Button>
            </div>
          )}
          
          {status === 'no_token' && (
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-warning mx-auto mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h2 className="text-xl font-bold text-warning mb-4">Необходимо подтвердить Email</h2>
              <p className="text-gray-700 mb-4">
                Для полного доступа к функционалу платформы требуется подтверждение вашего Email-адреса.
                Перейдите по ссылке, которую мы отправили на вашу почту.
              </p>
              
              {isAuthenticated && !user?.is_active && (
                <div className="mb-6">
                  <div className="bg-amber-50 p-4 rounded-lg text-amber-700 text-sm mb-4 border border-amber-200">
                    <p className="font-medium mb-1">Не получили письмо?</p>
                    <p>Проверьте папку "Спам" или запросите новую ссылку для подтверждения.</p>
                  </div>
                  
                  {resendSuccess && (
                    <div className="bg-green-50 p-4 rounded-lg text-green-700 text-sm mb-4 border border-green-200">
                      <p className="font-medium">Новое письмо отправлено!</p>
                      <p>Проверьте вашу почту.</p>
                    </div>
                  )}
                  
                  <div className="flex gap-2 justify-center">
                    <Button
                      color="warning"
                      isLoading={isResendingEmail}
                      onClick={resendVerificationEmail}
                    >
                      Отправить письмо повторно
                    </Button>
                    
                    <Button
                      color="primary"
                      variant="flat"
                      onClick={() => navigate('/')}
                    >
                      Вернуться на главную
                    </Button>
                  </div>
                </div>
              )}
              
              {!isAuthenticated && (
                <div className="w-full mb-6">
                  <div className="bg-amber-50 p-4 rounded-lg text-amber-700 text-sm mb-4 border border-amber-200">
                    <p className="font-medium mb-1">Не получили письмо?</p>
                    <p>Проверьте папку "Спам" или запросите новую ссылку для подтверждения, указав ваш email:</p>
                  </div>
                  
                  {resendSuccess && (
                    <div className="bg-green-50 p-4 rounded-lg text-green-700 text-sm mb-4 border border-green-200">
                      <p className="font-medium">Новое письмо отправлено!</p>
                      <p>Проверьте вашу почту.</p>
                    </div>
                  )}
                  
                  {resendError && (
                    <div className="bg-red-50 p-4 rounded-lg text-red-700 text-sm mb-4 border border-red-200">
                      <p>{resendError}</p>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-3">
                    <Input
                      label="Ваш Email"
                      placeholder="example@mail.com"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      type="email"
                      isRequired
                    />
                    
                    <div className="flex gap-2 justify-center mt-2">
                      <Button
                        color="warning"
                        isLoading={isResendingEmail}
                        onClick={resendVerificationEmail}
                        fullWidth
                      >
                        Отправить письмо повторно
                      </Button>
                    </div>
                    
                    <Button
                      color="primary"
                      variant="flat"
                      onClick={goToLogin}
                      fullWidth
                    >
                      Вернуться на страницу входа
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {status === 'success' && (
            <div className="text-center">
              <div className="animate-bounce mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-green-600 mb-4">Email успешно подтвержден!</h2>
              <p className="text-gray-700 mb-4">
                Теперь вы можете войти в систему, используя ваш email и пароль.
              </p>
              
              {hasProfileData && (
                <div className="bg-green-50 p-4 rounded-lg text-green-700 text-sm mb-6 border border-green-200">
                  <p className="font-medium mb-1">Ваш профиль готов!</p>
                  <p>Ваши личные данные, указанные при регистрации, будут автоматически сохранены 
                  при первом входе в систему.</p>
                </div>
              )}
              
              <Button
                color="primary"
                onClick={goToLogin}
              >
                Перейти к входу
              </Button>
            </div>
          )}
          
          {status === 'error' && (
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-danger mx-auto mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-bold text-danger mb-4">Ошибка подтверждения</h2>
              <p className="text-gray-700 mb-6">{error}</p>
              <Button
                color="primary"
                onClick={goToLogin}
              >
                Вернуться на страницу входа
              </Button>
            </div>
          )}
          
          {status === 'expired' && (
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-warning mx-auto mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-bold text-warning mb-4">Срок действия ссылки истек</h2>
              <p className="text-gray-700 mb-6">
                Ссылка для подтверждения email истекла. Пожалуйста, войдите в систему, чтобы запросить новую ссылку, или запросите ее сейчас:
              </p>
              
              <div className="w-full mb-6">
                {resendSuccess && (
                  <div className="bg-green-50 p-4 rounded-lg text-green-700 text-sm mb-4 border border-green-200">
                    <p className="font-medium">Новое письмо отправлено!</p>
                    <p>Проверьте вашу почту.</p>
                  </div>
                )}
                
                {resendError && (
                  <div className="bg-red-50 p-4 rounded-lg text-red-700 text-sm mb-4 border border-red-200">
                    <p>{resendError}</p>
         </div>
      )}

                <div className="flex flex-col gap-3">
                  <Input
                    label="Ваш Email"
                    placeholder="example@mail.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    type="email"
                    isRequired
                  />
                  
                  <div className="flex gap-2 justify-center mt-2">
                    <Button
                      color="warning"
                      isLoading={isResendingEmail}
                      onClick={resendVerificationEmail}
                      fullWidth
                    >
                      Запросить новую ссылку
                    </Button>
                  </div>
                </div>
              </div>
              
              <Button
                color="primary"
                variant="flat"
                onClick={goToLogin}
              >
                Вернуться на страницу входа
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default VerifyEmailPage;