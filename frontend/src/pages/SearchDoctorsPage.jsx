import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardBody, CardFooter, Divider, Pagination, Spinner, Chip, Select, SelectItem } from '@nextui-org/react';
import { doctorsApi } from '../api';
import useAuthStore from '../stores/authStore';

// Компонент карточки врача в списке
const DoctorCard = ({ doctor, onClick }) => {
  return (
    <Card 
      className="mb-4 hover:shadow-lg transition-shadow"
      isPressable 
      onPress={onClick}
    >
      <CardBody className="p-4">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{doctor.full_name || 'Имя не указано'}</h3>
              <div className="flex items-center mt-1">
                <Chip color="primary" variant="flat" size="sm" className="mr-2">{doctor.specialization}</Chip>
                {doctor.is_verified && (
                  <Chip color="success" variant="flat" size="sm">Проверенный врач</Chip>
                )}
              </div>
            </div>
            <div className="text-xl font-bold text-primary">{doctor.cost_per_consultation} UZS</div>
          </div>
          
          <Divider className="my-2" />
          
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="flex items-center">
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-50 mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Район</p>
                <p className="text-sm font-semibold">{doctor.district || 'Не указан'}</p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-50 mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Опыт</p>
                <p className="text-sm font-semibold">{doctor.experience || 'Не указан'}</p>
              </div>
            </div>
          </div>
        </div>
      </CardBody>
      <CardFooter className="bg-gray-50 py-3 px-4">
        <div className="text-sm text-primary-600 font-medium flex items-center">
          Просмотреть профиль
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </CardFooter>
    </Card>
  );
};

// Компонент страницы поиска врачей
function SearchDoctorsPage() {
  const navigate = useNavigate();
  
  // Состояния для фильтров
  const [specialization, setSpecialization] = useState('');
  const [specializations, setSpecializations] = useState([]);
  
  // Состояния для данных
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Состояния для пагинации
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Загружаем список специализаций
  useEffect(() => {
    const loadSpecializations = async () => {
      try {
        const specializations = await doctorsApi.getSpecializations();
        setSpecializations(specializations);
      } catch (error) {
        console.error('Failed to load specializations:', error);
      }
    };
    
    loadSpecializations();
  }, []);

  // Загрузка врачей при первом рендере и при изменении фильтров или страницы
  useEffect(() => {
    // Функция для загрузки данных
    const fetchDoctors = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Фильтры для запроса (только специализация)
        const filters = {};
        if (specialization) {
          filters.specialization = specialization;
        }
        
        // Отправляем запрос на API
        const doctorsData = await doctorsApi.getDoctors(filters, page, 10);
        
        // Обновляем состояние
        setDoctors(doctorsData.items);
        setTotalPages(doctorsData.pages);
        setTotalItems(doctorsData.total);
      } catch (err) {
        console.error('Error fetching doctors:', err);
        setError('Не удалось загрузить список врачей.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDoctors();
  }, [page, specialization]);
  
  // Обработчик поиска (сбрасывает пагинацию и выполняет новый поиск)
  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1); // Сбрасываем страницу на первую при новом поиске
  };
  
  // Обработчик изменения специализации
  const handleSpecializationChange = (e) => {
    setSpecialization(e.target.value);
    setPage(1); // Сбрасываем на первую страницу при изменении фильтра
  };
  
  // Обработчик клика по карточке врача
  const handleDoctorClick = (doctorId) => {
    navigate(`/doctors/${doctorId}`);
  };
  
  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-center">Поиск врачей</h1>
      
      {/* Форма фильтрации */}
      <form onSubmit={handleSearch} className="mb-8 bg-gray-50 p-4 rounded-lg">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-grow">
            <Select
              label="Специализация"
              placeholder="Выберите специализацию"
              value={specialization}
              onChange={handleSpecializationChange}
              variant="bordered"
              radius="sm"
              fullWidth
              className="min-w-full"
            >
              <SelectItem key="" value="">Все специализации</SelectItem>
              {specializations.map((spec) => (
                <SelectItem key={spec} value={spec}>
                  {spec}
                </SelectItem>
              ))}
            </Select>
          </div>
          <Button
            type="submit"
            color="primary"
            isLoading={loading}
            className="md:w-auto w-full"
          >
            Поиск
          </Button>
        </div>
      </form>
      
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
          {/* Список врачей */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {doctors.map(doctor => (
              <DoctorCard 
                key={doctor.id} 
                doctor={doctor} 
                onClick={() => handleDoctorClick(doctor.id)}
              />
            ))}
          </div>
          
          {/* Пагинация */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <Pagination
                total={totalPages}
                initialPage={page}
                onChange={setPage}
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