import React, { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader, Tabs, Tab, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Divider, Spinner } from '@nextui-org/react';
import useAuthStore from '../stores/authStore';
import api from '../api';

// Компонент страницы истории консультаций и платежей
function HistoryPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState("consultations");
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Загрузка реальных консультаций при монтировании компонента
  useEffect(() => {
    const fetchConsultations = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Получаем консультации с сервера
        const response = await api.get('/api/consultations');
        setConsultations(response.data);
      } catch (err) {
        console.error('Error fetching consultations:', err);
        setError('Не удалось загрузить историю консультаций');
      } finally {
        setLoading(false);
      }
    };
    
    // Загружаем консультации, только если активна вкладка консультаций
    if (activeTab === "consultations") {
      fetchConsultations();
    }
  }, [activeTab]);
  
  // Заглушка для данных платежей (в будущем будет получаться с бэкенда)
  const mockPayments = [
    {
      id: 101,
      date: "2023-05-15",
      amount: 1500,
      description: "Консультация: Терапевт - Иванов И.И.",
      status: "success" // success, pending, failed
    },
    {
      id: 102,
      date: "2023-06-20",
      amount: 2000,
      description: "Предоплата: Кардиолог - Петрова А.С.",
      status: "pending"
    },
    {
      id: 103,
      date: "2023-04-10",
      amount: 500,
      description: "Возврат за отмену: Невролог - Сидоров П.М.",
      status: "success"
    }
  ];
  
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
  
  // Функция для получения цвета статуса платежа
  const getPaymentStatusColor = (status) => {
    switch(status) {
      case "success": return "success";
      case "pending": return "warning";
      case "failed": return "danger";
      default: return "default";
    }
  };
  
  // Функция для получения текста статуса платежа
  const getPaymentStatusText = (status) => {
    switch(status) {
      case "success": return "Успешно";
      case "pending": return "В обработке";
      case "failed": return "Ошибка";
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
            <Tab key="payments" title="Платежи" />
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
          
          {activeTab === "payments" && (
            <Table aria-label="История платежей">
              <TableHeader>
                <TableColumn>Дата</TableColumn>
                <TableColumn>Описание</TableColumn>
                <TableColumn>Сумма</TableColumn>
                <TableColumn>Статус</TableColumn>
              </TableHeader>
              <TableBody items={mockPayments}>
                {(item) => (
                  <TableRow key={item.id}>
                    <TableCell>{formatDate(item.date)}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.amount} ₽</TableCell>
                    <TableCell>
                      <Chip
                        color={getPaymentStatusColor(item.status)}
                        variant="flat"
                        size="sm"
                      >
                        {getPaymentStatusText(item.status)}
                      </Chip>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default HistoryPage; 