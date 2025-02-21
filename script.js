import { loadPrograms, loadPeriods, periodsData, curriculaMap, isCourseInCurriculum } from './loader.js?v=0.1';
import { initializeDragSelect, removeEventHandlers } from './dragSelect.js?v=0.1';

let courses = [];

async function loadCourses() {
    try {
        const response = await fetch('courses.json'); // Load JSON
        courses = await response.json();
        await loadPrograms(); // Load JSON
        await loadPeriods();
        displayCourses(courses, false); // Display all initially
    } catch (error) {
        console.error("Error loading JSON:", error);
    }
}

function displayCourses(courses, filtersApplied) {
  const container = document.getElementById('courseList');
  container.innerHTML = ''; // Clear previous results

  courses.forEach(course => {
    const courseLink = `https://sisu.aalto.fi/student/courseunit/${course.courseUnitId}/brochure`; // Construct the course brochure URL
    const row = `<tr>
      <td>${course.code}</td>
      <td><a href="${courseLink}" target="_blank">${course.name.en}</a></td>
      <td>${course.teachers.join(", ")}</td>
      <td>${course.credits.min}</td>
      <td>${course.languageOfInstructionCodes.join(", ")}</td>
      <td>${course.startDate}</td>
      <td>${course.endDate}</td>
      <td>${course.enrolmentStartDate}</td>
      <td>${course.enrolmentEndDate}</td>
      <td>${course.summary.prerequisites ? course.summary.prerequisites.en : 'None'}</td>
    </tr>`;

    container.insertAdjacentHTML('beforeend', row);
  });

  // Update the number of filtered courses
  const courseCountDiv = document.getElementById('courseCount');
  if (filtersApplied) {
    courseCountDiv.innerHTML = `Total filtered courses: ${courses.length}`;
  } else {
    courseCountDiv.innerHTML = `Total courses: ${courses.length}`;
  }
}

// Adds a new filter block
function addFilter() {
    const filterContainer = document.getElementById('filterContainer');
    const filterGroup = document.createElement('div');
    filterGroup.classList.add('filter-group');

    // Create select element for fields
    const fieldSelect = createSelect('filter-field', 'handleFieldChange(this)', [
        { value: 'code', text: 'Course Code' },
        { value: 'name', text: 'Course Name' },
        { value: 'period', text: 'Period'},
        { value: 'startDate', text: 'Start Date' },
        { value: 'endDate', text: 'End Date' },
        { value: 'major', text: 'Major' },
        { value: 'minor', text: 'Minor' },
        { value: 'enrollment', text: 'Enrollment' },
        { value: 'teacher', text: 'Teacher' },
        { value: 'language', text: 'Language' },
        { value: 'credits', text: 'Credits' },
        { value: 'level', text: 'Level' }
    ]);

    // Create select element for filter types
    const typeSelect = createSelect('filter-type', '', [
        { value: 'contains', text: 'Contains' },
        { value: 'is', text: 'Is' }
    ]);

    // Create an input field container
    const inputField = document.createElement('div');
    inputField.classList.add('filter-input');
    inputField.innerHTML = `<input type="text" class="filter-value" placeholder="Enter value">`;

    // Append elements to filter group
    filterGroup.innerHTML += `<button onclick="removeFilter(this)"><i class="bi bi-trash"></i></button>`;
    filterContainer.appendChild(filterGroup);
    filterGroup.appendChild(fieldSelect);
    filterGroup.appendChild(typeSelect);
    filterGroup.appendChild(inputField);

    // Call changeInputField to initialize the input and operator dropdown
    changeInputField(fieldSelect, inputField, typeSelect);
}

// Creates a <select> element with options from a provided array of objects
function createSelect(className, onChange, options) {
    const select = document.createElement('select');
    select.classList.add(className);
    if (onChange) select.setAttribute('onchange', onChange); // Set onchange if provided

    select.innerHTML = options.map(option => 
        `<option value="${option.value}">${option.text}</option>`
    ).join('');
    
    return select;
}

