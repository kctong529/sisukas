// src/domain/value-objects/ArrayComparison.ts

/**
 * Generic array comparison utilities for categorical values.
 * Supports case-insensitive string comparisons.
 */

export interface ArrayComparisonOptions {
  caseSensitive?: boolean;
  partial?: boolean; // Enable substring matching
}

function normalize<T>(value: T, options?: ArrayComparisonOptions): T | string {
  if (typeof value === 'string' && !options?.caseSensitive) {
    return value.toLowerCase();
  }
  return value;
}

function matchesPartial(item: string, value: string, options?: ArrayComparisonOptions): boolean {
  const normalizedItem = normalize(item, options) as string;
  const normalizedValue = normalize(value, options) as string;
  
  if (options?.partial) {
    return normalizedItem.includes(normalizedValue) || normalizedValue.includes(normalizedItem);
  }
  
  return normalizedItem === normalizedValue;
}

/** Check if array includes a specific value */
export function includes<T>(
  array: T[],
  value: T,
  options?: ArrayComparisonOptions
): boolean {
  if (typeof value === 'string' && options?.partial) {
    return array.some(item => 
      typeof item === 'string' && matchesPartial(item, value, options)
    );
  }
  
  const normalizedValue = normalize(value, options);
  return array.some(item => normalize(item, options) === normalizedValue);
}

/** Check if array does not include a specific value */
export function notIncludes<T>(
  array: T[],
  value: T,
  options?: ArrayComparisonOptions
): boolean {
  return !includes(array, value, options);
}

/** Check if array includes at least one of the provided values */
export function includesAny<T>(
  array: T[],
  values: T[],
  options?: ArrayComparisonOptions
): boolean {
  if (typeof values[0] === 'string' && options?.partial) {
    return array.some(item => 
      typeof item === 'string' && 
      values.some(value => 
        typeof value === 'string' && matchesPartial(item, value, options)
      )
    );
  }
  
  const normalizedValues = values.map(v => normalize(v, options));
  return array.some(item => normalizedValues.includes(normalize(item, options)));
}

/** Check if array includes all of the provided values */
export function includesAll<T>(
  array: T[],
  values: T[],
  options?: ArrayComparisonOptions
): boolean {
  if (typeof values[0] === 'string' && options?.partial) {
    return values.every(value =>
      typeof value === 'string' &&
      array.some(item =>
        typeof item === 'string' && matchesPartial(item, value, options)
      )
    );
  }
  
  const normalizedValues = values.map(v => normalize(v, options));
  return normalizedValues.every(nv =>
    array.some(item => normalize(item, options) === nv)
  );
}

/** Check if array is empty */
export function isEmpty<T>(array: T[]): boolean {
  return array.length === 0;
}

/** Check if array is not empty */
export function isNotEmpty<T>(array: T[]): boolean {
  return array.length > 0;
}

/** Check if two arrays contain the same elements (order doesn't matter) */
export function haveSameElements<T>(
  array1: T[],
  array2: T[],
  options?: ArrayComparisonOptions
): boolean {
  if (array1.length !== array2.length) return false;
  
  const normalized1 = array1.map(v => normalize(v, options));
  const normalized2 = array2.map(v => normalize(v, options));
  
  return normalized1.every(v => normalized2.includes(v)) &&
         normalized2.every(v => normalized1.includes(v));
}