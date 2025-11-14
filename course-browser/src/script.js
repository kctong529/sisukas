// Import all required modules and helper functions
import { loadPrograms, loadPeriods, loadOrganizations, periodsData, curriculaMap, organizationNames } from './yamlCache.js';
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
import { config } from './config.js';

const filtersApi = import.meta.env.VITE_FILTERS_API;
const wrapperApi = import.meta.env.VITE_WRAPPER_API;


// Global state variables
let courses = []; // Stores all courses loaded from JSON
let filteredCourses = []; // Stores currently filtered courses
let currentSortColumn = "courseName"; // Default sort column
let sortDirection = 1; // 1 = ascending, -1 = descending

// IndexedDB-based cache for large files, hash-driven
class LargeFileCache {
    constructor(dbName = 'lastModified-cache', version = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
    }

    // Initialize IndexedDB
    async init() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object store for cached files
                if (!db.objectStoreNames.contains('files')) {
                    const store = db.createObjectStore('files', { keyPath: 'url' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    // Get cached data
    async getCache(url) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');
            const request = store.get(url);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    // Save data to cache
    async setCache(url, hash, data) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');

            const cacheItem = {
                url,
                hash,
                data,
                timestamp: Date.now(),
                size: JSON.stringify(data).length
            };

            const request = store.put(cacheItem);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    // Main fetch method with cache support
    async fetch(dataUrl, hashUrl) {
        try {
            const cached = await this.getCache(dataUrl);
            console.log(`Fetching hash ${hashUrl}`);

            const hashRes = await fetch(hashUrl);
            if (!hashRes.ok) throw new Error(`Failed to fetch hash: ${hashRes.status}`);
            const { hash: newHash } = await hashRes.json();

            if (cached?.hash === newHash) {
                console.log(`Using cached data for ${dataUrl} (${Math.round(cached.size / 1024 / 1024)}MB)`);
                return cached.data;
            }

            console.log(`Fetching updated data ${dataUrl}`);
            const dataRes = await fetch(dataUrl);
            if (!dataRes.ok) throw new Error(`Failed to fetch data: ${dataRes.status}`);
            const data = await dataRes.json();

            const sizeMB = Math.round(JSON.stringify(data).length / 1024 / 1024);
            console.log(`Downloaded ${sizeMB}MB, hash: ${newHash}`);

            await this.setCache(dataUrl, newHash, data);
            return data;
        } catch (error) {
            console.error(`Failed to fetch ${dataUrl}:`, error);

            // Fall back to cached data if available
            const cached = await this.getCache(dataUrl);
            if (cached?.data) {
                console.log(`Using stale cached data for ${dataUrl}`);
                return cached.data;
            }

            throw error;
        }
    }

    // Clear cache for a specific URL
    async clearCache(url) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            const request = store.delete(url);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    // Clear all cache
    async clearAllCache() {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            const request = store.clear();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    // Get cache info for debugging
    async getCacheInfo() {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');
            const request = store.getAll();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const info = {};
                request.result.forEach(item => {
                    info[item.url] = {
                        lastModified: item.lastModified,
                        size: `${Math.round(item.size / 1024 / 1024)}MB`,
                        cached: new Date(item.timestamp).toLocaleString()
                    };
                });
                resolve(info);
            };
        });
    }

    // Clean old cache entries (optional)
    async cleanOldCache(maxAgeMs = 7 * 24 * 60 * 60 * 1000) { // 7 days
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            const index = store.index('timestamp');

            const cutoffTime = Date.now() - maxAgeMs;
            const range = IDBKeyRange.upperBound(cutoffTime);

            const request = index.openCursor(range);

            request.onerror = () => reject(request.error);
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
        });
    }
}

const cache = new LargeFileCache();

// Main initialization function
async function loadCourses() {
    try {
        // Load course data and initialize filteredCourses with all courses
        courses = await loadCourseData();
        filteredCourses = [...courses]; // Shallow copy of all courses

        // Sort by default column (courseName ascending) and display
        sortCourses();
        displayCourses(filteredCourses, false);
        updateSortIndicators(currentSortColumn, sortDirection);
    } catch (error) {
        console.error("Error loading JSON:", error);
    }
}

