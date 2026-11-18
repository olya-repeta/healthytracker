import { apiClient } from './client';
import {
  AdherenceStatsResponseDto,
  DoseItemDto,
  DoseStatus,
  FeedbackResponseDto,
  FeedbackSubmissionDto,
  ProductMetricsDto,
  ScheduleRangeResponseDto,
} from '../types/api';

export const scheduleApi = {
  async getByDate(date: string): Promise<{ date: string; doses: DoseItemDto[] }> {
    const { data } = await apiClient.get<{ date: string; doses: DoseItemDto[] }>(
      '/schedule/by-date',
      { params: { date } }
    );
    return data;
  },

  async getByRange(
    from: string,
    to: string
  ): Promise<ScheduleRangeResponseDto> {
    const { data } = await apiClient.get<ScheduleRangeResponseDto>(
      '/schedule/range',
      { params: { from, to } }
    );
    return data;
  },

  async getStats(date?: string): Promise<AdherenceStatsResponseDto> {
    const { data } = await apiClient.get<AdherenceStatsResponseDto>(
      '/schedule/stats',
      { params: date ? { date } : undefined }
    );
    return data;
  },

  async updateStatus(
    scheduleId: string,
    status: DoseStatus
  ): Promise<{ dose: DoseItemDto }> {
    const { data } = await apiClient.patch<{ dose: DoseItemDto }>(
      `/schedule/${scheduleId}/status`,
      { status }
    );
    return data;
  },

  async getProductMetrics(): Promise<ProductMetricsDto> {
    const { data } = await apiClient.get<ProductMetricsDto>(
      '/schedule/product-metrics'
    );
    return data;
  },

  async submitFeedback(
    dto: FeedbackSubmissionDto
  ): Promise<FeedbackResponseDto> {
    const { data } = await apiClient.post<FeedbackResponseDto>(
      '/schedule/feedback',
      dto
    );
    return data;
  },

  async trackDonateClick(): Promise<FeedbackResponseDto> {
    const { data } = await apiClient.post<FeedbackResponseDto>(
      '/schedule/feedback',
      { type: 'donate_click' }
    );
    return data;
  },
};
