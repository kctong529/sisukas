// src/domain/models/Block.ts

/**
 * Groups of alternative study groups for a course offering.
 * courseInstanceId is the existing stored name for courseOfferingId;
 * block membership is not an explicit calendar attendance selection.
 */
export interface Block {
  id: string;
  courseInstanceId: string;
  label: string;
  studyGroupIds: string[];
  order: number;
  colorIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents scheduling alternatives for a course offering.
 * A scheduling choice does not establish attendance or registration.
 */
export type BlockPartition = Block[];