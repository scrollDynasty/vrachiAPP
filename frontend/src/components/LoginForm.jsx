// frontend/src/components/LoginForm.jsx
import React, { useState } from 'react';
import { Button, Spinner, Checkbox } from '@nextui-org/react';

// Создаем кастомный компонент для инпутов
const CustomInput = ({ 
  id, 
  label, 
  value, 
  onChange, 
  type = "text", 
  placeholder, 
  required = false,
  autoComplete = "",
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
        autoComplete={autoComplete}
        className="border border-gray-300 rounded-lg px-4 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-sm text-gray-800 bg-white dark:bg-gray-900 dark:text-white dark:border-gray-700"
      />
    </div>
  );
};

function LoginForm({ onSubmit, isLoading, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [formError, setFormError] = useState(null);

  // Обработчик отправки формы
  const handleSubmit = (event) => {
    event.preventDefault();
    setFormError(null);

    // Базовая валидация на фронтенде
    if (!email || !password) {
       setFormError("Пожалуйста, заполните оба поля.");
       return;
    }

    // Проверка формата email с помощью регулярного выражения
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      setFormError("Пожалуйста, введите корректный email адрес");
      return;
    }

    // Вызываем функцию onSubmit, переданную из родительского компонента (AuthPage)
    onSubmit(email, password, rememberMe);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-xl p-8 shadow-md w-full">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Вход в систему</h2>
        
        {(error || formError) && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 border border-red-200">
            <p className="font-medium">{error || formError}</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <CustomInput
            id="login-email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Введите ваш email"
            autoComplete="email"
            required
          />

          <CustomInput
            id="login-password"
            label="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Введите ваш пароль"
            autoComplete="current-password"
            required
          />

          <div className="flex justify-between items-center pt-2">
            <Checkbox
              isSelected={rememberMe}
              onValueChange={setRememberMe}
              size="sm"
            >
              <span className="ml-1 text-gray-700">Запомнить меня</span>
            </Checkbox>
            
            <a href="#" className="text-primary-600 hover:underline text-sm font-medium">
              Забыли пароль?
            </a>
          </div>

          <Button
            type="submit"
            color="primary"
            className="w-full mt-6 py-6"
            disabled={isLoading}
          >
            {isLoading ? <Spinner size="sm" color="white" /> : 'Войти'}
          </Button>
          
          <div className="text-center mt-4">
            <p className="text-gray-600">
              Нет аккаунта?{' '}
              <a href="/register" className="text-primary-600 hover:underline font-medium">
                Зарегистрироваться
              </a>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginForm;
