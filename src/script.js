import { loadPrograms, loadPeriods, periodsData, curriculaMap } from './yamlCache.js';
import { initializeDragSelect, removeEventHandlers } from './dragSelect.js';
import { createSelect, populateSelect } from './domUtils.js';
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
} from './filterHelpers.js';

import { FILTER_FIELDS, INPUT_HTMLS } from './constant.js';

let courses = [];
let organizationNames = new Set();

async function loadCourses() {
    try {
        courses = await loadCourseData();
        organizationNames = extractOrganizationNames(courses);
        await loadAdditionalData();
        displayCourses(courses);
    } catch (error) {
        console.error("Error loading JSON:", error);
    }
}

async function loadCourseData() {
    const response = await fetch('data/courses.json');
    return response.json();
}

export function extractOrganizationNames(courses) {
    return new Set(courses.map(course => course.organizationName.en).filter(name => name));
}

async function loadAdditionalData() {
    await loadPrograms();
    await loadPeriods();
}

function displayCourses(courses, filtersApplied=false) {
    const container = document.getElementById('course-list');
    container.innerHTML = ''; // Clear previous results

    courses.forEach(course => {
        container.insertAdjacentHTML('beforeend', createCourseRow(course));
    });
    updateCourseCount(courses, filtersApplied);
}

