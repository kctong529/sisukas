// src/lib/stores/academicPeriodStore.ts
import { writable } from 'svelte/store';
import type { AcademicPeriod } from '../../domain/models/AcademicPeriod';

function createAcademicPeriodStore() {
  const { subscribe, set } = writable<AcademicPeriod[] | null>(null);

  return {
    subscribe,
    setPeriods: (periods: AcademicPeriod[]) => set(periods)
  };
}

export const academicPeriodStore = createAcademicPeriodStore();