// Handles field change event and updates the filter
function handleFieldChange(fieldSelect) {
    const filterGroup = fieldSelect.closest('.filter-group');
    const inputField = filterGroup.querySelector('.filter-input');
    const typeSelect = filterGroup.querySelector('.filter-type');

    changeInputField(fieldSelect, inputField, typeSelect); // Update the input field
}

// Updates the input field with a new element
function updateInputField(inputField, htmlContent) {
    inputField.innerHTML = htmlContent;
}

// Updates the operator dropdown with options
function updateOperatorDropdown(typeSelect, options) {
    typeSelect.innerHTML = options.map(option => 
        `<option value="${option.toLowerCase()}">${option}</option>`
    ).join('');
}

// Populate the curriculum options into the dropdown
function populateCurriculumDropdown(typeSelect, inputField, curriculumType) {
    // Helper function to create and append options
    const createOption = (value, text) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = text;
        typeSelect.appendChild(opt);
    };

    // Clear existing options and populate new ones
    typeSelect.innerHTML = '';
    Object.entries(curriculaMap[curriculumType]).forEach(([code, { name }]) => {
        if (name) createOption(code, name);
    });

    // Sync input field with dropdown selection
    const syncInputWithDropdown = () => {
        const filterValueInput = inputField.querySelector('.filter-value');
        if (!filterValueInput) return;

        // Update input when dropdown changes
        typeSelect.addEventListener('change', () => {
            filterValueInput.value = typeSelect.value;
        });

        // Update dropdown when input changes
        filterValueInput.addEventListener('input', (e) => {
            const value = e.target.value.trim().toUpperCase();
            const isValidCurriculumCode = Object.keys(curriculaMap[curriculumType]).includes(value);

            if (isValidCurriculumCode) {
                typeSelect.value = value;
            } else {
                typeSelect.value = ''; // Reset dropdown selection if invalid
            }
        });
    };

    // Call sync function after DOM updates
    setTimeout(syncInputWithDropdown, 0);
}

// Handles input and operator updates based on selected field
function changeInputField(fieldSelect, inputField, typeSelect) {
    inputField.innerHTML = ''; // Clear existing input
    typeSelect.innerHTML = ''; // Clear existing operator options

    const selectedField = fieldSelect.value;

    const commonOptions = {
        language: {
            inputHTML: `
                <select class="filter-value">
                    <option value="en">English</option>
                    <option value="fi">Finnish</option>
                    <option value="sv">Swedish</option>
                </select>`,
            operators: ['Is']
        },
        credits: {
            inputHTML: `<input type="text" class="filter-value" placeholder="Enter value">`,
            operators: ['Is']
        },
        level: {
            inputHTML: `
                <select class="filter-value">
                    <option value="basic-studies">Basic Studies</option>
                    <option value="intermediate-studies">Intermediate Studies</option>
                    <option value="advanced-studies">Advanced Studies</option>
                    <option value="other-studies">Other Studies</option>
                </select>`,
            operators: ['Is']
        },
        startDate: {
            inputHTML: `<input type="date" class="filter-value" value="${new Date().toISOString().split('T')[0]}">`,
            operators: ['Before', 'After']
        },
        endDate: {
            inputHTML: `<input type="date" class="filter-value" value="${new Date().toISOString().split('T')[0]}">`,
            operators: ['Before', 'After']
        },
        enrollment: {
            inputHTML: `<input type="date" class="filter-value" value="${new Date().toISOString().split('T')[0]}">`,
            operators: ['On', 'Before', 'After']
        },
        major: {
            inputHTML: `<input type="text" class="filter-value" placeholder="Enter value">`,
            operators: [],
            customHandler: () => {
                // removeEventHandlers();
                populateCurriculumDropdown(typeSelect, inputField, 'major');
                const firstOptionValue = typeSelect.options[0].value;
                updateInputField(inputField, 
                    `<input type="text" class="filter-value" placeholder="Enter value" value="${firstOptionValue}">`
                );
            }
        },
        minor: {
            inputHTML: `<input type="text" class="filter-value" placeholder="Enter value">`,
            operators: [],
            customHandler: () => {
                // removeEventHandlers();
                populateCurriculumDropdown(typeSelect, inputField, 'minor');
                const firstOptionValue = typeSelect.options[0].value;
                updateInputField(inputField, 
                    `<input type="text" class="filter-value" placeholder="Enter value" value="${firstOptionValue}">`
                );
            }
        },
        period: {
            inputHTML: `<input type="text" class="filter-value" placeholder="Select period(s)">`,
            operators: ['Fully Contained', 'Strictly Contained', 'Overlaps'],
            customHandler: () => {
                const periodsContainer = document.getElementById('periods-container');
                periodsContainer.style.display = 'flex';

                initializeDragSelect((selectedPeriods) => {
                    // Update the input field with the selected periods
                    const filterValueInput = inputField.querySelector('.filter-value');
                    filterValueInput.value = selectedPeriods.join(', '); // Display as comma-separated values
                    console.log('Updated input with:', selectedPeriods);
                });

            }
        }
    };

    const defaultOptions = {
        inputHTML: `<input type="text" class="filter-value" placeholder="Enter value">`,
        operators: ['Contains', 'Is']
    };

    const fieldConfig = commonOptions[selectedField] || defaultOptions;

    updateInputField(inputField, fieldConfig.inputHTML);
    updateOperatorDropdown(typeSelect, fieldConfig.operators);

    // Call custom handler if available (e.g., for major)
    if (fieldConfig.customHandler) {
        fieldConfig.customHandler();
    } else {
        // removeEventHandlers();
    }
}

