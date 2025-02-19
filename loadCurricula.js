import yaml from 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm';

export let curriculaMap = {};
export let courseIndex = {};

export async function loadCurricula(filePath = 'curricula.yaml') {
    const cachedTimestamp = localStorage.getItem('curriculaTimestamp');
    const timestamp = cachedTimestamp || new Date().toUTCString(); // Use the cached timestamp or the current timestamp

    const urlWithTimestamp = `${filePath}?timestamp=${timestamp}`; // Append timestamp to the URL

    try {
        const response = await fetch(urlWithTimestamp);
        const text = await response.text();
        const data = yaml.load(text);

        const fileTimestamp = response.headers.get('Last-Modified');

        // Cache the new timestamp
        if (fileTimestamp) {
            localStorage.setItem('curriculaTimestamp', fileTimestamp); // Update the timestamp in localStorage
        }
        
        const curriculaArray = data.curricula;

        curriculaArray.forEach(curriculum => {
            const { code, courses, name } = curriculum;
            curriculaMap[code.toUpperCase()] = {
                name: name,
                courses: new Set(courses),
            };

            courses.forEach(course => {
                if (!courseIndex[course]) {
                    courseIndex[course] = new Set();
                }
                courseIndex[course].add(code.toUpperCase());
            });
        });
    } catch (error) {
        console.error('Error loading curricula:', error);
    }
}

// Get courses for a given curriculum code
export function getCourses(curriculumCode) {
    return curriculaMap[curriculumCode]?.courses || new Set();
}

// Get curricula that include a given course code
export function getCurriculaForCourse(courseCode) {
    return courseIndex[courseCode] || new Set();
}

// Boolean check if a course is in a given curriculum
export function isCourseInCurriculum(course, curriculum) {
    return curriculaMap[curriculum]?.courses.has(course) || false;
}
