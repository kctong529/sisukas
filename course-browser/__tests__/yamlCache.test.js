import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchYaml, getCachedTimestamp, setCachedTimestamp, parseYaml } from '../src/yamlCache';

// Mock js-yaml
vi.mock('js-yaml', () => ({
  default: {
    load: vi.fn((yamlText) => {
      if (yamlText.includes('invalid')) throw new Error('Invalid YAML');
      return { parsed: 'data' };
    }),
  },
}));

describe('fetchYaml', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should fetch YAML text and headers', async () => {
    const mockHeaders = new Headers({ 'Last-Modified': 'Wed, 21 Oct 2015 07:28:00 GMT' });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        text: () => Promise.resolve('example: data'),
        headers: mockHeaders
      })
    );

    const result = await fetchYaml('https://example.com/data.yaml');
    expect(result).toEqual({
      text: 'example: data',
      headers: mockHeaders
    });
  });

  it('should return null and log an error on fetch failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn(() => Promise.reject('Fetch error'));

    const result = await fetchYaml('https://example.com/data.yaml');
    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith('Error fetching https://example.com/data.yaml:', 'Fetch error');
  });
});

describe('getCachedTimestamp', () => {
  beforeEach(() => {
    localStorage.setItem('testFileTimestamp', 'Wed, 21 Oct 2015 07:28:00 GMT');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should return cached timestamp if present', () => {
    const timestamp = getCachedTimestamp('testFile');
    expect(timestamp).toBe('Wed, 21 Oct 2015 07:28:00 GMT');
  });

  it('should return null if no cached timestamp', () => {
    const timestamp = getCachedTimestamp('nonexistentFile');
    expect(timestamp).toBeNull();
  });
});

describe('setCachedTimestamp', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('should store the timestamp in localStorage', () => {
    setCachedTimestamp('testFile', 'Wed, 21 Oct 2015 07:28:00 GMT');
    expect(localStorage.getItem('testFileTimestamp')).toBe('Wed, 21 Oct 2015 07:28:00 GMT');
  });
});

describe('parseYaml', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should parse valid YAML text', () => {
    const yamlText = 'example: data';
    const result = parseYaml(yamlText);
    expect(result).toEqual({ parsed: 'data' });
  });

  it('should return empty object and log an error on invalid YAML', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const yamlText = 'invalid: :::';
    const result = parseYaml(yamlText);
    expect(result).toEqual({});
    expect(consoleSpy).toHaveBeenCalledWith('Error parsing YAML:', expect.any(Error));
  });
});