function removeFilter(button) {
    button.parentElement.remove();
}

function filterCourses() {
    const filters = document.querySelectorAll('.filter-group');
    const conditionType = document.getElementById('conditionType').value;

    const filterRules = Array.from(filters).map(filter => {
        return {
            field: filter.querySelector('.filter-field').value,
            type: filter.querySelector('.filter-type').value,
            value: filter.querySelector('.filter-value').value.trim()
        };
    });

    let filtered = courses.filter(course => applyFilters(course, filterRules, conditionType));

    const showUnique = document.getElementById("uniqueToggle").checked;
    if (showUnique) {
        filtered = getUniqueCourses(filtered);
    }

    displayCourses(filtered, true);
}

function applyFilters(course, filterRules, conditionType) {
    return filterRules.reduce((acc, rule, index) => {
        const match = applyRule(course, rule);
        return index === 0
            ? match
            : (conditionType === "AND" ? acc && match : acc || match);
        }, conditionType === "AND");
}

function applyRule(course, rule) {
    switch (rule.field) {
        case "code": return rule.type === "contains" ? course.code.toLowerCase().includes(rule.value.toLowerCase()) : course.code.toLowerCase() === rule.value.toLowerCase();
        case "name": return rule.type === "contains" ? course.name.en.toLowerCase().includes(rule.value.toLowerCase()) : course.name.en.toLowerCase() === rule.value.toLowerCase();
        case "teacher": return course.teachers.some(teacher => rule.type === "contains" ? teacher.toLowerCase().includes(rule.value) : teacher.toLowerCase() === rule.value);
        case "language": return course.languageOfInstructionCodes.includes(rule.value);
        case "startDate": return rule.type === "after" ? new Date(course.startDate) > new Date(rule.value) : rule.type === "before" ? new Date(course.startDate) < new Date(rule.value) : course.startDate.includes(rule.value);
        case "endDate": return rule.type === "after" ? new Date(course.endDate) > new Date(rule.value) : rule.type === "before" ? new Date(course.endDate) < new Date(rule.value) : course.endDate.includes(rule.value);
        case "credits": return rule.type === "is" ? course.credits.min === parseInt(rule.value) : course.credits.min >= parseInt(rule.value);
        case "level": return course.summary.level?.en === rule.value;
        case "major": return isCourseInCurriculum(course.code, rule.value, "major") || isCourseInCurriculum(course.code, rule.type, "major");
        case "minor": return isCourseInCurriculum(course.code, rule.value, "minor") || isCourseInCurriculum(course.code, rule.type, "minor");
        case "period": return applyPeriodFilter(course, rule);
        case "enrollment": return rule.type === "after" 
            ? new Date(course.enrolmentStartDate) > new Date(rule.value) 
            : rule.type === "before" 
            ? new Date(course.enrolmentEndDate) < new Date(rule.value) 
            : new Date(course.enrolmentStartDate) <= new Date(rule.value) && new Date(course.enrolmentEndDate) >= new Date(rule.value);
    }
}

