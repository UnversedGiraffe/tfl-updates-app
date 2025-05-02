// --- Configuration ---
// !!! IMPORTANT: Replace with your actual API Gateway Invoke URL !!!
const API_BASE_URL = "https://eu9oxde9zh.execute-api.eu-west-2.amazonaws.com/prod"; // Replace if needed
// Fetch all modes that might be needed by any tab
const MODES_TO_FETCH = "tube,dlr,overground,elizabeth-line,tram"; 
const API_ENDPOINT = `${API_BASE_URL}/modes/${MODES_TO_FETCH}/status`;
const REFRESH_INTERVAL_MS = 60000; // Refresh every 60 seconds

// --- DOM Elements ---
const statusContainer = document.getElementById("status-container");
const loadingMessage = document.getElementById("loading-message"); // Keep ref if needed elsewhere, or remove if #status-container innerHTML is enough
const timestampSpan = document.getElementById("timestamp");
const modeTabsContainer = document.querySelector(".mode-tabs"); // Get the tab container

// --- Global State ---
let fullStatusData = []; // Store the last full fetch results

// --- TfL Line Colours (Add more as needed) ---
const lineColors = {
    bakerloo: "#B36305",
    central: "#E32017",
    circle: "#FFD300",
    district: "#007849",
    "hammersmith-city": "#F4A9BE",
    jubilee: "#A0A5A9",
    metropolitan: "#9B0056",
    northern: "#000000",
    piccadilly: "#003688",
    victoria: "#0098D4",
    "waterloo-city": "#95CDBA",
    dlr: "#00A4A7",
    "london-overground": "#EE7C0E", 
    overground: "#EE7C0E", 
    "elizabeth-line": "#6950a1",
    tram: "#84B817",
    default: "#cccccc" // Default grey
};

// --- Functions ---

/**
 * Fetches status data from the API endpoint.
 * @returns {Promise<Array>} A promise that resolves with the array of status data.
 */
async function fetchStatusData() {
  console.log("Fetching status from:", API_ENDPOINT);
  // Show loading message visually if container is empty
  if (!statusContainer.querySelector('.status-card') && !statusContainer.querySelector('.error-message')) {
       statusContainer.innerHTML = '<p id="loading-message">Loading live status...</p>';
  }

  try {
    const response = await fetch(API_ENDPOINT);
    if (!response.ok) {
      let errorMsg = `API request failed: ${response.status}`;
      try {
        const errorBody = await response.json();
        errorMsg = errorBody.error || errorMsg;
      } catch (e) {}
      throw new Error(errorMsg);
    }
    const data = await response.json();
    console.log("Full data received:", data);
    return data;
  } catch (error) {
    console.error("Error fetching status data:", error);
    throw error;
  }
}

/**
 * Creates CSS class name for status text based on the status description.
 * @param {string} statusText - The status description (e.g., "Good Service").
 * @returns {string} CSS class for the status span.
 */
function getStatusTextClass(statusText) {
  const baseClass = (statusText || "unknown")
    .toLowerCase()
    .replace(/\s+/g, "-");

  if (baseClass.includes("good-service")) return "status-good-service";
  if (baseClass.includes("minor-delays")) return "status-minor-delays";
  if (
    baseClass.includes("severe-delays") ||
    baseClass.includes("part-closure") ||
    baseClass.includes("planned-closure") ||
    baseClass.includes("closed") ||
    baseClass.includes("suspended")
  ) return "status-severe-delays"; 
  if (baseClass.includes("special-service")) return "status-special-service";
  if (baseClass.includes("not-available")) return "status-not-available";
  if (baseClass.includes("parse-error")) return "status-parse-error";
  
  return "status-unknown"; 
}


/**
 * Renders the filtered status data onto the page.
 * @param {Array} filteredData - Array of status objects for the selected mode(s).
 */
