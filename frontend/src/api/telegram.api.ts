import { apiClient } from './client';

export const telegramApi = {
  /**
   * Запитує URL для прив'язки бота у Telegram
   */
  async link(timezone?: string): Promise<{ url: string }> {
    const { data } = await apiClient.post<{ url: string }>('/telegram/link', {
      timezone,
    });
    return data;
  },

  /**
   * Відв'язує Telegram від поточного акаунта
   */
  async unlink(): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.delete<{
      success: boolean;
      message: string;
    }>('/telegram/link');
    return data;
  },
};
