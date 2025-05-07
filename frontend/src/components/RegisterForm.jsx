// frontend/src/components/RegisterForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Button, Spinner, Checkbox, Card, CardHeader, CardBody, Input, Select, SelectItem, Divider, Radio, RadioGroup } from '@nextui-org/react';
import api from '../api'; // Импортируем API для получения списка районов

function RegisterForm({ onSubmit, isLoading, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userType, setUserType] = useState('patient'); // Только пациент
  const [formError, setFormError] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [district, setDistrict] = useState('');
  const [fullName, setFullName] = useState(''); // ФИО
  const [phone, setPhone] = useState(''); // Номер телефона
  const [agreeTos, setAgreeTos] = useState(false);

  // Загрузка списка районов при монтировании компонента
  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        const districtsData = await api.getDistricts();
        setDistricts(districtsData);
      } catch (error) {
        console.error('Failed to load districts:', error);
      }
    };
    
    fetchDistricts();
  }, []);

  // Валидация формы
  const validateForm = () => {
    // Базовая валидация полей
    if (!email) return "Пожалуйста, введите email";
    if (!password) return "Пожалуйста, введите пароль";
    if (password !== confirmPassword) return "Пароли не совпадают";
    if (password.length < 8) return "Пароль должен содержать минимум 8 символов";
    if (!fullName) return "Пожалуйста, введите ваше ФИО";
    if (!phone) return "Пожалуйста, введите номер телефона";
    if (!district) return "Пожалуйста, выберите район проживания";
    if (!agreeTos) return "Вы должны согласиться с условиями использования";
    
    // Email валидация
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return "Пожалуйста, введите корректный email";
    }
    
    // Телефонная валидация (простая)
    const phoneRegex = /^[+]?[0-9]{10,15}$/;
    if (!phoneRegex.test(phone.trim())) {
      return "Пожалуйста, введите корректный номер телефона (от 10 до 15 цифр)";
    }
    
    return null;
  };

  // Обработчик отправки формы
  const handleSubmit = async (event) => {
    event.preventDefault();
    
    // Сбрасываем ошибку перед валидацией
    setFormError(null);
    
    // Валидация формы
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    
    try {
      // Подготовка данных для регистрации
      const userData = {
        email: email.trim(),
        password: password,
        role: "patient", // Всегда роль пациента
        district: district,
        full_name: fullName.trim(),
        contact_phone: phone.trim()
      };
      
      // Вызываем функцию onSubmit из родительского компонента
      await onSubmit(userData);
      
    } catch (error) {
      console.error('Registration error:', error);
      
      // Обработка ошибок
      if (error.response) {
        const status = error.response.status;
        const detail = error.response.data?.detail;
        
        if (status === 400 && detail?.includes('уже зарегистрирован')) {
          setFormError("Этот email уже зарегистрирован. Пожалуйста, используйте другой email или выполните вход.");
        } else if (detail) {
          setFormError(detail);
        } else {
          setFormError("Ошибка регистрации. Пожалуйста, попробуйте позже.");
        }
      } else if (error.message) {
        setFormError(error.message);
      } else {
        setFormError("Произошла ошибка при регистрации. Пожалуйста, попробуйте позже.");
      }
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Card className="shadow-xl border border-gray-100">
        <CardHeader className="flex flex-col gap-1 items-center bg-primary-50 py-6">
          <div className="w-16 h-16 flex items-center justify-center rounded-full bg-primary-100 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-primary-800">Регистрация</h2>
          <p className="text-primary-600 text-sm">Создайте новый аккаунт в MedCare</p>
        </CardHeader>
        
        <CardBody className="px-6 py-8">
          {/* Отображение загрузки */}
          {isLoading && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 backdrop-blur-sm">
              <div className="bg-white p-6 rounded-xl shadow-xl flex flex-col items-center">
                <Spinner size="lg" color="primary" className="mb-4" />
                <p className="text-gray-700 font-medium">Регистрация...</p>
              </div>
            </div>
          )}
          
          {/* Отображаем ошибку */}
          {(error || formError) && (
            <div className="p-4 rounded-lg mb-6 bg-red-50 text-red-700 border border-red-200">
              <p className="font-medium">{error || formError}</p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">ФИО и контактные данные</h3>
              
              <Input
                type="text"
                label="ФИО"
                placeholder="Введите ваше полное имя"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                variant="bordered"
                radius="sm"
                fullWidth
                isRequired
                startContent={
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                }
              />
              
              <Input
                type="tel"
                label="Номер телефона"
                placeholder="Введите ваш номер телефона"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                variant="bordered"
                radius="sm"
                fullWidth
                isRequired
                startContent={
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                }
              />
            </div>
            
            <Divider />
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Район проживания</h3>
              
              <Select
                label="Район проживания"
                placeholder="Выберите район"
                variant="bordered"
                radius="sm"
                fullWidth
                isRequired
                selectedKeys={district ? [district] : []}
                onSelectionChange={(keys) => {
                  if (keys.size > 0) {
                    setDistrict(Array.from(keys)[0]);
                  } else {
                    setDistrict('');
                  }
                }}
                startContent={
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
              >
                {districts.map((district) => (
                  <SelectItem key={district} value={district}>
                    {district}
                  </SelectItem>
                ))}
              </Select>
            </div>
            
            <Divider />
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Учётные данные</h3>
              
              <Input
                type="email"
                label="Email"
                placeholder="Введите ваш email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                variant="bordered"
                radius="sm"
                fullWidth
                isRequired
                startContent={
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="password"
                  label="Пароль"
                  placeholder="Введите пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  variant="bordered"
                  radius="sm"
                  fullWidth
                  isRequired
                  startContent={
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  }
                />
                
                <Input
                  type="password"
                  label="Подтверждение пароля"
                  placeholder="Повторите пароль"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  variant="bordered"
                  radius="sm"
                  fullWidth
                  isRequired
                  startContent={
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  }
                />
              </div>
            </div>
            
            <Divider />
            
            <div className="space-y-4">
              <Checkbox
                isSelected={agreeTos}
                onValueChange={setAgreeTos}
                color="primary"
              >
                <span className="text-sm">
                  Я согласен с <a href="#" className="text-primary-600 hover:underline">условиями использования</a> и <a href="#" className="text-primary-600 hover:underline">политикой конфиденциальности</a>
                </span>
              </Checkbox>
              
              <Button
                type="submit"
                color="primary"
                className="w-full py-6 font-semibold"
                isLoading={isLoading}
                isDisabled={!agreeTos}
              >
                {isLoading ? <Spinner size="sm" color="white" /> : 'Зарегистрироваться'}
              </Button>
              
              <div className="text-center mt-4">
                <p className="text-gray-600">
                  Уже есть аккаунт?{' '}
                  <a href="/login" className="text-primary-600 hover:underline font-medium">
                    Войти
                  </a>
                </p>
              </div>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

export default RegisterForm;