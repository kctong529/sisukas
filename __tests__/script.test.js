import { describe, it, expect, vi } from 'vitest';
import { extractOrganizationNames, createRuleFromFilter, createFilterGroups } from '../src/script.js'; // Adjust the path

describe('extractOrganizationNames', () => {
  it('should return a set of unique organization names from the courses', () => {
    const courses = [
      { organizationName: { en: 'Organization A' } },
      { organizationName: { en: 'Organization B' } },
      { organizationName: { en: 'Organization A' } },
      { organizationName: { en: 'Organization C' } },
  ];

  const result = extractOrganizationNames(courses);

    // Check that result is a set and contains the unique names
  expect(result).toBeInstanceOf(Set);
  expect(result.has('Organization A')).toBe(true);
  expect(result.has('Organization B')).toBe(true);
  expect(result.has('Organization C')).toBe(true);
    expect(result.size).toBe(3);  // Should be 3 unique organizations
});

  it('should ignore empty organization names', () => {
    const courses = [
      { organizationName: { en: 'Organization A' } },
      { organizationName: { en: '' } },
      { organizationName: { en: 'Organization B' } },
  ];

  const result = extractOrganizationNames(courses);

    // Check that empty organization names are ignored
  expect(result.has('')).toBe(false);
    expect(result.size).toBe(2);  // Only 2 unique organizations
});
});

function createMockFilterElement(field, relation, value, booleanOperator=null) {
    return {
        querySelector: vi.fn((selector) => {
            if (selector === '.filter-field') return { value: field };
            if (selector === '.filter-relation') return { value: relation };
            if (selector === '.filter-value') return { value: value };
            if (selector === '.filter-boolean') return { value: booleanOperator };
        }),
    };
}

describe('createRuleFromFilter', () => {
    it('should correctly create a rule object from filter', () => {
        const filter = createMockFilterElement('field1', 'equals', 'value1');
        
        const rule = createRuleFromFilter(filter);
        
        expect(rule).toEqual({
            field: 'field1',
            relation: 'equals',
            value: 'value1',
        });
    });

    it('should return null and log a warning for empty value', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        const filter = createMockFilterElement('field2', 'equals', '');
        
        const rule = createRuleFromFilter(filter);
        
        expect(rule).toBeNull();
        expect(warnSpy).toHaveBeenCalledWith('Empty value for field: field2');
        
        warnSpy.mockRestore();
    });
});

describe('createFilterGroups', () => {
    it('should create groups of filters based on booleanOperator (AND only)', () => {
        const filters = [
            createMockFilterElement('field1', 'relation1', 'value1'),
            createMockFilterElement('field2', 'relation2', 'value2', 'AND'),
            createMockFilterElement('field3', 'relation3', 'value3', 'AND')
        ];

        const result = createFilterGroups(filters);
        
        expect(result).toEqual([
            [
                { field: 'field1', relation: 'relation1', value: 'value1' },
                { field: 'field2', relation: 'relation2', value: 'value2' },
                { field: 'field3', relation: 'relation3', value: 'value3' }
            ]
        ]);
    });

    it('should create groups of filters based on booleanOperator (OR only)', () => {
        const filters = [
            createMockFilterElement('field1', 'relation1', 'value1'),
            createMockFilterElement('field2', 'relation2', 'value2', 'OR'),
            createMockFilterElement('field3', 'relation3', 'value3', 'OR')
        ];

        const result = createFilterGroups(filters);
        
        expect(result).toEqual([
            [
                { field: 'field1', relation: 'relation1', value: 'value1' }
            ],
            [
                { field: 'field2', relation: 'relation2', value: 'value2' }
            ],
            [
                { field: 'field3', relation: 'relation3', value: 'value3' }
            ]
        ]);
    });

    it('should create groups of filters based on mixed booleanOperators (OR and AND)', () => {
        const filters = [
            createMockFilterElement('field1', 'relation1', 'value1'),
            createMockFilterElement('field2', 'relation2', 'value2', 'OR'),
            createMockFilterElement('field3', 'relation3', 'value3', 'AND')
        ];

        const result = createFilterGroups(filters);
        
        expect(result).toEqual([
            [
                { field: 'field1', relation: 'relation1', value: 'value1' }
            ],
            [
                { field: 'field2', relation: 'relation2', value: 'value2' },
                { field: 'field3', relation: 'relation3', value: 'value3' }
            ]
        ]);
    });

    it('should create groups based on mixed booleanOperators (AND and OR)', () => {
        const filters = [
            createMockFilterElement('field1', 'relation1', 'value1'),
            createMockFilterElement('field2', 'relation2', 'value2', 'AND'),
            createMockFilterElement('field3', 'relation3', 'value3', 'OR')
        ];

        const result = createFilterGroups(filters);
        
        expect(result).toEqual([
            [
                { field: 'field1', relation: 'relation1', value: 'value1' },
                { field: 'field2', relation: 'relation2', value: 'value2' }
            ],
            [
                { field: 'field3', relation: 'relation3', value: 'value3' }
            ]
        ]);
    });
});
