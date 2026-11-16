import { apiClient } from './client';
import {
  CreateMedicationRequestDto,
  CreateMedicationResponseDto,
  MedicationDto,
  PreviewImageResponseDto,
} from '../types/api';

export const medicationsApi = {
  async previewImage(url: string): Promise<PreviewImageResponseDto> {
    const { data } = await apiClient.post<PreviewImageResponseDto>(
      '/medications/preview-image',
      { url }
    );
    return data;
  },

  async create(
    payload: CreateMedicationRequestDto
  ): Promise<CreateMedicationResponseDto> {
    const { data } = await apiClient.post<CreateMedicationResponseDto>(
      '/medications',
      payload
    );
    return data;
  },

  async list(): Promise<{ medications: MedicationDto[] }> {
    const { data } = await apiClient.get<{ medications: MedicationDto[] }>(
      '/medications'
    );
    return data;
  },

  async remove(id: string): Promise<{ message: string }> {
    const { data } = await apiClient.delete<{ message: string }>(
      `/medications/${id}`
    );
    return data;
  },
};
