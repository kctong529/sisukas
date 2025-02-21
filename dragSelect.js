let selectedPeriods = [];
let isSelecting = false;
let firstSelectedIndex = -1;
let periodElements = [];

// Callback to update input with selected periods
let updateInputCallback = () => {};
let eventHandlers = [];

// Initialize drag selection logic and setup event handlers
export function initializeDragSelect(callback) {
    updateInputCallback = callback; // Set the callback function to update the input field
    
    // Dynamically fetch period elements each time the function is called
    periodElements = document.querySelectorAll('.period');

    periodElements.forEach((periodElement, index) => {
        // Define event listeners
        const mousedownHandler = () => {
            isSelecting = true;
            firstSelectedIndex = index;
            selectedPeriods = [periodElement.dataset.period]; // Start the selection
            updateSelectedPeriodsDisplay();
        };

        const mouseoverHandler = () => {
            if (isSelecting) {
                const lastIndex = index;
                const range = [Math.min(firstSelectedIndex, lastIndex), Math.max(firstSelectedIndex, lastIndex)];
                selectedPeriods = [];
                for (let i = range[0]; i <= range[1]; i++) {
                    selectedPeriods.push(periodElements[i].dataset.period);
                }
                updateSelectedPeriodsDisplay();
            }
        };

        const mouseupHandler = () => {
            isSelecting = false;
        };

        // Attach event listeners to each period element
        periodElement.addEventListener('mousedown', mousedownHandler);
        periodElement.addEventListener('mouseover', mouseoverHandler);
        periodElement.addEventListener('mouseup', mouseupHandler);

        // Store event handlers for later removal
        eventHandlers.push({ 
            element: periodElement, 
            events: [
                { type: 'mousedown', handler: mousedownHandler },
                { type: 'mouseover', handler: mouseoverHandler },
                { type: 'mouseup', handler: mouseupHandler }
            ]
        });
    });

    function updateSelectedPeriodsDisplay() {
        // Highlight the selected periods
        periodElements.forEach((element) => {
            if (selectedPeriods.includes(element.dataset.period)) {
                element.classList.add('selected');
            } else {
                element.classList.remove('selected');
            }
        });

        // Trigger callback to update input field
        updateInputCallback(selectedPeriods);
    }
}

// Function to remove all event handlers
export function removeEventHandlers() {
    eventHandlers.forEach(({ element, events }) => {
        events.forEach(({ type, handler }) => {
            element.removeEventListener(type, handler);
        });
    });

    // Clear selected periods and reset drag state
    selectedPeriods = [];
    isSelecting = false;
    firstSelectedIndex = -1;

    // Optionally, you can also clear the highlighted periods
    periodElements.forEach((element) => {
        element.classList.remove('selected');
    });
    const periodsContainer = document.getElementById('periods-container');
    periodsContainer.style.display = 'none';
}
