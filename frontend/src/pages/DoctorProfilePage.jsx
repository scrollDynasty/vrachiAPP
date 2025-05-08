import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardBody, Button, Divider, Spinner, Chip, Tooltip, Avatar, Pagination } from '@nextui-org/react';
import { doctorsApi } from '../api';
import useAuthStore from '../stores/authStore';
import RequestConsultationModal from '../components/RequestConsultationModal';
import api from '../api';

// Компонент для секции информации в профиле
const InfoSection = ({ title, children }) => (
  <div className="mb-6">
    <h3 className="text-lg font-semibold mb-2 text-primary">{title}</h3>
    <div className="pl-2">{children}</div>
  </div>
);

// Компонент для отображения звездного рейтинга
const StarRating = ({ rating }) => {
  return (
    <div className="flex items-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={`text-2xl ${star <= rating ? 'text-yellow-500' : 'text-gray-300'}`}>
          ★
        </span>
      ))}
      <span className="ml-2 text-lg font-semibold">{rating.toFixed(1)}</span>
    </div>
  );
};

// Компонент для отзыва
const ReviewItem = ({ review }) => {
  // Преобразуем дату в читаемый формат
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('ru-RU', options);
  };

  return (
    <Card className="mb-4 shadow-sm">
      <CardBody>
        <div className="flex items-start gap-4">
          <Avatar size="md" src="/assets/patient-avatar.png" />
          <div className="flex-1">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-semibold">{review.patientName || 'Пациент'}</h4>
              <span className="text-sm text-gray-500">
                {formatDate(review.created_at)}
              </span>
            </div>
            <div className="mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className={`text-xl ${star <= review.rating ? 'text-yellow-500' : 'text-gray-300'}`}>
                  ★
                </span>
              ))}
            </div>
            <p className="text-gray-700">{review.comment || 'Отзыв без комментария'}</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

