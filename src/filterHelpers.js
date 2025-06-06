function applyRelation(value1, value2, relation) {
    // Normalize values for comparison (e.g., case-insensitivity)
    const normalizedValue1 = typeof value1 === "string" ? value1.toLowerCase() : value1;
    const normalizedValue2 = typeof value2 === "string" ? value2.toLowerCase() : value2;

    switch (relation) {
        case "contains":
            return normalizedValue1.includes(normalizedValue2);
        case "is":
            return normalizedValue1 === normalizedValue2;
        default:
            return false;
    }
}

// Helper function for the 'code' field filter
export function applyCodeFilter(course, rule) {
    return applyRelation(course.code, rule.value, rule.relation);
}

// Helper function for the 'name' field filter
export function applyNameFilter(course, rule) {
    return applyRelation(course.name.en, rule.value, rule.relation);
}

// Helper function for the 'teacher' field filter
export function applyTeacherFilter(course, rule) {
    return course.teachers.some(teacher =>
        applyRelation(teacher, rule.value, rule.relation)
    );
}

// Helper function for the 'language' field filter
export function applyLanguageFilter(course, rule) {
    return course.languageOfInstructionCodes.includes(rule.value);
}

// Helper function for the 'startDate' field filter
export function applyStartDateFilter(course, rule) {
    const courseStart = new Date(course.startDate);
    if (rule.relation === "after") {
        return courseStart > new Date(rule.value);
    }
    return courseStart < new Date(rule.value);
}

// Helper function for the 'endDate' field filter
export function applyEndDateFilter(course, rule) {
    const courseEnd = new Date(course.endDate);
    if (rule.relation === "after") {
        return courseEnd > new Date(rule.value);
    }
    return courseEnd < new Date(rule.value);
}

// Helper function for the 'enrollment' field filter
export function applyEnrollmentFilter(course, rule) {
    const startDate = new Date(course.enrolmentStartDate);
    const endDate = new Date(course.enrolmentEndDate);
    const currDate = new Date(rule.value);
    if (rule.relation === "after") {
        return startDate > currDate;
    } else if (rule.relation === "before") {
        return endDate < currDate;
    }
    return startDate <= currDate && endDate >= currDate;
}

// Helper function for the 'credits' field filter
export function applyCreditsFilter(course, rule) {
    return course.credits.min === parseInt(rule.value);
}

// Helper function for the 'level' field filter
export function applyLevelFilter(course, rule) {
    return course.summary.level?.en === rule.value;
}

// Helper function for 'organization' field filter
export function applyOrganizationFilter(course, rule) {
    return course.organizationName.en === rule.value;
}

// Helper function for 'major' or 'minor' field filter
export function applyCurriculumFilter(course, rule, curriculumType, curriculaMap) {
    return isCourseInCurriculum(course.code, rule.value, curriculumType, curriculaMap)
        || isCourseInCurriculum(course.code, rule.relation, curriculumType, curriculaMap);
}

// Helper function for the 'period' field filter
export function applyPeriodFilter(course, rule, periodsData) {
    const periodNames = rule.value.split(", ");
    const periods = periodNames.map(periodName => getPeriodDates(periodName, periodsData));

    if (!periods || periods.length === 0 || periods.every(item => item === null))
        return false;

    const startDates = periods.map(period => new Date(period.start_date));
    const endDates = periods.map(period => new Date(period.end_date));

    const earliestStart = new Date(Math.min(...startDates));
    const latestEnd = new Date(Math.max(...endDates));
    const earliestEnd = new Date(Math.min(...endDates));
    const latestStart = new Date(Math.max(...startDates));
    const courseStart = new Date(course.startDate);
    const courseEnd = new Date(course.endDate);

    switch (rule.relation) {
        case "is in":
            return (earliestStart <= courseStart && courseEnd <= latestEnd);
        case "equals":
            return (earliestStart <= courseStart && courseStart <= earliestEnd
                && latestStart <= courseEnd && courseEnd <= latestEnd);
        case "overlaps":
            return (courseStart <= latestEnd && courseEnd >= earliestStart);
        default:
            return false;
    }
}

// Helper function to get the period start and end dates from the period name (e.g., "Period III 2024-25")
function getPeriodDates(periodName, periodsData) {
    const year = periodName.slice(-7);  // Extract the last 7 characters for the year (e.g., "2024-25")
    const period = periodName.slice(0, -8).trim();  // Extract everything before the last space for the period (e.g., "Period IV")
    
    let periodData = null;
    
    // Find the period data based on year and period
    periodData = periodsData.periods
        .find(item => item.year === year)  // Find the correct year object
        ?.periods.find(p => p.period === period);  // Find the matching period within the year

    if (periodData) {
        return {
            start_date: periodData.start_date,
            end_date: periodData.end_date
        };
    }

    // Return a default value if not found
    return null;
}

// Boolean check if a course is in a given program type (major or minor)
export function isCourseInCurriculum(course, programCode, type, curriculaMap) {
    if (type !== 'major' && type !== 'minor') {
        return false;
    }
    return curriculaMap[type][programCode]?.courses.has(course) || false;
}
