import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export const useAlerts = (params = {}) => {
  return useQuery({
    queryKey: ['alerts', params],
    queryFn: async () => {
      const { data } = await api.get('/alerts', { params });
      return data.data;
    },
  });
};
