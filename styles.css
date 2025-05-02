// --- Configuration ---
const API_BASE_URL = "https://eu9oxde9zh.execute-api.eu-west-2.amazonaws.com/prod"; // Replace
const MODES_TO_FETCH = "tube,dlr,overground,elizabeth-line,tram"; // Fetch all modes for filtering
const API_ENDPOINT = `${API_BASE_URL}/modes/${MODES_TO_FETCH}/status`;
const REFRESH_INTERVAL_MS = 60000; // Refresh every 60 seconds

// --- DOM Elements ---
const statusContainer = document.getElementById("status-container");
const loadingMessage = document.getElementById("loading-message");
const timestampSpan = document.getElementById("timestamp");
const modeSelect = document.getElementById("mode-select"); // Get the dropdown

// --- Global State ---
let fullStatusData = []; // Store the last full fetch results
let currentSelectedMode = 'tube'; // Default to tube

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
    "london-overground": "#EE7C0E", // Note: Overground ID might be different - check API response if needed
    overground: "#EE7C0E", // Add common variation
    "elizabeth-line": "#6950a1",
    tram: "#84B817",
    // Add colours for any other lines/modes if needed
    default: "#cccccc" // Default grey
};

// --- Functions ---

/**
 * Fetches status data from the API endpoint.
 * @returns {Promise<Array>} A promise that resolves with the array of status data.
 */
async function fetchStatusData() {
  console.log("Fetching status from:", API_ENDPOINT);
  // Show loading message only if container is empty (initial load)
  if (!statusContainer.hasChildNodes() || statusContainer.textContent.trim() === "") {
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

  // Prioritize finding specific classes, default otherwise
  if (baseClass.includes("good-service")) return "status-good-service";
  if (baseClass.includes("minor-delays")) return "status-minor-delays";
  if (
    baseClass.includes("severe-delays") ||
    baseClass.includes("part-closure") ||
    baseClass.includes("planned-closure") ||
    baseClass.includes("closed") ||
    baseClass.includes("suspended")
  ) return "status-severe-delays"; // Group major issues
  if (baseClass.includes("special-service")) return "status-special-service";
  if (baseClass.includes("not-available")) return "status-not-available";
  if (baseClass.includes("parse-error")) return "status-parse-error";
  
  return "status-unknown"; // Default class
}


/**
 * Renders the filtered status data onto the page.
 * @param {Array} filteredData - Array of status objects for the selected mode.
 */
function renderStatuses(filteredData) {
  // Clear previous content
  statusContainer.innerHTML = "";

  if (!filteredData || filteredData.length === 0) {
    statusContainer.innerHTML = `<p>No status available for ${currentSelectedMode}.</p>`;
    return;
  }

  filteredData.forEach((item) => {
    // Create elements
    const card = document.createElement("div");
    const lineDetailsDiv = document.createElement("div"); // Wrapper for name/status
    const lineNameSpan = document.createElement("span");
    const statusSpan = document.createElement("span");

    // Get line color - use line ID (often more consistent) if available, fallback to name
    const lineIdForColor = item.line ? item.line.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '-') : 'default';
    const color = lineColors[lineIdForColor] || lineColors.default;
    
    // Get CSS class for status text
    const statusClass = getStatusTextClass(item.status);

    // Set classes, content, and style
    card.classList.add("status-card");
    // Apply line color using CSS variable for the ::before pseudo-element or border
    card.style.setProperty('--line-color', color); 

    lineDetailsDiv.classList.add("line-details");

    lineNameSpan.classList.add("line-name");
    lineNameSpan.textContent = item.line; // Use the display name

    statusSpan.classList.add("line-status", statusClass); // Add status severity class for text color
    statusSpan.textContent = item.status;

    // Append elements
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
 * Filters the full data based on the selected mode and renders it.
 */
function displayFilteredStatus() {
    currentSelectedMode = modeSelect.value;
    console.log(`Filtering for mode: ${currentSelectedMode}`);
    if (!fullStatusData || fullStatusData.length === 0) {
        console.log("No data available to filter.");
        renderStatuses([]); // Render empty state
        return;
    }
    // Filter based on the 'mode' property returned by the updated Lambda
    const filteredData = fullStatusData.filter(item => item.mode === currentSelectedMode);
    renderStatuses(filteredData);
}


/**
 * Main function to load data and update the UI.
 */
async function loadAndRenderStatus() {
  try {
    fullStatusData = await fetchStatusData(); // Fetch all data and store it
    displayFilteredStatus(); // Filter and display based on current dropdown
    updateTimestamp();
  } catch (error) {
    handleError(error);
  }
}

// --- Event Listeners & Initial Load ---

// Add event listener for dropdown changes
modeSelect.addEventListener('change', displayFilteredStatus);

// Perform initial load when the script runs
loadAndRenderStatus();

// Set up interval to refresh data periodically
setInterval(loadAndRenderStatus, REFRESH_INTERVAL_MS);
