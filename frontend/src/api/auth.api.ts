import { apiClient } from './client';
import { AuthResponseDto, UserDto } from '../types/api';

export const authApi = {
  async register(payload: {
    name: string;
    email: string;
    password: string;
  }): Promise<AuthResponseDto> {
    const { data } = await apiClient.post<AuthResponseDto>(
      '/auth/register',
      payload
    );
    return data;
  },

  async login(payload: {
    email: string;
    password: string;
  }): Promise<AuthResponseDto> {
    const { data } = await apiClient.post<AuthResponseDto>(
      '/auth/login',
      payload
    );
    return data;
  },

  async getMe(): Promise<{ user: UserDto }> {
    const { data } = await apiClient.get<{ user: UserDto }>('/auth/me');
    return data;
  },
};
