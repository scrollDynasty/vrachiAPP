import React from 'react';
import { useNavigate } from 'react-router-dom';
import GoogleProfileForm from '../components/GoogleProfileForm';
import useAuthStore from '../stores/authStore';

function CompleteProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Обработчик завершения заполнения профиля
  const handleProfileCompletion = (userData) => {
    console.log('Profile updated successfully', userData);
    // Перенаправляем на главную страницу
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-[calc(100vh-200px)] py-10 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="container mx-auto px-4">
        {/* Заголовок */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            Добро пожаловать!
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Для продолжения работы с платформой, пожалуйста, заполните необходимую информацию о себе
          </p>
        </div>
        
        {/* Контейнер формы */}
        <div className="mt-6">
          <GoogleProfileForm onCompleted={handleProfileCompletion} />
        </div>
      </div>
    </div>
  );
}

export default CompleteProfilePage; 