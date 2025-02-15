let courses = [];

async function loadCourses() {
    try {
        const response = await fetch('courses.json'); // Load JSON
        courses = await response.json();
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
    fieldSelect.innerHTML = `
        <option value="code">Course Code</option>
        <option value="name">Course Name</option>
        <option value="teacher">Teacher</option>
        <option value="language">Language</option>
        <option value="startDate">Start Date</option>
        <option value="endDate">End Date</option>
        <option value="credits">Credits</option>
        <option value="level">Level</option>
        <option value="enrollment">Enrollment Period</option>
    `;

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
    filterGroup.appendChild(fieldSelect);
    filterGroup.appendChild(typeSelect);
    filterGroup.appendChild(inputField);
    filterGroup.innerHTML += `<button onclick="removeFilter(this)">❌</button>`;
    filterContainer.appendChild(filterGroup);

    // Call the function initially to set the input field based on the default selection
    changeInputField(fieldSelect, inputField, typeSelect);
}

// This function will be triggered when the fieldSelect value changes
function handleFieldChange(fieldSelect) {
    const filterGroup = fieldSelect.closest('.filter-group');
    const inputField = filterGroup.querySelector('.filter-input');
    const typeSelect = filterGroup.querySelector('.filter-type');

    console.log("Field changed to: " + fieldSelect.value); // Debugging
    changeInputField(fieldSelect, inputField, typeSelect); // Update the input field
}


// Changes the input field and operator dropdown based on selected field
function changeInputField(fieldSelect, inputField, typeSelect) {
    inputField.innerHTML = ''; // Clear existing input
    typeSelect.innerHTML = ''; // Clear existing operator options

    const selectedField = fieldSelect.value;
    console.log(selectedField);

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
    } else if (selectedField === 'startDate' || selectedField === 'endDate' || selectedField === 'enrollment') {
        // Date fields get a date picker
        inputField.innerHTML = `
            <input type="date" class="filter-value">
        `;
        typeSelect.innerHTML = `
            <option value="before">Before</option>
            <option value="after">After</option>
        `;
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
            value: filter.querySelector('.filter-value').value.trim().toLowerCase()
        };
    });

    const filtered = courses.filter(course => {
        return filterRules.reduce((acc, rule, index) => {
            let match = false;

            switch (rule.field) {
                case "code":
                    match = rule.type === "contains"
                        ? course.code.toLowerCase().includes(rule.value)
                        : course.code.toLowerCase() === rule.value;
                    break;

                case "name":
                    match = rule.type === "contains"
                        ? course.name.en.toLowerCase().includes(rule.value)
                        : course.name.en.toLowerCase() === rule.value;
                    break;

                case "teacher":
                    match = course.teachers.some(teacher =>
                        rule.type === "contains"
                            ? teacher.toLowerCase().includes(rule.value)
                            : teacher.toLowerCase() === rule.value
                    );
                    break;

                case "language":
                    match = course.languageOfInstructionCodes.includes(rule.value);
                    break;

                case "startDate":
                    match = rule.type === "after"
                        ? new Date(course.startDate) > new Date(rule.value)
                        : rule.type === "before"
                            ? new Date(course.startDate) < new Date(rule.value)
                            : course.startDate.toLowerCase().includes(rule.value);
                    break;

                case "endDate":
                    match = rule.type === "after"
                        ? new Date(course.endDate) > new Date(rule.value)
                        : rule.type === "before"
                            ? new Date(course.endDate) < new Date(rule.value)
                            : course.endDate.toLowerCase().includes(rule.value);
                    break;

                case "credits":
                    match = rule.type === "is"
                        ? course.credits.min === parseInt(rule.value)
                        : course.credits.min >= parseInt(rule.value);
                    break;

                case "level":
                    if (course.summary.level && course.summary.level.en) {
                        match = course.summary.level.en.toLowerCase() === rule.value;
                    } else {
                        match = false; // or you can decide what behavior you want if level is not defined
                    }
                    break;

                case "enrollment":
                    match = rule.type === "after"
                        ? new Date(course.endDate) > new Date(rule.value)
                        : rule.type === "before"
                            ? new Date(course.endDate) < new Date(rule.value)
                            : course.endDate.toLowerCase().includes(rule.value);
                    break;
            }

            return index === 0
                ? match
                : (conditionType === "AND" ? acc && match : acc || match);
        }, conditionType === "AND");
    });

    displayCourses(filtered, true);
}

window.onload = loadCourses;
