import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Tabs, Tab, Spinner, Divider, Button, Avatar, Badge } from '@nextui-org/react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import api from '../api';

// Компонент страницы истории консультаций и платежей
function HistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState("consultations");
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [doctorProfiles, setDoctorProfiles] = useState({});
  const [patientProfiles, setPatientProfiles] = useState({});
  const [userAvatars, setUserAvatars] = useState({});
  
  // Загружаем консультации при монтировании компонента или смене вкладки
  useEffect(() => {
    const fetchConsultations = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await api.get('/api/consultations');
        setConsultations(response.data);
        
        // Собираем уникальные ID врачей и пациентов
        const doctorIds = new Set();
        const patientIds = new Set();
        
        response.data.forEach(consultation => {
          if (user.role === 'patient') {
            doctorIds.add(consultation.doctor_id);
          } else {
            patientIds.add(consultation.patient_id);
          }
        });
        
        // Загружаем данные о врачах, если пользователь - пациент
        if (user.role === 'patient' && doctorIds.size > 0) {
          const doctorData = {};
          const avatarData = {};
          
          for (const doctorId of doctorIds) {
            try {
              const response = await api.get(`/doctors/${doctorId}/profile`);
              doctorData[doctorId] = response.data;
              
              // Сохраняем путь к аватару
              if (response.data.avatar_path) {
                avatarData[doctorId] = `http://127.0.0.1:8000${response.data.avatar_path}`;
              }
            } catch (error) {
              console.error(`Ошибка загрузки данных о враче ${doctorId}:`, error);
              doctorData[doctorId] = { full_name: `Врач #${doctorId}` };
            }
          }
          
          setDoctorProfiles(doctorData);
          setUserAvatars(avatarData);
        }
        
        // Загружаем данные о пациентах, если пользователь - врач
        // Примечание: этот функционал может потребовать дополнительного API на бэкенде
        if (user.role === 'doctor' && patientIds.size > 0) {
          // Заглушка, т.к. у нас нет API для получения данных пациентов по ID
          const patientData = {};
          patientIds.forEach(id => {
            patientData[id] = { full_name: `Пациент #${id}` };
          });
          
          setPatientProfiles(patientData);
        }
        
      } catch (error) {
        console.error('Error fetching consultations:', error);
        setError('Не удалось загрузить историю консультаций. Пожалуйста, попробуйте позже.');
      } finally {
        setLoading(false);
      }
    };
    
    // Загружаем консультации, только если активна вкладка консультаций
    if (activeTab === "consultations") {
      fetchConsultations();
    }
  }, [activeTab, user.role]);
  
  // Функция для получения цвета статуса консультации
  const getConsultationStatusColor = (status) => {
    switch(status) {
      case "completed": return "success";
      case "active": return "warning";
      case "pending": return "primary";
      case "cancelled": return "danger";
      default: return "default";
    }
  };
  
  // Функция для получения текста статуса консультации
  const getConsultationStatusText = (status) => {
    switch(status) {
      case "completed": return "Завершена";
      case "active": return "Активна";
      case "pending": return "Ожидает";
      case "cancelled": return "Отменена";
      default: return "Неизвестно";
    }
  };
  
  // Форматирование даты для отображения
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('ru-RU', options);
  };
  
  // Форматирование времени
  const formatTime = (dateString) => {
    const options = { hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleTimeString('ru-RU', options);
  };
  
  // Переход к консультации
  const goToConsultation = (consultationId) => {
    navigate(`/consultations/${consultationId}`);
  };
  
  // Получение имени врача или пациента для отображения
  const getParticipantName = (consultation) => {
    if (user.role === 'patient') {
      const doctorProfile = doctorProfiles[consultation.doctor_id];
      return doctorProfile ? doctorProfile.full_name : `Врач #${consultation.doctor_id}`;
    } else {
      const patientProfile = patientProfiles[consultation.patient_id];
      return patientProfile ? patientProfile.full_name : `Пациент #${consultation.patient_id}`;
    }
  };
  
  // Получение аватара пользователя
  const getUserAvatar = (consultation) => {
    if (user.role === 'patient') {
      return userAvatars[consultation.doctor_id];
    } else {
      return userAvatars[consultation.patient_id];
    }
  };
  
  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-center">История</h1>
      
      <Card>
        <CardHeader className="pb-0 pt-4">
          <Tabs 
            selectedKey={activeTab} 
            onSelectionChange={setActiveTab}
            variant="underlined"
            color="primary"
            fullWidth
          >
            <Tab key="consultations" title="Консультации" />
          </Tabs>
        </CardHeader>
        
        <Divider className="mt-4" />
        
        <CardBody>
          {activeTab === "consultations" && (
            <>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Spinner size="lg" />
                </div>
              ) : error ? (
                <div className="text-danger text-center py-8">
                  {error}
                </div>
              ) : consultations.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  У вас пока нет ни одной консультации
                </div>
              ) : (
                <Table aria-label="История консультаций">
                  <TableHeader>
                    <TableColumn>{user.role === 'patient' ? 'Врач' : 'Пациент'}</TableColumn>
                    <TableColumn>Дата и время</TableColumn>
                    <TableColumn>Статус</TableColumn>
                    <TableColumn>Сообщения</TableColumn>
                    <TableColumn>Действия</TableColumn>
                  </TableHeader>
                  <TableBody items={consultations}>
                    {(item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar 
                              src={getUserAvatar(item)} 
                              fallback={
                                <div className="bg-primary text-white flex items-center justify-center h-full">
                                  {getParticipantName(item).charAt(0)}
                                </div>
                              }
                              size="sm"
                            />
                            <div>
                              <div className="font-medium">
                                {getParticipantName(item)}
                              </div>
                              {item.status === 'active' && (
                                <Badge variant="flat" color="success" size="sm">
                                  Активная сессия
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div>{formatDate(item.created_at)}</div>
                            <div className="text-sm text-gray-500">
                              {item.started_at ? formatTime(item.started_at) : 'Не начата'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip
                            color={getConsultationStatusColor(item.status)}
                            variant="flat"
                            size="sm"
                          >
                            {getConsultationStatusText(item.status)}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm flex flex-col">
                            <span>{item.message_count} / {item.message_limit}</span>
                            {item.message_count > 0 && item.status === 'active' && (
                              <span className="text-xs text-success">Есть сообщения</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              color="primary" 
                              variant="flat"
                              onPress={() => goToConsultation(item.id)}
                            >
                              {item.status === 'pending' ? 'Перейти' : 
                               item.status === 'active' ? 'Продолжить' : 'Просмотреть'}
                            </Button>
                            {item.status === 'active' && (
                              <Button
                                size="sm"
                                color="success"
                                variant="light"
                                onPress={() => goToConsultation(item.id)}
                              >
                                Чат
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default HistoryPage; 