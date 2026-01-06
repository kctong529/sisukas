// src/infrastructure/loaders/OrganizationLoader.ts
import organizationsYaml from '../../data/organizations.yaml';

/**
 * Load and validate organization names from YAML
 * 
 * @param yamlData - The parsed YAML data (defaults to imported yaml)
 * @returns Array of organization names
 */
export function loadOrganizations(yamlData = organizationsYaml): string[] {
  if (!yamlData || !Array.isArray(yamlData.organizations)) {
    throw new Error('Invalid organizations data: root must have an "organizations" array');
  }

  const organizations: string[] = [];

  for (const org of yamlData.organizations) {
    // Skip invalid entries
    if (typeof org !== 'string' || org.trim() === '') {
      console.warn('Skipping invalid organization entry:', org);
      continue;
    }

    organizations.push(org.trim());
  }

  // Sort alphabetically for better UX
  return organizations.sort((a, b) => a.localeCompare(b));
}