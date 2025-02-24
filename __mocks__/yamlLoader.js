import { jest } from '@jest/globals';

export const getYaml = jest.fn().mockResolvedValue({
  load: jest.fn().mockReturnValue({}),  // Mock load() method
});