// frontend/src/components/LoginForm.jsx
import React, { useState } from 'react';
import { Input, Button, Spinner, Checkbox, Link } from '@nextui-org/react';

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

    // Вызываем функцию onSubmit, переданную из родительского компонента (AuthPage)
    onSubmit(email, password, rememberMe);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="login-email"
        label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        variant="bordered"
        isRequired
        radius="sm"
        labelPlacement="outside"
        placeholder="Введите ваш email"
        autoComplete="email"
        size="lg"
        fullWidth
        classNames={{
          input: "text-base py-2",
          inputWrapper: "py-0 h-auto min-h-[50px]",
          label: "pb-1 text-medium font-medium",
          base: "mb-2"
        }}
      />

      <Input
        id="login-password"
        label="Пароль"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        variant="bordered"
        isRequired
        radius="sm"
        labelPlacement="outside"
        placeholder="Введите ваш пароль"
        autoComplete="current-password"
        size="lg"
        fullWidth
        classNames={{
          input: "text-base py-2",
          inputWrapper: "py-0 h-auto min-h-[50px]",
          label: "pb-1 text-medium font-medium",
          base: "mb-2"
        }}
      />

      <div className="flex justify-between items-center mt-2 mb-2">
        <Checkbox
          isSelected={rememberMe}
          onValueChange={setRememberMe}
          size="sm"
        >
          <span className="ml-1">Запомнить меня</span>
        </Checkbox>
        
        <Link href="#" size="sm" className="text-primary font-medium">
          Забыли пароль?
        </Link>
      </div>

      {/* Контейнер для сообщений об ошибках с уменьшенной фиксированной высотой */}
      <div className="min-h-[40px]">
        {formError && (
          <div className="text-danger text-sm p-2 bg-danger-50 rounded border border-danger-200">
            {formError}
          </div>
        )}
      </div>

      <Button
        type="submit"
        color="primary"
        className="w-full mt-2"
        isLoading={isLoading}
        size="lg"
        disableRipple
      >
        {isLoading ? <Spinner size="sm" color="white" /> : 'Войти'}
      </Button>
    </form>
  );
}

export default LoginForm;
