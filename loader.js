import { getYaml } from './yamlLoader.js';
let yaml = await getYaml();

// Generic data structures to store program and course data
export let curriculaMap = {
    major: {},
    minor: {}
};
export let courseIndex = {
    major: {},
    minor: {}
};

export let periodsData = [];

// Helper function to load and process any YAML file
const loadYamlFile = async (filePath) => {
    const cachedTimestamp = localStorage.getItem(`${filePath}Timestamp`);
    const timestamp = cachedTimestamp || new Date().toUTCString();
    const urlWithTimestamp = `${filePath}?timestamp=${timestamp}`;

    try {
        const response = await fetch(urlWithTimestamp);
        const text = await response.text();
        const data = yaml.load(text);

        const fileTimestamp = response.headers.get('Last-Modified');
        if (fileTimestamp) {
            localStorage.setItem(`${filePath}Timestamp`, fileTimestamp);
        }

        return data || {};
    } catch (error) {
        console.error(`Error loading ${filePath}:`, error);
        return {};
    }
};

// Load programs (major/minor) data
export async function loadPrograms() {
    // Clear existing data
    curriculaMap = { major: {}, minor: {} };
    courseIndex = { major: {}, minor: {} };

    const majorPrograms = await loadYamlFile('major.yaml');
    const minorPrograms = await loadYamlFile('minor.yaml');

    // Function to process and categorize program data
    const processPrograms = (programsArray, type) => {
        programsArray.curricula.forEach(program => {
            const { code, courses, name } = program;
            const upperCode = code.toUpperCase();

            // Store program data in programsMap
            curriculaMap[type][upperCode] = {
                name,
                courses: new Set(courses),
            };

            // Store course data in courseIndex
            courses.forEach(course => {
                if (!courseIndex[type][course]) {
                    courseIndex[type][course] = new Set();
                }
                courseIndex[type][course].add(upperCode);
            });
        });
    };

    // Process major and minor programs separately
    processPrograms(majorPrograms, 'major');
    processPrograms(minorPrograms, 'minor');
}

// Load academic periods (e.g., terms or semesters) data
export async function loadPeriods() {
    periodsData = await loadYamlFile('periods.yaml');

    // Populate the periods container in the UI
    renderPeriods();
}

// Render periods into the DOM
function renderPeriods() {
    const periodsContainer = document.getElementById('periods-container');
    
    // Clear any existing periods content
    periodsContainer.innerHTML = '';

    periodsData.periods.forEach(year => {
        // Create a div for the year
        const yearDiv = document.createElement('div');
        yearDiv.classList.add('year');
        
        // Create and append the year label
        const yearSpan = document.createElement('span');
        yearSpan.setAttribute("id", "year");
        yearSpan.textContent = year.year;
        yearDiv.appendChild(yearSpan);

        // Loop through the periods for the current year
        year.periods.forEach(period => {
            const periodDiv = document.createElement('div');
            periodDiv.classList.add('period');
            periodDiv.dataset.period = period.period + ' ' + year.year;

            const fullTextSpan = document.createElement('span');
            fullTextSpan.classList.add('full-text');
            fullTextSpan.textContent = period.period;
            
            const abbreviatedSpan = document.createElement('span');
            abbreviatedSpan.classList.add('abbreviated-text');
            abbreviatedSpan.textContent = period.period.substring(7); // Skip first 7 characters
            
            periodDiv.appendChild(fullTextSpan);
            periodDiv.appendChild(abbreviatedSpan);

            yearDiv.appendChild(periodDiv);  // Append period div to year div
        });

        // Append the year div to the periods container
        periodsContainer.appendChild(yearDiv);
    });
}

// Boolean check if a course is in a given program type (major or minor)
export function isCourseInCurriculum(course, programCode, type) {
    if (type !== 'major' && type !== 'minor') {
        console.error(`Invalid type: ${type}. Must be either 'major' or 'minor'.`);
        return false;
    }
    return curriculaMap[type][programCode]?.courses.has(course) || false;
}