// Apply period filter based on the rule value
function applyPeriodFilter(course, rule) {
    // Extract the period names from the rule value (e.g., "Period III 2024-25, Period IV 2024-25, Period V 2024-25")
    const periodNames = rule.value.split(", ");
    
    // Get the period details for each period name
    const periods = periodNames.map(periodName => getPeriodDates(periodName));
    
    if (!periods || periods.length === 0) return false;

    // Extract dates from the selected periods
    const startDates = periods.map(period => new Date(period.start_date));
    const endDates = periods.map(period => new Date(period.end_date));

    // Get the required dates
    const earliestStart = new Date(Math.min(...startDates));
    const latestEnd = new Date(Math.max(...endDates));
    const earliestEnd = new Date(Math.min(...endDates));
    const latestStart = new Date(Math.max(...startDates));
    const courseStart = new Date(course.startDate);
    const courseEnd = new Date(course.endDate);

    switch (rule.type) {
        case "fully contained":
            // Course fully within all periods
            return (earliestStart <= courseStart && courseEnd <= latestEnd);
        case "strictly contained":
            // Course spans the whole described period(s)
            return (earliestStart <= courseStart && courseStart <= earliestEnd
                && latestStart <= courseEnd && courseEnd <= latestEnd);
        case "overlaps":
            // Course overlaps with at least one period
            return (courseStart <= latestEnd && courseEnd >= earliestStart);
        default:
            return false;
    }
}

// Helper function to get the period start and end dates from the period name (e.g., "Period III 2024-25")
function getPeriodDates(periodName) {
    const year = periodName.slice(-7);  // Extract the last 7 characters for the year (e.g., "2024-25")
    const period = periodName.slice(0, -8).trim();  // Extract everything before the last space for the period (e.g., "Period IV")
    
    let periodDates = null;
    
    // Find the period data based on year and period
    const periodData = periodsData.periods
        .find(item => item.year === year)  // Find the correct year object
        ?.periods.find(p => p.period === period);  // Find the matching period within the year

    if (periodData) {
        return { start_date: periodData.start_date, end_date: periodData.end_date };
    }
    return null;  // Return null if no matching period found
}

function getUniqueCourses(courses) {
    const uniqueCoursesMap = new Map();

    courses.forEach(course => {
        const courseCode = course.code.toLowerCase();
        const isTeaching = course.type.includes("teaching");

        if (uniqueCoursesMap.has(courseCode)) {
            const existingCourse = uniqueCoursesMap.get(courseCode);
            const existingIsTeaching = existingCourse.type.includes("teaching");

            // If the existing one is not teaching but the new one is, replace it
            if (!existingIsTeaching && isTeaching) {
                uniqueCoursesMap.set(courseCode, course);
            }
            // If both are teaching, keep the one with the later start date
            else if (isTeaching && course.startDate > existingCourse.startDate) {
                uniqueCoursesMap.set(courseCode, course);
            }
        } else {
            // Add the course if it's not already in the map
            uniqueCoursesMap.set(courseCode, course);
        }
    });
    
    return Array.from(uniqueCoursesMap.values());
}

window.addFilter = addFilter;
window.handleFieldChange = handleFieldChange;
window.removeFilter = removeFilter;
window.filterCourses = filterCourses;
window.onload = loadCourses;
window.getPeriodDates = getPeriodDates;
