let selectedPeriods = [];
let isSelecting = false;
let firstSelectedIndex = -1;
let periodElements = [];

// Callback to update input with selected periods
let updateInputCallback = () => {};
const eventHandlers = [];

// Initialize drag selection logic and setup event handlers
export function initializeDragSelect(callback) {
    updateInputCallback = callback;

    // Dynamically fetch period elements each time the function is called
    periodElements = document.querySelectorAll('.period');

    periodElements.forEach((periodElement, index) => {
        // Mouse event handlers
        const mousedownHandler = (e) => {
            console.log("mousedownHandler triggered");
            e.preventDefault();
            e.stopPropagation();
            isSelecting = true;
            firstSelectedIndex = index;
            selectedPeriods = [periodElement.dataset.period];
            updateSelectedPeriodsDisplay();
        };

        const mouseoverHandler = (e) => {
            console.log("mouseoverHandler triggered");
            e.stopPropagation();
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

        const mouseupHandler = (e) => {
            console.log("mouseupHandler triggered");
            e.stopPropagation();
            isSelecting = false;
        };

        // Touch event handlers
        const touchstartHandler = (e) => {
            console.log("touchstartHandler triggered");
            e.preventDefault();
            e.stopPropagation();
            isSelecting = true;
            firstSelectedIndex = index;
            selectedPeriods = [periodElement.dataset.period];
            updateSelectedPeriodsDisplay();
        };

        const touchmoveHandler = (e) => {
            console.log("touchmoveHandler triggered");
            e.preventDefault();
            e.stopPropagation();
            const touch = e.touches[0];
            const targetElement = document.elementFromPoint(touch.pageX, touch.pageY);
            if (targetElement && targetElement.classList.contains('period')) {
                const targetIndex = Array.from(periodElements).indexOf(targetElement);
                if (isSelecting && targetIndex !== -1) {
                    const lastIndex = targetIndex;
                    const range = [Math.min(firstSelectedIndex, lastIndex), Math.max(firstSelectedIndex, lastIndex)];
                    selectedPeriods = [];
                    for (let i = range[0]; i <= range[1]; i++) {
                        selectedPeriods.push(periodElements[i].dataset.period);
                    }
                    updateSelectedPeriodsDisplay();
                }
            }
        };

        const touchendHandler = (e) => {
            console.log("touchendHandler triggered");
            e.stopPropagation();
            isSelecting = false;
        };

        // Attach mouse event listeners to each period element
        periodElement.addEventListener('mousedown', mousedownHandler, false);
        periodElement.addEventListener('mouseover', mouseoverHandler, false);
        periodElement.addEventListener('mouseup', mouseupHandler, false);

        // Attach touch event listeners to each period element
        periodElement.addEventListener('touchstart', touchstartHandler, false);
        periodElement.addEventListener('touchmove', touchmoveHandler, false);
        periodElement.addEventListener('touchend', touchendHandler, false);

        // Store event handlers for later removal
        eventHandlers.push({ 
            element: periodElement, 
            events: [
                { type: 'mousedown', handler: mousedownHandler },
                { type: 'mouseover', handler: mouseoverHandler },
                { type: 'mouseup', handler: mouseupHandler },
                { type: 'touchstart', handler: touchstartHandler },
                { type: 'touchmove', handler: touchmoveHandler },
                { type: 'touchend', handler: touchendHandler }
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
