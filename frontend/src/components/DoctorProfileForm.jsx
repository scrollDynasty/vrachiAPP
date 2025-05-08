// frontend/src/components/DoctorProfileForm.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Spinner, Textarea, Card, CardBody, Divider, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Switch, Select, SelectItem, Avatar, Chip } from '@nextui-org/react';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import api, { getCsrfToken } from '../api';

// Компонент формы для профиля Врача
// Используется на странице ProfileSettingsPage для создания или редактирования профиля Врача.
// Принимает:
// - profile: Объект с текущими данными профиля врача (null, если профиль не создан).
// - onSave: Функция, которая будет вызвана при отправке формы с данными профиля.
// - isLoading: Флаг, указывающий, идет ли процесс сохранения (передается из родительского компонента).
// - error: Сообщение об ошибке сохранения (передается из родительского компонента).
function DoctorProfileForm({ profile, onSave, isLoading, error }) {
   const [full_name, setFullName] = useState('');
   const [specialization, setSpecialization] = useState('');
   const [experience_years, setExperienceYears] = useState('');
   const [education, setEducation] = useState('');
   const [district, setDistrict] = useState('');
   const [formLocalError, setFormLocalError] = useState(null);
   const [profileImage, setProfileImage] = useState('');
   const [isEditing, setIsEditing] = useState(false);
   
   // Состояние для модальных окон
   const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
   const [isPrivacyModalOpen, setPrivacyModalOpen] = useState(false);
   const [isDeleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
   
   const [isGoogleAccount, setIsGoogleAccount] = useState(false);
   const [currentPassword, setCurrentPassword] = useState('');
   const [newPassword, setNewPassword] = useState('');
   const [confirmPassword, setConfirmPassword] = useState('');
   const [passwordError, setPasswordError] = useState(null);
   
   // Настройки уведомлений
   const [emailNotifications, setEmailNotifications] = useState(true);
   const [pushNotifications, setPushNotifications] = useState(true);
   const [appointmentReminders, setAppointmentReminders] = useState(true);

   // Состояние для CSRF-токена
   const [csrfToken, setCsrfToken] = useState('');
   
   // Состояние для смены пароля
   const [isChangingPassword, setIsChangingPassword] = useState(false);

   // Предзаполнение формы при получении данных профиля
   useEffect(() => {
      if (profile) {
         setFullName(profile.full_name || '');
         setSpecialization(profile.specialization || '');
         
         // Преобразуем опыт из строки "X лет" в число
         if (profile.experience) {
            const expYears = parseInt(profile.experience.replace(/\D/g, '')) || '';
            setExperienceYears(expYears);
         }
         
         setEducation(profile.education || '');
         setDistrict(profile.district || profile.practice_areas || '');
         
         // Проверка метода авторизации
         setIsGoogleAccount(profile.isGoogleAccount || false);
         
         // Если профиль существует, не включаем режим редактирования по умолчанию
         setIsEditing(false);
      } else {
         // Если профиля нет (null), включаем режим редактирования
         setIsEditing(true);
      }
      
      // Загрузка изображения из локального хранилища
      const savedImage = localStorage.getItem('doctor_profileImage');
      if (savedImage) {
         setProfileImage(savedImage);
      }
      
      setFormLocalError(null);
   }, [profile]);

   // При монтировании компонента получаем CSRF токен
   useEffect(() => {
      const fetchCsrfToken = async () => {
         try {
            const token = await getCsrfToken();
            setCsrfToken(token);
         } catch (error) {
            console.error('Ошибка при получении CSRF токена:', error);
         }
      };
      
      fetchCsrfToken();
   }, []);

   // Обработчик отправки формы (пустая функция, так как редактирование всех полей запрещено)
   const handleSubmit = (event) => {
      event.preventDefault();
      setFormLocalError(null);

      // Здесь формируем данные для обновления профиля
      // Сейчас мы не разрешаем редактировать никакие поля
      const profileData = {
         full_name: full_name || '',
         specialization: specialization || '',
         experience: experience_years ? `${experience_years} лет` : '',
         education: education || '',
         district: district || ''
      };

      onSave(profileData);
      
      // После успешного сохранения выключаем режим редактирования
      if (!error) {
         setIsEditing(false);
      }
   };
   
   // Обработчик загрузки изображения
   const handleImageUpload = (e) => {
      const file = e.target.files[0];
      if (file) {
         const reader = new FileReader();
         reader.onloadend = () => {
            const base64String = reader.result;
            setProfileImage(base64String);
            
            // Сохраняем в localStorage с уникальным ключом
            const storageKey = 'doctor_profileImage';
            localStorage.setItem(storageKey, base64String);
            
            // Отправляем пользовательское событие, чтобы уведомить другие компоненты
            const profileImageEvent = new CustomEvent('doctorProfileImageUpdated', {
               detail: { profileImage: base64String }
            });
            window.dispatchEvent(profileImageEvent);
         };
         reader.readAsDataURL(file);
      }
   };
   
   // Обработчик включения режима редактирования (не используется, так как редактирование неактивно)
   const handleEditClick = () => {
      setIsEditing(true);
   };
   
   // Обработчик отмены редактирования (не используется, так как редактирование неактивно)
   const handleCancelEdit = () => {
      if (profile) {
         setFullName(profile.full_name || '');
         setSpecialization(profile.specialization || '');
         
         // Преобразуем опыт из строки "X лет" в число
         if (profile.experience) {
            const expYears = parseInt(profile.experience.replace(/\D/g, '')) || '';
            setExperienceYears(expYears);
         }
         
         setEducation(profile.education || '');
         setDistrict(profile.district || profile.practice_areas || '');
      }
      setIsEditing(false);
      setFormLocalError(null);
   };
   
   // Обработчик клика на фото
   const handleChangePhotoClick = () => {
      // Программно кликаем по скрытому полю загрузки файла
      document.getElementById('doctor-photo-upload').click();
   };
   
   // Обработчик изменения пароля
   const handlePasswordChange = async (e) => {
      e?.preventDefault();
      setPasswordError(null);
      setIsChangingPassword(true);
      
      try {
         // Валидация
         if (!currentPassword) {
            setPasswordError("Пожалуйста, введите текущий пароль");
            setIsChangingPassword(false);
            return;
         }
         
         if (!newPassword) {
            setPasswordError("Пожалуйста, введите новый пароль");
            setIsChangingPassword(false);
            return;
         }
         
         if (newPassword.length < 8) {
            setPasswordError("Новый пароль должен содержать минимум 8 символов");
            setIsChangingPassword(false);
            return;
         }
         
         if (newPassword !== confirmPassword) {
            setPasswordError("Пароли не совпадают");
            setIsChangingPassword(false);
            return;
         }
         
         // Проверка, что новый пароль не совпадает со старым
         if (newPassword === currentPassword) {
            setPasswordError("Новый пароль должен отличаться от текущего");
            setIsChangingPassword(false);
            return;
         }
         
         // Проверка наличия CSRF токена
         if (!csrfToken) {
            console.error('CSRF токен отсутствует. Получаем новый токен...');
            try {
               const tokenResponse = await api.get('/csrf-token');
               setCsrfToken(tokenResponse.data.csrf_token);
            } catch (tokenError) {
               console.error('Не удалось получить CSRF токен:', tokenError);
               setPasswordError("Ошибка безопасности. Пожалуйста, обновите страницу и попробуйте снова.");
               setIsChangingPassword(false);
               return;
            }
         }
         
         console.log('Отправка запроса на смену пароля...');
         
         // Всегда получаем свежий CSRF токен перед отправкой запроса на смену пароля
         try {
            const freshTokenResponse = await api.get('/csrf-token');
            const freshToken = freshTokenResponse.data.csrf_token;
            console.log('Получен свежий CSRF токен для смены пароля');
            
            // Отправляем запрос на смену пароля с свежим CSRF токеном
            const changePasswordResponse = await api.post('/users/me/change-password', {
               csrf_token: freshToken,
               current_password: currentPassword,
               new_password: newPassword
            });
            
            console.log('Ответ от сервера:', changePasswordResponse);
            
            // Показываем уведомление об успешной смене пароля
            toast.success('Пароль успешно изменен', {
               position: 'top-right',
               autoClose: 3000,
               hideProgressBar: false,
               closeOnClick: true,
               pauseOnHover: true,
               draggable: true
            });
            
            // Очищаем поля формы после успешной смены пароля
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            
            // Закрываем модальное окно
            setPasswordModalOpen(false);
            
            // Получаем новый CSRF токен после успешной операции
            const newToken = await getCsrfToken();
            setCsrfToken(newToken);
            
         } catch (error) {
            console.error('Ошибка при смене пароля:', error);
            
            // Подробная информация об ошибке для отладки
            if (error.response) {
               console.error('Данные ответа:', error.response.data);
               console.error('Статус ответа:', error.response.status);
               console.error('Заголовки ответа:', error.response.headers);
            } else if (error.request) {
               console.error('Запрос был отправлен, но ответ не получен:', error.request);
            } else {
               console.error('Ошибка при подготовке запроса:', error.message);
            }
            
            // Получаем сообщение ошибки из ответа сервера, если оно есть
            let errorMessage = 'Не удалось изменить пароль. Пожалуйста, проверьте введенные данные.';
            
            if (error.response?.data) {
               if (error.response.status === 401) {
                  errorMessage = 'Неверный текущий пароль. Пожалуйста, проверьте правильность ввода.';
               } else if (error.response.status === 400) {
                  // Специальная обработка для Bad Request
                  if (error.response.data.detail) {
                     const detail = error.response.data.detail;
                     console.info('Детальная ошибка 400:', detail);
                     
                     if (detail.includes('Invalid CSRF token') || detail.includes('CSRF token missing')) {
                        errorMessage = 'Ошибка безопасности. Пожалуйста, обновите страницу и попробуйте снова.';
                     } else if (detail.includes('Current password is incorrect') || detail.includes('Wrong password')) {
                        errorMessage = 'Неверный текущий пароль. Пожалуйста, проверьте правильность ввода.';
                     } else if (detail.includes('Password change failed')) {
                        errorMessage = 'Неверный текущий пароль. Пожалуйста, проверьте правильность ввода.';
                     } else {
                        errorMessage = 'Ошибка при смене пароля. Пожалуйста, проверьте введенные данные.';
                     }
                  } else if (typeof error.response.data === 'string') {
                     // Если сервер вернул текстовую ошибку
                     if (error.response.data.includes('Password change failed') || 
                         error.response.data.includes('Current password is incorrect')) {
                        errorMessage = 'Неверный текущий пароль. Пожалуйста, проверьте правильность ввода.';
                     } else {
                        errorMessage = 'Ошибка при смене пароля. Пожалуйста, проверьте введенные данные.';
                     }
                  }
               } else if (error.response.data.detail) {
                  // Проверяем английские сообщения и заменяем их на русские
                  const detail = error.response.data.detail;
                  if (detail.includes('Password change failed')) {
                     errorMessage = 'Ошибка при смене пароля. Пожалуйста, проверьте введенные данные.';
                  } else if (detail.includes('Current password is incorrect')) {
                     errorMessage = 'Неверный текущий пароль. Пожалуйста, проверьте правильность ввода.';
                  } else if (detail.includes('Password too short')) {
                     errorMessage = 'Новый пароль слишком короткий. Минимальная длина - 8 символов.';
                  } else if (detail.includes('Password too weak')) {
                     errorMessage = 'Новый пароль слишком простой. Используйте комбинацию букв, цифр и специальных символов.';
                  } else {
                     // Если получен какой-то другой текст ошибки, используем его
                     errorMessage = detail;
                  }
               }
            }
            
            setPasswordError(errorMessage);
         } finally {
            setIsChangingPassword(false);
         }
      } catch (error) {
         console.error('Неожиданная ошибка при смене пароля:', error);
         setPasswordError('Произошла неожиданная ошибка. Пожалуйста, попробуйте позже.');
         setIsChangingPassword(false);
      }
   };
   
   // Удаление аккаунта
   const handleDeleteAccount = () => {
      // Здесь будет логика удаления аккаунта
      toast.error('Аккаунт был удален', {
         position: 'top-right',
         autoClose: 3000,
         hideProgressBar: false,
         closeOnClick: true,
         pauseOnHover: true,
         draggable: true
      });
      setDeleteAccountModalOpen(false);
   };

   // Функция для закрытия модального окна смены пароля
   const closePasswordModal = () => {
      if (!isChangingPassword) {
         setPasswordModalOpen(false);
         setPasswordError(null);
      }
   };

   return (
      <div className="w-full max-w-5xl mx-auto">
         {/* Сообщение об ошибке */}
         {(error || formLocalError) && (
            <div className="bg-danger-50 text-danger p-4 rounded-xl mb-6">
               <p className="font-medium">{error || formLocalError}</p>
            </div>
         )}
         
         <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
               <div className="text-xl font-bold">Настройки профиля врача</div>
               <div>
                  {isEditing ? (
                     <div className="flex gap-2">
                        <Button 
                           color="danger" 
                           variant="flat" 
                           onClick={handleCancelEdit}
                           disabled={isLoading}
                        >
                           Отмена
                        </Button>
                        <Button 
                           color="primary" 
                           type="submit"
                           form="doctor-profile-form"
                           disabled={isLoading}
                        >
                           {isLoading ? <Spinner size="sm" /> : "Сохранить изменения"}
                        </Button>
                     </div>
                  ) : (
                     <div>
                        <Chip color="primary" variant="flat" className="mb-2">Ваш профиль зафиксирован администратором</Chip>
                     </div>
                  )}
               </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-6">
               {/* Левая колонка - фото профиля и настройки аккаунта */}
               <div className="md:w-1/3 space-y-6">
                  {/* Фото профиля */}
                  <Card className="shadow-sm hover:shadow-md transition-shadow overflow-visible">
                     <CardBody className="p-6 flex flex-col items-center">
                        <div className="relative mb-4">
                           <Avatar 
                              src={profileImage || "https://i.pravatar.cc/150?img=6"} 
                              className="w-28 h-28" 
                              isBordered
                              color="primary"
                           />
                           <input 
                              type="file" 
                              id="doctor-photo-upload" 
                              accept="image/*" 
                              onChange={handleImageUpload} 
                              className="hidden" 
                           />
                           <Button 
                              isIconOnly
                              color="primary" 
                              size="sm" 
                              radius="full" 
                              className="absolute bottom-0 right-0"
                              onClick={handleChangePhotoClick}
                           >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                 <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                           </Button>
                        </div>
                        <div className="text-center">
                           <h4 className="font-semibold mb-1">{full_name || 'Ваше имя'}</h4>
                           <p className="text-default-500 text-sm">{specialization || 'Специализация'}</p>
                        </div>
                     </CardBody>
                  </Card>
                  
                  {/* Настройки безопасности */}
                  <Card className="shadow-sm hover:shadow-md transition-shadow">
                     <CardBody className="p-4">
                        <div className="flex flex-col h-full">
                           <div className="mb-3 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              <h3 className="text-medium font-semibold">Безопасность</h3>
                           </div>
                           <p className="text-sm text-gray-500 mb-4">Управление паролем и настройками безопасности</p>
                           <div className="mt-auto">
                              <Button 
                                 color="primary"
                                 variant="flat"
                                 className="w-full text-sm"
                                 size="sm"
                                 onClick={() => setPasswordModalOpen(true)}
                                 disabled={isGoogleAccount}
                              >
                                 Изменить пароль
                              </Button>
                              {isGoogleAccount && (
                                 <p className="text-xs text-gray-400 mt-2">
                                    Вы используете вход через Google. Управление паролем недоступно.
                                 </p>
                              )}
                           </div>
                        </div>
                     </CardBody>
                  </Card>
                  
                  {/* Настройки уведомлений */}
                  <Card className="shadow-sm hover:shadow-md transition-shadow">
                     <CardBody className="p-4">
                        <div className="flex flex-col h-full">
                           <div className="mb-3 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                              </svg>
                              <h3 className="text-medium font-semibold">Уведомления</h3>
                           </div>
                           <p className="text-sm text-gray-500 mb-4">Управление email и push-уведомлениями</p>
                           <div className="mt-auto">
                              {/* Удаляем кнопку настроек уведомлений */}
                           </div>
                        </div>
                     </CardBody>
                  </Card>
                  
                  {/* Удаление аккаунта */}
                  <Card className="shadow-sm hover:shadow-md transition-shadow">
                     <CardBody className="p-4">
                        <div className="flex flex-col h-full">
                           <div className="mb-3 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <h3 className="text-medium font-semibold">Удаление аккаунта</h3>
                           </div>
                           <p className="text-sm text-gray-500 mb-4">Полное удаление вашего аккаунта</p>
                           <div className="mt-auto">
                              <Button 
                                 color="danger"
                                 variant="flat"
                                 className="w-full text-sm"
                                 size="sm"
                                 onClick={() => setDeleteAccountModalOpen(true)}
                              >
                                 Удалить аккаунт
                              </Button>
                           </div>
                        </div>
                     </CardBody>
                  </Card>
               </div>
               
               {/* Правая колонка - форма профиля */}
               <div className="md:w-2/3">
                  <Card className="shadow-sm">
                     <CardBody className="p-6">
                        <form id="doctor-profile-form" onSubmit={handleSubmit}>
                           <div className="space-y-5">
                              <h3 className="text-xl font-semibold mb-4">Информация о враче</h3>
                              
                              <div className="bg-blue-50 text-blue-800 p-4 rounded-lg mb-6">
                                 <p className="text-sm font-medium mb-1">Примечание:</p>
                                 <p className="text-sm">Основная информация о враче (ФИО, специализация, образование, опыт и район практики) берется из одобренной заявки и не может быть изменена. Стоимость консультации устанавливается администратором.</p>
                              </div>
                              
                              {/* ФИО (только для просмотра) */}
                              <Input
            label="ФИО"
            value={full_name}
                                 readOnly
                                 variant="bordered"
                                 isDisabled={true}
                                 className="max-w-full"
                              />
                              
                              {/* Специализация (только для просмотра) */}
                              <Input
                                 label="Специализация"
               value={specialization}
                                 readOnly
                                 variant="bordered"
                                 isDisabled={true}
                                 className="max-w-full"
                              />
                              
                              {/* Опыт работы (только для просмотра) */}
                              <Input
            label="Опыт работы (лет)"
            value={experience_years}
                                 readOnly
                                 variant="bordered"
                                 isDisabled={true}
                                 className="max-w-full"
                                 endContent={
                                    <div className="pointer-events-none flex items-center">
                                       <span className="text-default-400 text-small">лет</span>
                                    </div>
                                 }
                              />
                              
                              {/* Образование (только для просмотра) */}
                              <Textarea
            label="Образование"
            value={education}
                                 readOnly
                                 variant="bordered"
                                 isDisabled={true}
                                 minRows={3}
                                 maxRows={5}
                                 className="max-w-full"
                              />
                              
                              {/* Район практики (только для просмотра) */}
                              <Input
                                 label="Район практики"
                                 value={district}
                                 readOnly
                                 variant="bordered"
                                 isDisabled={true}
                                 className="max-w-full"
                              />
                           </div>
                        </form>
                     </CardBody>
                  </Card>
               </div>
            </div>
         </div>
         
         {/* Модальное окно для смены пароля */}
         <Modal isOpen={isPasswordModalOpen} onClose={closePasswordModal}>
            <ModalContent>
               <ModalHeader>Изменение пароля</ModalHeader>
               <ModalBody>
                  <form onSubmit={handlePasswordChange}>
                     {passwordError && (
                        <div className="bg-danger-50 text-danger p-3 rounded-lg mb-4">
                           <p className="text-sm">{passwordError}</p>
                        </div>
                     )}
                     
                     {!isGoogleAccount && (
                        <Input
                           label="Текущий пароль"
                           type="password"
                           value={currentPassword}
                           onChange={(e) => setCurrentPassword(e.target.value)}
                           className="mb-4"
                        />
                     )}
                     
                     <Input
                        label="Новый пароль"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="mb-4"
                     />
                     
                     <Input
                        label="Подтверждение пароля"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                     />
                  </form>
               </ModalBody>
               <ModalFooter>
                  <Button variant="flat" onClick={closePasswordModal} isDisabled={isChangingPassword}>
                     Отмена
                  </Button>
                  <Button 
                     color="primary" 
                     onClick={handlePasswordChange} 
                     isLoading={isChangingPassword}
                     isDisabled={!currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 8}
                  >
                     Изменить пароль
                  </Button>
               </ModalFooter>
            </ModalContent>
         </Modal>
         
         {/* Модальное окно для удаления аккаунта */}
         <Modal isOpen={isDeleteAccountModalOpen} onClose={() => setDeleteAccountModalOpen(false)}>
            <ModalContent>
               <ModalHeader>Удаление аккаунта</ModalHeader>
               <ModalBody>
                  <div className="bg-danger-50 text-danger p-4 rounded-lg mb-4">
                     <p className="font-medium">Внимание! Это действие необратимо.</p>
                  </div>
                  <p>Вы уверены, что хотите удалить свой аккаунт? Все ваши данные будут безвозвратно удалены.</p>
               </ModalBody>
               <ModalFooter>
                  <Button variant="flat" onClick={() => setDeleteAccountModalOpen(false)}>
                     Отмена
                  </Button>
                  <Button color="danger" onClick={handleDeleteAccount}>
                     Удалить аккаунт
             </Button>
               </ModalFooter>
            </ModalContent>
         </Modal>
      </div>
   );
}

export default DoctorProfileForm;