// Компонент страницы профиля врача
function DoctorProfilePage() {
  const { doctorId } = useParams(); // Получаем ID врача из URL
  const navigate = useNavigate();
  const { user } = useAuthStore(); // Получаем текущего пользователя
  
  // Состояния для данных
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isConsultationModalOpen, setIsConsultationModalOpen] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const reviewsPerPage = 5;
  
  // Рассчитываем общий рейтинг врача
  const calculateRating = (reviews) => {
    if (!reviews || reviews.length === 0) return 0;
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    return totalRating / reviews.length;
  };
  
  // Проверяем, может ли пользователь запрашивать консультацию
  const canRequestConsultation = () => {
    // Проверяем, что пользователь авторизован
    if (!user) return false;
    
    // Проверяем, что пользователь - пациент
    if (user.role !== 'patient') return false;
    
    // Проверяем, что доктор активен
    if (!doctor || !doctor.is_active) return false;
    
    return true;
  };
  
  // Загружаем данные врача при первом рендере
  useEffect(() => {
    const fetchDoctorData = async () => {
      setLoading(true);
      try {
        const data = await doctorsApi.getDoctorById(doctorId);
        console.log('Получены данные о враче:', data);
        console.log('ID врача:', data.id);
        console.log('user_id врача:', data.user_id);
        setDoctor(data);
      } catch (err) {
        setError('Не удалось загрузить информацию о враче. Пожалуйста, попробуйте позже.');
        console.error('Error loading doctor profile:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDoctorData();
  }, [doctorId]);
  
  // Загружаем отзывы о враче
  useEffect(() => {
    const fetchReviews = async () => {
      if (!doctorId) return;
      
      setReviewsLoading(true);
      try {
        // Используем user_id из профиля врача, а не id профиля
        if (doctor && doctor.user_id) {
          const response = await api.get(`/api/doctors/${doctor.user_id}/reviews`);
          
          // Для каждого отзыва пытаемся получить информацию о пациенте
          const reviewsWithPatientInfo = await Promise.all(
            response.data.map(async (review) => {
              try {
                // Получаем консультацию, чтобы узнать ID пациента
                const consultResponse = await api.get(`/api/consultations/${review.consultation_id}`);
                const patientId = consultResponse.data.patient_id;
                
                // Получаем профиль пациента
                const patientResponse = await api.get(`/patients/${patientId}/profile`);
                
                // Добавляем информацию о пациенте в отзыв
                return {
                  ...review,
                  patientName: patientResponse.data.full_name || 'Пациент'
                };
              } catch (err) {
                console.log('Не удалось получить данные о пациенте:', err);
                return {...review, patientName: 'Пациент'};
              }
            })
          );
          
          setReviews(reviewsWithPatientInfo);
        }
      } catch (err) {
        console.error('Ошибка при загрузке отзывов:', err);
        setReviewsError('Не удалось загрузить отзывы о враче');
      } finally {
        setReviewsLoading(false);
      }
    };
    
    if (doctor) {
      fetchReviews();
    }
  }, [doctor]);
  
  // Обработчик кнопки "Назад к поиску"
  const handleBackToSearch = () => {
    navigate('/search-doctors');
  };
  
  // Обработчик "Подать заявку на консультацию"
  const handleRequestConsultation = () => {
    if (!canRequestConsultation()) {
      if (!user) {
        alert("Для записи на консультацию необходимо войти в систему.");
        navigate('/login');
        return;
      }
      
      if (user.role !== 'patient') {
        alert("Только пациенты могут записываться на консультации.");
        return;
      }
      
      if (!doctor.is_active) {
        alert("К сожалению, этот врач в данный момент недоступен для консультаций.");
        return;
      }
    }
    
    // Открываем модальное окно для запроса консультации
    setIsConsultationModalOpen(true);
  };
  
  // Получаем текущую страницу отзывов
  const indexOfLastReview = currentPage * reviewsPerPage;
  const indexOfFirstReview = indexOfLastReview - reviewsPerPage;
  const currentReviews = reviews.slice(indexOfFirstReview, indexOfLastReview);
  const totalPages = Math.ceil(reviews.length / reviewsPerPage);
  
  // Отображаем индикатор загрузки
  if (loading) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-8 flex justify-center items-center min-h-[50vh]">
        <Spinner size="lg" />
      </div>
    );
  }
  
  // Отображаем сообщение об ошибке
  if (error) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        <Card>
          <CardBody>
            <div className="text-danger text-center py-8">
              <p>{error}</p>
              <Button onPress={handleBackToSearch} color="primary" className="mt-4">
                Назад к поиску
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }
  
  // Если доктор не найден
  if (!doctor) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        <Card>
          <CardBody>
            <div className="text-gray-600 text-center py-8">
              <p>Врач не найден. Возможно, он был удален или деактивирован.</p>
              <Button onPress={handleBackToSearch} color="primary" className="mt-4">
                Назад к поиску
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }
  
  // Преобразуем строку specializations в массив
  const specializationsArray = doctor.specializations ? doctor.specializations.split(',').map(s => s.trim()) : [];
  
  // Преобразуем строку practice_areas в массив
  const practiceAreasArray = doctor.practice_areas ? doctor.practice_areas.split(',').map(s => s.trim()) : [];
  
  // Форматирование даты
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('ru-RU', options);
  };
  
  // Рассчитаем рейтинг врача
  const doctorRating = calculateRating(reviews);
  
  // Основной рендер
  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">
      <Button 
        onPress={handleBackToSearch} 
        variant="light" 
        className="mb-4"
      >
        ← Назад к поиску
      </Button>
      
      <Card className="shadow-md mb-6">
        <CardBody className="p-6">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Левая колонка с фото и основной информацией */}
            <div className="w-full md:w-1/3">
              <div className="bg-gray-200 rounded-lg aspect-square mb-4 flex items-center justify-center overflow-hidden">
                {doctor.avatar_path ? (
                  <img 
                    src={`http://127.0.0.1:8000${doctor.avatar_path}`}
                    alt={`Аватар ${doctor.full_name || "врача"}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-6xl">👨‍⚕️</span>
                )}
              </div>
              
              {doctor.is_active ? (
                <Chip color="success" variant="flat" className="mb-4">Принимает пациентов</Chip>
              ) : (
                <Chip color="danger" variant="flat" className="mb-4">Не принимает пациентов</Chip>
              )}
              
              <h1 className="text-2xl font-bold mb-1">
                {doctor.last_name || ""} {doctor.first_name || ""} {doctor.middle_name || ""}
              </h1>
              
              <p className="text-gray-600 mb-4">
                {doctor.position || "Врач"}
              </p>
              
              {/* Отображение рейтинга */}
              <div className="mb-4">
                {reviews.length > 0 ? (
                  <div>
                    <StarRating rating={doctorRating} />
                    <p className="text-sm text-gray-600 mt-1">На основе {reviews.length} отзывов</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Нет отзывов</p>
                )}
              </div>
              
              {doctor.district && (
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-semibold">Район: </span>
                  {doctor.district}
                </p>
              )}
              
              {doctor.experience && (
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-semibold">Опыт работы: </span>
                  {doctor.experience} лет
                </p>
              )}
              
              {doctor.joined_at && (
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-semibold">На платформе с: </span>
                  {formatDate(doctor.joined_at)}
                </p>
              )}
            </div>
            
            {/* Правая колонка с детальной информацией */}
            <div className="w-full md:w-2/3">
              {doctor.about && (
                <InfoSection title="О враче">
                  <p className="text-gray-700">{doctor.about}</p>
                </InfoSection>
              )}
              
              {doctor.education && (
                <InfoSection title="Образование">
                  <p className="text-gray-700">{doctor.education}</p>
                </InfoSection>
              )}
              
              {specializationsArray.length > 0 && (
                <InfoSection title="Специализации">
                  <div className="flex flex-wrap gap-2">
                    {specializationsArray.map((spec, index) => (
                      <Chip key={index} color="primary" variant="flat">
                        {spec}
                      </Chip>
                    ))}
                  </div>
                </InfoSection>
              )}
              
              {practiceAreasArray.length > 0 && (
                <InfoSection title="Районы практики">
                  <div className="flex flex-wrap gap-2">
                    {practiceAreasArray.map((area, index) => (
                      <Chip key={index} color="primary" variant="flat">
                        {area}
                      </Chip>
                    ))}
                  </div>
                </InfoSection>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
      
      {/* Секция с кнопкой запроса консультации */}
      <Card className="shadow-md mb-6">
        <CardBody className="p-6 flex justify-center">
          <Button 
            color="primary" 
            size="lg"
            onPress={handleRequestConsultation}
            isDisabled={!canRequestConsultation()}
          >
            Записаться на консультацию
          </Button>
        </CardBody>
      </Card>
      
      {/* Секция с отзывами */}
      <Card className="shadow-md">
        <CardBody className="p-6">
          <h3 className="text-xl font-bold mb-4">Отзывы о враче</h3>
          
          {reviewsLoading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : reviewsError ? (
            <p className="text-center text-danger">{reviewsError}</p>
          ) : reviews.length === 0 ? (
            <p className="text-center text-gray-500 py-4">У этого врача пока нет отзывов</p>
          ) : (
            <div>
              {currentReviews.map((review, index) => (
                <ReviewItem key={index} review={review} />
              ))}
              
              {/* Пагинация */}
              {totalPages > 1 && (
                <div className="flex justify-center mt-4">
                  <Pagination 
                    total={totalPages} 
                    initialPage={1}
                    page={currentPage}
                    onChange={setCurrentPage}
                  />
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>
      
      {/* Модальное окно для запроса консультации */}
      <RequestConsultationModal 
        isOpen={isConsultationModalOpen}
        onClose={() => setIsConsultationModalOpen(false)}
        doctorId={doctor.user_id}
        doctorName={`${doctor.last_name || ""} ${doctor.first_name || ""} ${doctor.middle_name || ""}`}
      />
    </div>
  );
}

export default DoctorProfilePage; 