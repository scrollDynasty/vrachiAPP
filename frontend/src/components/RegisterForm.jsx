// frontend/src/components/RegisterForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Button, Spinner, Checkbox } from '@nextui-org/react';
import api from '../api'; // Импортируем API для получения списка районов

// Создаем очень простой кастомный компонент для инпутов
const CustomInput = ({ 
  id, 
  label, 
  value, 
  onChange, 
  type = "text", 
  placeholder, 
  required = false,
  className = ""
}) => {
  return (
    <div className={`flex flex-col ${className}`}>
      <label htmlFor={id} className="pb-1 text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value || ''} 
        onChange={onChange}
        required={required}
        className="border border-gray-300 rounded-lg px-4 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-sm text-gray-800 bg-white dark:bg-gray-900 dark:text-white dark:border-gray-700"
      />
    </div>
  );
};

// Создаем очень простой кастомный компонент для textarea
const CustomTextarea = ({ 
  id, 
  label, 
  value, 
  onChange, 
  placeholder,
  rows = 3,
  className = ""
}) => {
  return (
    <div className={`flex flex-col ${className}`}>
      <label htmlFor={id} className="pb-1 text-sm font-medium text-gray-700">
        {label}
      </label>
      <textarea
        id={id}
        placeholder={placeholder}
        value={value || ''}
        onChange={onChange}
        rows={rows}
        className="border border-gray-300 rounded-lg px-4 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-sm text-gray-800 resize-none bg-white dark:bg-gray-900 dark:text-white dark:border-gray-700"
      />
    </div>
  );
};

