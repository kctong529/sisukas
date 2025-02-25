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
        it('should match course code (contains)', () => {
            expect(applyCodeFilter(course, { type: 'contains', value: 'CS' })).toBe(true);
        });

        it('should not match course code (contains)', () => {
            expect(applyCodeFilter(course, { type: 'contains', value: 'CSC' })).toBe(false);
        });

        it('should match course code (exact)', () => {
            expect(applyCodeFilter(course, { type: 'exact', value: 'CS-A1120' })).toBe(true);
        });

        it('should not match incorrect course code', () => {
            expect(applyCodeFilter(course, { type: 'exact', value: 'CS-A1110' })).toBe(false);
        });
    });

    describe('applyNameFilter', () => {
        it('should match course name (contains)', () => {
            expect(applyNameFilter(course, { type: 'contains', value: 'Prog' })).toBe(true);
        });

        it('should not match course name (contains)', () => {
            expect(applyNameFilter(course, { type: 'contains', value: 'Computer Programming' })).toBe(false);
        });

        it('should match course name (exact)', () => {
            expect(applyNameFilter(course, { type: 'exact', value: 'Programming 2, Lecture' })).toBe(true);
        });

        it('should not match incorrect course name', () => {
            expect(applyNameFilter(course, { type: 'exact', value: 'Signals and Systems, Lecture' })).toBe(false);
        });
    });

    describe('applyTeacherFilter', () => {
        it('should match teacher name (contains)', () => {
            expect(applyTeacherFilter(course, { type: 'contains', value: 'Lukas' })).toBe(true);
        });

        it('should match teacher name (exact)', () => {
            expect(applyTeacherFilter(course, { type: 'exact', value: 'Johan Lukas Ahrenberg' })).toBe(true);
        });

        it('should not match incorrect teacher name', () => {
            expect(applyTeacherFilter(course, { type: 'exact', value: 'Stephan' })).toBe(false);
        });
    });

    describe('applyLanguageFilter', () => {
        it('should match language code', () => {
            expect(applyLanguageFilter(course, { value: 'en' })).toBe(true);
        });

        it('should not match incorrect language code', () => {
            expect(applyLanguageFilter(course, { value: 'sv' })).toBe(false);
        });
    });

    describe('applyStartDateFilter', () => {
        it('should match start date after', () => {
            expect(applyStartDateFilter(course, { type: 'after', value: '2025-01-01' })).toBe(true);
        });

        it('should not match start date before', () => {
            expect(applyStartDateFilter(course, { type: 'before', value: '2025-01-01' })).toBe(false);
        });
    });

    describe('applyEndDateFilter', () => {
        it('should match end date before', () => {
            expect(applyEndDateFilter(course, { type: 'before', value: '2025-06-01' })).toBe(true);
        });

        it('should not match end date after', () => {
            expect(applyEndDateFilter(course, { type: 'after', value: '2025-06-01' })).toBe(false);
        });
    });

    describe('applyEnrollmentFilter', () => {
        it('should match enrollment after', () => {
            expect(applyEnrollmentFilter(course, { type: 'after', value: '2025-01-25' })).toBe(true);
        });

        it('should not match enrollment after', () => {
            expect(applyEnrollmentFilter(course, { type: 'after', value: '2025-05-01' })).toBe(false);
        });

        it('should match enrollment before', () => {
            expect(applyEnrollmentFilter(course, { type: 'before', value: '2025-03-05' })).toBe(true);
        });

        it('should not match enrollment before', () => {
            expect(applyEnrollmentFilter(course, { type: 'before', value: '2025-01-01' })).toBe(false);
        });

        it('should match enrollment on', () => {
            expect(applyEnrollmentFilter(course, { type: 'on', value: '2025-02-10' })).toBe(true);
        });

        it('should not match enrollment outside range', () => {
            expect(applyEnrollmentFilter(course, { type: 'on', value: '2025-03-10' })).toBe(false);
        });
    });

    describe('applyCreditsFilter', () => {
        it('should match exact credits', () => {
            expect(applyCreditsFilter(course, { type: 'is', value: '5' })).toBe(true);
        });

        it('should not match different credits', () => {
            expect(applyCreditsFilter(course, { type: 'is', value: '6' })).toBe(false);
        });
    });

    describe('applyLevelFilter', () => {
        it('should match level', () => {
            expect(applyLevelFilter(course, { value: 'Intermediate Studies' })).toBe(true);
        });

        it('should not match incorrect level', () => {
            expect(applyLevelFilter(course, { value: 'Basic Studies' })).toBe(false);
        });
    });

    describe('applyCurriculumFilter', () => {
        it('should not match major course', () => {
            expect(applyCurriculumFilter(course, { type: "DSD22", value: "DSD25" }, 'major', curriculaMap)).toBe(false);
        });

        it('should match minor course', () => {
            expect(applyCurriculumFilter(course, { type: "CS22 (SCI3031)", value: "CS" }, 'minor', curriculaMap)).toBe(true);
        });

        it('should not match an unknown curriculum', () => {
            expect(applyCurriculumFilter(course, { type: "ABC", value: "ABC" }, 'degree', curriculaMap)).toBe(false);
        });
    });

    describe('applyPeriodFilter', () => {
        it('should match period is in', () => {
            const rule = { type: 'is in', value: 'Period III 2024-25, Period IV 2024-25, Period V 2024-25' };
            expect(applyPeriodFilter(course, rule, periodsData)).toBe(true);
        });

        it('should not match too narrow periods', () => {
            const rule = { type: 'is in', value: 'Period IV 2024-25' };
            expect(applyPeriodFilter(course, rule, periodsData)).toBe(false);
        });

        it('should match period equals', () => {
            const rule = { type: 'equals', value: 'Period IV 2024-25, Period V 2024-25' };
            expect(applyPeriodFilter(course, rule, periodsData)).toBe(true);
        });

        it('should not match unequal periods', () => {
            const rule = { type: 'equals', value: 'Period III 2024-25, Period IV 2024-25, Period V 2024-25' };
            expect(applyPeriodFilter(course, rule, periodsData)).toBe(false);
        });

        it('should match period overlaps', () => {
            const rule = { type: 'overlaps', value: 'Period IV 2024-25' };
            expect(applyPeriodFilter(course, rule, periodsData)).toBe(true);
        });

        it('should not match period without overlaps', () => {
            const rule = { type: 'overlaps', value: 'Period III 2024-25' };
            expect(applyPeriodFilter(course, rule, periodsData)).toBe(false);
        });

        it('should not match undefined period', () => {
            const rule = { type: 'overlaps', value: 'Period VI 2024-25' };
            expect(applyPeriodFilter(course, rule, periodsData)).toBe(false);
        });

        it('should not match period with undefined type', () => {
            const rule = { type: 'outside', value: 'Period V 2024-25' };
            expect(applyPeriodFilter(course, rule, periodsData)).toBe(false);
        });
    });
});