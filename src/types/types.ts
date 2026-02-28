export const MEDICAL_CONDITIONS = [
  "Diabetes",
  "Blood Pressure",
  "Heart Condition",
  "Asthma",
  "Other",
] as const;

export type MedicalCondition = (typeof MEDICAL_CONDITIONS)[number];

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export function apiSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

export function apiError(message: string): ApiResponse<never> {
  return { success: false, error: message };
}
