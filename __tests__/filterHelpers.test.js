import { describe, it, expect, test } from 'vitest'

import {
    applyCodeFilter,
    applyNameFilter,
    applyTeacherFilter,
    applyLanguageFilter,
    applyStartDateFilter,
    applyEndDateFilter,
    applyEnrollmentFilter,
    applyCreditsFilter,
    applyLevelFilter,
    applyCurriculumFilter,
    applyPeriodFilter,
    isCourseInCurriculum
} from '../filterHelpers';

describe('filterHelpers', () => {
    const course = {
        code: 'CS-A1120',
        name: { en: 'Programming 2, Lecture' },
        teachers: ['Johan Lukas Ahrenberg', 'Sanna Helena Suoranta'],
        languageOfInstructionCodes: ['en', 'fi'],
        startDate: '2025-02-24',
        endDate: '2025-05-30',
        enrolmentStartDate: '2025-01-27',
        enrolmentEndDate: '2025-03-03',
        credits: { min: 5 },
        summary: { level: { en: 'Intermediate Studies' } }
    };

    const curriculaMap = {
        major: {
            DSD22: {
                name: "Digital Systems and Design (2022-2024)",
                courses: new Set([
                    "MS-A0111",
                    "MS-A0001",
                    "MS-A0211",
                    "MS-A0503",
                    "ELEC-A7200",
                    "CS-A1110",
                    "ELEC-A7100",
                    "CS-A1140",
                    "ELEC-C9801",
                    "ELEC-C5231",
                    "ELEC-A7151",
                    "SCI-A1010",
                    "LC-1117",
                    "TU-A1300",
                    "CS-C1000",
                    "CS-E4840",
                    "CS-C3180",
                    "CS-E4400",
                    "CS-E4450",
                    "AAN-C2007",
                    "MEC-E1004",
                    "AAN-C2012",
                    "ELEC-E8701",
                    "TU-C2010",
                    "AXM-E0411",
                    "MS-C1001",
                    "ELEC-A7901",
                    "ELEC-A4930",
                    "CS-A1160",
                    "ELEC-A7310",
                    "ELEC-C9610",
                    "ELEC-C7420",
                    "ELEC‐C9600",
                    "ELEC-C9821",
                    "ELEC-C5310",
                    "ELEC‐C8201",
                    "ELEC-C7430",
                    "ELEC-E8001",
                    "ELEC‐C9410",
                    "ELEC‐C0302",
                    "ELEC-C9822",
                    "JOIN.bsc"
                ])
            }
        },
        minor: {
            "CS22 (SCI3031)": {
                name: "Computer Science (2022-2024) (Bachelor)",
                courses: new Set([
                    "CS-A1113",
                    "CS-A1123",
                    "CS-A1143",
                    "CS-A1110",
                    "CS-A1120",
                    "CS-A1140",
                    "CS-C2160",
                    "CS-C3100",
                    "CS-C3120",
                    "CS-C3240",
                    "CS-C3140",
                    "CS-C3170",
                    "CS-C3130",
                    "CS-C3150",
                    "CS-E4580",
                    "ELEC-A7100",
                    "ELEC-A7151"
                ])
            }
        }
    };

    const periodsData = {
        periods: [
            {
                year: '2024-25',
                periods: [
                    {
                        period: 'Period III',
                        start_date: "2025-01-06",
                        end_date: "2025-02-23"
                    },
                    {
                        period: "Period IV",
                        start_date: "2025-02-24",
                        end_date: "2025-04-13"
                    },
                    {
                        period: "Period V",
                        start_date: "2025-04-14",
                        end_date: "2025-06-06"
                    }
                ]
            }
        ]
    };

    describe('applyCodeFilter', () => {
        it('should return true if course code contains the specified value', () => {
            expect(applyCodeFilter(course, { type: 'contains', value: 'CS' })).toBe(true);
        });

        it('should return false if course code does not contain the specified value', () => {
            expect(applyCodeFilter(course, { type: 'contains', value: 'CSC' })).toBe(false);
        });

        it('should be case insensitive when checking if course code contains the specified value', () => {
            expect(applyCodeFilter(course, { type: 'contains', value: 'cs' })).toBe(true);
        });

        it('should return true if course code matches exactly', () => {
            expect(applyCodeFilter(course, { type: 'exact', value: 'CS-A1120' })).toBe(true);
        });

        it('should return false if course code does not match exactly', () => {
            expect(applyCodeFilter(course, { type: 'exact', value: 'CS-A1110' })).toBe(false);
        });

        it('should be case insensitive when checking for exact match', () => {
            expect(applyCodeFilter(course, { type: 'exact', value: 'cs-a1120' })).toBe(true);
        });
    });


    describe('applyNameFilter', () => {
        it('should return true if course name contains the specified value', () => {
            expect(applyNameFilter(course, { type: 'contains', value: 'Prog' })).toBe(true);
        });

        it('should be case insensitive when checking if course name contains the specified value', () => {
            expect(applyNameFilter(course, { type: 'contains', value: 'prog' })).toBe(true);
        });

        it('should return false if course name does not contain the specified value', () => {
            expect(applyNameFilter(course, { type: 'contains', value: 'Computer Programming' })).toBe(false);
        });

        it('should return true if course name matches exactly', () => {
            expect(applyNameFilter(course, { type: 'exact', value: 'Programming 2, Lecture' })).toBe(true);
        });

        it('should be case insensitive when checking for exact name match', () => {
            expect(applyNameFilter(course, { type: 'exact', value: 'programming 2, lecture' })).toBe(true);
        });

        it('should return false if course name does not match exactly', () => {
            expect(applyNameFilter(course, { type: 'exact', value: 'Signals and Systems, Lecture' })).toBe(false);
        });
    });

    describe('applyTeacherFilter', () => {
        it('should return true if teacher name contains the specified value', () => {
            expect(applyTeacherFilter(course, { type: 'contains', value: 'Lukas' })).toBe(true);
        });

        it('should be case insensitive when checking if teacher name contains the specified value', () => {
            expect(applyTeacherFilter(course, { type: 'contains', value: 'lukas' })).toBe(true);
        });

        it('should return true if teacher name matches exactly', () => {
            expect(applyTeacherFilter(course, { type: 'exact', value: 'Johan Lukas Ahrenberg' })).toBe(true);
        });

        it('should be case insensitive when checking for exact teacher name match', () => {
            expect(applyTeacherFilter(course, { type: 'exact', value: 'johan lukas ahrenberg' })).toBe(true);
        });

        it('should return false if teacher name does not match exactly', () => {
            expect(applyTeacherFilter(course, { type: 'exact', value: 'Stephan' })).toBe(false);
        });
    });

    describe('applyLanguageFilter', () => {
        it('should return true if course language code matches the specified value', () => {
            expect(applyLanguageFilter(course, { value: 'en' })).toBe(true);
        });

        it('should return false if course language code does not match the specified value', () => {
            expect(applyLanguageFilter(course, { value: 'sv' })).toBe(false);
        });
    });

    describe('applyStartDateFilter', () => {
        it('should return true if course start date is after the specified date', () => {
            expect(applyStartDateFilter(course, { type: 'after', value: '2025-01-01' })).toBe(true);
        });

        it('should return false if course start date is before the specified date', () => {
            expect(applyStartDateFilter(course, { type: 'before', value: '2025-01-01' })).toBe(false);
        });
    });

    describe('applyEndDateFilter', () => {
        it('should return true if course end date is before the specified date', () => {
            expect(applyEndDateFilter(course, { type: 'before', value: '2025-06-01' })).toBe(true);
        });

        it('should return false if course end date is after the specified date', () => {
            expect(applyEndDateFilter(course, { type: 'after', value: '2025-06-01' })).toBe(false);
        });
    });

    describe('applyEnrollmentFilter', () => {
        it('should return true if enrollment start date is after the specified date', () => {
            expect(applyEnrollmentFilter(course, { type: 'after', value: '2025-01-25' })).toBe(true);
        });

        it('should return false if enrollment start date is after the specified date', () => {
            expect(applyEnrollmentFilter(course, { type: 'after', value: '2025-05-01' })).toBe(false);
        });

        it('should return true if enrollment end date is before the specified date', () => {
            expect(applyEnrollmentFilter(course, { type: 'before', value: '2025-03-05' })).toBe(true);
        });

        it('should return false if enrollment end date is before the specified date', () => {
            expect(applyEnrollmentFilter(course, { type: 'before', value: '2025-01-01' })).toBe(false);
        });

        it('should return true if the specified date is within the enrollment period', () => {
            expect(applyEnrollmentFilter(course, { type: 'on', value: '2025-02-10' })).toBe(true);
        });

        it('should return false if the specified date is outside the enrollment period', () => {
            expect(applyEnrollmentFilter(course, { type: 'on', value: '2025-03-10' })).toBe(false);
        });
    });

    describe('applyCreditsFilter', () => {
        it('should return true for matching credits', () => {
            expect(applyCreditsFilter(course, { type: 'is', value: '5' })).toBe(true);
        });

        it('should return false for non-matching credits', () => {
            expect(applyCreditsFilter(course, { type: 'is', value: '6' })).toBe(false);
        });
    });

    describe('applyLevelFilter', () => {
        it('should return true for matching level', () => {
            expect(applyLevelFilter(course, { value: 'Intermediate Studies' })).toBe(true);
        });

        it('should return false for non-matching level', () => {
            expect(applyLevelFilter(course, { value: 'Basic Studies' })).toBe(false);
        });
    });

    describe('applyCurriculumFilter', () => {
        it('should return false for non-matching major curriculum', () => {
            expect(applyCurriculumFilter(course, { type: "DSD22", value: "DSD25" }, 'major', curriculaMap)).toBe(false);
        });

        it('should return true for matching minor curriculum', () => {
            expect(applyCurriculumFilter(course, { type: "CS22 (SCI3031)", value: "CS" }, 'minor', curriculaMap)).toBe(true);
        });

        it('should return false for unknown curriculum', () => {
            expect(applyCurriculumFilter(course, { type: "ABC", value: "ABC" }, 'degree', curriculaMap)).toBe(false);
        });
    });

    describe('applyPeriodFilter', () => {
        it('should return true when period is in the specified range', () => {
            const rule = { type: 'is in', value: 'Period III 2024-25, Period IV 2024-25, Period V 2024-25' };
            expect(applyPeriodFilter(course, rule, periodsData)).toBe(true);
        });

        it('should return false when period is not in the specified range', () => {
            const rule = { type: 'is in', value: 'Period IV 2024-25' };
            expect(applyPeriodFilter(course, rule, periodsData)).toBe(false);
        });

        it('should return true for exact period match', () => {
            const rule = { type: 'equals', value: 'Period IV 2024-25, Period V 2024-25' };
            expect(applyPeriodFilter(course, rule, periodsData)).toBe(true);
        });

        it('should return false for unequal period match', () => {
            const rule = { type: 'equals', value: 'Period III 2024-25, Period IV 2024-25, Period V 2024-25' };
            expect(applyPeriodFilter(course, rule, periodsData)).toBe(false);
        });

        it('should return true when period overlaps', () => {
            const rule = { type: 'overlaps', value: 'Period IV 2024-25' };
            expect(applyPeriodFilter(course, rule, periodsData)).toBe(true);
        });

        it('should return false when period does not overlap', () => {
            const rule = { type: 'overlaps', value: 'Period III 2024-25' };
            expect(applyPeriodFilter(course, rule, periodsData)).toBe(false);
        });

        it('should return false for undefined period', () => {
            const rule = { type: 'overlaps', value: 'Period VI 2024-25' };
            expect(applyPeriodFilter(course, rule, periodsData)).toBe(false);
        });

        it('should return false for unsupported period type', () => {
            const rule = { type: 'outside', value: 'Period V 2024-25' };
            expect(applyPeriodFilter(course, rule, periodsData)).toBe(false);
        });
    });
});