async function loadCourseData() {
    try {
        const courses = await cache.fetch(
            'https://storage.googleapis.com/sisukas-core-test/courses.json',
            'https://storage.googleapis.com/sisukas-core-test/courses.hash.json'
        );
        console.log('Courses loaded:', courses.length);
        return courses;
    } catch (error) {
        console.error('Failed to load courses:', error);
        throw error;
    }
}

// Debug helpers
window.debugCache = async () => {
    console.table(await cache.getCacheInfo());
};

window.clearCache = async () => {
    await cache.clearAllCache();
    console.log('Cache cleared');
};

export function extractOrganizationNames(courses) {
    return new Set(courses.map(course => course.organizationName.en).filter(name => name));
}

async function loadAdditionalData() {
    await loadPrograms();
    await loadPeriods();
    await loadOrganizations();
}

// Helper to extract sortable value from course based on column
function getSortableValue(course, column) {
    switch (column) {
        case 'courseCode':
            return course.code.toLowerCase().trim();
        case 'courseName':
            return course.name.en.toLowerCase().trim();
        case 'teachers':
            return course.teachers.join(", ").toLowerCase().trim();
        case 'credits':
            return course.credits.min;
        case 'language':
            return course.languageOfInstructionCodes.join(", ").toLowerCase();
        case 'startDate':
            return new Date(course.startDate);
        case 'endDate':
            return new Date(course.endDate);
        case 'enrollFrom':
            return new Date(course.enrolmentStartDate);
        case 'enrollTo':
            return new Date(course.enrolmentEndDate);
        case 'prerequisites':
            return (course.summary.prerequisites ? course.summary.prerequisites.en : '').toLowerCase();
        default:
            return '';
    }
}

// Display courses in the table
function displayCourses(coursesToDisplay, filtersApplied=false) {
    const container = document.getElementById('course-list');
    container.innerHTML = ''; // Clear previous results

    coursesToDisplay.forEach(course => {
        container.insertAdjacentHTML('beforeend', createCourseRow(course));
    });
    updateCourseCount(coursesToDisplay, filtersApplied);
}

// Create HTML for a single course row
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

// Update the course count display
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

// Filter courses based on current filter rules
function filterCourses() {
    const filters = document.querySelectorAll('.filter-rule');
    const showUnique = document.getElementById("uniqueToggle").checked;

    if (filters.length === 0) {
        // No filters - show all courses (optionally unique only)
        filteredCourses = showUnique ? getUniqueCourses(courses) : [...courses];
    } else {
        // Apply filter rules
        const filterGroups = createFilterGroups(filters);
        const allResults = new Set();
        
        courses.forEach(course => {
            if (evaluateBooleanLogic(course, filterGroups)) {
                allResults.add(course);
            }
        });

        filteredCourses = showUnique ? getUniqueCourses(Array.from(allResults)) : Array.from(allResults);
    }
}

