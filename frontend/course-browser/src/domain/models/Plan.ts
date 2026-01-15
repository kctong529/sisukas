// src/domain/models/Plan.ts

export interface Plan {
  planId: string;
  name: string;
  description?: string;
  instanceIds: string[];
  createdAt: Date;
  updatedAt: Date;
}