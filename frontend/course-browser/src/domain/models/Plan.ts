// src/domain/models/Plan.ts

export interface Plan {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  instanceIds: string[];
  createdAt: Date;
  updatedAt: Date;
}