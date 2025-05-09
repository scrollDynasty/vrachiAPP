import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api';

// Store for managing chat state including unread messages
const useChatStore = create(
  persist(
    (set, get) => ({
      // Store unread message counts by consultation ID
      // Format: { consultationId: count }
      unreadMessages: {},
      
      // Total count of unread messages across all consultations
      totalUnread: 0,
      
      // Add an unread message for a consultation
      addUnreadMessage: (consultationId) => 
        set((state) => {
          const currentCount = state.unreadMessages[consultationId] || 0;
          const newUnreadMessages = {
            ...state.unreadMessages,
            [consultationId]: currentCount + 1
          };
          
          return {
            unreadMessages: newUnreadMessages,
            totalUnread: Object.values(newUnreadMessages).reduce((sum, count) => sum + count, 0)
          };
        }),
      
      // Mark messages for a consultation as read
      markAsRead: (consultationId) => 
        set((state) => {
          const newUnreadMessages = { ...state.unreadMessages };
          delete newUnreadMessages[consultationId];
          
          return {
            unreadMessages: newUnreadMessages,
            totalUnread: Object.values(newUnreadMessages).reduce((sum, count) => sum + count, 0)
          };
        }),
        
      // Set specific count for a consultation
      setUnreadCount: (consultationId, count) =>
        set((state) => {
          const newUnreadMessages = {
            ...state.unreadMessages,
            [consultationId]: count
          };
          
          return {
            unreadMessages: newUnreadMessages,
            totalUnread: Object.values(newUnreadMessages).reduce((sum, count) => sum + count, 0)
          };
        }),
      
      // Reset all unread counts
      resetUnread: () => set({ unreadMessages: {}, totalUnread: 0 }),
      
      // Fetch unread message counts from the server
      fetchUnreadCounts: async () => {
        try {
          console.log('Использую локальную реализацию для получения непрочитанных сообщений');
          
          // Локальная заглушка для непрочитанных сообщений
          // Вместо запроса к проблемному эндпоинту /api/consultations/unread
          
          // Получаем все консультации пользователя
          try {
            const consultationsResponse = await api.get('/api/consultations');
            const consultations = consultationsResponse.data || [];
            
            // Создаем локальный объект непрочитанных сообщений
            const unreadData = {};
            let totalUnread = 0;
            
            // Для активных консультаций проверяем непрочитанные сообщения
            for (const consultation of consultations) {
              if (consultation.status === 'active' || consultation.status === 'completed') {
                try {
                  // Получаем сообщения консультации
                  const messagesResponse = await api.get(`/api/consultations/${consultation.id}/messages`);
                  const messages = messagesResponse.data || [];
                  
                  // Проверяем, есть ли новые сообщения
                  const unreadCount = messages.filter(msg => !msg.is_read).length;
                  
                  if (unreadCount > 0) {
                    unreadData[consultation.id] = unreadCount;
                    totalUnread += unreadCount;
                  }
                } catch (msgError) {
                  console.warn(`Не удалось загрузить сообщения для консультации ${consultation.id}:`, msgError);
                }
              }
            }
            
            // Обновляем состояние только если получены данные
            if (Object.keys(unreadData).length > 0) {
              set({ 
                unreadMessages: unreadData,
                totalUnread: totalUnread 
              });
            }
            
            console.log('Обновлены данные о непрочитанных сообщениях:', unreadData);
            return unreadData;
          } catch (consultationsError) {
            console.error('Ошибка при загрузке консультаций для проверки непрочитанных сообщений:', consultationsError);
            throw consultationsError;
          }
        } catch (error) {
          // Более подробное логирование ошибок
          if (error.response) {
            // Ошибка от сервера
            console.error('Failed to fetch unread message counts - server error:', 
              error.response.status, error.response.data);
          } else if (error.request) {
            // Запрос был сделан, но ответ не получен
            console.error('Failed to fetch unread message counts - no response received:', 
              error.request);
          } else {
            // Что-то еще пошло не так
            console.error('Failed to fetch unread message counts:', error.message);
          }
          
          // Не меняем текущее состояние при ошибке
          return get().unreadMessages;
        }
      }
    }),
    {
      name: 'chat-storage'
    }
  )
);

export default useChatStore; 