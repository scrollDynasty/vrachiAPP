import React, { useState, useEffect } from 'react';
import { Card, CardBody, Button, Chip } from '@nextui-org/react';
import { notificationsApi } from '../api';

// Компонент для отображения уведомления о статусе заявки на роль врача
function DoctorApplicationNotification({ application, onClose }) {
  if (!application) return null;
  
  // Автоматическое скрытие уведомления через 15 секунд
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('Автоматическое закрытие уведомления через 15 секунд, ID:', application.id);
      if (onClose) {
        onClose();
      }
    }, 15000); // 15 секунд
    
    // Очистка таймера при размонтировании компонента
    return () => clearTimeout(timer);
  }, [application.id, onClose]);
  
  // Функция для определения типа уведомления и отображения соответствующего стиля
  const getNotificationDetails = () => {
    switch (application.status) {
      case 'approved':
        return {
          title: 'Заявка одобрена!',
          message: 'Ваша заявка на получение роли врача одобрена. Теперь вы можете создать профиль врача и начать консультировать пациентов.',
          color: 'success',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        };
      case 'rejected':
        return {
          title: 'Заявка отклонена',
          message: application.admin_comment 
            ? `Ваша заявка на получение роли врача отклонена. Причина: ${application.admin_comment}` 
            : 'Ваша заявка на получение роли врача отклонена.',
          color: 'danger',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        };
      default:
        return {
          title: 'Статус заявки обновлен',
          message: 'Ваша заявка на получение роли врача обновлена.',
          color: 'primary',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        };
    }
  };
  
  const { title, message, color, icon } = getNotificationDetails();
  
  // Простая функция для обработки закрытия
  const handleCloseClick = () => {
    console.log('Закрываем уведомление с ID:', application.id);
    if (onClose) {
      onClose();
    }
  };
  
  return (
    <Card 
      className={`mb-4 shadow-md border-${color}`}
      style={{ borderLeftWidth: '4px' }}
    >
      <CardBody className="p-4">
        <div className="flex items-start gap-4">
          <div className={`rounded-full p-2 bg-${color}-100 flex-shrink-0`}>
            {icon}
          </div>
          <div className="flex-grow">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-lg font-semibold">{title}</h4>
                <Chip size="sm" color={color} variant="flat" className="mt-1 mb-2">
                  {application.status === 'approved' ? 'Одобрено' : 
                   application.status === 'rejected' ? 'Отклонено' : 'Обновлено'}
                </Chip>
                <p className="text-gray-600">{message}</p>
              </div>
              <button 
                type="button"
                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-red-500 flex items-center justify-center transition-colors border border-transparent hover:border-gray-200"
                onClick={handleCloseClick}
                aria-label="Закрыть"
                style={{ minWidth: '32px', minHeight: '32px' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            {application.status === 'approved' && (
              <div className="mt-3">
                <Button 
                  color="success" 
                  variant="flat"
                  href="/profile"
                  as="a"
                >
                  Перейти к профилю
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// Компонент для отслеживания и отображения статусов заявок
function ApplicationStatusTracker() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState([]);
  const STORAGE_KEY = 'vrach_dismissedApplications';
  
  // Функция для сброса данных в localStorage (для отладки)
  const resetStoredData = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setDismissedIds([]);
      
      // После очистки сразу получаем новые данные
      fetchApplicationUpdates();
    } catch (error) {
      console.error('Ошибка при очистке localStorage:', error);
    }
  };
  
  // Загружаем статусы заявок и сохраненные dismissed ID при монтировании компонента
  useEffect(() => {
    // Раскомментируйте следующую строку для сброса сохраненных данных
    resetStoredData();
    
    // Функция для загрузки закрытых ID из localStorage
    const loadDismissedIds = () => {
      try {
        const savedDismissedIds = localStorage.getItem(STORAGE_KEY);
        
        if (savedDismissedIds) {
          // Парсим JSON из localStorage
          const parsedIds = JSON.parse(savedDismissedIds);
          
          // Преобразуем в массив чисел, если это массив
          if (Array.isArray(parsedIds)) {
            const numericIds = parsedIds.map(id => Number(id));
            console.log('Загружены закрытые ID из localStorage:', numericIds);
            setDismissedIds(numericIds);
          } else {
            localStorage.removeItem(STORAGE_KEY);
            setDismissedIds([]);
          }
        } else {
          setDismissedIds([]);
        }
      } catch (error) {
        // В случае ошибки сбрасываем сохраненные данные
        localStorage.removeItem(STORAGE_KEY);
        setDismissedIds([]);
      }
    };
    
    // Загружаем сохраненные ID и затем загружаем уведомления
    loadDismissedIds();
    fetchApplicationUpdates();
  }, []);
  
  // Получение статусов заявок
  const fetchApplicationUpdates = async () => {
    try {
      setLoading(true);
      const data = await notificationsApi.checkDoctorApplicationUpdates();
      
      console.log('Получены обновления заявок:', data);
      console.log('Текущие dismissedIds:', dismissedIds);
      
      // Фильтруем полученные данные, исключая уже закрытые уведомления
      const filteredData = data.filter(app => {
        const appId = Number(app.id);
        const shouldShow = !dismissedIds.includes(appId);
        return shouldShow;
      });
      
      setApplications(filteredData);
    } catch (error) {
      console.error('Не удалось получить обновления заявок:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Обработчик закрытия уведомления
  const handleDismissNotification = (applicationId) => {
    console.log('Закрытие уведомления с ID:', applicationId);
    // Преобразуем ID в число для согласованности
    const appId = Number(applicationId);
    
    
    if (!dismissedIds.includes(appId)) {
      // Создаем новый массив с добавленным ID
      const updatedDismissedIds = [...dismissedIds, appId];
      console.log('Обновленные закрытые ID:', updatedDismissedIds);
      
      // Обновляем состояние компонента
      setDismissedIds(updatedDismissedIds);
      
      // Сохраняем массив ID в localStorage как JSON
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDismissedIds));
        console.log('Сохранено в localStorage:', STORAGE_KEY, JSON.stringify(updatedDismissedIds));
      } catch (error) {
        console.error('Ошибка при сохранении закрытых уведомлений:', error);
      }
      
      // Удаляем уведомление из текущего списка
      setApplications(prev => prev.filter(app => Number(app.id) !== appId));
    } else {
      console.log('Уведомление уже в списке закрытых:', appId);
    }
  };
  
  // Отображаем только обработанные заявки (approved/rejected)
  const recentlyProcessedApplications = applications
    .filter(app => (app.status === 'approved' || app.status === 'rejected'));
  
  if (loading || recentlyProcessedApplications.length === 0) return null;
  
  return (
    <div className="mb-8">
      {recentlyProcessedApplications.map(application => (
        <DoctorApplicationNotification 
          key={application.id}
          application={application}
          onClose={() => handleDismissNotification(application.id)}
        />
      ))}
      
      {/* Дебаг-кнопка для очистки localStorage (скрыта в продакшн) */}
      {process.env.NODE_ENV === 'development' && (
        <button
          type="button"
          onClick={resetStoredData}
          className="text-xs text-gray-400 hover:text-red-500 mt-2 underline cursor-pointer"
          style={{ marginTop: '5px', opacity: 0.7 }}
        >
          Сбросить закрытые уведомления (DEBUG)
        </button>
      )}
    </div>
  );
}

export { DoctorApplicationNotification, ApplicationStatusTracker }; 