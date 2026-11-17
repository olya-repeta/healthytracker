// Спільні типізовані контракти (DTO) між Frontend та Backend

export interface UserDto {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResponseDto {
  token: string;
  user: UserDto;
}

export type FrequencyType = 'DAILY' | 'WEEKLY';
export type DoseStatus = 'PENDING' | 'TAKEN' | 'SKIPPED';

export interface MedicationDto {
  id: string;
  userId: string;
  name: string;
  dosage: string;
  sourceUrl: string | null;
  imageUrl: string;
  frequencyType: FrequencyType;
  timesPerDay: number;
  timesOfDay: string[];
  daysOfWeek: number[];
  startDate: string;
  durationDays: number;
  endDate: string;
  createdAt: string;
}

export interface CreateMedicationRequestDto {
  name: string;
  dosage: string;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  frequencyType: FrequencyType;
  timesPerDay: number;
  timesOfDay: string[];
  daysOfWeek: number[];
  startDate: string;
  durationDays: number;
}

export interface CreateMedicationResponseDto {
  medication: MedicationDto;
  generatedDosesCount: number;
}

export interface PreviewImageResponseDto {
  imageUrl: string;
  title?: string;
  isFallback: boolean;
  source?: string;
  reason?: string;
}

export interface DoseItemDto {
  id: string;
  medicationId: string;
  userId: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
  status: DoseStatus;
  actionAt: string | null;
  medication: {
    id: string;
    name: string;
    dosage: string;
    imageUrl: string;
    sourceUrl: string | null;
    frequencyType: FrequencyType;
  };
}

export interface DaySummaryDto {
  date: string;
  total: number;
  taken: number;
  skipped: number;
  pending: number;
  allCompleted: boolean;
  hasSkipped: boolean;
  doses: DoseItemDto[];
}

export interface ScheduleRangeResponseDto {
  from: string;
  to: string;
  doses: DoseItemDto[];
  days: Record<string, DaySummaryDto>;
}

export interface AdherencePeriodStatsDto {
  total: number;
  taken: number;
  skipped: number;
  pending: number;
  adherencePercent: number;
}

export interface AdherenceStatsResponseDto {
  today: string;
  weekly: AdherencePeriodStatsDto;
  monthly: AdherencePeriodStatsDto;
}
