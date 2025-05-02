// --- Configuration ---
// !!! IMPORTANT: Replace this with your actual API Gateway Invoke URL !!!
const API_BASE_URL =
  "https://eu9oxde9zh.execute-api.eu-west-2.amazonaws.com/prod";

const MODES_TO_FETCH = "tube,dlr,overground,elizabeth-line,tram";
const API_ENDPOINT = `${API_BASE_URL}/modes/${MODES_TO_FETCH}/status`;
const REFRESH_INTERVAL_MS = 60000; // Refresh every 60 seconds (60 * 1000 ms)

// --- DOM Elements ---
const statusContainer = document.getElementById("status-container");
const loadingMessage = document.getElementById("loading-message");
const timestampSpan = document.getElementById("timestamp");

// --- Functions ---

/**
 * Fetches status data from the API endpoint.
 * @returns {Promise<Array>} A promise that resolves with the array of status data.
 */
async function fetchStatusData() {
  console.log("Fetching status from:", API_ENDPOINT);
  try {
    const response = await fetch(API_ENDPOINT);

    if (!response.ok) {
      // Try to get error message from API response body if available
      let errorMsg = `API request failed with status ${response.status}`;
      try {
        const errorBody = await response.json();
        errorMsg = errorBody.error || errorMsg; // Use API's error if present
      } catch (e) {
        // Ignore if response body isn't JSON
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    console.log("Data received:", data);
    return data;
  } catch (error) {
    console.error("Error fetching status data:", error);
    throw error; // Re-throw the error to be caught by the caller
  }
}

/**
 * Creates CSS class names based on the status text.
 * @param {string} statusText - The status description (e.g., "Good Service").
 * @returns {{cardClass: string, statusClass: string}} CSS classes for the card and status span.
 */
function getStatusClasses(statusText) {
  const baseClass = (statusText || "unknown")
    .toLowerCase()
    .replace(/\s+/g, "-"); // e.g., "good-service", "minor-delays"

  // Map known base classes to the ones defined in CSS
  let finalStatusClass = "status-unknown";
  let finalCardClass = "line-status-unknown";

  // Add more explicit mappings if needed based on exact TfL responses
  if (baseClass.includes("good-service")) {
    finalStatusClass = "status-good-service";
    finalCardClass = "line-status-good-service";
  } else if (baseClass.includes("minor-delays")) {
    finalStatusClass = "status-minor-delays";
    finalCardClass = "line-status-minor-delays";
  } else if (
    baseClass.includes("severe-delays") ||
    baseClass.includes("part-closure") ||
    baseClass.includes("planned-closure") ||
    baseClass.includes("closed") ||
    baseClass.includes("suspended")
  ) {
    finalStatusClass = "status-severe-delays"; // Using severe-delays style for all major issues
    finalCardClass = "line-status-severe-delays"; // Using severe-delays style for all major issues
  } else if (baseClass.includes("special-service")) {
     finalStatusClass = "status-special-service";
     finalCardClass = "line-status-special-service";
  }
  // Add more else if blocks here for other specific statuses if needed

  return { cardClass: finalCardClass, statusClass: finalStatusClass };
}

/**
 * Renders the status data onto the page.
 * @param {Array} statusData - Array of status objects [{line: ..., status: ...}].
 */
function renderStatuses(statusData) {
  // Clear previous content (loading message or old statuses)
  statusContainer.innerHTML = "";

  if (!statusData || statusData.length === 0) {
    statusContainer.innerHTML = "<p>No status data available.</p>";
    return;
  }

  statusData.forEach((item) => {
    // Create elements
    const card = document.createElement("div");
    const lineNameSpan = document.createElement("span");
    const statusSpan = document.createElement("span");

    // Get CSS classes based on status text
    const { cardClass, statusClass } = getStatusClasses(item.status);

    // Set classes and content
    card.classList.add("status-card", cardClass); 
    lineNameSpan.classList.add("line-name");
    lineNameSpan.textContent = item.line;
    statusSpan.classList.add("line-status", statusClass);
    statusSpan.textContent = item.status;

    // Append elements
    card.appendChild(lineNameSpan);
    card.appendChild(statusSpan);
    statusContainer.appendChild(card);
  });
}

/**
 * Updates the timestamp display.
 */
function updateTimestamp() {
  const now = new Date();
  // Basic HH:MM:SS format
  const timeString = now.toLocaleTimeString("en-GB"); // Use locale for formatting
  timestampSpan.textContent = timeString;
}

/**
 * Handles errors during the fetch/render process.
 * @param {Error} error - The error object.
 */
function handleError(error) {
    statusContainer.innerHTML = `<p class="error-message">Failed to load status: ${error.message}</p>`;
    // Optional: style the .error-message class in CSS
    timestampSpan.textContent = "Error";
}


/**
 * Main function to load data and update the UI.
 */
async function loadAndRenderStatus() {
  try {
    const statusData = await fetchStatusData();
    renderStatuses(statusData);
    updateTimestamp();
  } catch (error) {
    handleError(error);
  }
}

// --- Initial Load & Refresh Interval ---

// Perform initial load when the script runs
loadAndRenderStatus();

// Set up interval to refresh data periodically
setInterval(loadAndRenderStatus, REFRESH_INTERVAL_MS);
