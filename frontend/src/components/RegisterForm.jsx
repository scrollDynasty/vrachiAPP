// frontend/src/components/RegisterForm.jsx
import React, { useState, useEffect } from 'react';
import { Input, Button, Spinner, Checkbox, Select, SelectItem, Textarea } from '@nextui-org/react';
import api from '../api'; // Импортируем API для получения списка районов
import StepWizard from 'react-step-wizard';

// Компонент формы регистрации
// Принимает функцию onSubmit (которая будет вызывать регистрацию из стора),
// isLoading (статус загрузки из стора), и error (ошибка из стора)
function RegisterForm({ onSubmit, isLoading, error }) {
  // Шаги регистрации
  const [activeStep, setActiveStep] = useState(1);
  const [totalSteps] = useState(3);
  const [districts, setDistricts] = useState([]);

  // Основные поля для регистрации
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Персональные данные
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [phone, setPhone] = useState('');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  
  // Согласие с условиями
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  
  // Состояние для локальных ошибок
  const [formError, setFormError] = useState(null);
  const [districtLoading, setDistrictLoading] = useState(false);
  
  // Загрузка районов Ташкента
  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        setDistrictLoading(true);
        const response = await api.get('/api/districts');
        setDistricts(response.data);
        setDistrictLoading(false);
      } catch (err) {
        console.error('Failed to load districts:', err);
        setDistricts([
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
        ]); // Запасной список районов
        setDistrictLoading(false);
      }
    };
    
    fetchDistricts();
  }, []);

  // Функция для перехода к следующему шагу
  const goToNextStep = () => {
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
      if (!district) {
        setFormError("Пожалуйста, выберите район проживания");
        return;
      }
      if (!gender) {
        setFormError("Пожалуйста, укажите ваш пол");
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
  };
  
  // Функция для перехода к предыдущему шагу
  const goToPrevStep = () => {
    setFormError(null);
    setActiveStep(current => Math.max(current - 1, 1));
  };

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
        firstName,
        lastName,
        middleName: middleName || '',
        phone,
        district,
        address: address || '',
        gender,
        birthDate: birthDate || '',
        additionalInfo: additionalInfo || ''
      }
    };

    // Вызываем функцию onSubmit, переданную из родительского компонента
    onSubmit(userData);
  };

  // Индикатор прогресса
  const renderProgress = () => {
    return (
      <div className="flex justify-between items-center mb-6">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex-1 flex flex-col items-center">
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${
                step < activeStep ? 'bg-green-500 text-white' : 
                step === activeStep ? 'bg-primary text-white' : 
                'bg-gray-200 text-gray-500'
              }`}
            >
              {step < activeStep ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                step
              )}
            </div>
            <div className={`text-xs ${step === activeStep ? 'text-primary font-medium' : 'text-gray-500'}`}>
              {step === 1 ? 'Персональные данные' : 
               step === 2 ? 'Учетные данные' : 
               'Завершение'}
            </div>
            {step < 3 && (
              <div className={`h-0.5 w-full ${step < activeStep ? 'bg-green-500' : 'bg-gray-200'}`} style={{ width: '100%' }}></div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Шаг 1: Персональные данные
  const renderPersonalInfoStep = () => {
    return (
      <div className="space-y-5">
        <h3 className="text-lg font-medium text-gray-800 mb-4">Персональные данные</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            id="register-first-name"
            label="Имя"
            placeholder="Введите ваше имя"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            variant="bordered"
            isRequired
            labelPlacement="outside"
            radius="sm"
            className="col-span-1"
            classNames={{
              input: "text-base py-2",
              inputWrapper: "py-0 h-auto min-h-[56px]",
              label: "pb-2 text-medium",
              base: "mb-2"
            }}
          />
          
          <Input
            id="register-last-name"
            label="Фамилия"
            placeholder="Введите вашу фамилию"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            variant="bordered"
            isRequired
            labelPlacement="outside"
            radius="sm"
            className="col-span-1"
            classNames={{
              input: "text-base py-2",
              inputWrapper: "py-0 h-auto min-h-[56px]",
              label: "pb-2 text-medium",
              base: "mb-2"
            }}
          />
        </div>

        <Input
          id="register-middle-name"
          label="Отчество"
          placeholder="Введите ваше отчество (если есть)"
          value={middleName}
          onChange={(e) => setMiddleName(e.target.value)}
          variant="bordered"
          labelPlacement="outside"
          radius="sm"
          classNames={{
            input: "text-base py-2",
            inputWrapper: "py-0 h-auto min-h-[56px]",
            label: "pb-2 text-medium",
            base: "mb-6"
          }}
        />

        <Input
          id="register-phone"
          label="Телефон"
          placeholder="+998(XX) XXX-XX-XX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          variant="bordered"
          isRequired
          labelPlacement="outside"
          radius="sm"
          type="tel"
          classNames={{
            input: "text-base py-2",
            inputWrapper: "py-0 h-auto min-h-[56px]",
            label: "pb-2 text-medium",
            base: "mb-6"
          }}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Select
            id="register-district"
            label="Район проживания"
            placeholder="Выберите район"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            variant="bordered"
            isRequired
            labelPlacement="outside"
            radius="sm"
            isLoading={districtLoading}
            className="col-span-1"
            classNames={{
              trigger: "py-2 min-h-[56px]",
              label: "pb-2 text-medium",
              base: "mb-2"
            }}
          >
            {districts.map((district) => (
              <SelectItem key={district} value={district}>{district}</SelectItem>
            ))}
          </Select>
          
          <Select
            id="register-gender"
            label="Пол"
            placeholder="Выберите пол"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            variant="bordered"
            isRequired
            labelPlacement="outside"
            radius="sm"
            className="col-span-1"
            classNames={{
              trigger: "py-2 min-h-[56px]",
              label: "pb-2 text-medium",
              base: "mb-2"
            }}
          >
            <SelectItem key="male" value="male">Мужской</SelectItem>
            <SelectItem key="female" value="female">Женский</SelectItem>
          </Select>
        </div>
        
        <Input
          id="register-address"
          label="Адрес"
          placeholder="Введите ваш адрес"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          variant="bordered"
          labelPlacement="outside"
          radius="sm"
          classNames={{
            input: "text-base py-2",
            inputWrapper: "py-0 h-auto min-h-[56px]",
            label: "pb-2 text-medium",
            base: "mb-6"
          }}
        />
        
        <Input
          id="register-birth-date"
          label="Дата рождения"
          placeholder="ДД.ММ.ГГГГ"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          variant="bordered"
          labelPlacement="outside"
          radius="sm"
          type="date"
          classNames={{
            input: "text-base py-2",
            inputWrapper: "py-0 h-auto min-h-[56px]",
            label: "pb-2 text-medium",
            base: "mb-6"
          }}
        />
      </div>
    );
  };

  // Шаг 2: Учетные данные
  const renderAccountInfoStep = () => {
    return (
      <div className="space-y-5">
        <h3 className="text-lg font-medium text-gray-800 mb-4">Учетные данные</h3>
        
        <Input
          id="register-email"
          label="Email"
          placeholder="Введите ваш email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          variant="bordered"
          isRequired
          labelPlacement="outside"
          radius="sm"
          description="Например: user@example.com"
          classNames={{
            input: "text-base py-2",
            inputWrapper: "py-0 h-auto min-h-[56px]",
            label: "pb-2 text-medium",
            base: "mb-6"
          }}
        />

        <Input
          id="register-password"
          label="Пароль"
          placeholder="Минимум 8 символов"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          variant="bordered"
          isRequired
          labelPlacement="outside"
          radius="sm"
          classNames={{
            input: "text-base py-2",
            inputWrapper: "py-0 h-auto min-h-[56px]",
            label: "pb-2 text-medium",
            base: "mb-6"
          }}
        />

        <Input
          id="register-confirm-password"
          label="Повторите пароль"
          placeholder="Введите пароль еще раз"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          type="password"
          variant="bordered"
          isRequired
          labelPlacement="outside"
          radius="sm"
          classNames={{
            input: "text-base py-2",
            inputWrapper: "py-0 h-auto min-h-[56px]",
            label: "pb-2 text-medium",
            base: "mb-6"
          }}
        />
        
        <Textarea
          id="register-additional-info"
          label="Дополнительная информация (необязательно)"
          placeholder="Укажите дополнительную информацию, которая может быть полезна врачам"
          value={additionalInfo}
          onChange={(e) => setAdditionalInfo(e.target.value)}
          variant="bordered"
          labelPlacement="outside"
          radius="sm"
          classNames={{
            input: "text-base py-2",
            inputWrapper: "py-0 min-h-[100px]",
            label: "pb-2 text-medium",
            base: "mb-6"
          }}
        />
      </div>
    );
  };

  // Шаг 3: Завершение и соглашение
  const renderCompletionStep = () => {
    return (
      <div className="space-y-5">
        <h3 className="text-lg font-medium text-gray-800 mb-4">Подтверждение регистрации</h3>
        
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <h4 className="text-blue-700 font-medium mb-2">Проверьте введенные данные:</h4>
          <div className="text-blue-700 space-y-2">
            <p><strong>ФИО:</strong> {lastName} {firstName} {middleName}</p>
            <p><strong>Email:</strong> {email}</p>
            <p><strong>Телефон:</strong> {phone}</p>
            <p><strong>Район:</strong> {district}</p>
            {address && <p><strong>Адрес:</strong> {address}</p>}
            <p><strong>Пол:</strong> {gender === 'male' ? 'Мужской' : 'Женский'}</p>
            {birthDate && <p><strong>Дата рождения:</strong> {birthDate}</p>}
          </div>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <p className="text-gray-600 text-sm">
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
          <span className="ml-1 text-sm">
            Я согласен с <a href="#" className="text-primary hover:underline">условиями использования</a> и <a href="#" className="text-primary hover:underline">политикой конфиденциальности</a>
          </span>
        </Checkbox>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Прогресс регистрации */}
      {renderProgress()}
      
      {/* Текущий шаг */}
      {activeStep === 1 && renderPersonalInfoStep()}
      {activeStep === 2 && renderAccountInfoStep()}
      {activeStep === 3 && renderCompletionStep()}

      {/* Контейнер для сообщений об ошибках с фиксированной высотой */}
      <div className="min-h-[60px]">
        {formError && (
          <div className="text-danger text-sm p-3 bg-danger-50 rounded border border-danger-200">
            {formError}
          </div>
        )}
      </div>

      {/* Навигация по шагам */}
      <div className="flex justify-between pt-2">
        {activeStep > 1 ? (
          <Button
            type="button"
            variant="flat"
            color="default"
            onClick={goToPrevStep}
            isDisabled={isLoading}
          >
            Назад
          </Button>
        ) : (
          <div></div> // Пустой блок для сохранения выравнивания
        )}
        
        {activeStep < totalSteps ? (
          <Button
            type="button"
            color="primary"
            onClick={goToNextStep}
            isDisabled={isLoading}
          >
            Продолжить
          </Button>
        ) : (
          <Button
            type="submit"
            color="primary"
            isLoading={isLoading}
            isDisabled={isLoading || !agreeToTerms}
          >
            {isLoading ? <Spinner size="sm" color="white" /> : 'Зарегистрироваться'}
          </Button>
        )}
      </div>
    </form>
  );
}

export default RegisterForm; // Экспорт компонента по умолчанию