// frontend/src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { NextUIProvider } from '@nextui-org/react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { ThemeProvider } from '@mui/material/styles';
import App from './App'

// Импортируем стили
import './index.css' // Tailwind CSS
import './index.scss' // SCSS стили

// Импортируем тему MUI
import muiTheme from './theme/index'

// Используйте здесь ваш реальный Client ID из Google Console
const GOOGLE_CLIENT_ID = "735617581412-e8ceb269bj7qqrv9sl066q63g5dr5sne.apps.googleusercontent.com"

// Обработчик глобальных ошибок
window.addEventListener('error', (event) => {
  console.error('Глобальная ошибка:', event.error);
});

// Убедимся, что DOM готов для рендеринга
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Элемент с id "root" не найден. Невозможно отрендерить приложение.');
} else {
  try {
    // Точка входа в приложение
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <BrowserRouter>
          <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <ThemeProvider theme={muiTheme}>
              <NextUIProvider>
                <App />
              </NextUIProvider>
            </ThemeProvider>
          </GoogleOAuthProvider>
        </BrowserRouter>
      </React.StrictMode>
    )
  } catch (error) {
    console.error('Ошибка при инициализации приложения:', error);
    // Показываем сообщение об ошибке пользователю
    rootElement.innerHTML = `
      <div style="text-align: center; margin-top: 50px; font-family: Arial, sans-serif;">
        <h1>Произошла ошибка при загрузке приложения</h1>
        <p>Пожалуйста, обновите страницу или попробуйте позже.</p>
        <button onclick="location.reload()">Обновить страницу</button>
      </div>
    `;
  }
}