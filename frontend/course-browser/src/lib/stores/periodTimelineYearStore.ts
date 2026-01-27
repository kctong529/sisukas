// src/lib/stores/periodTimelineYearStore.ts
import { writable } from "svelte/store";

export const periodTimelineYearStore = writable<string | null>(null);