// Создаем кастомный компонент Select
const CustomSelect = ({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  className = ""
}) => {
  return (
    <div className={`flex flex-col ${className}`}>
      <label htmlFor={id} className="pb-1 text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        className="border border-gray-300 rounded-lg px-4 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-sm text-gray-800 appearance-none bg-white dark:bg-gray-900 dark:text-white dark:border-gray-700"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

// Создаем компонент для выбора даты
const CustomDatePicker = ({
  id,
  label,
  value,
  onChange,
  required = false,
  className = ""
}) => {
  // Преобразуем значение в формат yyyy-MM-dd для input type="date"
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    
    // Если это уже в формате yyyy-MM-dd, вернем как есть
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // Попробуем разобрать дату в формате DD.MM.YYYY
    const parts = dateString.split('.');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${year}-${month}-${day}`;
    }
    
    return '';
  };
  
  // Форматируем дату для отображения пользователю (DD.MM.YYYY)
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    
    // Если это в формате yyyy-MM-dd, преобразуем к DD.MM.YYYY
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-');
      return `${day}.${month}.${year}`;
    }
    
    return dateString;
  };
  
  const handleDateChange = (e) => {
    // Преобразуем из формата yyyy-MM-dd в DD.MM.YYYY для сохранения в state
    const selectedDate = e.target.value;
    if (selectedDate) {
      const [year, month, day] = selectedDate.split('-');
      const formattedDate = `${day}.${month}.${year}`;
      onChange({target: {value: formattedDate}});
    } else {
      onChange({target: {value: ''}});
    }
  };
  
  // Максимальная дата - сегодняшний день (чтобы нельзя было выбрать будущее)
  const today = new Date().toISOString().split('T')[0];
  
  return (
    <div className={`flex flex-col ${className}`}>
      <label htmlFor={id} className="pb-1 text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={id}
        type="date"
        value={formatDateForInput(value)}
        onChange={handleDateChange}
        max={today}
        required={required}
        className="border border-gray-300 rounded-lg px-4 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-sm text-gray-800 bg-white dark:bg-gray-900 dark:text-white dark:border-gray-700"
      />
    </div>
  );
};

// === ВЫНОСИМ КОМПОНЕНТЫ ШАГОВ НАРУЖУ ===

const Step1Component = React.memo(({
  lastName, setLastName,
  firstName, setFirstName,
  middleName, setMiddleName,
  phone, setPhone,
  address, setAddress,
  birthDate, setBirthDate,
  gender, setGender,
  district, setDistrict,
  districts // Передаем массив районов
}) => {
  return (
    <div className="space-y-5">
      <h3 className="text-xl font-semibold text-gray-800 mb-5">Персональные данные</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <CustomInput
          id="register-lastName"
          label="Фамилия"
          placeholder="Введите фамилию"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
        <CustomInput
          id="register-firstName"
          label="Имя"
          placeholder="Введите имя"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
      </div>
      <CustomInput
        id="register-middleName"
        label="Отчество"
        placeholder="Введите отчество (если есть)"
        value={middleName}
        onChange={(e) => setMiddleName(e.target.value)}
      />
      <CustomInput
        id="register-phone"
        label="Номер телефона"
        placeholder="+998 __ ___ __ __"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
      />
      <CustomSelect
        id="register-district"
        label="Район"
        placeholder="Выберите ваш район"
        value={district}
        onChange={(e) => setDistrict(e.target.value)}
        options={districts.map(dist => ({ value: dist, label: dist }))}
        required
      />
      <CustomInput
        id="register-address"
        label="Адрес"
        placeholder="Введите адрес"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <CustomSelect
          id="register-gender"
          label="Пол"
          placeholder="Выберите пол"
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          options={[
            { value: "male", label: "Мужской" },
            { value: "female", label: "Женский" }
          ]}
          required
          className="col-span-1"
        />
        <CustomDatePicker
          id="register-birthDate"
          label="Дата рождения"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
      </div>
    </div>
  );
});

const Step2Component = React.memo(({
  email, setEmail,
  password, setPassword,
  confirmPassword, setConfirmPassword,
  additionalInfo, setAdditionalInfo
}) => {
  return (
    <div className="space-y-5">
      <h3 className="text-xl font-semibold text-gray-800 mb-5">Учетные данные</h3>
      <CustomInput
        id="register-email"
        label="Email"
        type="email"
        placeholder="example@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <CustomInput
        id="register-password"
        label="Пароль"
        type="password"
        placeholder="Минимум 8 символов"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <CustomInput
        id="register-confirm-password"
        label="Подтверждение пароля"
        type="password"
        placeholder="Повторите пароль"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
      />
      <CustomTextarea
        id="register-additionalInfo"
        label="Дополнительная информация (необязательно)"
        placeholder="Укажите дополнительную информацию, которая может быть полезна медицинским специалистам"
        value={additionalInfo}
        onChange={(e) => setAdditionalInfo(e.target.value)}
        rows={4}
      />
    </div>
  );
});

const Step3Component = React.memo(({
  lastName, firstName, middleName, email, phone, district, address, gender, birthDate,
  agreeToTerms, setAgreeToTerms
}) => {
  // Форматируем дату для отображения
  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    // Проверим формат даты (может быть уже в DD.MM.YYYY)
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateString)) {
      return dateString;
    }
    
    // Попробуем разобрать дату в формате YYYY-MM-DD
    try {
      const [year, month, day] = dateString.split('-');
      if (year && month && day) {
        return `${day}.${month}.${year}`;
      }
    } catch (e) {
      // Если что-то пошло не так, вернем как есть
    }
    
    return dateString;
  };
  
  return (
    <div className="space-y-5">
      <h3 className="text-xl font-semibold text-gray-800 mb-5">Подтверждение регистрации</h3>
      <div className="bg-blue-50 p-5 rounded-lg mb-6 shadow-inner">
        <h4 className="text-blue-700 font-semibold mb-3">Проверьте введенные данные:</h4>
        <div className="text-blue-700 space-y-2">
          <p><strong>ФИО:</strong> {lastName} {firstName} {middleName}</p>
          <p><strong>Email:</strong> {email}</p>
          <p><strong>Телефон:</strong> {phone}</p>
          <p><strong>Район:</strong> {district}</p>
          {address && <p><strong>Адрес:</strong> {address}</p>}
          <p><strong>Пол:</strong> {gender === 'male' ? 'Мужской' : gender === 'female' ? 'Женский' : ''}</p>
          {birthDate && <p><strong>Дата рождения:</strong> {formatDate(birthDate)}</p>}
        </div>
      </div>
      <div className="bg-gray-50 p-5 rounded-lg mb-6 shadow-inner">
        <p className="text-gray-600">
          После регистрации на указанный email будет отправлено письмо для подтверждения.
          Пожалуйста, проверьте вашу почту и следуйте инструкциям в письме.
        </p>
      </div>
      <Checkbox
        isSelected={agreeToTerms}
        onValueChange={setAgreeToTerms}
        size="sm"
        className="mt-6"
      >
        <span className="ml-1 text-gray-700">
          Я согласен с <a href="#" className="text-primary-600 hover:underline">условиями использования</a> и <a href="#" className="text-primary-600 hover:underline">политикой конфиденциальности</a>
        </span>
      </Checkbox>
    </div>
  );
});

// Компонент формы регистрации
// Принимает функцию onSubmit (которая будет вызывать регистрацию из стора),
// isLoading (статус загрузки из стора), и error (ошибка из стора)
function RegisterForm({ onSubmit, isLoading, error }) {
  // Шаги регистрации
  const [activeStep, setActiveStep] = useState(1);
  const [totalSteps] = useState(3);

  // Основные поля для регистрации
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Персональные данные
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [district, setDistrict] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  
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
  
  // Согласие с условиями
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  
  // Состояние для локальных ошибок
  const [formError, setFormError] = useState(null);
  
  // Хук для инициализации формы после монтирования
  useEffect(() => {
    // Устанавливаем начальные значения для полей выбора
    if (!gender) setGender('');
    if (!district) setDistrict('');
  }, []);
  
  // Функция для перехода к следующему шагу
  const goToNextStep = useCallback(() => {
    setFormError(null);
    
    // Валидация для первого шага (персональные данные)
    if (activeStep === 1) {
      if (!firstName || !lastName) {
        setFormError("Пожалуйста, укажите имя и фамилию");
        return;
      }
      if (!phone) {
        setFormError("Пожалуйста, укажите номер телефона");
        return;
      }
      if (!gender) {
        setFormError("Пожалуйста, укажите ваш пол");
        return;
      }
      if (!district) {
        setFormError("Пожалуйста, выберите ваш район");
        return;
      }
    }
    
    // Валидация для второго шага (учетные данные)
    if (activeStep === 2) {
      if (!email) {
        setFormError("Пожалуйста, укажите email");
        return;
      }
      
      // Проверка формата email с помощью регулярного выражения
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email.trim())) {
        setFormError("Пожалуйста, введите корректный email адрес");
        return;
      }
      
      if (password.length < 8) {
        setFormError("Пароль должен содержать не менее 8 символов");
        return;
      }
      if (password !== confirmPassword) {
        setFormError("Пароли не совпадают");
        return;
      }
    }
    
    setActiveStep(current => Math.min(current + 1, totalSteps));
  }, [activeStep, email, password, confirmPassword, firstName, lastName, phone, gender, district, totalSteps]);
  
  // Функция для перехода к предыдущему шагу
  const goToPrevStep = useCallback(() => {
    setFormError(null);
    setActiveStep(current => Math.max(current - 1, 1));
  }, []);

  // Обработчик отправки формы
  const handleSubmit = (event) => {
    event.preventDefault();
    setFormError(null);

    // Проверка согласия с условиями
    if (!agreeToTerms) {
      setFormError("Необходимо согласиться с условиями использования");
      return;
    }
    
    // Финальная проверка email
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email.trim())) {
      setFormError("Пожалуйста, введите корректный email адрес");
       return;
    }

    // Формируем данные пользователя
    const userData = {
      email: email.trim().toLowerCase(), // Нормализуем email
      password,
      role: 'patient', // Устанавливаем роль "patient" по умолчанию для всех пользователей
      profile: {
        full_name: `${lastName} ${firstName} ${middleName || ''}`.trim(),
        contact_phone: phone,
        contact_address: address || '',
        district: district,
        medical_info: additionalInfo || ''
      }
    };

    // Вызываем функцию onSubmit, переданную из родительского компонента
    onSubmit(userData);
  };

  // Индикатор прогресса
  const ProgressIndicator = () => {
    return (
      <div className="flex justify-center items-center space-x-4 mb-8">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const stepNumber = index + 1;
          const isCurrent = stepNumber === activeStep;
          const isCompleted = stepNumber < activeStep;
          
          return (
            <div key={index} className="flex items-center">
              <div 
                className={`flex items-center justify-center w-8 h-8 rounded-full font-medium text-sm transition-colors
                  ${isCurrent ? 'bg-primary-600 text-white' : 
                    isCompleted ? 'bg-primary-100 text-primary-700 border border-primary-600' : 
                    'bg-gray-100 text-gray-500 border border-gray-300'}`}
              >
                {isCompleted ? '✓' : stepNumber}
              </div>
              {index < totalSteps - 1 && (
                <div className={`w-10 h-1 mx-1 
                  ${stepNumber < activeStep ? 'bg-primary-600' : 'bg-gray-300'}`} 
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Отображение состояния загрузки */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-xl flex flex-col items-center">
            <Spinner size="lg" color="primary" className="mb-4" />
            <p className="text-gray-700 font-medium">Регистрация...</p>
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-xl p-8 shadow-md w-full">
        {/* Отображение ошибок */}
        {(error || formError) && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 border border-red-200">
            <p className="font-medium">{error || formError}</p>
          </div>
        )}
        
        {/* Индикатор прогресса */}
        <ProgressIndicator />
        
        {/* Шаги формы */}
        <div className="mb-8">
          {activeStep === 1 && (
            <Step1Component
              lastName={lastName} setLastName={setLastName}
              firstName={firstName} setFirstName={setFirstName}
              middleName={middleName} setMiddleName={setMiddleName}
              phone={phone} setPhone={setPhone}
              address={address} setAddress={setAddress}
              birthDate={birthDate} setBirthDate={setBirthDate}
              gender={gender} setGender={setGender}
              district={district} setDistrict={setDistrict}
              districts={districts}
            />
          )}
          {activeStep === 2 && (
            <Step2Component
              email={email} setEmail={setEmail}
              password={password} setPassword={setPassword}
              confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
              additionalInfo={additionalInfo} setAdditionalInfo={setAdditionalInfo}
            />
          )}
          {activeStep === 3 && (
            <Step3Component
              lastName={lastName} firstName={firstName} middleName={middleName}
              email={email} phone={phone} district={district} address={address}
              gender={gender} birthDate={birthDate}
              agreeToTerms={agreeToTerms} setAgreeToTerms={setAgreeToTerms}
            />
          )}
        </div>
        
        {/* Кнопки навигации между шагами */}
        <div className="flex justify-between">
          <Button
            color="default"
            variant="flat"
            onClick={goToPrevStep}
            className={`${activeStep === 1 ? 'invisible' : ''} px-6 py-2`}
          >
            Назад
          </Button>
          
          {activeStep < totalSteps ? (
            <Button 
              color="primary" 
              onClick={goToNextStep}
              className="px-6 py-2"
            >
              Далее
            </Button>
          ) : (
            <Button 
              color="primary" 
              onClick={handleSubmit} 
              disabled={isLoading || !agreeToTerms}
              className="px-6 py-2"
            >
              {isLoading ? <Spinner size="sm" color="white" /> : "Зарегистрироваться"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default RegisterForm;