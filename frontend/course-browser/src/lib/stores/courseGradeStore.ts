// src/lib/stores/courseGradeStore.ts
import { writable } from "svelte/store";

export type CourseGradeMap = Map<string, number>;

export const courseGradeStore = writable<CourseGradeMap>(new Map());
