import yaml from 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm';

export let curriculaMap = {};
export let courseIndex = {};

export async function loadCurricula(filePath = 'curricula.yaml') {
    const cachedTimestamp = localStorage.getItem('curriculaTimestamp');
    try {
        // Make a request with the `If-Modified-Since` header to check if the file has changed
        const response = await fetch(filePath, {
            headers: {
                'If-Modified-Since': cachedTimestamp || 'Thu, 01 Jan 1970 00:00:00 GMT'  // Initial timestamp for the first fetch
            }
        });

        if (response.status === 304) {
            // If the response is 304 (Not Modified), use cached data
            console.log('Using cached curricula data');
            return;
        }

        // If file has been modified, proceed to parse it
        const text = await response.text();
        const data = yaml.load(text);

        const fileTimestamp = response.headers.get('Last-Modified');
        
        // Cache the new timestamp
        localStorage.setItem('curriculaTimestamp', fileTimestamp);

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
