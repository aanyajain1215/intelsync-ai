import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export const useCompanies = (params = {}) => {
  return useQuery({
    queryKey: ['companies', params],
    queryFn: async () => {
      const { data } = await api.get('/companies', { params });
      return data.data;
    },
  });
};
