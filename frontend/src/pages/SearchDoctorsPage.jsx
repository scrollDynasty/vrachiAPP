import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Button, Card, CardBody, CardFooter, Divider, Pagination, Spinner, Select, SelectItem, Chip } from '@nextui-org/react';
import { doctorsApi } from '../api';
import useAuthStore from '../stores/authStore';

// Компонент карточки врача в списке
const DoctorCard = ({ doctor, onClick, userDistrict }) => {
  // Проверяем, совпадает ли основной район врача с районом пользователя
  const isFromSameDistrict = doctor.district === userDistrict;
  
  return (
    <Card 
      className={`mb-4 hover:shadow-lg transition-shadow ${isFromSameDistrict ? 'border-2 border-primary' : ''}`}
      isPressable 
      onPress={onClick}
    >
      <CardBody className="p-4">
        <div className="flex flex-col">
          <h3 className="text-lg font-semibold text-primary">{doctor.full_name || 'Имя не указано'}</h3>
          <p className="text-sm text-gray-500">{doctor.specialization}</p>
          {isFromSameDistrict && (
            <Chip color="primary" variant="flat" className="mt-1 self-start">
              Ваш район: {doctor.district}
            </Chip>
          )}
          <Divider className="my-2" />
          <div className="flex flex-col gap-1 mt-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Стоимость:</span>
              <span className="text-sm font-bold text-primary">{doctor.cost_per_consultation.toLocaleString()} UZS</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Район:</span>
              <span className="text-sm">{doctor.district}</span>
            </div>
            {doctor.is_verified && (
              <div className="mt-1">
                <span className="text-xs text-success flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Верифицирован
                </span>
              </div>
            )}
          </div>
        </div>
      </CardBody>
      <CardFooter className="bg-gray-50 p-2">
        <Button size="sm" color="primary" fullWidth>
          Посмотреть профиль
        </Button>
      </CardFooter>
    </Card>
  );
};

// Компонент страницы поиска врачей
function SearchDoctorsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  // Список районов Ташкента
  const districts = [
    { value: "", label: "Все районы" },
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
  
  // Состояния для фильтров
  const [specialization, setSpecialization] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [userDistrict, setUserDistrict] = useState('');
  const [userProfileLoaded, setUserProfileLoaded] = useState(false);
  
  // Состояния для данных
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Состояния для пагинации
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Загружаем профиль пользователя и его район
  useEffect(() => {
    const loadUserProfile = async () => {
      if (user && user.role === 'patient') {
        try {
          const response = await api.get('/api/patient-profile');
          if (response.data && response.data.district) {
            setUserDistrict(response.data.district);
            setSelectedDistrict(response.data.district); // По умолчанию выбираем район пользователя
          }
        } catch (error) {
          console.error('Failed to load user profile:', error);
        } finally {
          setUserProfileLoaded(true);
        }
      } else {
        setUserProfileLoaded(true);
      }
    };
    
    loadUserProfile();
  }, [user]);
  
  // Функция для загрузки данных с применением фильтров
  const loadDoctors = async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      // Подготавливаем фильтры для запроса
      const filters = {};
      if (specialization) filters.specialization = specialization;
      if (selectedDistrict) filters.district = selectedDistrict;
      if (minPrice) filters.min_price = parseInt(minPrice, 10);
      if (maxPrice) filters.max_price = parseInt(maxPrice, 10);
      
      // Запрашиваем данные с API
      const result = await doctorsApi.getDoctors(filters, pageNum);
      
      // Обновляем состояния
      setDoctors(result.items);
      setTotalPages(result.pages);
      setTotalItems(result.total);
      setPage(result.page);
    } catch (err) {
      setError('Не удалось загрузить список врачей. Пожалуйста, попробуйте позже.');
      console.error('Error loading doctors:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Загружаем врачей когда загружен профиль пользователя
  useEffect(() => {
    if (userProfileLoaded) {
      loadDoctors();
    }
  }, [userProfileLoaded]);
  
  // Обработчик нажатия на кнопку поиска
  const handleSearch = (e) => {
    e.preventDefault();
    loadDoctors(1); // Сбрасываем на первую страницу при новом поиске
  };
  
  // Обработчик изменения страницы
  const handlePageChange = (pageNum) => {
    loadDoctors(pageNum);
  };
  
  // Обработчик нажатия на карточку врача
  const handleDoctorClick = (doctorId) => {
    navigate(`/doctors/${doctorId}`);
  };
  
  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-center">Поиск врачей</h1>
      
      {/* Форма фильтрации */}
      <form onSubmit={handleSearch} className="mb-8 bg-gray-50 p-4 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Input
            label="Специализация"
            placeholder="Например: Терапевт, Кардиолог"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            variant="bordered"
            radius="sm"
          />
          <Select
            label="Район практики"
            placeholder="Выберите район"
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            variant="bordered"
            radius="sm"
          >
            {districts.map((district) => (
              <SelectItem key={district.value} value={district.value}>
                {district.label}
              </SelectItem>
            ))}
          </Select>
          <Input
            label="Минимальная цена (UZS)"
            placeholder="От"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            type="number"
            variant="bordered"
            radius="sm"
          />
          <Input
            label="Максимальная цена (UZS)"
            placeholder="До"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            type="number"
            variant="bordered"
            radius="sm"
          />
        </div>
        
        <div className="flex justify-center">
          <Button
            type="submit"
            color="primary"
            isLoading={loading}
            className="px-8"
          >
            Поиск
          </Button>
        </div>
      </form>
      
      {/* Пояснение к поиску по районам */}
      {userDistrict && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-sm text-blue-700">
            <span className="font-medium">Информация:</span> Вы видите врачей в приоритетном порядке из вашего района (<strong>{userDistrict}</strong>). 
            Врачи из вашего района выделены рамкой.
          </p>
        </div>
      )}
      
      {/* Отображение ошибки */}
      {error && (
        <div className="text-danger text-center mb-4">
          {error}
        </div>
      )}
      
      {/* Индикатор загрузки */}
      {loading && (
        <div className="flex justify-center my-8">
          <Spinner size="lg" />
        </div>
      )}
      
      {/* Результаты поиска */}
      {!loading && doctors.length === 0 ? (
        <div className="text-center text-gray-500 my-8">
          Нет врачей, соответствующих вашим критериям поиска.
        </div>
      ) : (
        <>
          {/* Счетчик результатов */}
          {!loading && totalItems > 0 && (
            <p className="text-sm text-gray-500 mb-4">
              Найдено: {totalItems} {totalItems === 1 ? 'врач' : totalItems >= 2 && totalItems <= 4 ? 'врача' : 'врачей'}
            </p>
          )}
          
          {/* Список врачей */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {doctors.map((doctor) => (
              <DoctorCard
                key={doctor.id}
                doctor={doctor}
                onClick={() => handleDoctorClick(doctor.id)}
                userDistrict={userDistrict}
              />
            ))}
          </div>
          
          {/* Пагинация */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <Pagination
                total={totalPages}
                initialPage={page}
                onChange={handlePageChange}
                color="primary"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SearchDoctorsPage; 