function renderStatuses(filteredData) {
  statusContainer.innerHTML = ""; // Clear previous content/loading message

  if (!filteredData || filteredData.length === 0) {
    const activeTabButton = modeTabsContainer.querySelector('.tab-button.active');
    const currentTabLabel = activeTabButton ? activeTabButton.textContent.trim() : 'selected view';
    statusContainer.innerHTML = `<p>No status available for ${currentTabLabel}.</p>`;
    return;
  }

  filteredData.forEach((item) => {
    const card = document.createElement("div");
    const lineDetailsDiv = document.createElement("div"); 
    const lineNameSpan = document.createElement("span");
    const statusSpan = document.createElement("span");

    // Use line id (more reliable for mapping) if available, fallback to name
    // Convert to lowercase, handle '&', replace spaces for key matching
    const lineIdForColor = (item.id || item.line || 'default')
                            .toLowerCase()
                            .replace(/&/g, 'and')
                            .replace(/\s+/g, '-'); 
    const color = lineColors[lineIdForColor] || lineColors.default;
    
    const statusClass = getStatusTextClass(item.status);

    card.classList.add("status-card");
    card.style.setProperty('--line-color', color); // Set CSS variable for border

    lineDetailsDiv.classList.add("line-details");
    lineNameSpan.classList.add("line-name");
    lineNameSpan.textContent = item.line; // Display name

    statusSpan.classList.add("line-status", statusClass); 
    statusSpan.textContent = item.status;

    lineDetailsDiv.appendChild(lineNameSpan);
    lineDetailsDiv.appendChild(statusSpan);
    card.appendChild(lineDetailsDiv);
    statusContainer.appendChild(card);
  });
}

/**
 * Updates the timestamp display.
 */
function updateTimestamp() {
  const now = new Date();
  const timeString = now.toLocaleTimeString("en-GB");
  timestampSpan.textContent = timeString;
}

/**
 * Handles errors during the fetch/render process.
 * @param {Error} error - The error object.
 */
function handleError(error) {
    statusContainer.innerHTML = `<p class="error-message">Failed to load status: ${error.message}</p>`;
    timestampSpan.textContent = "Error";
}

/**
 * Filters the stored full data based on the currently active tab and renders it.
 */
function displayStatusForActiveTab() {
    const activeButton = modeTabsContainer.querySelector('.tab-button.active');
    if (!activeButton) {
        console.error("No active tab button found.");
        renderStatuses([]); // Render empty state
        return;
    }

    const modesToShowStr = activeButton.dataset.modes; // e.g., "tube,elizabeth-line,dlr,..."
    if (!modesToShowStr) {
         console.error("Active tab button missing data-modes attribute.");
         renderStatuses([]);
         return;
    }

    const modesToShowArr = modesToShowStr.split(','); // ['tube', 'elizabeth-line', ...]
    console.log(`Filtering for active tab modes: ${modesToShowArr.join(', ')}`);
    
    if (!fullStatusData || fullStatusData.length === 0) {
        console.log("No data available to filter.");
        renderStatuses([]); 
        return;
    }
    
    // Filter based on the 'mode' property returned by the Lambda
    const filteredData = fullStatusData.filter(item => modesToShowArr.includes(item.mode));
    renderStatuses(filteredData);
}


/**
 * Main function to load data and update the UI based on the active tab.
 */
async function loadAndRenderStatus() {
  try {
    fullStatusData = await fetchStatusData(); // Fetch/refresh ALL data and store it
    displayStatusForActiveTab(); // Filter and display based on current active tab
    updateTimestamp();
  } catch (error) {
    handleError(error);
  }
}

/**
 * Handles clicks within the tab container.
 * @param {Event} event - The click event object.
 */
function handleTabClick(event) {
    // Check if the clicked element is a tab button AND not already active
    const clickedButton = event.target.closest('.tab-button');
    if (!clickedButton || clickedButton.classList.contains('active')) {
        return; // Ignore clicks not on inactive buttons
    }

    // Remove active class from all buttons
    const allButtons = modeTabsContainer.querySelectorAll('.tab-button');
    allButtons.forEach(button => button.classList.remove('active'));

    // Add active class to the clicked button
    clickedButton.classList.add('active');

    // Re-filter and display data based on the newly active tab
    displayStatusForActiveTab();
}


// --- Event Listeners & Initial Load ---

// Add single event listener to the container for delegation
if (modeTabsContainer) {
    modeTabsContainer.addEventListener('click', handleTabClick);
} else {
    console.error("Mode tabs container not found!");
}


// Perform initial load when the script runs
loadAndRenderStatus();

// Set up interval to refresh ALL data periodically
// displayStatusForActiveTab will ensure the correct filter is applied after refresh
setInterval(loadAndRenderStatus, REFRESH_INTERVAL_MS);
