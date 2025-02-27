import { loadPrograms, loadPeriods, periodsData, curriculaMap } from './yamlCache.js?v=0.5';
import { initializeDragSelect, removeEventHandlers } from './dragSelect.js?v=0.5';
import { createSelect } from './domUtils.js?v=0.5';
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
    applyPeriodFilter,
    applyCurriculumFilter,
    applyOrganizationFilter
} from './filterHelpers.js?v=0.5';

let courses = [];
let organizationNames = new Set();

async function loadCourses() {
    try {
        const response = await fetch('data/courses.json'); // Load JSON
        courses = await response.json();
        organizationNames = new Set(
          courses
            .map(course => course.organizationName.en)
            .filter(name => name) // Filter out empty or undefined names
        );

        await loadPrograms(); // Load JSON
        await loadPeriods();
        displayCourses(courses, false); // Display all initially
    } catch (error) {
        console.error("Error loading JSON:", error);
    }
}

function displayCourses(courses, filtersApplied) {
  const container = document.getElementById('course-list');
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
  const courseCountDiv = document.getElementById('course-count');
  if (filtersApplied) {
    courseCountDiv.innerHTML = `Total filtered courses: ${courses.length}`;
  } else {
    courseCountDiv.innerHTML = `Total courses: ${courses.length}`;
  }
}

// Adds a new filter block
function addFilter() {
    const filterContainer = document.getElementById('filter-container');
    const filterGroup = document.createElement('div');
    filterGroup.classList.add('filter-group');

    // Add AND/OR selector only if it's not the first rule
    if (filterContainer.children.length > 0) {
        const operatorSelect = createSelect('filter-boolean', '', [
            { value: 'AND', text: 'AND' },
            { value: 'OR', text: 'OR' }
        ]);
        filterGroup.appendChild(operatorSelect);
    }

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
        { value: 'organization', text: 'Organization' },
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
    filterContainer.appendChild(filterGroup);
    filterGroup.appendChild(fieldSelect);
    filterGroup.appendChild(typeSelect);
    filterGroup.appendChild(inputField);
    filterGroup.innerHTML += `<button onclick="removeFilter(this)"><i class="bi bi-trash"></i></button>`;

    // Call changeInputField to initialize the input and operator dropdown
    changeInputField(fieldSelect, inputField, typeSelect);
}

// Handles field change event and updates the filter
function handleFieldChange(fieldSelect) {
    const filterGroup = fieldSelect.closest('.filter-group');
    const inputField = filterGroup.querySelector('.filter-input');
    const typeSelect = filterGroup.querySelector('.filter-type');
    const periodsContainer = document.getElementById('periods-container');

    // Check previous selection
    const lastSelectedField = fieldSelect.dataset.lastSelectedField;

    if (fieldSelect.value === 'period') {
        removeEventHandlers();
    }
    
    // If the previous selection was 'period' and the new one is different, hide the container
    if (lastSelectedField === 'period' && fieldSelect.value !== 'period') {
        periodsContainer.style.display = 'none';
    }

    // Store the current selection for future comparison
    fieldSelect.dataset.lastSelectedField = fieldSelect.value;

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

// Populate the organization options into the dropdown
function populateOrganizationDropdown(typeSelect, inputField) {
    // Helper function to create and append options
    const createOption = (value, text) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = text;
        typeSelect.appendChild(opt);
    };

    // Clear existing options and populate new ones
    typeSelect.innerHTML = '';
    organizationNames.forEach(name => {
        if (name) createOption(name, name);
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
            const value = e.target.value.trim();
            const isValidOrganization = organizationNames.includes(value);

            if (isValidOrganization) {
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
            operators: ['After', 'Before']
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
                populateCurriculumDropdown(typeSelect, inputField, 'minor');
                const firstOptionValue = typeSelect.options[0].value;
                updateInputField(inputField, 
                    `<input type="text" class="filter-value" placeholder="Enter value" value="${firstOptionValue}">`
                );
            }
        },
        period: {
            inputHTML: `<input type="text" class="filter-value" placeholder="Select period(s)">`,
            operators: ['Is In', 'Equals', 'Overlaps'],
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
        },
        organization: {
            inputHTML: `<input type="text" class="filter-value" placeholder="Enter value">`,
            operators: [],
            customHandler: () => {
                populateOrganizationDropdown(typeSelect, inputField);
                const firstOptionValue = typeSelect.options[0].value;
                updateInputField(inputField, 
                    `<input type="text" class="filter-value" placeholder="Enter value" value="${firstOptionValue}">`
                );
            }
        },
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
    }
}

function removeFilter(button) {
    const filterGroup = button.closest('.filter-group');
    filterGroup.remove();

    // Check if any remaining filters are using 'period'
    const fieldSelects = document.querySelectorAll('.filter-field');
    const periodsContainer = document.getElementById('periods-container');

    const isPeriodUsed = Array.from(fieldSelects).some(select => select.value === 'period');

    if (!isPeriodUsed) {
        periodsContainer.style.display = 'none';
    }
}

function filterCourses() {
    const filters = document.querySelectorAll('.filter-group');
    const showUnique = document.getElementById("uniqueToggle").checked;

    // Group filters by OR
    const filterGroups = [];
    let currentGroup = [];

    filters.forEach(filter => {
        const field = filter.querySelector('.filter-field').value;
        const type = filter.querySelector('.filter-type').value;
        const value = filter.querySelector('.filter-value').value.trim();
        
        if (!value) {
          console.warn(`Empty value for field: ${field}`);
          return;  // Skip empty filters
        }
        
        const rule = { field, type, value };

        const booleanOperator = filter.querySelector('.filter-boolean')?.value;
        if (booleanOperator === 'AND') {
            currentGroup.push(rule);
        } else {
            // Push current group and start a new one
            if (currentGroup.length > 0) {
                filterGroups.push(currentGroup);
            }
            currentGroup = [rule];
        }
        console.log("Current group: ");
        console.log(currentGroup);
        console.log("Filter groups: ");
        console.log(filterGroups);
    });

    // Push the last group
    if (currentGroup.length > 0) {
        filterGroups.push(currentGroup);
    }

    // Collect union of all filter group results
    const allResults = new Set();
    filterGroups.forEach(group => {
        const groupFiltered = courses.filter(course => applyFilters(course, group));
        groupFiltered.forEach(course => allResults.add(course));
    });

    let filtered = Array.from(allResults);

    if (showUnique) {
        filtered = getUniqueCourses(filtered);
    }

    displayCourses(filtered, true);
}

function applyFilters(course, filterRules) {
    return filterRules.every(rule => applyRule(course, rule));
}

function applyRule(course, rule) {
    switch (rule.field) {
        case "code": return applyCodeFilter(course, rule);
        case "name": return applyNameFilter(course, rule);
        case "teacher": return applyTeacherFilter(course, rule);
        case "language": return applyLanguageFilter(course, rule);
        case "startDate": return applyStartDateFilter(course, rule);
        case "endDate": return applyStartDateFilter(course, rule);
        case "enrollment": return applyEnrollmentFilter(course, rule);
        case "credits": return applyCreditsFilter(course, rule);
        case "level": return applyLevelFilter(course, rule);
        case "period": return applyPeriodFilter(course, rule, periodsData);
        case "major": return applyCurriculumFilter(course, rule, "major", curriculaMap);
        case "minor": return applyCurriculumFilter(course, rule, "minor", curriculaMap);
        case "organization": return applyOrganizationFilter(course, rule);
    }
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
