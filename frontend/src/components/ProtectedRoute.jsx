// frontend/src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom'; // Outlet для вложенных роутов, Navigate для перенаправления
import useAuthStore from '../stores/authStore'; // Импортируем наш стор аутентификации

// Компонент для защиты роутов.
// Если пользователь не аутентифицирован или не имеет нужной роли, перенаправляет или показывает ошибку.
// Используется для оборачивания <Route> элементов в компоненте <Routes>.
function ProtectedRoute({ allowedRoles }) {
  // Получаем состояние аутентификации из стора
  const { isAuthenticated, isLoading, user, needsProfileUpdate } = useAuthStore();

  // Пока идет проверка аутентификации при старте приложения (загрузка из Local Storage и валидация токена на бэкенде)
  // В это время мы еще не знаем точно, авторизован пользователь или нет.
  // Показываем индикатор загрузки или null.
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <p className="mt-5 text-gray-600 font-medium">Загрузка...</p>
        </div>
      </div>
    );
  }

  // После завершения загрузки:
  // Если пользователь не аутентифицирован
  if (!isAuthenticated) {
    console.log("ProtectedRoute: User not authenticated, redirecting to login");
    // Перенаправляем на страницу логина.
    // 'replace' заменяет текущую запись в истории браузера, чтобы пользователь не мог вернуться на защищенную страницу кнопкой "Назад".
    return <Navigate to="/login" replace />;
  }

  // Проверяем, заполнен ли профиль пользователя (особенно после Google OAuth)
  if (needsProfileUpdate || !user.role || !user.is_active) {
    console.log("ProtectedRoute: User needs to complete profile, redirecting to profile form");
    return <Navigate to="/complete-profile" replace />;
  }

  // Если пользователь аутентифицирован, но для данного роута требуются определенные роли
  // allowedRoles - это массив строк, например ['doctor', 'admin']
  if (allowedRoles && allowedRoles.length > 0) {
    // Проверяем, существует ли объект пользователя (он должен быть, если isAuthenticated true)
    // и входит ли его роль в массив разрешенных ролей allowedRoles.
    if (!user || !allowedRoles.includes(user.role)) {
      console.log(`ProtectedRoute: User role '${user?.role}' not in allowed roles: ${allowedRoles.join(', ')}`);
      // Если роль не соответствует, показываем сообщение об ошибке доступа (403 Forbidden)
      return (
        <div className="flex justify-center items-center min-h-screen bg-gray-50">
          <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md">
            <div className="flex justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-danger mb-2">Доступ запрещен</h1>
            <p className="text-gray-600 mb-6">
              У вас недостаточно прав для доступа к этой странице. Требуется роль: {allowedRoles.join(' или ')}.
            </p>
            <button 
              onClick={() => window.history.back()} 
              className="px-5 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors"
            >
              Вернуться назад
            </button>
          </div>
        </div>
      );
    }
  }

  // Если пользователь аутентифицирован и соответствует всем требованиям к роли (если они были указаны),
  // рендерим содержимое дочернего роута (с помощью компонента <Outlet /> из react-router-dom).
  // <Outlet /> используется, когда ProtectedRoute оборачивает группу вложенных <Route> в родительском компоненте (например, App.jsx).
   console.log("ProtectedRoute: Access granted, rendering content.");
  return <Outlet />;
}

export default ProtectedRoute; // Экспорт компонента по умолчанию