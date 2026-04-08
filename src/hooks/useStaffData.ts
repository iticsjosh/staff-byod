import { useState, useEffect, useCallback } from 'react';
import { Staff, staffData as initialStaffData } from '../data';
import {
  fetchStaff as apiFetchStaff,
  addStaff as apiAddStaff,
  updateStaff as apiUpdateStaff,
  deleteStaff as apiDeleteStaff
} from '../services/api';

interface UseStaffDataReturn {
  staffList: Staff[];
  loading: boolean;
  error: string | null;
  addStaff: (data: Omit<Staff, 'id'>) => Promise<void>;
  updateStaff: (id: string, updates: Partial<Staff>) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useStaffData(): UseStaffDataReturn {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetchStaff();
      setStaffList(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch staff data';
      console.warn(
        `API unavailable (${message}). Using fallback static data.`
      );
      setError(message);
      // Fallback to static data so the app remains usable
      // Map static data to include generated IDs if needed
      setStaffList(initialStaffData.map((s, idx) => ({ ...s, id: s.id || String(idx + 1) })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const addStaff = useCallback(
    async (data: Omit<Staff, 'id'>) => {
      try {
        const created = await apiAddStaff(data);
        setStaffList((prev) => [...prev, created]);
      } catch {
        // Optimistic local-only add when API is unavailable
        const localStaff: Staff = {
          ...data,
          id: Date.now().toString(),
        };
        setStaffList((prev) => [...prev, localStaff]);
      }
    },
    []
  );

  const updateStaff = useCallback(
    async (id: string, updates: Partial<Staff>) => {
      try {
        const updated = await apiUpdateStaff(id, updates);
        // Merge API response with local updates so fields like markedAsExit
        // (which the API doesn't return) are preserved
        setStaffList((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...updated, ...updates } : s))
        );
      } catch {
        // Optimistic local-only update when API is unavailable
        setStaffList((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
        );
      }
    },
    []
  );

  const deleteStaff = useCallback(
    async (id: string) => {
      try {
        // Send the full staff record so N8N can identify the row
        const staff = staffList.find((s) => s.id === id);
        await apiDeleteStaff(id, staff ?? undefined);
        setStaffList((prev) => prev.filter((s) => s.id !== id));
      } catch {
        // Optimistic local-only delete when API is unavailable
        setStaffList((prev) => prev.filter((s) => s.id !== id));
      }
    },
    [staffList]
  );

  return {
    staffList,
    loading,
    error,
    addStaff,
    updateStaff,
    deleteStaff,
    refetch: loadStaff,
  };
}
