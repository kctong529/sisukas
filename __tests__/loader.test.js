import { loadPrograms, curriculaMap, courseIndex } from './loader.js';

// Mock the fetch API to return sample YAML data
global.fetch = jest.fn((url) => {
    let responseData = {};

    if (url.includes('major.yaml')) {
        responseData = {
            curricula: [
                {
                    code: 'CS',
                    name: 'Computer Science',
                    courses: ['CS101', 'CS102']
                }
            ]
        };
    } else if (url.includes('minor.yaml')) {
        responseData = {
            curricula: [
                {
                    code: 'MATH',
                    name: 'Mathematics',
                    courses: ['MATH101']
                }
            ]
        };
    }

    return Promise.resolve({
        text: () => Promise.resolve(JSON.stringify(responseData)),
        headers: {
            get: () => 'Wed, 21 Oct 2024 07:28:00 GMT' // Mock Last-Modified header
        }
    });
});

describe('loadPrograms', () => {
    beforeEach(() => {
        // Clear the localStorage and reset fetch mock
        localStorage.clear();
        fetch.mockClear();
    });

    test('should load and process major and minor programs', async () => {
        await loadPrograms();

        // Check that fetch was called for both major and minor YAML files
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('major.yaml?timestamp='));
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('minor.yaml?timestamp='));

        // Check curriculaMap data
        expect(curriculaMap.major).toHaveProperty('CS');
        expect(curriculaMap.major.CS.name).toBe('Computer Science');
        expect(curriculaMap.major.CS.courses).toEqual(new Set(['CS101', 'CS102']));

        expect(curriculaMap.minor).toHaveProperty('MATH');
        expect(curriculaMap.minor.MATH.name).toBe('Mathematics');
        expect(curriculaMap.minor.MATH.courses).toEqual(new Set(['MATH101']));

        // Check courseIndex data
        expect(courseIndex.major['CS101']).toEqual(new Set(['CS']));
        expect(courseIndex.major['CS102']).toEqual(new Set(['CS']));
        expect(courseIndex.minor['MATH101']).toEqual(new Set(['MATH']));
    });

    test('should handle empty YAML files gracefully', async () => {
        fetch.mockImplementationOnce(() => Promise.resolve({
            text: () => Promise.resolve(''),
            headers: {
                get: () => null
            }
        }));

        await loadPrograms();

        // Expect no data to be populated if YAML is empty
        expect(curriculaMap.major).toEqual({});
        expect(curriculaMap.minor).toEqual({});
        expect(courseIndex.major).toEqual({});
        expect(courseIndex.minor).toEqual({});
    });
});
