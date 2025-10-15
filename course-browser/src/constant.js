export const FILTER_FIELDS = [
    { value: 'code', text: 'Course Code' },
    { value: 'name', text: 'Course Name' },
    { value: 'period', text: 'Period' },
    { value: 'startDate', text: 'Start Date' },
    { value: 'endDate', text: 'End Date' },
    { value: 'major', text: 'Major' },
    { value: 'minor', text: 'Minor' },
    { value: 'enrollment', text: 'Enrollment' },
    { value: 'organization', text: 'Organization' },
    { value: 'teacher', text: 'Teacher' },
    { value: 'language', text: 'Language' },
    { value: 'credits', text: 'Credits' },
    { value: 'level', text: 'Level' },
];

export const INPUT_HTMLS = {
  language: `
    <select class="filter-value">
      <option value="en">English</option>
      <option value="fi">Finnish</option>
      <option value="sv">Swedish</option>
    </select>`,
  level: `
    <select class="filter-value">
      <option value="basic-studies">Basic Studies</option>
      <option value="intermediate-studies">Intermediate Studies</option>
      <option value="advanced-studies">Advanced Studies</option>
      <option value="other-studies">Other Studies</option>
    </select>`,
  input: `<input type="text" class="filter-value" placeholder="Enter value">`,
  date: `<input type="date" class="filter-value" value="${new Date().toISOString().split('T')[0]}">`
};