import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
  Card, CardBody, CardHeader, Spinner, Button, 
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Pagination, Chip, useDisclosure, Tabs, Tab, Input, Select, SelectItem, Textarea
} from '@nextui-org/react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@nextui-org/react';
import useAuthStore from '../stores/authStore';

// Импортируем API_BASE_URL для использования в путях к файлам
const API_BASE_URL = 'http://127.0.0.1:8000';

function AdminPage() {
  // Состояние для заявок докторов
  const [applications, setApplications] = useState([]);
  const [totalApplications, setTotalApplications] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('pending');
  
  // Состояние для пользователей
  const [users, setUsers] = useState([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userProfileLoading, setUserProfileLoading] = useState(false);
  const [newRole, setNewRole] = useState("");
  
  // Состояние для просмотра деталей заявки
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [adminComment, setAdminComment] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  // Состояние для модальных окон подтверждения действий
  const [confirmAction, setConfirmAction] = useState(null); // 'approve' или 'reject'
  const { 
    isOpen: isConfirmModalOpen, 
    onOpen: onConfirmModalOpen, 
    onClose: onConfirmModalClose 
  } = useDisclosure();
  
  // Модальное окно для профиля пользователя
  const { 
    isOpen: isUserModalOpen, 
    onOpen: onUserModalOpen, 
    onClose: onUserModalClose 
  } = useDisclosure();
  
  // Текущая вкладка
  const [activeTab, setActiveTab] = useState('applications');
  
  // Данные пользователя из стора
  const { user } = useAuthStore();
  
  // Добавляем состояния для общего количества пользователей и страниц
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalUsersPages, setTotalUsersPages] = useState(1);
  
  // Загружаем пользователей при первом переключении на вкладку
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [usersPage, activeTab]);
  
  // Загружаем заявки при первом переключении на вкладку
  useEffect(() => {
    if (activeTab === 'applications') {
      fetchApplications();
    }
  }, [page, selectedStatus, activeTab]);
  
  // Функция для загрузки заявок
  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/admin/doctor-applications?page=${page}&size=10&status=${selectedStatus}`);
      
      setApplications(response.data.items || response.data);
      setTotalApplications(response.data.total || response.data.length);
      setLoading(false);
    } catch (err) {
      console.error('Ошибка при загрузке заявок:', err);
      setError('Ошибка при загрузке заявок. Пожалуйста, проверьте подключение к серверу или обратитесь к администратору.');
      setLoading(false);
    }
  };
  
  // Функция для загрузки пользователей
  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      setUsersError(null);
      
      // Получаем список пользователей
      const response = await api.get(`/admin/users?page=${usersPage}&size=10`);
      
      // Получаем базовые данные пользователей
      const usersData = response.data.items || response.data;
      
      // Устанавливаем полученные данные
      setUsers(usersData);
      setTotalUsers(response.data.total || response.data.length);
      setTotalUsersPages(response.data.pages || Math.ceil(response.data.length / 10));
      
      setUsersLoading(false);
    } catch (err) {
      console.error('Ошибка при загрузке пользователей:', err);
      setUsersError('Ошибка при загрузке пользователей. Пожалуйста, проверьте подключение к серверу или обратитесь к администратору.');
      setUsersLoading(false);
    }
  };
  
  // Функция для загрузки профиля пользователя
  const fetchUserProfile = async (userId) => {
    try {
      setUserProfileLoading(true);
      const response = await api.get(`/admin/users/${userId}/profile`);
      
      setUserProfile(response.data);
      setUserProfileLoading(false);
    } catch (err) {
      console.error('Ошибка при загрузке профиля пользователя:', err);
      setUserProfile({ message: 'Ошибка при загрузке профиля пользователя. Пожалуйста, попробуйте позже.' });
      setUserProfileLoading(false);
    }
  };
  
  // Функция для обработки заявки
  const processApplication = async (id, status, comment = '') => {
    try {
      setLoading(true);
      await api.put(`/admin/doctor-applications/${id}`, {
        status,
        admin_comment: comment
      });
      
      // Обновляем список заявок
      fetchApplications();
      onClose(); // Закрываем модальное окно деталей
      onConfirmModalClose(); // Закрываем модальное окно подтверждения
    } catch (err) {
      console.error('Failed to process application:', err);
      setError('Ошибка при обработке заявки. Пожалуйста, попробуйте позже.');
      setLoading(false);
    }
  };
  
  // Обработчик подтверждения одобрения/отклонения заявки
  const handleConfirmAction = () => {
    if (confirmAction === 'approve') {
      processApplication(selectedApplication.id, 'approved', adminComment);
    } else if (confirmAction === 'reject') {
      if (!adminComment.trim()) {
        setError('Пожалуйста, укажите причину отклонения заявки');
        return; // Не закрываем модальное окно и не вызываем processApplication
      }
      processApplication(selectedApplication.id, 'rejected', adminComment);
    }
  };
  
  // Функция для открытия диалога подтверждения
  const showConfirmation = (action) => {
    setConfirmAction(action);
    
    // Если действие - отклонить, и комментарий не введен, показываем предупреждение
    if (action === 'reject' && !adminComment.trim()) {
      setError('Пожалуйста, укажите причину отклонения заявки в поле комментария');
      return; // Не открываем модальное окно
    }
    
    // Сбрасываем ошибку перед открытием модального окна
    setError(null);
    onConfirmModalOpen();
  };
  
  // Функция для просмотра деталей заявки
  const viewApplicationDetails = (application) => {
    setSelectedApplication(application);
    setAdminComment('');
    setError(null); // Сбрасываем ошибку при открытии деталей
    onOpen();
  };
  
  // Функция для просмотра профиля пользователя
  const viewUserProfile = (user) => {
    setSelectedUser(user);
    // Загружаем профиль пользователя
    fetchUserProfile(user.id);
    // Устанавливаем текущую роль
    setNewRole(user.role);
    onUserModalOpen();
  };
  
  // Функция для изменения роли пользователя
  const changeUserRole = async () => {
    if (!selectedUser || selectedUser.role === newRole) return;
    
    try {
      setUsersLoading(true);
      await api.put(`/admin/users/${selectedUser.id}/role`, { role: newRole });
      
      // Обновляем список пользователей
      fetchUsers();
      onUserModalClose(); // Закрываем модальное окно
      
      // Обновляем данные в текущем окне
      setSelectedUser(prev => ({ ...prev, role: newRole }));
    } catch (err) {
      console.error('Failed to change user role:', err);
      setUsersError('Ошибка при изменении роли пользователя. Пожалуйста, попробуйте позже.');
      setUsersLoading(false);
    }
  };
  
  // Функция для отображения статуса заявки
  const renderStatus = (status) => {
    switch (status) {
      case 'pending':
        return <Chip color="warning">Ожидает</Chip>;
      case 'approved':
        return <Chip color="success">Одобрено</Chip>;
      case 'rejected':
        return <Chip color="danger">Отклонено</Chip>;
      default:
        return <Chip>{status}</Chip>;
    }
  };
  
  // Функция для форматирования даты
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  // Функция для отображения роли пользователя
  const renderUserRole = (role) => {
    switch (role) {
      case 'admin':
        return <Chip color="secondary">Администратор</Chip>;
      case 'doctor':
        return <Chip color="primary">Врач</Chip>;
      case 'patient':
        return <Chip color="success">Пациент</Chip>;
      default:
        return <Chip>{role}</Chip>;
    }
  };
  
  // Функция рендера таблицы пользователей с информацией, которая доступна из API
  const renderUsersTable = () => {
    return (
      <Table
        aria-label="Таблица пользователей"
        shadow="sm"
        selectionMode="none"
        color="primary"
        isHeaderSticky
        classNames={{
          base: "max-h-[70vh]",
          table: "min-h-[400px]",
        }}
      >
        <TableHeader>
          <TableColumn>ID</TableColumn>
          <TableColumn>Email</TableColumn>
          <TableColumn>Роль</TableColumn>
          <TableColumn>Активен</TableColumn>
          <TableColumn>Имя</TableColumn>
          <TableColumn>Телефон</TableColumn>
          <TableColumn>Район</TableColumn>
          <TableColumn>Дата регистрации</TableColumn>
          <TableColumn width={130}>Действия</TableColumn>
        </TableHeader>
        <TableBody
          items={users}
          isLoading={usersLoading}
          loadingContent={<Spinner label="Загрузка пользователей..." />}
          emptyContent="Пользователи не найдены"
        >
          {(user) => (
            <TableRow key={user.id}>
              <TableCell>{user.id}</TableCell>
              <TableCell>{user.email || "-"}</TableCell>
              <TableCell>{renderUserRole(user.role)}</TableCell>
              <TableCell>
                <Chip color={user.is_active ? "success" : "danger"} variant="flat">
                  {user.is_active ? "Да" : "Нет"}
                </Chip>
              </TableCell>
              <TableCell>{user.full_name || "-"}</TableCell>
              <TableCell>{user.contact_phone || "-"}</TableCell>
              <TableCell>{user.district || "-"}</TableCell>
              <TableCell>{formatDate(user.created_at)}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    color="primary"
                    variant="flat"
                    onPress={() => viewUserProfile(user)}
                  >
                    Подробнее
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    );
  };
  
  // Обновляем рендер компонента Pagination в секции пользователей, чтобы использовать реальные данные
  const renderUsersPagination = () => {
    return (
      <div className="flex justify-between items-center mt-4">
        <span className="text-gray-500 text-sm">
          Всего: {totalUsers} пользователей
        </span>
        <Pagination
          showControls
          total={totalUsersPages}
          initialPage={usersPage}
          page={usersPage}
          onChange={setUsersPage}
        />
      </div>
    );
  };
  
  return (
    <div className="py-12 px-6 sm:px-8 lg:px-10 bg-gradient-to-br from-blue-50 to-indigo-50 min-h-[calc(100vh-100px)]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 mb-3">
            Панель администратора
          </h1>
          <p className="text-gray-600">Управление системой и пользователями</p>
        </div>
        
        <Card className="shadow-lg border-none overflow-hidden mb-10">
          <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
          
          <CardHeader className="flex justify-between items-center gap-3 p-6 bg-gradient-to-b from-indigo-50 to-transparent">
            <div>
              <h2 className="text-xl font-semibold">Административная панель</h2>
              <p className="text-sm text-gray-500">
                Аккаунт: {user?.email} | <span className="text-purple-600 font-semibold">Роль: Администратор</span>
              </p>
            </div>
            <div>
              <Chip color="secondary" variant="flat" className="font-semibold">
                Панель администратора
              </Chip>
            </div>
          </CardHeader>
          
          <CardBody className="p-0">
            <Tabs 
              selectedKey={activeTab} 
              onSelectionChange={setActiveTab}
              className="p-4"
            >
              <Tab key="applications" title="Заявки врачей">
                <div className="px-6 py-4 border-t">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Заявки на получение роли врача</h3>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant={selectedStatus === 'pending' ? 'solid' : 'flat'} 
                        color={selectedStatus === 'pending' ? 'warning' : 'default'}
                        onClick={() => setSelectedStatus('pending')}
                      >
                        Ожидающие
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedStatus === 'approved' ? 'solid' : 'flat'} 
                        color={selectedStatus === 'approved' ? 'success' : 'default'}
                        onClick={() => setSelectedStatus('approved')}
                      >
                        Одобренные
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedStatus === 'rejected' ? 'solid' : 'flat'} 
                        color={selectedStatus === 'rejected' ? 'danger' : 'default'}
                        onClick={() => setSelectedStatus('rejected')}
                      >
                        Отклоненные
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedStatus === '' ? 'solid' : 'flat'} 
                        color={selectedStatus === '' ? 'primary' : 'default'}
                        onClick={() => setSelectedStatus('')}
                      >
                        Все
                      </Button>
                    </div>
                  </div>
                
                  {loading ? (
                    <div className="flex justify-center items-center py-8">
                      <Spinner size="lg" />
                    </div>
                  ) : error ? (
                    <div className="bg-danger-50 text-danger p-4 rounded-lg">
                      {error}
                    </div>
                  ) : applications.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Нет заявок с выбранным статусом
                    </div>
                  ) : (
                    <>
                      <Table aria-label="Список заявок на роль врача">
                        <TableHeader>
                          <TableColumn>ID</TableColumn>
                          <TableColumn>ФИО</TableColumn>
                          <TableColumn>Специализация</TableColumn>
                          <TableColumn>Дата подачи</TableColumn>
                          <TableColumn>Статус</TableColumn>
                          <TableColumn>Действия</TableColumn>
                        </TableHeader>
                        <TableBody>
                          {applications.map((app) => (
                            <TableRow key={app.id}>
                              <TableCell>{app.id}</TableCell>
                              <TableCell>{app.full_name}</TableCell>
                              <TableCell>{app.specialization}</TableCell>
                              <TableCell>{formatDate(app.created_at)}</TableCell>
                              <TableCell>{renderStatus(app.status)}</TableCell>
                              <TableCell>
                                <Button 
                                  size="sm" 
                                  color="primary" 
                                  variant="flat"
                                  onClick={() => viewApplicationDetails(app)}
                                >
                                  Подробнее
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      
                      <div className="flex justify-center py-4">
                        <Pagination
                          total={Math.ceil(totalApplications / 10)}
                          page={page}
                          onChange={setPage}
                        />
                      </div>
                    </>
                  )}
                </div>
              </Tab>
              
              <Tab key="users" title="Пользователи">
                <div className="px-6 py-4 border-t">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Управление пользователями</h3>
                    <Button 
                      size="sm" 
                      color="primary" 
                      onClick={fetchUsers}
                      isDisabled={usersLoading}
                    >
                      Обновить список
                    </Button>
                  </div>
                
                  {usersLoading ? (
                    <div className="flex justify-center items-center py-8">
                      <Spinner size="lg" />
                    </div>
                  ) : usersError ? (
                    <div className="bg-danger-50 text-danger p-4 rounded-lg">
                      {usersError}
                    </div>
                  ) : users.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Нет пользователей в системе
                    </div>
                  ) : (
                    <>
                      {renderUsersTable()}
                      {renderUsersPagination()}
                    </>
                  )}
                </div>
              </Tab>
              
              <Tab key="settings" title="Настройки">
                <div className="p-6 border-t">
                  <h3 className="text-lg font-semibold mb-4">Настройки системы</h3>
                  <p className="text-gray-500">
                    Настройки системы будут доступны в следующих обновлениях.
                  </p>
                </div>
              </Tab>
            </Tabs>
          </CardBody>
        </Card>
      </div>
      
      {/* Модальное окно для просмотра деталей заявки */}
      {selectedApplication && (
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          size="3xl"
          scrollBehavior="inside"
        >
          <ModalContent>
            <ModalHeader className="flex flex-col gap-1">
              <div className="text-xl">Заявка на роль врача</div>
              <div className="text-small text-gray-500">ID: {selectedApplication.id}</div>
            </ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-medium font-semibold mb-2">Информация о враче</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-small text-gray-500">ФИО:</span>
                      <p>{selectedApplication.full_name}</p>
                    </div>
                    <div>
                      <span className="text-small text-gray-500">Специализация:</span>
                      <p>{selectedApplication.specialization}</p>
                    </div>
                    <div>
                      <span className="text-small text-gray-500">Опыт:</span>
                      <p>{selectedApplication.experience}</p>
                    </div>
                    <div>
                      <span className="text-small text-gray-500">Образование:</span>
                      <p>{selectedApplication.education}</p>
                    </div>
                    <div>
                      <span className="text-small text-gray-500">Номер лицензии:</span>
                      <p>{selectedApplication.license_number}</p>
                    </div>
                    {selectedApplication.additional_info && (
                      <div>
                        <span className="text-small text-gray-500">Дополнительная информация:</span>
                        <p>{selectedApplication.additional_info}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-small text-gray-500">Дата подачи:</span>
                      <p>{formatDate(selectedApplication.created_at)}</p>
                    </div>
                    <div>
                      <span className="text-small text-gray-500">Статус:</span>
                      <div className="mt-1">{renderStatus(selectedApplication.status)}</div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-medium font-semibold mb-2">Загруженные документы</h3>
                  <div className="space-y-4">
                    {/* Фотография */}
                    <div>
                      <span className="text-small text-gray-500">Фотография:</span>
                      {selectedApplication.photo_path ? (
                        <div className="mt-2 border rounded-md overflow-hidden">
                          <a 
                            href={`${API_BASE_URL}${selectedApplication.photo_path}`} 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center text-primary hover:underline mb-2"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Открыть в полном размере
                          </a>
                          <img 
                            src={`${API_BASE_URL}${selectedApplication.photo_path}`} 
                            alt="Фото врача" 
                            className="w-full h-auto max-h-48 object-cover"
                          />
                        </div>
                      ) : (
                        <p className="text-gray-400">Фотография не загружена</p>
                      )}
                    </div>
                    
                    {/* Диплом */}
                    <div>
                      <span className="text-small text-gray-500">Диплом:</span>
                      {selectedApplication.diploma_path ? (
                        <div className="mt-2 border rounded-md overflow-hidden">
                          <a 
                            href={`${API_BASE_URL}${selectedApplication.diploma_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center text-primary hover:underline mb-2"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            Просмотреть документ в полном размере
                          </a>
                          {selectedApplication.diploma_path.toLowerCase().endsWith('.pdf') ? (
                            <iframe 
                              src={`${API_BASE_URL}${selectedApplication.diploma_path}`} 
                              className="w-full h-48"
                              title="Диплом"
                            ></iframe>
                          ) : (
                            <img 
                              src={`${API_BASE_URL}${selectedApplication.diploma_path}`} 
                              alt="Диплом" 
                              className="w-full h-auto max-h-48 object-cover"
                            />
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-400">Диплом не загружен</p>
                      )}
                    </div>
                    
                    {/* Лицензия */}
                    <div>
                      <span className="text-small text-gray-500">Лицензия:</span>
                      {selectedApplication.license_path ? (
                        <div className="mt-2 border rounded-md overflow-hidden">
                          <a 
                            href={`${API_BASE_URL}${selectedApplication.license_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center text-primary hover:underline mb-2"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            Просмотреть документ в полном размере
                          </a>
                          {selectedApplication.license_path.toLowerCase().endsWith('.pdf') ? (
                            <iframe 
                              src={`${API_BASE_URL}${selectedApplication.license_path}`} 
                              className="w-full h-48"
                              title="Лицензия"
                            ></iframe>
                          ) : (
                            <img 
                              src={`${API_BASE_URL}${selectedApplication.license_path}`} 
                              alt="Лицензия" 
                              className="w-full h-auto max-h-48 object-cover"
                            />
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-400">Лицензия не загружена</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Комментарий администратора */}
              {selectedApplication.status === 'pending' && (
                <div className="mt-4">
                  <Textarea
                    label="Комментарий администратора"
                    placeholder="Укажите причину отклонения или любой другой комментарий"
                    value={adminComment}
                    onChange={(e) => setAdminComment(e.target.value)}
                    className="w-full"
                    isRequired={true}
                    errorMessage={error && !adminComment.trim() ? error : null}
                    isInvalid={error && !adminComment.trim()}
                  />
                  {confirmAction === 'reject' && !adminComment.trim() && error && (
                    <div className="mt-1 text-danger text-sm">
                      {error}
                    </div>
                  )}
                </div>
              )}
              
              {/* Результат рассмотрения */}
              {selectedApplication.status !== 'pending' && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-medium font-semibold mb-2">Результат рассмотрения</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-small text-gray-500">Статус:</span>
                      <div className="mt-1">{renderStatus(selectedApplication.status)}</div>
                    </div>
                    {selectedApplication.admin_comment && (
                      <div>
                        <span className="text-small text-gray-500">Комментарий администратора:</span>
                        <p>{selectedApplication.admin_comment}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-small text-gray-500">Дата рассмотрения:</span>
                      <p>{formatDate(selectedApplication.processed_at)}</p>
                    </div>
                  </div>
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              {selectedApplication.status === 'pending' && (
                <>
                  <Button
                    color="danger"
                    variant="flat"
                    onPress={() => showConfirmation('reject')}
                    isDisabled={loading}
                  >
                    Отклонить
                  </Button>
                  <Button
                    color="success"
                    onPress={() => showConfirmation('approve')}
                    isDisabled={loading}
                  >
                    Одобрить
                  </Button>
                </>
              )}
              <Button color="default" variant="light" onPress={onClose}>
                {selectedApplication.status === 'pending' ? 'Отмена' : 'Закрыть'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
      
      {/* Модальное окно подтверждения действия */}
      <Modal isOpen={isConfirmModalOpen} onClose={onConfirmModalClose} size="sm">
        <ModalContent>
          {(onCloseConfirm) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {confirmAction === 'approve' ? 'Подтверждение одобрения' : 'Подтверждение отклонения'}
              </ModalHeader>
              <ModalBody>
                {confirmAction === 'approve' ? (
                  <p>Вы уверены, что хотите одобрить заявку на роль врача? После одобрения пользователь получит роль врача и сможет создать свой профиль.</p>
                ) : (
                  <p>Вы уверены, что хотите отклонить заявку на роль врача? Пользователь получит уведомление с указанным комментарием.</p>
                )}
                
                {confirmAction === 'reject' && !adminComment.trim() && (
                  <div className="mt-3 text-danger text-sm">
                    Необходимо указать причину отклонения в комментарии.
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="light" onPress={onCloseConfirm}>
                  Отмена
                </Button>
                <Button 
                  color={confirmAction === 'approve' ? 'success' : 'danger'} 
                  onPress={handleConfirmAction}
                  isDisabled={confirmAction === 'reject' && !adminComment.trim()}
                >
                  {confirmAction === 'approve' ? 'Подтвердить одобрение' : 'Подтвердить отклонение'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      
      {/* Модальное окно для просмотра профиля пользователя */}
      <Modal isOpen={isUserModalOpen} onClose={onUserModalClose} size="3xl">
        <ModalContent>
          {() => (
            <>
              <ModalHeader>
                <div className="flex flex-col">
                  <span>Профиль пользователя</span>
                  <span className="text-sm text-gray-500">ID: {selectedUser?.id}</span>
                </div>
              </ModalHeader>
              <ModalBody>
                {userProfileLoading ? (
                  <div className="flex justify-center py-8">
                    <Spinner label="Загрузка профиля..." />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Основная информация о пользователе */}
                    <Card>
                      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                        <div className="flex justify-between items-center w-full">
                          <h3 className="text-lg font-semibold">Основная информация</h3>
                          {renderUserRole(selectedUser?.role)}
                        </div>
                      </CardHeader>
                      <CardBody>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Email</p>
                            <p className="font-medium">{selectedUser?.email}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Статус</p>
                            <Chip color={selectedUser?.is_active ? "success" : "danger"} variant="flat">
                              {selectedUser?.is_active ? "Активен" : "Неактивен"}
                            </Chip>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Дата регистрации</p>
                            <p>{formatDate(selectedUser?.created_at)}</p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>

                    {/* Информация о профиле */}
                    {userProfile && (
                      <Card>
                        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                          <h3 className="text-lg font-semibold">Профиль пользователя</h3>
                        </CardHeader>
                        <CardBody>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Общие поля для всех профилей */}
                            <div>
                              <p className="text-sm text-gray-500">Полное имя</p>
                              <p className="font-medium">{userProfile.full_name || "-"}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Телефон</p>
                              <p className="font-medium">{userProfile.contact_phone || "-"}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Район</p>
                              <p>{userProfile.district || "-"}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Адрес</p>
                              <p>{userProfile.contact_address || "-"}</p>
                            </div>
                            
                            {/* Поля только для пациентов */}
                            {selectedUser?.role === 'patient' && (
                              <div className="col-span-2">
                                <p className="text-sm text-gray-500">Медицинская информация</p>
                                <p className="whitespace-pre-wrap bg-gray-50 p-2 rounded mt-1">
                                  {userProfile.medical_info || "-"}
                                </p>
                              </div>
                            )}
                            
                            {/* Поля только для врачей */}
                            {selectedUser?.role === 'doctor' && (
                              <>
                                <div>
                                  <p className="text-sm text-gray-500">Специализация</p>
                                  <p className="font-medium">{userProfile.specialization || "-"}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-500">Стоимость консультации</p>
                                  <p className="font-medium">{userProfile.cost_per_consultation || "-"} ₽</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-500">Опыт работы</p>
                                  <p>{userProfile.experience || "-"}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-500">Верификация</p>
                                  <Chip color={userProfile.is_verified ? "success" : "warning"} variant="flat">
                                    {userProfile.is_verified ? "Верифицирован" : "Не верифицирован"}
                                  </Chip>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-sm text-gray-500">Образование</p>
                                  <p className="whitespace-pre-wrap bg-gray-50 p-2 rounded mt-1">
                                    {userProfile.education || "-"}
                                  </p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-sm text-gray-500">Районы практики</p>
                                  <p>{userProfile.practice_areas || "-"}</p>
                                </div>
                              </>
                            )}
                          </div>
                        </CardBody>
                      </Card>
                    )}

                    {/* Секция выбора роли */}
                    <Card>
                      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                        <h3 className="text-lg font-semibold">Изменить роль пользователя</h3>
                      </CardHeader>
                      <CardBody>
                        <div className="flex flex-col gap-4">
                          <Select
                            label="Выберите роль"
                            selectedKeys={[newRole]}
                            onChange={(e) => setNewRole(e.target.value)}
                          >
                            <SelectItem key="patient" value="patient">
                              Пациент
                            </SelectItem>
                            <SelectItem key="doctor" value="doctor">
                              Врач
                            </SelectItem>
                            <SelectItem key="admin" value="admin">
                              Администратор
                            </SelectItem>
                          </Select>
                          <Button
                            color="primary"
                            onClick={changeUserRole}
                            disabled={selectedUser?.role === newRole || usersLoading}
                          >
                            Изменить роль
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onUserModalClose}>
                  Закрыть
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

export default AdminPage; 