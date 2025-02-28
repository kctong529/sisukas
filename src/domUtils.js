/**
 * Creates a new <select> element with the specified class, event handler, and options.
 * 
 * @param {string} className - The class name to be added to the <select> element for styling.
 * @param {string} onChange - The onchange event handler to be assigned to the <select> element.
 *                             This should be a string representing the function call (e.g., 'handleSelectChange()').
 * @param {Array} options - An array of option objects to populate the <select> element.
 *                          Each object should have:
 *                              - value: The value attribute of the <option>
 *                              - text: The visible text of the <option>
 * 
 * @returns {HTMLSelectElement} - The newly created <select> element with the specified options.
 */
export function createSelect(className, onChange, options) {
    const select = document.createElement('select');
    if (className) select.classList.add(className);
    if (onChange) select.setAttribute('onchange', onChange);

    populateSelect(select, options);
    return select;
}

/**
 * Populates an existing <select> element with <option> elements based on the provided options.
 * If the <select> already has options, they are cleared before adding the new ones.
 * 
 * @param {HTMLSelectElement} selectElement - The existing <select> element to be populated.
 * @param {Array} options - An array of option objects used to populate the <select> element.
 *                          Each object should have:
 *                              - value: The value attribute of the <option>
 *                              - text: The visible text of the <option>
 */
export function populateSelect(selectElement, options) {
    selectElement.innerHTML = '';
    selectElement.innerHTML = options.map(option => 
        `<option value="${option.value}">${option.text}</option>`
    ).join('');
}
