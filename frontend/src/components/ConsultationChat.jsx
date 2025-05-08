import React, { useState, useEffect, useRef } from 'react';
import { Button, Textarea, Spinner, Card, CardBody, CardHeader, Divider, Badge, Chip, Avatar, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, CardFooter } from '@nextui-org/react';
import { toast } from 'react-hot-toast';
import api from '../api';
import useAuthStore from '../stores/authStore';

// Компонент сообщения в чате
const ChatMessage = ({ message, currentUserId, patientAvatar, doctorAvatar }) => {
  const isMyMessage = message.sender_id === currentUserId;
  
  // Форматирование времени
  const formatTime = (dateString) => {
    const options = { hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleTimeString(undefined, options);
  };
  
  // Выбираем аватарку в зависимости от отправителя
  const avatarUrl = message.sender_id === currentUserId ? 
    (isMyMessage && doctorAvatar ? doctorAvatar : '/assets/doctor-avatar.png') : 
    (patientAvatar || '/assets/patient-avatar.png');
  
  return (
    <div className={`flex mb-4 ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
      {!isMyMessage && (
        <Avatar src={avatarUrl} className="mr-2" size="sm" />
      )}
      <div className={`px-4 py-2 rounded-lg max-w-[70%] ${isMyMessage ? 'bg-primary text-white' : 'bg-gray-100'}`}>
        <div className="text-sm">{message.content}</div>
        <div className={`text-xs mt-1 ${isMyMessage ? 'text-blue-100' : 'text-gray-500'}`}>
          {formatTime(message.sent_at)}
          {message.is_read && isMyMessage && (
            <span className="ml-2">✓</span>
          )}
        </div>
      </div>
      {isMyMessage && (
        <Avatar src={avatarUrl} className="ml-2" size="sm" />
      )}
    </div>
  );
};

// Основной компонент чата
function ConsultationChat({ consultationId, consultation, onConsultationUpdated, canSendMessages, isDoctor, isPatient, patientName, doctorName }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [patientAvatar, setPatientAvatar] = useState(null);
  const [doctorAvatar, setDoctorAvatar] = useState(null);
  
  const { token } = useAuthStore();
  const accessToken = token;
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  // Скролл чата к последнему сообщению
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // Загрузка сообщений при монтировании компонента
  useEffect(() => {
    fetchMessages();
    fetchParticipantsInfo();
    
    // Инициализация WebSocket соединения
    initWebSocket();
    
    // Установка обработчика для прокрутки при изменении сообщений
    scrollToBottom();
    
    return () => {
      // Закрытие WebSocket соединения при размонтировании
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [consultationId, consultation?.status, accessToken]);
  
  // Обновление прокрутки при изменении сообщений
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Загрузка сообщений из API
  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/consultations/${consultationId}/messages`);
      setMessages(response.data);
      setLoading(false);
      
      // Прокрутка к последнему сообщению
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Ошибка при загрузке сообщений:', error);
      setLoading(false);
    }
  };
  
  // Загрузка информации об участниках консультации
  const fetchParticipantsInfo = async () => {
    try {
      // Получаем аватары участников
      if (consultation) {
        try {
          const doctorResponse = await api.get(`/doctors/${consultation.doctor_id}/profile`);
          if (doctorResponse.data && doctorResponse.data.avatar_url) {
            setDoctorAvatar(doctorResponse.data.avatar_url);
          }
        } catch (err) {
          console.error('Ошибка при загрузке аватара врача:', err);
        }
        
        try {
          const patientResponse = await api.get(`/patients/${consultation.patient_id}/profile`);
          if (patientResponse.data && patientResponse.data.avatar_url) {
            setPatientAvatar(patientResponse.data.avatar_url);
          }
        } catch (err) {
          console.error('Ошибка при загрузке аватара пациента:', err);
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке информации об участниках:', error);
    }
  };
  
  // Инициализация WebSocket соединения
  const initWebSocket = () => {
    // Закрываем предыдущее соединение, если оно существует
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    // Создаем новое WebSocket соединение
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${wsProtocol}://${window.location.host}/ws/consultations/${consultationId}?token=${accessToken}`;
    
    // Для локальной разработки используем другой порт
    const isLocalDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const wsUrlDev = isLocalDevelopment 
      ? `ws://127.0.0.1:8000/ws/consultations/${consultationId}?token=${accessToken}`
      : wsUrl;
    
    // Проверяем наличие токена
    if (!accessToken) {
      console.error('Ошибка: отсутствует токен доступа для WebSocket соединения');
      return;
    }
    
    try {
      socketRef.current = new WebSocket(wsUrlDev);
      
      // Обработчик открытия соединения
      socketRef.current.onopen = () => {
        console.log('WebSocket соединение установлено');
      };
      
      // Обработчик ошибок
      socketRef.current.onerror = (error) => {
        console.error('WebSocket ошибка:', error);
      };
      
      // Обработчик закрытия соединения
      socketRef.current.onclose = (event) => {
        console.log('WebSocket соединение закрыто:', event.code, event.reason);
        
        // Пытаемся переподключиться через 3 секунды
        setTimeout(() => {
          if (document.visibilityState !== 'hidden') {
            console.log('Попытка переподключения WebSocket...');
            initWebSocket();
          }
        }, 3000);
      };
      
      // Обработчик сообщений
      socketRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // Обрабатываем различные типы сообщений
        if (data.type === 'new_message') {
          // Получили новое сообщение
          setMessages(prevMessages => {
            // Проверяем, есть ли уже такое сообщение (избегаем дублирования)
            const messageExists = prevMessages.some(msg => msg.id === data.data.id);
            if (messageExists) {
              return prevMessages;
            }
            
            // Добавляем новое сообщение и прокручиваем чат
            const updatedMessages = [...prevMessages, data.data];
            setTimeout(scrollToBottom, 100);
            
            // Если сообщение не от текущего пользователя, отмечаем как прочитанное
            if (data.data.sender_id !== (isDoctor ? consultation.doctor_id : consultation.patient_id)) {
              markMessageAsRead(data.data.id);
            }
            
            return updatedMessages;
          });
        } else if (data.type === 'consultation_updated') {
          // Консультация обновлена (например, изменился статус)
          console.log('Консультация обновлена:', data.data);
          
          // Вызываем колбэк для обновления родительского компонента
          if (onConsultationUpdated) {
            onConsultationUpdated();
          }
          
          // Если консультация завершена и пользователь - пациент, показываем модальное окно для отзыва
          if (data.data.status === 'completed' && isPatient) {
            // Автоматически открываем модальное окно для отзыва
            setTimeout(() => {
              toast.success('Консультация завершена. Пожалуйста, оставьте отзыв о враче.');
              window.showReviewModal?.();
            }, 1000);
          }
        } else if (data.type === 'message_read') {
          // Сообщение прочитано
          setMessages(prevMessages => 
            prevMessages.map(msg => 
              msg.id === data.data.message_id 
                ? { ...msg, is_read: true } 
                : msg
            )
          );
        }
      };
    } catch (error) {
      console.error('Ошибка при создании WebSocket соединения:', error);
    }
  };
  
  // Отправка сообщения
  const sendMessage = () => {
    if (!newMessage.trim()) return;
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket соединение не установлено');
      toast.error('Не удалось отправить сообщение. Пожалуйста, обновите страницу.');
      return;
    }
    // ОТПРАВЛЯЕМ В ФОРМАТЕ type: 'message', content: <текст>
    socketRef.current.send(JSON.stringify({
      type: 'message',
      content: newMessage
    }));
    setNewMessage('');
  };
  
  // Отметка сообщения как прочитанного
  const markMessageAsRead = (messageId) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'mark_read',
        data: {
          message_id: messageId
        }
      }));
    }
  };
  
  // Обработчик клавиш в поле ввода (отправка по Enter)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  // Завершение консультации
  const completeConsultation = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      // ОТПРАВЛЯЕМ В ФОРМАТЕ type: 'status_change', status: 'completed'
      socketRef.current.send(JSON.stringify({
        type: 'status_change',
        status: 'completed'
      }));
      setIsCompleteModalOpen(false);
      toast.success('Консультация завершена');
    }
  };
  
  if (loading || !consultation) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-[70vh] max-h-[700px] w-full bg-white rounded-xl shadow-md mb-6 border border-gray-200">
      <div className="flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-xl">
        <div />
        <div className="flex flex-row gap-3 items-center">
          {/* Аватар и имя собеседника */}
          <div className="flex flex-col items-center mr-4">
            <Avatar src={isPatient ? doctorAvatar || '/assets/doctor-avatar.png' : patientAvatar || '/assets/patient-avatar.png'} />
            <span className="text-xs mt-1">
              {isPatient ? doctorName || 'Врач' : patientName || 'Пациент'}
            </span>
          </div>
          {consultation.status === 'active' && isDoctor && (
            <Button 
              color="danger" 
              size="sm"
              onPress={() => setIsCompleteModalOpen(true)}
            >
              Завершить консультацию
            </Button>
          )}
          {/* Кнопка оставить отзыв для пациента после завершения */}
          {isPatient && consultation.status === 'completed' && !consultation.review && (
            <Button 
              color="primary" 
              size="sm"
              onPress={() => window.showReviewModal?.()}
            >
              Оставить отзыв
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 bg-white" style={{ minHeight: 0 }}>
        {loading ? (
          <div className="flex justify-center py-4">
            <Spinner size="lg" color="primary" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-gray-500 py-4">
            {consultation.status === 'pending' || consultation.status === 'waiting' 
              ? (isPatient ? 'Ожидается начало консультации врачом' : 'Нажмите "Начать консультацию" для запуска чата')
              : 'Нет сообщений. Начните диалог!'}
          </p>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isCurrentUser = 
                (isDoctor && message.sender_id === consultation.doctor_id) || 
                (isPatient && message.sender_id === consultation.patient_id);
              return (
                <div 
                  key={message.id} 
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`flex max-w-[70%] ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <Avatar 
                      src={
                        message.sender_id === consultation.doctor_id 
                          ? doctorAvatar || '/assets/doctor-avatar.png'
                          : patientAvatar || '/assets/patient-avatar.png'
                      }
                      className={`h-8 w-8 ${isCurrentUser ? 'ml-2' : 'mr-2'}`}
                    />
                    <div 
                      className={
                        `rounded-lg p-3 shadow-sm ${isCurrentUser 
                          ? 'bg-primary-100 text-primary-700' 
                          : 'bg-gray-100 text-gray-800'}`
                      }
                    >
                      <p className="whitespace-pre-wrap break-words">{message.text}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-xs text-gray-500">
                          {new Date(message.created_at).toLocaleDateString()}
                        </span>
                        {isCurrentUser && (
                          <span className="text-xs">
                            {message.is_read ? 
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-500">
                                <path d="M18 6L7 17L2 12"></path>
                              </svg> : 
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                                <path d="M12 19L5 12L12 5"></path>
                                <path d="M19 12H5"></path>
                              </svg>
                            }
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      <div className="p-4 border-t bg-gray-50 rounded-b-xl sticky bottom-0 z-10">
        {canSendMessages ? (
          <div className="flex w-full gap-2">
            <Input
              fullWidth
              placeholder="Введите сообщение..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={consultation.status === 'completed'}
            />
            <Button 
              color="primary"
              onPress={sendMessage}
              disabled={consultation.status === 'completed' || !newMessage.trim()}
            >
              Отправить
            </Button>
          </div>
        ) : (
          <p className="text-center w-full text-gray-500">
            {consultation.status === 'completed' 
              ? 'Консультация завершена'
              : isPatient && (consultation.status === 'pending' || consultation.status === 'waiting')
                ? 'Ожидается начало консультации врачом'
                : isPatient && consultation.message_count >= consultation.message_limit
                  ? 'Достигнут лимит сообщений'
                  : 'Отправка сообщений недоступна'}
          </p>
        )}
      </div>
      {/* Модальное окно для подтверждения завершения консультации */}
      <Modal isOpen={isCompleteModalOpen} onClose={() => setIsCompleteModalOpen(false)}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">Завершение консультации</ModalHeader>
          <ModalBody>
            <p>Вы уверены, что хотите завершить эту консультацию? После завершения дальнейшее общение будет недоступно.</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setIsCompleteModalOpen(false)}>
              Отмена
            </Button>
            <Button color="danger" onPress={completeConsultation}>
              Завершить
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

export default ConsultationChat; 