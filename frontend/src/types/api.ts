// Спільні типізовані контракти (DTO) між Frontend та Backend

export interface UserDto {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  createdAt: string;
  isTelegramConnected: boolean;
  timezone: string;
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
  packagingImageUrl?: string | null;
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
  packagingImageUrl?: string | null;
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

export interface ProductMetricsDto {
  totalUsers: number;
  activeCourses: number;
  takenDoses: number;
  retentionPercent: number;
  feedbackCount: number;
  donateClicks: number;
  conversionPercent: number;
  recentFeedbacks?: Array<{
    id: string;
    userId?: string | null;
    rating: number;
    comment: string;
    authorName: string;
    createdAt: string;
  }>;
}

export interface FeedbackSubmissionDto {
  type: 'feedback' | 'donate_click';
  rating?: number;
  comment?: string;
}

export interface FeedbackResponseDto {
  success: boolean;
  message: string;
  data?: {
    id: string;
    type: string;
    rating?: number | null;
    comment?: string | null;
    userId?: string | null;
    createdAt: string;
  };
}
