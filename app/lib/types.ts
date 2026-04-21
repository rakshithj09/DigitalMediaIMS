export type Period = "AM" | "PM";

export interface Student {
  id: string;
  name: string;
  student_id?: string | null;
  user_id?: string | null;
  email?: string | null;
  period: Period;
  is_active: boolean;
  created_at: string;
}

export interface Equipment {
  id: string;
  name: string;
  category: string;
  total_quantity: number;
  serial_number?: string | null;
  condition_notes?: string | null;
  is_active: boolean;
  created_at: string;
  available?: number;
}

export interface Checkout {
  id: string;
  student_id: string;
  equipment_id: string;
  quantity: number;
  checked_out_at: string;
  checked_in_at?: string | null;
  notes?: string | null;
  return_notes?: string | null;
  period: Period;
  created_at: string;
  student?: Pick<Student, "id" | "name" | "student_id">;
  equipment?: Pick<Equipment, "id" | "name" | "category">;
}

export const EQUIPMENT_CATEGORIES = [
  "Camera",
  "Microphone",
  "Tripod",
  "Lighting",
  "Memory Card",
  "Lens",
  "Accessory",
  "Other",
] as const;
