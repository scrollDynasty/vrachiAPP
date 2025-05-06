import React, { useState, useRef } from 'react';
import { Input, Button, Textarea, Spinner, Select, SelectItem } from '@nextui-org/react';
import api from '../api';

function DoctorApplicationForm({ onSuccess }) {
  // Состояние для полей формы
  const [fullName, setFullName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [experience, setExperience] = useState('');
  const [education, setEducation] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [district, setDistrict] = useState('');
  
  // Список районов Ташкента
  const districts = [
    "Алмазарский район",
    "Бектемирский район",
    "Мирабадский район",
    "Мирзо-Улугбекский район",
    "Сергелийский район",
    "Учтепинский район",
    "Чиланзарский район",
    "Шайхантаурский район",
    "Юнусабадский район",
    "Яккасарайский район",
    "Яшнабадский район"
  ];
  
  // Состояние для файлов
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [diploma, setDiploma] = useState(null);
  const [diplomaName, setDiplomaName] = useState('');
  const [license, setLicense] = useState(null);
  const [licenseName, setLicenseName] = useState('');
  
  // Состояние для UI
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // Refs для файловых инпутов
  const photoInputRef = useRef(null);
  const diplomaInputRef = useRef(null);
  const licenseInputRef = useRef(null);
  
  // Обработчики для файлов
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      
      // Создаем URL для превью изображения
      const reader = new FileReader();
      reader.onload = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleDiplomaChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setDiploma(file);
      setDiplomaName(file.name);
    }
  };
  
  const handleLicenseChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLicense(file);
      setLicenseName(file.name);
    }
  };
  
  // Валидация формы
  const validateForm = () => {
    if (!fullName) {
      setError('Пожалуйста, укажите ваше полное имя');
      return false;
    }
    
    if (!specialization) {
      setError('Пожалуйста, укажите вашу специализацию');
      return false;
    }
    
    if (!experience) {
      setError('Пожалуйста, укажите ваш опыт работы');
      return false;
    }
    
    if (!education) {
      setError('Пожалуйста, укажите ваше образование');
      return false;
    }
    
    if (!licenseNumber) {
      setError('Пожалуйста, укажите номер вашей лицензии/сертификата');
      return false;
    }
    
    if (!district) {
      setError('Пожалуйста, укажите район вашей практики');
      return false;
    }
    
    if (!photo) {
      setError('Пожалуйста, загрузите вашу фотографию');
      return false;
    }
    
    if (!diploma) {
      setError('Пожалуйста, загрузите скан вашего диплома');
      return false;
    }
    
    if (!license) {
      setError('Пожалуйста, загрузите скан вашей лицензии/сертификата');
      return false;
    }
    
    return true;
  };
  
  // Отправка формы
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Создаем FormData для отправки файлов
      const formData = new FormData();
      formData.append('full_name', fullName);
      formData.append('specialization', specialization);
      formData.append('experience', experience);
      formData.append('education', education);
      formData.append('license_number', licenseNumber);
      formData.append('district', district);
      
      if (additionalInfo) {
        formData.append('additional_info', additionalInfo);
      }
      
      if (photo) {
        formData.append('photo', photo);
      }
      
      if (diploma) {
        formData.append('diploma', diploma);
      }
      
      if (license) {
        formData.append('license_doc', license);
      }
      
      // Отправляем запрос на бэкенд
      const response = await api.post('/doctor-applications', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      // Если успешно, показываем уведомление и сбрасываем форму
      setSuccess(true);
      
      // Очищаем форму
      setFullName('');
      setSpecialization('');
      setExperience('');
      setEducation('');
      setLicenseNumber('');
      setAdditionalInfo('');
      setDistrict('');
      setPhoto(null);
      setPhotoPreview(null);
      setDiploma(null);
      setDiplomaName('');
      setLicense(null);
      setLicenseName('');
      
      // Сбрасываем файловые инпуты
      if (photoInputRef.current) photoInputRef.current.value = '';
      if (diplomaInputRef.current) diplomaInputRef.current.value = '';
      if (licenseInputRef.current) licenseInputRef.current.value = '';
      
      // Вызываем колбэк успешной отправки
      if (onSuccess) {
        onSuccess(response.data);
      }
      
    } catch (err) {
      console.error('Failed to submit doctor application:', err);
      setError(err.response?.data?.detail || 'Ошибка при отправке заявки. Пожалуйста, попробуйте еще раз.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Если форма успешно отправлена, показываем сообщение об успехе
  if (success) {
    return (
      <div className="bg-green-50 p-6 rounded-lg border border-green-200 text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-green-500 rounded-full p-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <h3 className="text-xl font-semibold text-green-700 mb-2">Заявка успешно отправлена!</h3>
        <p className="text-green-600 mb-4">
          Ваша заявка на получение роли врача принята и будет рассмотрена администрацией в ближайшее время.
          Мы сообщим вам о результате рассмотрения по электронной почте.
        </p>
        <Button
          color="primary"
          onClick={() => setSuccess(false)}
          className="mt-2"
        >
          Отправить еще одну заявку
        </Button>
      </div>
    );
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h3 className="text-xl font-semibold mb-4">Заявка на получение роли врача</h3>
      <p className="text-gray-600 mb-6">
        Заполните форму ниже, чтобы подать заявку на получение роли врача на нашей платформе.
        После рассмотрения заявки администрацией, вы получите уведомление о результате.
      </p>
      
      {error && (
        <div className="bg-danger-50 text-danger p-4 rounded-lg border border-danger-200 mb-6">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="font-medium">{error}</p>
          </div>
        </div>
      )}
      
      <div className="space-y-6">
        {/* Полное имя */}
        <Input
          id="doctor-application-full-name"
          label="Полное имя"
          placeholder="Иванов Иван Иванович"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          variant="bordered"
          labelPlacement="outside"
          isRequired
          className="max-w-full"
        />
        
        {/* Специализация */}
        <Input
          id="doctor-application-specialization"
          label="Специализация"
          placeholder="Например: Кардиолог, Терапевт"
          value={specialization}
          onChange={(e) => setSpecialization(e.target.value)}
          variant="bordered"
          labelPlacement="outside"
          isRequired
          className="max-w-full"
        />
        
        {/* Опыт работы */}
        <Input
          id="doctor-application-experience"
          label="Опыт работы"
          placeholder="Например: 5 лет"
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
          variant="bordered"
          labelPlacement="outside"
          isRequired
          className="max-w-full"
        />
        
        {/* Образование */}
        <Textarea
          id="doctor-application-education"
          label="Образование"
          placeholder="Укажите ваше образование (университет, год окончания, специальность)"
          value={education}
          onChange={(e) => setEducation(e.target.value)}
          variant="bordered"
          labelPlacement="outside"
          isRequired
          minRows={3}
          className="max-w-full"
        />
        
        {/* Номер лицензии */}
        <Input
          id="doctor-application-license-number"
          label="Номер лицензии/сертификата"
          placeholder="Укажите номер вашей лицензии или сертификата"
          value={licenseNumber}
          onChange={(e) => setLicenseNumber(e.target.value)}
          variant="bordered"
          labelPlacement="outside"
          isRequired
          className="max-w-full"
        />
        
        {/* Район практики */}
        <Select
          id="doctor-application-district"
          label="Район практики"
          placeholder="Выберите район, в котором вы будете принимать пациентов"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          variant="bordered"
          labelPlacement="outside"
          isRequired
          className="max-w-full"
        >
          {districts.map((dist) => (
            <SelectItem key={dist} value={dist}>
              {dist}
            </SelectItem>
          ))}
        </Select>
        
        {/* Дополнительная информация */}
        <Textarea
          id="doctor-application-additional-info"
          label="Дополнительная информация"
          placeholder="Укажите дополнительную информацию о вашей практике, специализации или квалификации (по желанию)"
          value={additionalInfo}
          onChange={(e) => setAdditionalInfo(e.target.value)}
          variant="bordered"
          labelPlacement="outside"
          minRows={3}
          className="max-w-full"
        />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {/* Фотография */}
          <div className="space-y-2">
            <div className="font-medium">Фотография *</div>
            <div className="text-sm text-gray-500 mb-2">Загрузите вашу фотографию для профиля</div>
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 h-48 relative">
              {photoPreview ? (
                <div className="w-full h-full flex items-center justify-center">
                  <img src={photoPreview} alt="Preview" className="max-h-full max-w-full object-contain rounded" />
                  <button
                    type="button"
                    className="absolute top-2 right-2 bg-gray-800 bg-opacity-50 text-white rounded-full p-1"
                    onClick={() => {
                      setPhoto(null);
                      setPhotoPreview(null);
                      if (photoInputRef.current) photoInputRef.current.value = '';
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  color="primary"
                  variant="flat"
                  size="sm"
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                  onClick={() => photoInputRef.current.click()}
                >
                  Загрузить фото
                </Button>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </div>
          </div>
          
          {/* Диплом */}
          <div className="space-y-2">
            <div className="font-medium">Диплом *</div>
            <div className="text-sm text-gray-500 mb-2">Загрузите скан вашего диплома о медицинском образовании</div>
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 h-48 relative">
              {diplomaName ? (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-primary mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="text-center text-sm truncate max-w-full px-4">{diplomaName}</div>
                  <button
                    type="button"
                    className="absolute top-2 right-2 bg-gray-800 bg-opacity-50 text-white rounded-full p-1"
                    onClick={() => {
                      setDiploma(null);
                      setDiplomaName('');
                      if (diplomaInputRef.current) diplomaInputRef.current.value = '';
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  color="primary"
                  variant="flat"
                  size="sm"
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                  onClick={() => diplomaInputRef.current.click()}
                >
                  Загрузить диплом
                </Button>
              )}
              <input
                ref={diplomaInputRef}
                type="file"
                accept=".pdf,image/*"
                onChange={handleDiplomaChange}
                className="hidden"
              />
            </div>
          </div>
          
          {/* Лицензия */}
          <div className="space-y-2">
            <div className="font-medium">Лицензия *</div>
            <div className="text-sm text-gray-500 mb-2">Загрузите скан вашей лицензии/сертификата на медицинскую деятельность</div>
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 h-48 relative">
              {licenseName ? (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-primary mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="text-center text-sm truncate max-w-full px-4">{licenseName}</div>
                  <button
                    type="button"
                    className="absolute top-2 right-2 bg-gray-800 bg-opacity-50 text-white rounded-full p-1"
                    onClick={() => {
                      setLicense(null);
                      setLicenseName('');
                      if (licenseInputRef.current) licenseInputRef.current.value = '';
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  color="primary"
                  variant="flat"
                  size="sm"
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                  onClick={() => licenseInputRef.current.click()}
                >
                  Загрузить лицензию
                </Button>
              )}
              <input
                ref={licenseInputRef}
                type="file"
                accept=".pdf,image/*"
                onChange={handleLicenseChange}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex justify-center mt-8">
        <Button
          type="submit"
          color="primary"
          size="lg"
          isLoading={isLoading}
          className="min-w-[200px]"
        >
          {isLoading ? 'Отправка...' : 'Отправить заявку'}
        </Button>
      </div>
    </form>
  );
}

export default DoctorApplicationForm; 