function createCourseRow(course) {
    const courseLink = `https://sisu.aalto.fi/student/courseunit/${course.courseUnitId}/brochure`;
    return `<tr>
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
}

function updateCourseCount(courses, filtersApplied) {
    const courseCountDiv = document.getElementById('course-count');
    courseCountDiv.innerHTML = `Total ${filtersApplied ? 'filtered' : ''} courses: ${courses.length}`;
}

// Helper function to create and return filter rule element
function createFilterRule(booleanSelect, fieldSelect, relationSelect, inputField) {
    const filterRule = document.createElement('div');
    filterRule.classList.add('filter-rule');

    // Append AND/OR selector if it's not the first rule
    if (booleanSelect) {
        filterRule.appendChild(booleanSelect);
    }

    // Append the rest of the filter elements
    filterRule.appendChild(fieldSelect);
    filterRule.appendChild(relationSelect);
    filterRule.appendChild(inputField);

    // Add delete button to the filter rule
    filterRule.innerHTML += `<button onclick="removeFilterRule(this)"><i class="bi bi-trash"></i></button>`;

    return filterRule;
}

// Adds a new filter rule
function addFilterRule() {
    const filterContainer = document.getElementById('filter-container');
    const booleanSelect = filterContainer.children.length > 0 ? createBooleanSelect() : null;
    const fieldSelect = createFieldSelect();
    const relationSelect = createRelationSelect();
    const inputField = createInputField();

    const filterRule = createFilterRule(booleanSelect, fieldSelect, relationSelect, inputField);
    filterContainer.appendChild(filterRule);

    // Initialize the input and operator dropdown
    changeInputField(fieldSelect, inputField, relationSelect);
}

function createBooleanSelect() {
    return createSelect('filter-boolean', '', [
        { value: 'AND', text: 'AND' },
        { value: 'OR', text: 'OR' }
    ]);
}

function createFieldSelect() {
    return createSelect('filter-field', 'handleFieldChange(this)', FILTER_FIELDS);
}

function createRelationSelect() {
    return createSelect('filter-relation', '', [
        { value: 'contains', text: 'Contains' },
        { value: 'is', text: 'Is' }
    ]);
}

function createInputField() {
    const inputField = document.createElement('div');
    inputField.classList.add('filter-input');
    inputField.innerHTML = INPUT_HTMLS.input;
    return inputField;
}

// Handles field change event and updates the filter
function handleFieldChange(fieldSelect) {
    const filterRule = fieldSelect.closest('.filter-rule');
    const inputField = filterRule.querySelector('.filter-input');
    const relationSelect = filterRule.querySelector('.filter-relation');
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

    changeInputField(fieldSelect, inputField, relationSelect); // Update the input field
}

// Updates the input field with a new element
function updateInputField(inputField, htmlContent) {
    inputField.innerHTML = htmlContent;
}

// Updates the operator dropdown with options
function updateOperatorDropdown(relationSelect, options) {
    relationSelect.innerHTML = options.map(option => 
        `<option value="${option.toLowerCase()}">${option}</option>`
    ).join('');
}

// Populate the curriculum options into the dropdown
function populateCurriculumDropdown(relationSelect, inputField, curriculumType) {
    // Map the curriculum data into an array of option objects
    const options = Object.entries(curriculaMap[curriculumType]).map(([code, { name }]) => {
        return { value: code, text: name };
    });

    populateSelect(relationSelect, options);

    // Sync input field with dropdown selection
    const syncInputWithDropdown = () => {
        const filterValueInput = inputField.querySelector('.filter-value');
        if (!filterValueInput) return;

        // Update input when dropdown changes
        relationSelect.addEventListener('change', () => {
            filterValueInput.value = relationSelect.value;
        });

        // Update dropdown when input changes
        filterValueInput.addEventListener('input', (e) => {
            const value = e.target.value.trim().toUpperCase();
            const isValidCurriculumCode = Object.keys(curriculaMap[curriculumType]).includes(value);

            if (isValidCurriculumCode) {
                relationSelect.value = value;
            } else {
                relationSelect.value = ''; // Reset dropdown selection if invalid
            }
        });
    };

    // Call sync function after DOM updates
    setTimeout(syncInputWithDropdown, 0);
}

// Populate the organization options into the dropdown
function populateOrganizationDropdown(inputField) {
    // Map the organization names into an array of option objects
    const options = Array.from(organizationNames).sort().map(name => {
        return { value: name, text: name };
    });

    // Populate the select element with the options
    const filterValueInput = inputField.querySelector('.filter-value');
    populateSelect(filterValueInput, options);
}

// Handles input and operator updates based on selected field
function changeInputField(fieldSelect, inputField, relationSelect) {
    inputField.innerHTML = ''; // Clear existing input
    relationSelect.innerHTML = ''; // Clear existing operator options

    const selectedField = fieldSelect.value;

    const commonOptions = {
        language: {
            inputHTML: INPUT_HTMLS.language,
            operators: ['Is']
        },
        credits: {
            inputHTML: INPUT_HTMLS.input,
            operators: ['Is']
        },
        level: {
            inputHTML: INPUT_HTMLS.level,
            operators: ['Is']
        },
        startDate: {
            inputHTML: INPUT_HTMLS.date,
            operators: ['After', 'Before']
        },
        endDate: {
            inputHTML: INPUT_HTMLS.date,
            operators: ['Before', 'After']
        },
        enrollment: {
            inputHTML: INPUT_HTMLS.date,
            operators: ['On', 'Before', 'After']
        },
        major: {
            inputHTML: INPUT_HTMLS.input,
            operators: [],
            customHandler: () => {
                populateCurriculumDropdown(relationSelect, inputField, 'major');
                const firstOptionValue = relationSelect.options[0].value;
                updateInputField(inputField, 
                    `<input type="text" class="filter-value" placeholder="Enter value" value="${firstOptionValue}">`
                );
            }
        },
        minor: {
            inputHTML: INPUT_HTMLS.input,
            operators: [],
            customHandler: () => {
                populateCurriculumDropdown(relationSelect, inputField, 'minor');
                const firstOptionValue = relationSelect.options[0].value;
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
            inputHTML: `<select class="filter-value"></select>`,
            operators: ['Is'],
            customHandler: () => {
                populateOrganizationDropdown(inputField);
            }
        },
    };

    const defaultOptions = {
        inputHTML: `<input type="text" class="filter-value" placeholder="Enter value">`,
        operators: ['Contains', 'Is']
    };

    const fieldConfig = commonOptions[selectedField] || defaultOptions;

    updateInputField(inputField, fieldConfig.inputHTML);
    updateOperatorDropdown(relationSelect, fieldConfig.operators);

    // Call custom handler if available (e.g., for major)
    if (fieldConfig.customHandler) {
        fieldConfig.customHandler();
    }
}

function removeFilterRule(button) {
    const filterRule = button.closest('.filter-rule');
    filterRule.remove();

    // Check if any remaining filters are using 'period'
    const fieldSelects = document.querySelectorAll('.filter-field');
    const periodsContainer = document.getElementById('periods-container');

    const isPeriodUsed = Array.from(fieldSelects).some(select => select.value === 'period');

    if (!isPeriodUsed) {
        periodsContainer.style.display = 'none';
    }
}

export function createRuleFromFilter(filter) {
    const field = filter.querySelector('.filter-field').value;
    const relation = filter.querySelector('.filter-relation').value;
    const value = filter.querySelector('.filter-value').value.trim();
    
    if (!value) {
        console.warn(`Empty value for field: ${field}`);
        return null;
    }
    
    return { field, relation, value };
}

export function createFilterGroups(filters) {
    const filterGroups = [];
    let currentGroup = [];

    filters.forEach(filter => {
        const rule = createRuleFromFilter(filter);

        // Skip this filter if the rule is null (because value was empty)
        if (!rule) return;

        const booleanOperator = filter.querySelector('.filter-boolean')?.value;

        // Group rules based on the booleanOperator
        if (booleanOperator === 'AND') {
            currentGroup.push(rule);
        } else {
            if (currentGroup.length > 0) {
                filterGroups.push(currentGroup);
            }
            currentGroup = [rule];
        }
    });

    // Push the last group if not empty
    if (currentGroup.length > 0) {
        filterGroups.push(currentGroup);
    }

    return filterGroups;
}

function evaluateBooleanLogic(course, filterGroups) {
    return filterGroups.some(group => 
        group.every(rule => applyRule(course, rule))
    );
}

function filterCourses() {
    const filters = document.querySelectorAll('.filter-rule');
    const showUnique = document.getElementById("uniqueToggle").checked;

    const filterGroups = createFilterGroups(filters);

    const allResults = new Set();
    courses.forEach(course => {
        if (evaluateBooleanLogic(course, filterGroups)) {
            allResults.add(course);
        }
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

function exportFilters() {
    const rules = Array.from(document.querySelectorAll("#filter-container .filter-rule"));
    const filters = rules.map(rule => {
        const booleanSelect = rule.querySelector(".filter-boolean");
        const fieldSelect = rule.querySelector(".filter-field");
        const relationSelect = rule.querySelector(".filter-relation");
        const valueInput = rule.querySelector(".filter-value");

        return {
            boolean: booleanSelect ? booleanSelect.value : null,
            field: fieldSelect.value,
            relation: relationSelect.value,
            value: valueInput.value
        };
    });

    return filters;
}

function logFilters() {
    const filters = exportFilters();
    console.log(JSON.stringify(filters, null, 2));
}

function saveFiltersToFile() {
    const filters = exportFilters();
    const jsonString = JSON.stringify(filters, null, 2);

    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "filters.json";
    a.click();

    URL.revokeObjectURL(url);
}

function loadFiltersFromJson(filters) {
    filters.forEach(filter => {
        addFilterRule(); // adds a new filter rule row

        // Get the last added rule
        const rules = document.querySelectorAll("#filter-container .filter-rule");
        const newRule = rules[rules.length - 1];

        // Set field
        const fieldSelect = newRule.querySelector(".filter-field");
        fieldSelect.value = filter.field;
        handleFieldChange(fieldSelect); // if necessary

        // Set relation
        const relationSelect = newRule.querySelector(".filter-relation");
        relationSelect.value = filter.relation;

        // Set boolean (if exists)
        const booleanSelect = newRule.querySelector(".filter-boolean");
        if (booleanSelect && filter.boolean) {
            booleanSelect.value = filter.boolean;
        }

        // Set value
        const valueInput = newRule.querySelector(".filter-value");
        if (valueInput) {
            valueInput.value = filter.value;
        }
    });

    // Finally trigger the search
    filterCourses();
}

function loadFiltersFromFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";

    input.onchange = event => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = e => {
            try {
                const filters = JSON.parse(e.target.result);
                loadFiltersFromJson(filters);
            } catch (err) {
                console.error("Failed to parse JSON file:", err);
                alert("Invalid JSON file.");
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

window.addFilterRule = addFilterRule;
window.handleFieldChange = handleFieldChange;
window.removeFilterRule = removeFilterRule;
window.filterCourses = filterCourses;
window.onload = loadCourses;
window.logFilters = logFilters;
window.saveFiltersToFile = saveFiltersToFile;
window.loadFiltersFromJson = loadFiltersFromJson;
window.loadFiltersFromFile = loadFiltersFromFile;
