// frontend/src/components/DoctorProfileForm.jsx
import React, { useState, useEffect } from 'react';

// Импортируем компоненты Material UI
import TextField from '@mui/material/TextField'; // Поле ввода текста
import Button from '@mui/material/Button';     // Кнопка
import Box from '@mui/material/Box';           // Универсальный контейнер для лейаута
import Typography from '@mui/material/Typography'; // Текст и заголовки
import CircularProgress from '@mui/material/CircularProgress'; // Индикатор загрузки
import Select from '@mui/material/Select';     // Для выпадающего списка специализаций
import MenuItem from '@mui/material/MenuItem';   // Пункты списка
import FormControl from '@mui/material/FormControl'; // Контейнер для Select с меткой
import InputLabel from '@mui/material/InputLabel'; // Метка для Select
import Chip from '@mui/material/Chip'; // Компонент для отображения выбранных элементов
import OutlinedInput from '@mui/material/OutlinedInput'; // Стилизованный инпут для мульти-селекта
import Paper from '@mui/material/Paper'; // Для отображения информации о районе
import Alert from '@mui/material/Alert'; // Для информационных сообщений
import InfoIcon from '@mui/icons-material/Info'; // Иконка для информации
import Tooltip from '@mui/material/Tooltip'; // Тултип для подсказок
// TODO: Возможно, понадобится Autocomplete или Chip для выбора нескольких районов из списка


