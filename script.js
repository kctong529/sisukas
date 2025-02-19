import { loadCurricula, curriculaMap, isCourseInCurriculum } from './loadCurricula.js';

let courses = [];

async function loadCourses() {
    try {
        const response = await fetch('courses.json'); // Load JSON
        courses = await response.json();
        await loadCurricula(); // Load JSON
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

function addFilter() {
    const filterContainer = document.getElementById('filterContainer');
    const filterGroup = document.createElement('div');
    filterGroup.classList.add('filter-group');

    // Create select element for fields
    const fieldSelect = document.createElement('select');
    fieldSelect.classList.add('filter-field');
    fieldSelect.setAttribute('onchange', 'handleFieldChange(this)'); // Use onchange here

    fieldSelect.innerHTML = ''; // Clear existing options

    // Default options
    const defaultOptions = [
        { value: 'code', text: 'Course Code' },
        { value: 'name', text: 'Course Name' },
        { value: 'teacher', text: 'Teacher' },
        { value: 'language', text: 'Language' },
        { value: 'startDate', text: 'Start Date' },
        { value: 'endDate', text: 'End Date' },
        { value: 'credits', text: 'Credits' },
        { value: 'level', text: 'Level' },
        { value: 'enrollment', text: 'Enrollment Period' },
        { value: 'major', text: 'Major Curriculum' }
    ];

    // Append default options first
    defaultOptions.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.text;
        fieldSelect.appendChild(opt);
    });

    // Create select element for filter types (contains, is, before, after)
    const typeSelect = document.createElement('select');
    typeSelect.classList.add('filter-type');

    // Create an input field container
    const inputField = document.createElement('div');
    inputField.classList.add('filter-input');

    inputField.innerHTML = `
        <input type="text" class="filter-value" placeholder="Enter value">
    `;
    typeSelect.innerHTML = `
        <option value="contains">Contains</option>
        <option value="is">Is</option>
    `;

    // Append the elements to the filter group
    filterGroup.innerHTML += `<button onclick="removeFilter(this)"><i class="bi bi-trash"></i></button>`;
    filterContainer.appendChild(filterGroup);
    filterGroup.appendChild(fieldSelect);
    filterGroup.appendChild(typeSelect);
    filterGroup.appendChild(inputField);

    // Call the function initially to set the input field based on the default selection
    changeInputField(fieldSelect, inputField, typeSelect);
}

// This function will be triggered when the fieldSelect value changes
function handleFieldChange(fieldSelect) {
    const filterGroup = fieldSelect.closest('.filter-group');
    const inputField = filterGroup.querySelector('.filter-input');
    const typeSelect = filterGroup.querySelector('.filter-type');

    changeInputField(fieldSelect, inputField, typeSelect); // Update the input field
}


// Changes the input field and operator dropdown based on selected field
function changeInputField(fieldSelect, inputField, typeSelect) {
    inputField.innerHTML = ''; // Clear existing input
    typeSelect.innerHTML = ''; // Clear existing operator options

    const selectedField = fieldSelect.value;

    if (selectedField === 'language') {
        // Language field gets a dropdown
        inputField.innerHTML = `
            <select class="filter-value">
                <option value="en">English</option>
                <option value="fi">Finnish</option>
                <option value="sv">Swedish</option>
            </select>
        `;
        typeSelect.innerHTML = `
            <option value="is">Is</option>
        `;
    } else if (selectedField === 'credits') {
        inputField.innerHTML = `
            <input type="text" class="filter-value" placeholder="Enter value">
        `;
        typeSelect.innerHTML = `
            <option value="is">Is</option>
        `;
    } else if (selectedField === 'level') {
        // Language field gets a dropdown
        inputField.innerHTML = `
            <select class="filter-value">
                <option value="basic-studies">Basic Studies</option>
                <option value="intermediate-studies">Intermediate Studies</option>
                <option value="advanced-studies">Advanced Studies</option>
                <option value="other-studies">Other Studies</option>
            </select>
        `;
        typeSelect.innerHTML = `
            <option value="is">Is</option>
        `;
    } else if (selectedField === 'startDate' || selectedField === 'endDate') {
        // Date fields get a date picker
        inputField.innerHTML = `
            <input type="date" class="filter-value">
        `;
        typeSelect.innerHTML = `
            <option value="before">Before</option>
            <option value="after">After</option>
        `;
    } else if (selectedField === 'enrollment') {
        // Date fields get a date picker
        inputField.innerHTML = `
            <input type="date" class="filter-value" value="${new Date().toISOString().split('T')[0]}">
        `;

        typeSelect.innerHTML = `
            <option value="on">On</option>
            <option value="before">Before</option>
            <option value="after">After</option>
        `;
    } else if (selectedField === 'major') {
        inputField.innerHTML = `
            <input type="text" class="filter-value" placeholder="Enter value">
        `;
        typeSelect.innerHTML = '';

        // Populate the dropdown with curriculum options
        Object.keys(curriculaMap).forEach(curriculumCode => {
            const curriculumName = curriculaMap[curriculumCode]?.name;
            if (curriculumName) {
                const opt = document.createElement('option');
                opt.value = curriculumCode;
                opt.textContent = curriculumName;
                typeSelect.appendChild(opt);
            }
        });

        // Set inputField's value to the first element in typeSelect
        if (typeSelect.options.length > 0) {
            const firstOptionValue = typeSelect.options[0].value;

            // Update inputField with a text input and set its value to the first option's value
            inputField.innerHTML = `
                <input type="text" class="filter-value" placeholder="Enter value" value="${firstOptionValue}">
            `;
        }

        // Update the input field when the curriculum dropdown changes
        typeSelect.addEventListener('change', function() {
            const selectedCurriculum = typeSelect.value;
            inputField.querySelector('.filter-value').value = selectedCurriculum;
        });

        const isCurriculumCodeValid = value => Object.keys(curriculaMap).some(key => key.toLowerCase() === value.toLowerCase());

        // Dynamically update curriculum code if input is valid
        const inputFieldElement = inputField.querySelector('.filter-value');
        inputFieldElement.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            if (isCurriculumCodeValid(value)) {
                const option = typeSelect.querySelector(`option[value="${value.toUpperCase()}"]`);
                if (option) {
                    option.selected = true; // Set the option as selected
                }
            }
        });
    } else {
        // Other fields get a text input
        inputField.innerHTML = `
            <input type="text" class="filter-value" placeholder="Enter value">
        `;
        typeSelect.innerHTML = `
            <option value="contains">Contains</option>
            <option value="is">Is</option>
        `;
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

    const filtered = courses.filter(course => applyFilters(course, filterRules, conditionType));
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
        case "major": return isCourseInCurriculum(course.code, rule.value) || isCourseInCurriculum(course.code, rule.type);
        case "enrollment": return rule.type === "after" 
            ? new Date(course.enrolmentStartDate) > new Date(rule.value) 
            : rule.type === "before" 
            ? new Date(course.enrolmentEndDate) < new Date(rule.value) 
            : new Date(course.enrolmentStartDate) <= new Date(rule.value) && new Date(course.enrolmentEndDate) >= new Date(rule.value);
    }
}

window.addFilter = addFilter;
window.handleFieldChange = handleFieldChange;
window.removeFilter = removeFilter;
window.filterCourses = filterCourses;
window.onload = loadCourses;
