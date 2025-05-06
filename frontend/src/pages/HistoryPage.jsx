import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Tabs, Tab, Spinner, Divider } from '@nextui-org/react';
import useAuthStore from '../stores/authStore';
import api from '../api';

// Компонент страницы истории консультаций и платежей
function HistoryPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState("consultations");
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Загружаем консультации при монтировании компонента или смене вкладки
  useEffect(() => {
    const fetchConsultations = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await api.get('/api/consultations');
        setConsultations(response.data);
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
  }, [activeTab]);
  
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
                  </TableHeader>
                  <TableBody items={consultations}>
                    {(item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {user.role === 'patient' ? 
                                `Врач #${item.doctor_id}` : 
                                `Пациент #${item.patient_id}`}
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