// src/domain/filters/utils/RelationLabels.ts

export const RELATION_LABELS: Record<string, string> = {
  // Text relations
  'contains': 'Contains',
  'notContains': 'Does Not Contain',
  'equals': 'Equals',
  'notEquals': 'Does Not Equal',
  'startsWith': 'Starts With',
  'endsWith': 'Ends With',
  'matches': 'Matches (regex)',
  
  // Numeric relations
  'minEquals': 'At Least',
  'maxEquals': 'At Most',
  'includes': 'Include',
  'notIncludes': 'Does Not Include',
  
  // Date relations
  'before': 'Before',
  'after': 'After',
  'onOrBefore': 'On or Before',
  'onOrAfter': 'On or After',
  'between': 'Between',
  
  // Date range relations
  'overlaps': 'Overlaps',
  'within': 'Within',
  'containsDate': 'Contains',
  'isCompletelyBefore': 'Is Completely Before',
  'isCompletelyAfter': 'Is Completely After',
  
  // Categorical relations
  'isOneOf': 'Is One Of',
  'isNotOneOf': 'Is Not One Of',
  'includesAny': 'Includes Any',
  'includesAll': 'Includes All',
  'isEmpty': 'Is Empty',
  'isNotEmpty': 'Is Not Empty',
  
  // Membership relations
  'isMemberOf': 'Is',
  'isNotMemberOf': 'Is Not'
};

export function formatRelationLabel(relation: string): string {
  return RELATION_LABELS[relation] || relation;
}