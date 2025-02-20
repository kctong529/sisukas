import yaml from 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm';

export let curriculaMap = {
    major: {},
    minor: {}
};
export let courseIndex = {
    major: {},
    minor: {}
};

export async function loadCurricula() {
    // Helper function to load and process a YAML file
    const loadYamlFile = async (filePath, type) => {
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
            
            return data.curricula || [];
        } catch (error) {
            console.error(`Error loading ${filePath}:`, error);
            return [];
        }
    };

    // Clear existing data
    curriculaMap = { major: {}, minor: {} };
    courseIndex = { major: {}, minor: {} };

    // Load and categorize majors and minors separately
    const majorCurricula = await loadYamlFile('major.yaml', 'major');
    const minorCurricula = await loadYamlFile('minor.yaml', 'minor');

    // Function to process and store curricula data
    const processCurricula = (curriculaArray, type) => {
        curriculaArray.forEach(curriculum => {
            const { code, courses, name } = curriculum;
            const upperCode = code.toUpperCase();

            // Store in curriculaMap by type (major or minor)
            curriculaMap[type][upperCode] = {
                name,
                courses: new Set(courses),
            };

            // Store in courseIndex by type (major or minor)
            courses.forEach(course => {
                if (!courseIndex[type][course]) {
                    courseIndex[type][course] = new Set();
                }
                courseIndex[type][course].add(upperCode);
            });
        });
    };

    // Process majors and minors separately
    processCurricula(majorCurricula, 'major');
    processCurricula(minorCurricula, 'minor');
}

// Boolean check if a course is in a given curriculum type (major or minor)
export function isCourseInCurriculum(course, curriculumCode, type) {
    if (type !== 'major' && type !== 'minor') {
        console.error(`Invalid type: ${type}. Must be either 'major' or 'minor'.`);
        return false;
    }
    return curriculaMap[type][curriculumCode]?.courses.has(course) || false;
}
