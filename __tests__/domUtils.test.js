import { expect, test } from 'vitest';
import { createSelect } from '../domUtils.js';

test('createSelect generates a select element with the correct options', () => {
    const options = [
        { value: 'value1', text: 'Option 1' },
        { value: 'value2', text: 'Option 2' }
    ];

    const selectElement = createSelect('test-class', 'testOnChange()', options);

    // Check the tag name
    expect(selectElement.tagName).toBe('SELECT');

    // Check the class
    expect(selectElement.classList.contains('test-class')).toBe(true);

    // Check the onchange attribute
    expect(selectElement.getAttribute('onchange')).toBe('testOnChange()');

    // Check the options
    const optionElements = selectElement.querySelectorAll('option');
    expect(optionElements.length).toBe(2);
    expect(optionElements[0].value).toBe('value1');
    expect(optionElements[0].textContent).toBe('Option 1');
    expect(optionElements[1].value).toBe('value2');
    expect(optionElements[1].textContent).toBe('Option 2');
});