// Handle search button click - applies filters and maintains current sort
function onSearchButtonClick() {
    filterCourses(); // Apply current filters
    sortCourses(); // Maintain current sort order
    displayCourses(filteredCourses, true);
    updateSortIndicators(currentSortColumn, sortDirection);
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
        case "endDate": return applyEndDateFilter(course, rule);
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

// Helper function to sort courses based on current settings
function sortCourses(coursesToSort = filteredCourses, column = currentSortColumn, direction = sortDirection) {
    return coursesToSort.sort((a, b) => {
        const valueA = getSortableValue(a, column);
        const valueB = getSortableValue(b, column);
        
        // Handle both string and number/date comparisons
        if (typeof valueA === 'string') {
            return valueA.localeCompare(valueB) * direction;
        } else {
            return (valueA - valueB) * direction;
        }
    });
}

// Handle column header clicks for sorting
function handleColumnSort(column) {
    // Toggle direction if clicking same column, otherwise reset to ascending
    if (currentSortColumn === column) {
        sortDirection *= -1;
    } else {
        // New column, default to ascending
        currentSortColumn = column;
        sortDirection = 1;
    }

    sortCourses(); // Re-sort with new parameters
    displayCourses(filteredCourses, true);
    updateSortIndicators(currentSortColumn, sortDirection);
}

// Update sort indicators in the UI
function updateSortIndicators(column, direction) {
    // Remove all existing indicators
    document.querySelectorAll('th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    // Add indicator to current column
    const header = document.querySelector(`th[data-column="${column}"]`);
    if (header) {
        header.classList.add(direction === 1 ? 'sort-asc' : 'sort-desc');
    }
}

function exportFilters() {
    const rules = Array.from(document.querySelectorAll("#filter-container .filter-rule"));
    const groups = [];
    let group = [];

    for (const rule of rules) {
        const get = cls => rule.querySelector(cls)?.value || "";
        const boolean = get(".filter-boolean").toUpperCase();
        const ruleObj = { field: get(".filter-field"), relation: get(".filter-relation"), value: get(".filter-value") };

        if (boolean === "OR" || !group.length) {
            if (group.length) groups.push(group);
            group = [ruleObj];
        } else group.push(ruleObj);
    }

    if (group.length) groups.push(group);
    return groups;
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

/**
 * Saves the current filters to the API.
 * @returns A Promise resolving to the shareable URL or null if saving failed.
 */
async function saveFiltersToApi() {
    const filters = exportFilters();
    
    // Validate that there are filters to save
    if (filters.length === 0) {
        showFilterLoadError("No filters to save");
        return null;
    }

    try {
        // Wrap each AND-group in an object with "rules" key
        const payload = {
            groups: filters.map(group => ({ rules: group }))
        };
        console.log("Saving filters:", payload);

        // Send POST request to API
        const response = await fetch(`${filtersApi}/api/filters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errorMessage = "Failed to save filters";
            
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorMessage;
            } catch (e) {
                errorMessage = response.statusText;
            }
            
            console.error(`Failed to save filters (${response.status}):`, errorMessage);
            showFilterLoadError(`Unable to save filters: ${errorMessage}`);
            return null;
        }

        const data = await response.json();
        console.log(data);
        
        // Validate response structure
        if (!data.hash_id) {
            console.error("Invalid response structure:", data);
            showFilterLoadError("Invalid response from server");
            return null;
        }

        // Create shareable URL
        const shareableUrl = `${window.location.origin}${window.location.pathname}?filter=${data.hash_id}`;
        console.log(`Filters saved with hash ID: ${data.hash_id}`);
        return shareableUrl;
    } catch (error) {
        // Handle network errors and other exceptions
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            console.error("Network error saving filters:", error);
            showFilterLoadError("Unable to connect to filter service. Please check your internet connection.");
        } else {
            console.error("Error saving filters:", error);
            showFilterLoadError("An unexpected error occurred while saving filters");
        }
    }
}

async function handleSaveClick() {
    const shareableUrl = await saveFiltersToApi();
    if (!shareableUrl) return;

    try {
        console.log(`Shareable URL: ${shareableUrl}`);
        showFilterLoadSuccess("Filter link copied to clipboard!");
        await navigator.clipboard.writeText(shareableUrl);
    } catch (clipboardError) {
        console.warn("Clipboard API failed:", clipboardError);
    } finally {
        // Navigate to the URL with the filter hash
        showFilterLoadSuccess("Opening your saved filters...");
        setTimeout(() => {
            window.location.href = shareableUrl;
        }, 500);
    }
}

// Combined function that does both - save to API and optionally download
async function saveFilters(downloadJson = false) {
    const filters = exportFilters();
    
    if (filters.length === 0) {
        showFilterLoadError("No filters to save");
        return;
    }

    await handleSaveClick();
    
    // Optionally also download JSON
    if (downloadJson) {
        saveFiltersToFile();
    }
}

function loadFiltersFromJson(filters) {
    const groups = (filters && filters.groups) || [];
    let isFirstRuleOverall = true;

    groups.forEach(group => {
        const rules = group.rules || [];
        rules.forEach((rule, idxInGroup) => {
            addFilterRule(); // adds a new filter rule row

            // Get the last added rule
            const rules = document.querySelectorAll("#filter-container .filter-rule");
            const newRule = rules[rules.length - 1];

            // Set field
            const fieldSelect = newRule.querySelector(".filter-field");
            fieldSelect.value = rule.field;
            handleFieldChange(fieldSelect); // if necessary

            // Set relation
            const relationSelect = newRule.querySelector(".filter-relation");
            relationSelect.value = rule.relation;

            // Decide boolean based on position
            const booleanSelect = newRule.querySelector(".filter-boolean");
            if (booleanSelect) {
                if (isFirstRuleOverall) {
                    // leave as default / empty for the very first rule
                } else if (idxInGroup === 0) {
                    // first rule of a new group => separate from previous group
                    booleanSelect.value = "OR";
                } else {
                    // inside same group => AND with previous
                    booleanSelect.value = "AND";
                }
            }

            isFirstRuleOverall = false;

            // Set value
            const valueInput = newRule.querySelector(".filter-value");
            if (valueInput) {
                valueInput.value = rule.value;
            }
        });
    });

    onSearchButtonClick();
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

function setupEnterKeyHandler() {
    // Use event delegation on the filter container
    const filterContainer = document.getElementById('filter-container');
    
    filterContainer.addEventListener('keydown', function(event) {
        // Check if the event target is a filter input field and Enter was pressed
        if (event.target.classList.contains('filter-value') && event.key === 'Enter') {
            event.preventDefault();
            onSearchButtonClick();
        }
    });
}

// On page load, check for filter parameter and load from API
async function loadFiltersFromUrl() {
    const filtersKey = new URLSearchParams(window.location.search).get('filter');
    if (!filtersKey) return;

    try {
        const response = await fetch(`${filtersApi}/api/filters/${filtersKey}`);
        
        // Handle different error responses
        if (!response.ok) {
            let errorMessage = "Failed to load filters";
            
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorMessage;
            } catch (e) {
                // If response isn't JSON, use status text
                errorMessage = response.statusText;
            }
            
            switch (response.status) {
                case 404:
                    showFilterLoadError("These filters no longer exist or have been deleted");
                    break;
                case 422:
                    showFilterLoadError("Invalid filter URL format");
                    break;
                case 503:
                    showFilterLoadError("Filter service is temporarily unavailable. Please try again later.");
                    break;
                default:
                    showFilterLoadError(`Unable to load filters: ${errorMessage}`);
            }
            console.error(`Failed to load filters (${response.status}):`, errorMessage);
            return;
        }

        const data = await response.json();
        
        // Validate response structure
        if (!data.groups || !Array.isArray(data.groups)) {
            console.error("Invalid filter data structure:", data);
            showFilterLoadError("Invalid filter data received from server");
            return;
        }
        
        loadFiltersFromJson(data);
        logFilters();
        showFilterLoadSuccess("Loaded filter(s) from shared link");
        
    } catch (error) {
        // Handle network errors and other exceptions
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            console.error("Network error loading filters:", error);
            showFilterLoadError("Unable to connect to filter service. Please check your internet connection.");
        } else {
            console.error("Error loading filters from URL:", error);
            showFilterLoadError("An unexpected error occurred while loading filters");
        }
    }
}

// Helper function to show error messages to the user
function showFilterLoadError(message) {
    // Remove any existing notifications first
    removeExistingNotifications();
    
    const notification = document.createElement('div');
    notification.className = 'filter-notification error';
    notification.innerHTML = `
        <i class="bi bi-exclamation-circle"></i>
        <span>${message}</span>
    `;
    
    // Insert at a fixed position in the DOM
    const container = getNotificationContainer();
    container.appendChild(notification);
    
    // Auto-remove after configured duration
    setTimeout(() => notification.remove(), config.ui.notificationDuration.error);
}

// Helper function to show success messages
function showFilterLoadSuccess(message) {
    // Remove any existing notifications first
    removeExistingNotifications();
    
    const notification = document.createElement('div');
    notification.className = 'filter-notification success';
    notification.innerHTML = `
        <i class="bi bi-check-circle"></i>
        <span>${message}</span>
    `;
    
    // Insert at a fixed position in the DOM
    const container = getNotificationContainer();
    container.appendChild(notification);
    
    // Auto-remove after configured duration
    setTimeout(() => notification.remove(), config.ui.notificationDuration.success);
}

// Get or create notification container
function getNotificationContainer() {
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        document.body.appendChild(container);
    }
    return container;
}

// Remove any existing notifications
function removeExistingNotifications() {
    const existing = document.querySelectorAll('.filter-notification');
    existing.forEach(notif => notif.remove());
}

// Initialize on page load
window.onload = async function() {
    try {
        // Load just the data needed for filters
        await loadAdditionalData();

        // Now load filters from URL (if present)
        await loadFiltersFromUrl();

        // Finally load and display courses
        await loadCourses();

        const filterContainer = document.getElementById('filter-container');
        if (filterContainer.children.length > 0) {
            onSearchButtonClick();
        }
    } catch (error) {
        console.error("Error loading:", error);
    }

    // Add click handlers to column headers
    document.querySelector('table').addEventListener('click', (e) => {
        const th = e.target.closest('th[data-column]');
        if (!th) return;
        handleColumnSort(th.getAttribute('data-column'));
    });
    
    // Add Enter key handler for filter inputs
    setupEnterKeyHandler();
};

function debugCourses() {
    console.log("Filtered courses:", filteredCourses);
    console.table(filteredCourses.map(c => ({
        code: c.code,
        name: c.name?.en,
        credits: c.credits?.min,
        start: c.startDate,
        end: c.endDate
    })));
    console.log(`Total: ${filteredCourses.length}`);
    console.log(filteredCourses[0]);
};

function validateCourseIndex(index) {
    if (!filteredCourses || filteredCourses.length === 0) {
        console.warn("⚠️ filteredCourses is empty or undefined.");
        return false;
    }
    if (index < 0 || index >= filteredCourses.length) {
        console.warn(`⚠️ Index out of range (0–${filteredCourses.length - 1}).`);
        return false;
    }
    return true;
}

function logCourseSummary(index = 0) {
    if (!validateCourseIndex(index)) return;
    const course = filteredCourses[index];

    console.log(`🔍 Course #${index} — ${course.name?.en || "(no name)"} (${course.code})`);
    console.table(Object.entries(course).map(([key, value]) => ({
        Attribute: key,
        Type: typeof value,
        Value: value
    })));
};

function getCourseIdsByIndex(index = 0) {
    if (!validateCourseIndex(index)) return;
    const course = filteredCourses[index];

    return {
        course_unit_id: course.courseUnitId || null,
        course_offering_id: course.id || null,
        code: course.code || null,
        name: course.name?.en || null
    };
};

/**
 * Call the FastAPI endpoint to fetch study groups for a given course object.
 * @param {Object} courseObj - Object with course_unit_id and course_offering_id
 */
async function fetchStudyGroups(courseObj) {
  if (!courseObj || !courseObj.course_unit_id || !courseObj.course_offering_id) {
    console.error("Invalid course object:", courseObj);
    return;
  }

  const url = new URL(`${wrapperApi}/study-groups`);
  url.searchParams.append("course_unit_id", courseObj.course_unit_id);
  url.searchParams.append("course_offering_id", courseObj.course_offering_id);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const data = await response.json();
    console.log("Study groups:", data);
    return data;
  } catch (err) {
    console.error("Failed to fetch study groups:", err);
    return []; // empty array if fetch fails
  }
}

function getCourseObjectsInRange(startIndex = 0, endIndex = 10) {
    if (!filteredCourses || filteredCourses.length === 0) {
        console.warn("⚠️ filteredCourses is empty or undefined.");
        return [];
    }

    // Clamp indices to valid range
    const validStart = Math.max(0, Math.min(startIndex, filteredCourses.length - 1));
    const validEnd = Math.max(validStart, Math.min(endIndex, filteredCourses.length));
    
    const courseObjects = [];

    for (let i = validStart; i < validEnd; i++) {
        const course = filteredCourses[i];
        courseObjects.push({
            course_unit_id: course.courseUnitId || null,
            course_offering_id: course.id || null,
            code: course.code || null,
            name: course.name?.en || null
        });
    }

    console.log(`Extracted ${courseObjects.length} course objects (indices ${validStart}–${validEnd - 1}):`);
    return courseObjects;
}

Object.assign(window, {
    addFilterRule,
    handleFieldChange,
    removeFilterRule,
    displayCourses,
    filterCourses,
    logFilters,
    saveFiltersToFile,
    saveFiltersToApi,
    saveFilters,
    loadFiltersFromJson,
    loadFiltersFromFile,
    loadFiltersFromUrl,
    onSearchButtonClick,
    debugCourses,
    getCourseIdsByIndex,
    fetchStudyGroups,
    getCourseObjectsInRange
});