// Компонент формы для профиля Врача
// Используется на странице ProfileSettingsPage для создания или редактирования профиля Врача.
// Принимает: profile, onSave, isLoading (сохранение), error (сохранение).
function DoctorProfileForm({ profile, onSave, isLoading, error }) { // Переименовал isLoading/error для ясности в props
   // Состояния формы, предзаполненные данными из пропса profile
   const [full_name, setFullName] = useState('');
   const [specialization, setSpecialization] = useState(''); // Будет значением из списка
   const [experience_years, setExperienceYears] = useState(''); // Опыт работы в годах (число)
   const [education, setEducation] = useState(''); // Текст образования
   const [cost_per_consultation, setCostPerConsultation] = useState(''); // Стоимость (число)
   const [practice_areas, setPracticeAreas] = useState([]); // Теперь это массив выбранных районов
   const [district, setDistrict] = useState(''); // Основной район практики из заявки (нередактируемый)

   // Локальное состояние для ошибки валидации формы на фронтенде
   const [formLocalError, setFormLocalError] = useState(null);

   // TODO: Состояния для списков специализаций и районов (будут загружаться с бэкенда)
   // const [specializationsList, setSpecializationsList] = useState([]);
   // const [areasList, setAreasList] = useState([]);
   // const [isListsLoading, setIsListsLoading] = useState(true); // Флаг загрузки списков

   // Пример статического списка специализаций (временно, пока нет API)
   const staticSpecializations = [
       'Терапевт', 'Педиатр', 'Хирург', 'Невролог', 'Кардиолог', 'Окулист', 'ЛОР', 'Стоматолог', 'Гейнеколог' // TODO: Добавить полный список
   ];

    // Пример статического списка районов Ташкента (временно, пока нет API)
    const staticAreas = [
        'Алмазарский район', 'Бектемирский район', 'Мирабадский район', 'Мирзо-Улугбекский район', 'Сергелийский район',
        'Учтепинский район', 'Чиланзарский район', 'Шайхантаурский район', 'Юнусабадский район', 'Яккасарайский район', 'Яшнабадский район'
    ]; 

   // Эффект для предзаполнения формы при получении данных профиля из пропсов.
   useEffect(() => {
      if (profile) {
         setFullName(profile.full_name || '');
         setSpecialization(profile.specialization || '');
         // TODO: Преобразовать опыт работы из строки ("5 лет") в число лет (5)
         // Регулярное выражение \D находит все нецифровые символы, replace заменяет их на пустую строку. parseInt парсит оставшиеся цифры.
         setExperienceYears(profile.experience ? parseInt(profile.experience.replace(/\D/g, '')) || '' : ''); // Пример парсинга "5 лет" в 5
         setEducation(profile.education || ''); // Текст образования
         setCostPerConsultation(profile.cost_per_consultation || ''); // Числовое поле
         
         // Устанавливаем основной район из заявки (нередактируемый)
         setDistrict(profile.district || '');
         
         // Если practice_areas пришёл как строка, разбиваем его на массив
         if (profile.practice_areas) {
           if (typeof profile.practice_areas === 'string') {
             // Разделяем строку по запятой и удаляем лишние пробелы
             const areas = profile.practice_areas.split(',').map(area => area.trim());
             setPracticeAreas(areas.filter(area => area)); // Фильтруем пустые значения
           } else if (Array.isArray(profile.practice_areas)) {
             setPracticeAreas(profile.practice_areas);
           }
         } else {
           // Если районы практики не указаны, устанавливаем основной район как единственный
           if (profile.district) {
             setPracticeAreas([profile.district]);
           }
         }
      }
       // Сбрасываем локальную ошибку формы при смене профиля
       setFormLocalError(null);
   }, [profile]); // Зависимость: эффект срабатывает при изменении пропса profile

   // TODO: Эффект для загрузки списков специализаций и районов с бэкенда
   // useEffect(() => {
   //    const fetchLists = async () => {
   //       setIsListsLoading(true);
   //       try {
   //          const specResponse = await api.get('/specializations'); // TODO: Создать этот эндпоинт на бэкенде
   //          setSpecializationsList(specResponse.data);
   //          const areasResponse = await api.get('/areas'); // TODO: Создать этот эндпоинт на бэкенде (вернет список районов Ташкента)
   //          setAreasList(areasResponse.data);
   //       } catch (err) {
   //          console.error("Failed to load lists:", err);
   //          // TODO: Обработка ошибок загрузки списков
   //       } finally {
   //          setIsListsLoading(false);
   //       }
   //    };
   //    fetchLists();
   // }, []); // Пустой массив зависимостей: эффект запускается один раз при монтировании


   // Обработчик отправки формы
   const handleSubmit = (event) => {
      event.preventDefault();
      setFormLocalError(null); // Сбрасываем локальные ошибки валидации

      // Валидация на фронтенде: специализация и стоимость обязательны
      if (!specialization) {
          setFormLocalError("Пожалуйста, укажите специализацию.");
          return;
      }
       // Проверка, что стоимость является числом и больше 0
      const cost = parseInt(cost_per_consultation);
      if (isNaN(cost) || cost <= 0) {
           setFormLocalError("Пожалуйста, укажите корректную стоимость консультации (число больше 0 сум).");
           return;
      }
       // Проверка, что опыт работы является числом (если заполнено)
       const experience = parseInt(experience_years);
       if (experience_years && (isNaN(experience) || experience < 0)) {
            setFormLocalError("Пожалуйста, укажите корректный опыт работы (число лет).");
            return;
       }

      // Проверка, что выбран хотя бы один район
      if (!practice_areas.length) {
        setFormLocalError("Пожалуйста, укажите хотя бы один район практики.");
        return;
      }

      // Формируем данные для отправки на бэкенд
      const profileData = {
         full_name: full_name || null,
         specialization: specialization, // Обязательное поле (значение из Select)
         experience: experience_years ? `${experience_years} лет` : null, // TODO: Сохранять опыт как число на бэкенде? Имя поля 'experience'
         education: education || null, // Текст образования
         cost_per_consultation: cost, // Отправляем как число
         practice_areas: district, // Теперь передаем только основной район
         district: district // Сохраняем основной район (нередактируемый)
      };

      // Вызываем функцию onSave, переданную из родительского компонента.
      // onSave сам установит isLoading и error.
      onSave(profileData); // Вызываем функцию сохранения

      // setFormLocalError("Ошибка сохранения профиля врача."); // Пример локальной ошибки формы

   };

   // Обработчик изменения значений в мульти-селекте районов - больше не используется
   const handleAreasChange = (event) => {
     // Функция оставлена для совместимости, но районы больше не редактируются
     return;
   };


   return (
      // Box как контейнер для формы
      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}> {/* mt: margin-top */}
         {/* Заголовок формы */}
         <Typography variant="h6" gutterBottom>
            Информация о Враче
         </Typography>

         {/* Информационное сообщение о нередактируемых полях */}
         <Alert severity="info" sx={{ mb: 3 }}>
           <Typography variant="body2">
             Основная информация о враче (ФИО, специализация, образование, опыт и район практики) 
             берется из одобренной заявки и не может быть изменена. Вы можете изменить 
             только стоимость консультации.
           </Typography>
         </Alert>

         {/* Показываем информацию о нередактируемом районе */}
         {district && (
           <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
             <Typography variant="subtitle2" gutterBottom>
               Район практики (указан при регистрации):
             </Typography>
             <Chip 
               label={district} 
               color="primary" 
               sx={{ mt: 1 }}
             />
             <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
               Этот район был указан при подаче заявки и не может быть изменен.
             </Typography>
           </Paper>
         )}

         {/* Поле ФИО (нередактируемое) */}
         <TextField
            label={
              <span>
                ФИО
                <Tooltip title="Нельзя изменить, так как указано в заявке">
                  <InfoIcon fontSize="small" sx={{ ml: 1, fontSize: '0.8rem', color: 'grey.500', verticalAlign: 'middle' }} />
                </Tooltip>
              </span>
            }
            id="doctor-full-name"
            value={full_name}
            variant="outlined"
            disabled={true}
            fullWidth
            margin="normal"
            sx={{ mb: 2 }}
         />

         {/* Специализация (нередактируемая) */}
         <FormControl fullWidth margin="normal" sx={{ mb: 2 }}>
           <InputLabel id="doctor-specialization-label">
             <span>
               Специализация
               <Tooltip title="Нельзя изменить, так как указано в заявке">
                 <InfoIcon fontSize="small" sx={{ ml: 1, fontSize: '0.8rem', color: 'grey.500', verticalAlign: 'middle' }} />
               </Tooltip>
             </span>
           </InputLabel>
           <Select
             labelId="doctor-specialization-label"
             id="doctor-specialization"
             value={specialization}
             label="Специализация"
             disabled={true}
           >
             <MenuItem value={specialization}>{specialization}</MenuItem>
           </Select>
         </FormControl>

         {/* Опыт работы (нередактируемый) */}
         <TextField
            label={
              <span>
                Опыт работы (лет)
                <Tooltip title="Нельзя изменить, так как указано в заявке">
                  <InfoIcon fontSize="small" sx={{ ml: 1, fontSize: '0.8rem', color: 'grey.500', verticalAlign: 'middle' }} />
                </Tooltip>
              </span>
            }
            id="doctor-experience"
            value={experience_years}
            variant="outlined"
            disabled={true}
            fullWidth
            margin="normal"
            sx={{ mb: 2 }}
         />

         {/* Образование (нередактируемое) */}
         <TextField
            label={
              <span>
                Образование
                <Tooltip title="Нельзя изменить, так как указано в заявке">
                  <InfoIcon fontSize="small" sx={{ ml: 1, fontSize: '0.8rem', color: 'grey.500', verticalAlign: 'middle' }} />
                </Tooltip>
              </span>
            }
            id="doctor-education"
            value={education}
            variant="outlined"
            disabled={true}
            multiline
            rows={4}
            fullWidth
            margin="normal"
            sx={{ mb: 2 }}
         />

         {/* Стоимость консультации (редактируемое) */}
         <TextField
            label="Стоимость консультации (сум)"
            id="doctor-cost"
            value={cost_per_consultation}
            onChange={(e) => setCostPerConsultation(e.target.value)}
            type="number"
            required
            inputProps={{ min: 1 }}
            fullWidth
            margin="normal"
            sx={{ mb: 2 }}
         />

         {/* Отображение районов практики (нередактируемое, только для показа) */}
         <FormControl fullWidth margin="normal" sx={{ mb: 2 }}>
           <InputLabel id="doctor-areas-label">
             <span>
               Район практики
               <Tooltip title="Нельзя изменить, так как указано в заявке">
                 <InfoIcon fontSize="small" sx={{ ml: 1, fontSize: '0.8rem', color: 'grey.500', verticalAlign: 'middle' }} />
               </Tooltip>
             </span>
           </InputLabel>
           <Select
             labelId="doctor-areas-label"
             id="doctor-areas"
             value={[district]}
             input={<OutlinedInput label="Район практики" />}
             disabled={true}
             renderValue={(selected) => (
               <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                 {selected.map((value) => (
                   <Chip 
                     key={value} 
                     label={value} 
                     color="primary"
                     size="small"
                   />
                 ))}
               </Box>
             )}
           >
             <MenuItem value={district}>{district}</MenuItem>
           </Select>
         </FormControl>

         {/* Отображение локальной ошибки валидации формы */}
         {formLocalError && (
            <Typography color="error" sx={{ mt: 2, mb: 2, textAlign: 'center', width: '100%' }}>
              {formLocalError}
            </Typography>
         )}

          {/* Отображение ошибки сохранения из родителя (если нужно отображать внутри формы) */}
           {/* {error && (
              <Typography color="error" sx={{ mt: 2, mb: 2, textAlign: 'center', width: '100%' }}>
                {error}
              </Typography>
           )} */}


          {/* Контейнер для кнопки сохранения. Центрируем ее. */}
         <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
             {/* Кнопка сохранения формы */}
             <Button
               type="submit"
               variant="contained"
               color="primary"
               disabled={isLoading}
             >
                {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Сохранить Профиль Врача'}
             </Button>
         </Box>
      </Box>
   );
}

export default DoctorProfileForm; // Экспорт компонента по умолчанию