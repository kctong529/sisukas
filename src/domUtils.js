/**
 * Creates a <select> element with specified options and event handling.
 * 
 * @param {string} className - The CSS class to be applied to the <select> element.
 * @param {string} onChange - The function (or function name) to be called when the selection changes.
 * @param {Array} options - An array of objects representing the options to be added to the <select> element. 
 *        Each object should have `value` and `text` properties for the option's value and display text, respectively.
 * 
 * @returns {HTMLElement} The created <select> element.
 */
export function createSelect(className, onChange, options) {
    // Create the <select> element.
    const select = document.createElement('select');
    
    // Add the provided className to the <select> element for styling.
    select.classList.add(className);

    // Set onChange as the onchange event handler for the <select>.
    select.setAttribute('onchange', onChange);

    // Populate the <select> element with <option> elements based on the provided options.
    // The options array is mapped to <option> elements and joined into a string to be injected into the innerHTML.
    select.innerHTML = options.map(option => 
        `<option value="${option.value}">${option.text}</option>`
    ).join('');  // Join options without any separator to form a single string.

    // Return the constructed <select> element.
    return select;
}
