// src/domain/models/Plan.ts

/**
 * A saved plan containing course offering IDs in instanceIds.
 * The legacy property name is retained for persisted API compatibility.
 */
export interface Plan {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  instanceIds: string[];
  createdAt: Date;
  updatedAt: Date;
}