/// <reference types="vite/client" />
import { Staff } from '../data';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const API_POST_URL = import.meta.env.VITE_API_POST_URL || API_BASE_URL;

// The exact shape returned by the API endpoint
export interface RawStaffData {
  row_number?: number;
  "Staff"?: string;
  "Y1 Onboarding year"?: string | number;
  "Y2 (reimburse 1150)"?: string | number;
  "Y3 (reimburse 800)"?: string | number;
  "Y4 (reimburse 400)"?: string | number;
  "Renewal BYOD (May before next SY)"?: string | number;
}

/**
 * Generic fetch wrapper with error handling.
 */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    throw new Error(
      `API request failed: ${response.status} ${response.statusText} — ${errorBody}`
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Maps the API's raw row format to our internal Staff domain model
 */
function mapRawToStaff(raw: RawStaffData): Staff {
  const name = raw["Staff"] || '';
  const onboardingYear = String(raw["Y1 Onboarding year"] ?? '');
  const y2 = String(raw["Y2 (reimburse 1150)"] ?? '');
  const y3 = String(raw["Y3 (reimburse 800)"] ?? '');
  const y4 = String(raw["Y4 (reimburse 400)"] ?? '');
  const renewal = String(raw["Renewal BYOD (May before next SY)"] ?? '');
  
  return {
    id: String(raw.row_number || Date.now()),
    name,
    onboardingYear,
    y2,
    y3,
    y4,
    renewal,
    notes: ''
  };
}

/**
 * Maps internally updated staff data back to the API's format
 */
function mapStaffToRaw(staff: Partial<Staff>): Partial<RawStaffData> {
  const raw: Partial<RawStaffData> = {};
  if (staff.id !== undefined) raw.row_number = parseInt(staff.id, 10);
  if (staff.name !== undefined) raw["Staff"] = staff.name;
  if (staff.onboardingYear !== undefined) raw["Y1 Onboarding year"] = staff.onboardingYear;
  if (staff.y2 !== undefined) raw["Y2 (reimburse 1150)"] = staff.y2;
  if (staff.y3 !== undefined) raw["Y3 (reimburse 800)"] = staff.y3;
  if (staff.y4 !== undefined) raw["Y4 (reimburse 400)"] = staff.y4;
  if (staff.renewal !== undefined) raw["Renewal BYOD (May before next SY)"] = staff.renewal;
  
  return raw;
}

/**
 * Fetch all staff records.
 */
export async function fetchStaff(): Promise<Staff[]> {
  const data = await request<RawStaffData[]>(API_BASE_URL);
  return data.map(mapRawToStaff);
}

/**
 * Add a new staff member.
 */
export async function addStaff(data: Omit<Staff, 'id'>): Promise<Staff> {
  const rawData = mapStaffToRaw(data);
  const created = await request<RawStaffData>(API_POST_URL, {
    method: 'POST',
    body: JSON.stringify(rawData),
  });
  return mapRawToStaff(created);
}

/**
 * Update an existing staff member.
 */
export async function updateStaff(
  id: string,
  data: Partial<Staff>
): Promise<Staff> {
  const rawData = mapStaffToRaw(data);
  // Using POST instead of PATCH for N8N webhook compatibility
  // including the action in the body
  const updated = await request<RawStaffData>(`${API_POST_URL}?id=${id}`, {
    method: 'POST',
    body: JSON.stringify({
      ...rawData,
      action: 'update',
    }),
  });
  return mapRawToStaff(updated);
}

/**
 * Delete a staff member.
 */
export async function deleteStaff(id: string): Promise<void> {
  // Using POST instead of DELETE for N8N webhook compatibility
  await request<void>(`${API_POST_URL}?id=${id}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'delete' })
  });
}
