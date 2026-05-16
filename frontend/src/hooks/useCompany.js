import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export const useCompany = (id) => {
  return useQuery({
    queryKey: ['company', id],
    queryFn: async () => {
      const { data } = await api.get(`/companies/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
};
