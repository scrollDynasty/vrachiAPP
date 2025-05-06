// frontend/src/components/PatientProfileForm.jsx
import React, { useState, useEffect } from 'react';
import { Input, Button, Spinner, Textarea, Card, CardBody, Divider, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Switch, Select, SelectItem } from '@nextui-org/react';

// Компонент формы для профиля Пациента
// Используется на странице ProfileSettingsPage для создания или редактирования профиля Пациента.
// Принимает:
// - profile: Объект с текущими данными профиля пациента (null, если профиль не создан).
// - onSave: Функция, которая будет вызвана при отправке формы с данными профиля.
// - isLoading: Флаг, указывающий, идет ли процесс сохранения (передается из родительского компонента).
// - error: Сообщение об ошибке сохранения (передается из родительского компонента).
function PatientProfileForm({ profile, onSave, isLoading, error }) {
   const [full_name, setFullName] = useState('');
   const [contact_phone, setContactPhone] = useState('');
   const [contact_address, setContactAddress] = useState('');
   const [district, setDistrict] = useState('');
   const [medicalInfo, setMedicalInfo] = useState('');
   const [formLocalError, setFormLocalError] = useState(null);
   const [profileImage, setProfileImage] = useState('');
   const [isEditing, setIsEditing] = useState(false);
   
   // Список районов Ташкента
   const districts = [
     { value: "Алмазарский район", label: "Алмазарский район" },
     { value: "Бектемирский район", label: "Бектемирский район" },
     { value: "Мирабадский район", label: "Мирабадский район" },
     { value: "Мирзо-Улугбекский район", label: "Мирзо-Улугбекский район" },
     { value: "Сергелийский район", label: "Сергелийский район" },
     { value: "Учтепинский район", label: "Учтепинский район" },
     { value: "Чиланзарский район", label: "Чиланзарский район" },
     { value: "Шайхантаурский район", label: "Шайхантаурский район" },
     { value: "Юнусабадский район", label: "Юнусабадский район" },
     { value: "Яккасарайский район", label: "Яккасарайский район" },
     { value: "Яшнабадский район", label: "Яшнабадский район" }
   ];
   
   // Состояние для модальных окон
   const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
   const [isNotificationsModalOpen, setNotificationsModalOpen] = useState(false);
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

   // Предзаполнение формы при получении данных профиля
   useEffect(() => {
      if (profile) {
         setFullName(profile.full_name || '');
         setContactPhone(profile.contact_phone || '');
         setContactAddress(profile.contact_address || '');
         setDistrict(profile.district || '');
         setMedicalInfo(profile.medical_info || '');
         
         // Проверка метода авторизации (для демонстрации, в реальности нужно получать из профиля)
         // В реальном приложении эта информация должна приходить с бэкенда
         setIsGoogleAccount(profile.isGoogleAccount || false);
         
         // Если профиль существует, не включаем режим редактирования по умолчанию
         setIsEditing(false);

         // Отладочное сообщение для проверки данных
         console.log('Profile data:', profile);
         console.log('Medical info:', profile.medical_info);
      } else {
         // Если профиля нет (null), включаем режим редактирования
         setIsEditing(true);
      }
      
      // Загрузка изображения из локального хранилища
      const savedImage = localStorage.getItem('profileImage');
      if (savedImage) {
         setProfileImage(savedImage);
      }
      
      setFormLocalError(null);
   }, [profile]);

   // Обработчик отправки формы
   const handleSubmit = (event) => {
      event.preventDefault();
      setFormLocalError(null);

      if (!full_name) {
        setFormLocalError("Пожалуйста, укажите ваше полное имя");
        return;
      }

      const profileData = {
         full_name: full_name || null,
         contact_phone: contact_phone || null,
         contact_address: contact_address || null,
         district: district || null,
         medical_info: medicalInfo || null
      };

      onSave(profileData);
      
      // После успешного сохранения выключаем режим редактирования
      if (!error) {
         setIsEditing(false);
      }
   };
   
   // Обработчик включения режима редактирования
   const handleEditClick = () => {
      setIsEditing(true);
   };
   
   // Обработчик отмены редактирования
   const handleCancelEdit = () => {
      // Восстанавливаем данные из profile и выключаем режим редактирования
      if (profile) {
         setFullName(profile.full_name || '');
         setContactPhone(profile.contact_phone || '');
         setContactAddress(profile.contact_address || '');
         setDistrict(profile.district || '');
         setMedicalInfo(profile.medical_info || '');
      }
      setIsEditing(false);
      setFormLocalError(null);
   };
   
   // Обработчик изменения пароля
   const handlePasswordChange = (e) => {
      e.preventDefault();
      setPasswordError(null);
      
      if (!isGoogleAccount && !currentPassword) {
         setPasswordError("Введите текущий пароль");
         return;
      }
      
      if (newPassword.length < 8) {
         setPasswordError("Новый пароль должен содержать минимум 8 символов");
         return;
      }
      
      if (newPassword !== confirmPassword) {
         setPasswordError("Пароли не совпадают");
         return;
      }
      
      // Здесь будет логика для изменения пароля
      // В реальном приложении здесь будет вызов API
      alert('Пароль успешно изменен');
      
      // Сброс полей и закрытие модального окна
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordModalOpen(false);
   };
   
   // Обработчик загрузки изображения
   const handleImageUpload = (e) => {
      const file = e.target.files[0];
      if (file) {
         const reader = new FileReader();
         reader.onloadend = () => {
            const base64String = reader.result;
            setProfileImage(base64String);
            
            // Сохраняем в localStorage с уникальным ключом, включая временную метку для предотвращения кэширования
            const storageKey = 'vrach_profileImage';
            localStorage.setItem(storageKey, base64String);
            
            // Отправляем пользовательское событие, чтобы уведомить другие компоненты
            const profileImageEvent = new CustomEvent('profileImageUpdated', {
               detail: { profileImage: base64String }
            });
            window.dispatchEvent(profileImageEvent);
            console.log('Событие profileImageUpdated отправлено');
         };
         reader.readAsDataURL(file);
      }
   };
   
   // Сохранение настроек уведомлений
   const handleNotificationsSave = () => {
      // Здесь будет логика сохранения настроек уведомлений
      // В реальном приложении здесь будет вызов API
      alert('Настройки уведомлений сохранены');
      setNotificationsModalOpen(false);
   };
   
   // Удаление аккаунта
   const handleDeleteAccount = () => {
      // Здесь будет логика удаления аккаунта
      // В реальном приложении здесь будет вызов API
      alert('Аккаунт был удален');
      setDeleteAccountModalOpen(false);
      // В реальном приложении здесь будет редирект на страницу логина
   };

   // Создаем ссылки на инпут файлы для возможности программного вызова
   const avatarInputRef = React.useRef(null);
   
   // Обработчик кнопки изменения фото
   const handleChangePhotoClick = () => {
      // Программно вызываем клик по скрытому инпуту выбора файла
      avatarInputRef.current.click();
   };

   return (
      <div className="space-y-8">
         {/* Секция аватара профиля */}
         <div className="flex flex-col items-center mb-6">
            <div className="w-24 h-24 relative rounded-full overflow-hidden mb-3 border-3 border-primary shadow-md">
               {profileImage ? (
                  <img 
                     src={profileImage} 
                     alt="Аватар профиля" 
                     className="w-full h-full object-cover"
                  />
               ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                     </svg>
                  </div>
               )}
            </div>
            {isEditing && (
               <>
                 <input 
                    type="file" 
                    ref={avatarInputRef}
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleImageUpload}
                 />
                 <Button
                    color="primary"
                    className="font-medium"
                    size="sm"
                    radius="full"
                    onClick={handleChangePhotoClick}
                 >
                    Изменить фото
                 </Button>
               </>
            )}
         </div>
      
         {/* Заголовок секции и кнопка редактирования */}
         <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-gray-800">Профиль пациента</h3>
            {!isEditing && profile && (
               <Button 
                  color="primary" 
                  variant="light" 
                  size="sm"
                  startContent={
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                     </svg>
                  }
                  onClick={handleEditClick}
               >
                  Редактировать
               </Button>
            )}
         </div>
         
         {/* Режим просмотра (нередактируемый) */}
         {!isEditing && profile && (
            <Card className="mb-6 shadow-sm">
               <CardBody className="p-5">
                  <div className="space-y-4">
                     <div>
                        <h4 className="text-sm font-semibold text-gray-500 mb-1">Полное имя</h4>
                        <p className="text-medium">{full_name || 'Не указано'}</p>
                     </div>
                     
                     <div>
                        <h4 className="text-sm font-semibold text-gray-500 mb-1">Контактный телефон</h4>
                        <p className="text-medium">{contact_phone || 'Не указано'}</p>
                     </div>
                     
                     <div>
                        <h4 className="text-sm font-semibold text-gray-500 mb-1">Адрес</h4>
                        <p className="text-medium">{contact_address || 'Не указано'}</p>
                     </div>
                     
                     <div>
                        <h4 className="text-sm font-semibold text-gray-500 mb-1">Район</h4>
                        <p className="text-medium">{district || 'Не указано'}</p>
                     </div>
                     
                     <Divider className="my-3" />
                     
                     <div>
                        <h4 className="text-sm font-semibold text-gray-500 mb-1">Медицинская информация</h4>
                        <p className="text-medium whitespace-pre-line">{medicalInfo || 'Не указано'}</p>
                     </div>
                  </div>
               </CardBody>
            </Card>
         )}
         
         {/* Режим редактирования */}
         {isEditing && (
            <form onSubmit={handleSubmit} className="space-y-6">
               <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2 text-gray-800">Основная информация</h3>
                  <p className="text-sm text-gray-500 mb-4">Используется для идентификации вас в системе</p>
                  
                  <div className="space-y-4">
                     <Input
                        label="Полное имя"
                        placeholder="Иванов Иван Иванович"
                        value={full_name}
                        onChange={(e) => setFullName(e.target.value)}
                        variant="bordered"
                        radius="sm"
                        isRequired
                        labelPlacement="outside"
                        size="md"
                        classNames={{
                           input: "text-sm py-2",
                           inputWrapper: "py-0 h-auto min-h-[46px]",
                           label: "pb-1 text-small font-medium",
                           base: "mb-4"
                        }}
                     />
                     
                     <Input
                        label="Контактный телефон"
                        placeholder="+998(XX) XXX-XX-XX"
                        value={contact_phone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        variant="bordered"
                        radius="sm"
                        labelPlacement="outside"
                        size="md"
                        type="tel"
                        classNames={{
                           input: "text-sm py-2",
                           inputWrapper: "py-0 h-auto min-h-[46px]",
                           label: "pb-1 text-small font-medium",
                           base: "mb-4"
                        }}
                     />
                     
                     <Input
                        label="Адрес"
                        placeholder="г. Ташкент, ул. Примерная, д. 1, кв. 123"
                        value={contact_address}
                        onChange={(e) => setContactAddress(e.target.value)}
                        variant="bordered"
                        radius="sm"
                        labelPlacement="outside"
                        size="md"
                        classNames={{
                           input: "text-sm py-2",
                           inputWrapper: "py-0 h-auto min-h-[46px]",
                           label: "pb-1 text-small font-medium",
                           base: "mb-4"
                        }}
                     />
                     
                     <Select
                       label="Район"
                       placeholder="Выберите район"
                       labelPlacement="outside"
                       selectedKeys={district ? [district] : []}
                       onSelectionChange={(keys) => {
                         const selected = Array.from(keys)[0];
                         setDistrict(selected || '');
                       }}
                       variant="bordered"
                       radius="sm"
                       size="md"
                       classNames={{
                         trigger: "h-auto min-h-[46px] py-0",
                         label: "pb-1 text-small font-medium",
                         base: "mb-4"
                       }}
                     >
                       {districts.map((dist) => (
                         <SelectItem key={dist.value} value={dist.value}>
                           {dist.label}
                         </SelectItem>
                       ))}
                     </Select>
                  </div>
               </div>
               
               <Divider className="my-6" />
               
               <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2 text-gray-800">Медицинская информация</h3>
                  <p className="text-sm text-gray-500 mb-4">Эта информация поможет врачам лучше понять вашу историю</p>
                  
                  <Textarea
                     label="Медицинская информация"
                     placeholder="Укажите информацию о хронических заболеваниях, аллергиях, группе крови и другую важную медицинскую информацию"
                     value={medicalInfo}
                     onChange={(e) => setMedicalInfo(e.target.value)}
                     variant="bordered"
                     radius="sm"
                     labelPlacement="outside"
                     size="md"
                     minRows={3}
                     classNames={{
                        input: "text-sm py-2",
                        inputWrapper: "py-0 min-h-[100px]",
                        label: "pb-1 text-small font-medium",
                        base: "mb-4"
                     }}
                  />
               </div>

               {/* Отображение ошибки валидации */}
               <div className="min-h-[50px] mb-4">
                  {formLocalError && (
                     <div className="bg-danger-50 text-danger p-3 rounded-lg border border-danger-200 text-sm">
                        <div className="flex items-center">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                           </svg>
                           <p className="font-medium">{formLocalError}</p>
                        </div>
                     </div>
                  )}
               </div>
               
               <div className="flex justify-center space-x-3 pt-2">
                  {profile && (
                     <Button
                        type="button"
                        color="default"
                        size="md"
                        radius="sm"
                        className="font-medium min-w-[140px]"
                        onClick={handleCancelEdit}
                     >
                        Отмена
                     </Button>
                  )}
                  <Button
                     type="submit"
                     color="primary"
                     size="md"
                     radius="sm"
                     className="font-medium min-w-[140px]"
                     isLoading={isLoading}
                     startContent={!isLoading && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                     )}
                  >
                     {isLoading ? 'Сохранение...' : 'Сохранить профиль'}
                  </Button>
               </div>
            </form>
         )}
         
         {/* Футер с настройками аккаунта */}
         <div className="mt-12 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-bold mb-4 text-gray-800">Настройки аккаунта</h2>
            
            {/* Карточки настроек */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {/* Карточка смены пароля */}
               <Card className="w-full shadow-sm hover:shadow-md transition-shadow">
                  <CardBody className="p-4">
                     <div className="flex flex-col h-full">
                        <div className="mb-3 flex items-center">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                           </svg>
                           <h3 className="text-medium font-semibold">Смена пароля</h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">Обновите пароль для повышения безопасности</p>
                        <div className="mt-auto">
                           <Button 
                              color="primary"
                              variant="flat"
                              className="w-full text-sm"
                              size="sm"
                              onClick={() => setPasswordModalOpen(true)}
                           >
                              {isGoogleAccount ? "Установить пароль" : "Изменить пароль"}
                           </Button>
                        </div>
                     </div>
                  </CardBody>
               </Card>
               
               {/* Карточка настроек уведомлений */}
               <Card className="w-full shadow-sm hover:shadow-md transition-shadow">
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
                           <Button 
                              color="primary"
                              variant="flat"
                              className="w-full text-sm"
                              size="sm"
                              onClick={() => setNotificationsModalOpen(true)}
                           >
                              Настроить уведомления
                           </Button>
                        </div>
                     </div>
                  </CardBody>
               </Card>
               
               {/* Карточка удаления аккаунта */}
               <Card className="w-full shadow-sm hover:shadow-md transition-shadow">
                  <CardBody className="p-4">
                     <div className="flex flex-col h-full">
                        <div className="mb-3 flex items-center">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                           </svg>
                           <h3 className="text-medium font-semibold text-danger">Удаление аккаунта</h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">Удаление всех данных аккаунта</p>
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
         </div>
         
         {/* Модальное окно смены пароля */}
         <Modal 
            isOpen={isPasswordModalOpen} 
            onClose={() => setPasswordModalOpen(false)}
            placement="center"
            size="md"
         >
            <ModalContent>
               {(onClose) => (
                  <>
                     <ModalHeader className="flex flex-col gap-1 text-medium">
                        {isGoogleAccount ? "Установка пароля" : "Изменение пароля"}
                     </ModalHeader>
                     <ModalBody>
                        <form onSubmit={handlePasswordChange} className="space-y-4">
                           {!isGoogleAccount && (
                              <Input
                                 label="Текущий пароль"
                                 placeholder="Введите ваш текущий пароль"
                                 value={currentPassword}
                                 onChange={(e) => setCurrentPassword(e.target.value)}
                                 variant="bordered"
                                 radius="sm"
                                 isRequired
                                 labelPlacement="outside"
                                 size="sm"
                                 type="password"
                                 classNames={{
                                    input: "text-sm py-1",
                                    inputWrapper: "py-0 h-auto min-h-[40px]",
                                    label: "pb-1 text-small font-medium",
                                    base: "mb-2"
                                 }}
                              />
                           )}
                           
                           <Input
                              label="Новый пароль"
                              placeholder="Минимум 8 символов"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              variant="bordered"
                              radius="sm"
                              isRequired
                              labelPlacement="outside"
                              size="sm"
                              type="password"
                              classNames={{
                                 input: "text-sm py-1",
                                 inputWrapper: "py-0 h-auto min-h-[40px]",
                                 label: "pb-1 text-small font-medium",
                                 base: "mb-2"
                              }}
                           />
                           
                           <Input
                              label="Подтверждение пароля"
                              placeholder="Повторите новый пароль"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              variant="bordered"
                              radius="sm"
                              isRequired
                              labelPlacement="outside"
                              size="sm"
                              type="password"
                              classNames={{
                                 input: "text-sm py-1",
                                 inputWrapper: "py-0 h-auto min-h-[40px]",
                                 label: "pb-1 text-small font-medium",
                                 base: "mb-2"
                              }}
                           />
                           
                           {/* Отображение ошибки пароля */}
                           <div className="min-h-[50px]">
                              {passwordError && (
                                 <div className="bg-danger-50 text-danger p-2 rounded-lg border border-danger-200 text-sm">
                                    <div className="flex items-center">
                                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                       </svg>
                                       <p className="font-medium">{passwordError}</p>
                                    </div>
                                 </div>
                              )}
                           </div>
                        </form>
                     </ModalBody>
                     <ModalFooter>
                        <Button color="danger" variant="light" size="sm" onPress={onClose}>
                           Отмена
                        </Button>
                        <Button color="primary" size="sm" onClick={handlePasswordChange}>
                           {isGoogleAccount ? "Установить пароль" : "Изменить пароль"}
                        </Button>
                     </ModalFooter>
                  </>
               )}
            </ModalContent>
         </Modal>
         
         {/* Модальное окно настроек уведомлений */}
         <Modal 
            isOpen={isNotificationsModalOpen} 
            onClose={() => setNotificationsModalOpen(false)}
            placement="center"
            size="md"
         >
            <ModalContent>
               {(onClose) => (
                  <>
                     <ModalHeader className="flex flex-col gap-1 text-medium">
                        Настройки уведомлений
                     </ModalHeader>
                     <ModalBody>
                        <div className="space-y-4">
                           <div className="flex justify-between items-center border-b pb-3">
                              <div>
                                 <h3 className="text-small font-semibold">Email-уведомления</h3>
                                 <p className="text-xs text-gray-500">Получать уведомления на email</p>
                              </div>
                              <Switch 
                                 isSelected={emailNotifications}
                                 onValueChange={setEmailNotifications}
                                 color="primary"
                                 size="sm"
                              />
                           </div>
                           
                           <div className="flex justify-between items-center border-b pb-3">
                              <div>
                                 <h3 className="text-small font-semibold">Push-уведомления</h3>
                                 <p className="text-xs text-gray-500">Получать уведомления в браузере</p>
                              </div>
                              <Switch 
                                 isSelected={pushNotifications}
                                 onValueChange={setPushNotifications}
                                 color="primary"
                                 size="sm"
                              />
                           </div>
                           
                           <div className="flex justify-between items-center pb-2">
                              <div>
                                 <h3 className="text-small font-semibold">Напоминания о записях</h3>
                                 <p className="text-xs text-gray-500">Напоминать о приближающихся консультациях</p>
                              </div>
                              <Switch 
                                 isSelected={appointmentReminders}
                                 onValueChange={setAppointmentReminders}
                                 color="primary"
                                 size="sm"
                              />
                           </div>
                        </div>
                     </ModalBody>
                     <ModalFooter>
                        <Button color="danger" variant="light" size="sm" onPress={onClose}>
                           Отмена
                        </Button>
                        <Button color="primary" size="sm" onClick={handleNotificationsSave}>
                           Сохранить настройки
                        </Button>
                     </ModalFooter>
                  </>
               )}
            </ModalContent>
         </Modal>
         
         {/* Модальное окно удаления аккаунта */}
         <Modal 
            isOpen={isDeleteAccountModalOpen} 
            onClose={() => setDeleteAccountModalOpen(false)}
            placement="center"
            size="md"
         >
            <ModalContent>
               {(onClose) => (
                  <>
                     <ModalHeader className="flex flex-col gap-1 text-medium text-danger">
                        Удаление аккаунта
                     </ModalHeader>
                     <ModalBody>
                        <div className="space-y-3">
                           <p className="text-sm font-semibold text-danger">Внимание! Это действие необратимо.</p>
                           <p className="text-sm">При удалении аккаунта будут удалены все ваши данные:</p>
                           <ul className="list-disc pl-5 space-y-1 text-sm">
                              <li>Личная информация</li>
                              <li>История консультаций</li>
                              <li>Медицинские данные</li>
                              <li>Записи к врачам</li>
                           </ul>
                           <p className="mt-3 text-sm">Пожалуйста, подтвердите, что вы хотите удалить аккаунт.</p>
                        </div>
                     </ModalBody>
                     <ModalFooter>
                        <Button color="default" variant="light" size="sm" onPress={onClose}>
                           Отмена
                        </Button>
                        <Button color="danger" size="sm" onClick={handleDeleteAccount}>
                           Подтвердить удаление
                        </Button>
                     </ModalFooter>
                  </>
               )}
            </ModalContent>
         </Modal>
      </div>
   );
}

export default PatientProfileForm;