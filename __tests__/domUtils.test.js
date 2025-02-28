import { expect, test } from 'vitest';
import { createSelect, populateSelect } from '../src/domUtils.js';

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

test('createSelect generates a select element with no options when options array is empty', () => {
    const selectElement = createSelect('test-class', 'testOnChange()', []);

    // Check the tag name
    expect(selectElement.tagName).toBe('SELECT');

    // Check that no options are present
    const optionElements = selectElement.querySelectorAll('option');
    expect(optionElements.length).toBe(0);
});

// Test populateSelect function directly
test('populateSelect populates the select element with the correct options', () => {
    const selectElement = document.createElement('select'); // Create an empty select element
    const options = [
        { value: 'value1', text: 'Option 1' },
        { value: 'value2', text: 'Option 2' }
    ];

    // Populate the select element with options
    populateSelect(selectElement, options);

    // Check the options
    const optionElements = selectElement.querySelectorAll('option');
    expect(optionElements.length).toBe(2);
    expect(optionElements[0].value).toBe('value1');
    expect(optionElements[0].textContent).toBe('Option 1');
    expect(optionElements[1].value).toBe('value2');
    expect(optionElements[1].textContent).toBe('Option 2');
});

// Test that populateSelect clears existing options before adding new ones
test('populateSelect clears existing options before adding new ones', () => {
    const selectElement = document.createElement('select');
    selectElement.innerHTML = '<option value="existing">Existing Option</option>'; // Add an existing option

    const newOptions = [
        { value: 'value1', text: 'Option 1' },
        { value: 'value2', text: 'Option 2' }
    ];

    // Populate the select element with new options
    populateSelect(selectElement, newOptions);

    // Check that the old options are removed
    const optionElements = selectElement.querySelectorAll('option');
    expect(optionElements.length).toBe(2);
    expect(optionElements[0].value).toBe('value1');
    expect(optionElements[0].textContent).toBe('Option 1');
    expect(optionElements[1].value).toBe('value2');
    expect(optionElements[1].textContent).toBe('Option 2');
});

// Test that populateSelect works with an empty options array
test('populateSelect works with an empty options array', () => {
    const selectElement = document.createElement('select');
    
    // Populate with an empty array
    populateSelect(selectElement, []);

    // Check that no options are added
    const optionElements = selectElement.querySelectorAll('option');
    expect(optionElements.length).toBe(0);
});
