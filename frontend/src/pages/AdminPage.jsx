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
  
  // Загрузка заявок
  useEffect(() => {
    if (activeTab === 'applications') {
      fetchApplications();
    }
  }, [page, selectedStatus, activeTab]);
  
  // Загрузка пользователей
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [usersPage, activeTab]);
  
  // Функция для загрузки заявок
  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/doctor-applications?page=${page}&size=10&status=${selectedStatus}`);
      setApplications(response.data.items);
      setTotalApplications(response.data.total);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch applications:', err);
      setError('Ошибка при загрузке заявок. Пожалуйста, попробуйте позже.');
      setLoading(false);
    }
  };
  
  // Функция для загрузки пользователей
  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      setUsersError(null);
      const response = await api.get(`/admin/users?page=${usersPage}&size=10`);
      setUsers(response.data);
      setUsersLoading(false);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setUsersError('Ошибка при загрузке пользователей. Пожалуйста, попробуйте позже.');
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
      console.error('Failed to fetch user profile:', err);
      setUserProfile({ message: 'Ошибка при загрузке профиля пользователя.' });
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
                      <Table aria-label="Список пользователей">
                        <TableHeader>
                          <TableColumn>ID</TableColumn>
                          <TableColumn>Email</TableColumn>
                          <TableColumn>Роль</TableColumn>
                          <TableColumn>Статус</TableColumn>
                          <TableColumn>Действия</TableColumn>
                        </TableHeader>
                        <TableBody>
                          {users.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell>{user.id}</TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell>{renderUserRole(user.role)}</TableCell>
                              <TableCell>
                                {user.is_active ? (
                                  <Chip color="success" size="sm">Активен</Chip>
                                ) : (
                                  <Chip color="danger" size="sm">Не активен</Chip>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button 
                                  size="sm" 
                                  color="primary" 
                                  variant="flat"
                                  onClick={() => viewUserProfile(user)}
                                >
                                  Профиль
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      
                      <div className="flex justify-center py-4">
                        <Pagination
                          total={10} // Заглушка, в реальном API нужно получать общее количество
                          page={usersPage}
                          onChange={setUsersPage}
                        />
                      </div>
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
      <Modal isOpen={isUserModalOpen} onClose={onUserModalClose} size="2xl">
        <ModalContent>
          {(onUserModalClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Профиль пользователя
              </ModalHeader>
              <ModalBody>
                {selectedUser && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">ID пользователя</p>
                        <p className="font-medium">{selectedUser.id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-medium">{selectedUser.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Текущая роль</p>
                        <div className="mt-1">{renderUserRole(selectedUser.role)}</div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Статус активации</p>
                        {selectedUser.is_active ? (
                          <Chip color="success" size="sm">Активен</Chip>
                        ) : (
                          <Chip color="danger" size="sm">Не активен</Chip>
                        )}
                      </div>
                    </div>
                    
                    <div className="border-t pt-4">
                      <h4 className="font-medium text-lg mb-4">Изменить роль пользователя</h4>
                      <div className="flex flex-col md:flex-row gap-4">
                        <Select
                          label="Новая роль"
                          placeholder="Выберите роль"
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value)}
                          className="md:w-1/2"
                        >
                          <SelectItem key="patient" value="patient">Пациент</SelectItem>
                          <SelectItem key="doctor" value="doctor">Врач</SelectItem>
                          <SelectItem key="admin" value="admin">Администратор</SelectItem>
                        </Select>
                        <Button 
                          color="primary" 
                          onClick={changeUserRole}
                          isDisabled={usersLoading || selectedUser.role === newRole}
                        >
                          Сохранить изменения
                        </Button>
                      </div>
                    </div>
                    
                    {userProfileLoading ? (
                      <div className="flex justify-center items-center py-4">
                        <Spinner size="md" />
                      </div>
                    ) : userProfile ? (
                      <div className="border-t pt-4">
                        <h4 className="font-medium text-lg mb-4">Профиль пользователя</h4>
                        {userProfile.message ? (
                          <p className="text-gray-500">{userProfile.message}</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {userProfile.full_name && (
                              <div>
                                <p className="text-sm text-gray-500">ФИО</p>
                                <p className="font-medium">{userProfile.full_name}</p>
                              </div>
                            )}
                            {userProfile.contact_phone && (
                              <div>
                                <p className="text-sm text-gray-500">Телефон</p>
                                <p className="font-medium">{userProfile.contact_phone}</p>
                              </div>
                            )}
                            {userProfile.contact_address && (
                              <div>
                                <p className="text-sm text-gray-500">Адрес</p>
                                <p className="font-medium">{userProfile.contact_address}</p>
                              </div>
                            )}
                            {userProfile.specialization && (
                              <div>
                                <p className="text-sm text-gray-500">Специализация</p>
                                <p className="font-medium">{userProfile.specialization}</p>
                              </div>
                            )}
                            {userProfile.experience && (
                              <div>
                                <p className="text-sm text-gray-500">Опыт</p>
                                <p className="font-medium">{userProfile.experience}</p>
                              </div>
                            )}
                            {userProfile.education && (
                              <div>
                                <p className="text-sm text-gray-500">Образование</p>
                                <p className="font-medium">{userProfile.education}</p>
                              </div>
                            )}
                            {userProfile.practice_areas && (
                              <div>
                                <p className="text-sm text-gray-500">Районы практики</p>
                                <p className="font-medium">{userProfile.practice_areas}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onUserModalClose}>
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