// frontend/src/App.jsx
import React, { useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'

// Импортируем компоненты страниц
import HomePage from './pages/HomePage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import ProfileSettingsPage from './pages/ProfileSettingsPage'
import NotFoundPage from './pages/NotFoundPage'
import AuthPage from './pages/AuthPage'
import SearchDoctorsPage from './pages/SearchDoctorsPage'
import DoctorProfilePage from './pages/DoctorProfilePage'
import HistoryPage from './pages/HistoryPage'
import GoogleAuthCallback from './pages/GoogleAuthCallback'
import CompleteProfilePage from './pages/CompleteProfilePage'
import AdminPage from './pages/AdminPage'
import DoctorApplicationPage from './pages/DoctorApplicationPage'
import AdminLoginPage from './pages/AdminLoginPage'

// Импортируем компонент хедера
import Header from './components/Header'

// Импортируем хук для доступа к стору аутентификации
import useAuthStore from './stores/authStore'
// Импортируем компонент для защиты роутов, требующих авторизации
import ProtectedRoute from './components/ProtectedRoute'
// Импортируем компонент для проверки подтверждения email
import EmailVerificationRequired from './components/EmailVerificationRequired'

// Импортируем основные стили
import './index.scss'

// Главный компонент приложения, который настраивает роутинг и общую структуру
function App() {
  // Получаем из стора функцию инициализации, состояние аутентификации и загрузки
  const initializeAuth = useAuthStore((state) => state.initializeAuth)
  const { isAuthenticated, isLoading, needsProfileUpdate } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((state) => state.user)

  // Эффект для инициализации стора аутентификации при монтировании компонента App
  useEffect(() => {
    console.log("App mounted, initializing auth store...")
    initializeAuth()
  }, [initializeAuth])
  
  // Перенаправляем неаутентифицированных пользователей на страницу логина
  useEffect(() => {
    // Публичные маршруты, доступные всем пользователям
    const publicRoutes = [
      '/login', 
      '/register', 
      '/verify-email',
      '/auth/google/callback',
      '/admin-piisa-popa',
      '/404'
    ];
    
    // Проверяем, является ли текущий путь публичным
    const isPublicRoute = publicRoutes.some(route => 
      location.pathname === route || location.pathname.startsWith(route)
    );
    
    // Если путь не публичный, загрузка завершена и пользователь не авторизован - перенаправляем на логин
    if (!isPublicRoute && !isLoading && !isAuthenticated) {
      navigate('/login');
    } 
    // Если пользователь авторизован, но требуется обновление профиля - перенаправляем на соответствующую страницу
    else if (!isLoading && isAuthenticated && needsProfileUpdate && location.pathname !== '/complete-profile') {
      navigate('/complete-profile');
    }
  }, [isLoading, isAuthenticated, needsProfileUpdate, navigate, location.pathname]);

  // Если идет загрузка инициализации стора
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <p className="mt-5 text-gray-600 font-medium">Загрузка приложения...</p>
        </div>
      </div>
    )
  }

  // Основной UI приложения
  return (
    <div className="App bg-gradient-to-b from-blue-50/30 to-white min-h-screen">
      {/* Хедер приложения (показываем только если пользователь аутентифицирован) */}
      {isAuthenticated && user && <Header />}
      
      {/* Основное содержимое */}
      <main className="pt-4 pb-8">
      {/* Определение набора маршрутов приложения с помощью компонента Routes */}
      <Routes>
          {/* Публичные роуты */}
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
          <Route path="/admin-piisa-popa" element={<AdminLoginPage />} />
          <Route path="/404" element={<NotFoundPage />} />
          
          {/* Страница для заполнения профиля */}
          <Route 
            path="/complete-profile" 
            element={isAuthenticated ? <CompleteProfilePage /> : <Navigate to="/login" />} 
          />

          {/* Базовые защищенные роуты (требуют только аутентификации) */}
        <Route element={<ProtectedRoute />}>
            {/* Домашняя страница доступна после аутентификации, даже без подтверждения email */}
            <Route path="/" element={<HomePage />} />
            
            {/* Роуты, требующие подтверждения email (для обычной регистрации) */}
            <Route element={<EmailVerificationRequired />}>
              <Route path="/profile" element={<ProfileSettingsPage />} />
              <Route path="/search-doctors" element={<SearchDoctorsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              {/* Маршрут для публичного профиля врача (доступен только аутентифицированным пользователям) */}
              <Route path="/doctors/:doctorId" element={<DoctorProfilePage />} />
              <Route path="/doctor-application" element={<DoctorApplicationPage />} />
            </Route>
        </Route>

          {/* Защищенные роуты с проверкой роли (для админов) */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin_control_panel_52x9a8" element={<AdminPage />} />
              <Route path="/admin" element={<AdminPage />} />
        </Route>

        {/* Роут для всех остальных путей - страница 404 Not Found */}
          <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
      </main>
      
      {/* Футер приложения (показываем только если пользователь аутентифицирован) */}
      {isAuthenticated && user && (
        <footer className="bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-gray-200 py-6 text-center text-gray-600 text-sm">
          <div className="container mx-auto">
            <p>© {new Date().getFullYear()} MedCare. Все права защищены.</p>
            <div className="mt-2 flex justify-center gap-4">
              <a href="#" className="hover:text-primary transition-colors">Политика конфиденциальности</a>
              <a href="#" className="hover:text-primary transition-colors">Условия использования</a>
              <a href="#" className="hover:text-primary transition-colors">Контакты</a>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}

export default App