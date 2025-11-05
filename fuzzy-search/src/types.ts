// types.ts
export interface LocalizedText {
  fi: string;
  sv: string;
  en: string;
}

export interface StudySubGroup {
  id: string;
  name: LocalizedText;
  type: LocalizedText;
}

export interface Course {
  id: string;
  code: string;
  startDate: string;
  endDate: string;
  type: string;
  name: LocalizedText;
  summary: {
    workload?: LocalizedText;
    prerequisites?: LocalizedText;
    learningOutcomes?: LocalizedText;
    languageOfInstruction?: LocalizedText;
    content?: LocalizedText;
  };
  organizationName: LocalizedText;
  credits?: {
    min: number;
    max: number;
  };
  courseUnitId: string;
  languageOfInstructionCodes: string[];
  teachers: string[];
  studySubGroups: StudySubGroup[];
}
