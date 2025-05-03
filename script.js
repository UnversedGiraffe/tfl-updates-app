// --- Configuration ---
const API_BASE_URL = "https://eu9oxde9zh.execute-api.eu-west-2.amazonaws.com/prod";

// Fetch all modes that might be needed by any tab
const MODES_TO_FETCH = "tube,dlr,overground,elizabeth-line,tram";
const API_ENDPOINT = `${API_BASE_URL}/modes/${MODES_TO_FETCH}/status`;
const REFRESH_INTERVAL_MS = 60000; // Refresh every 60 seconds

// --- DOM Elements ---
const statusContainer = document.getElementById("status-container");

const timestampSpan = document.getElementById("timestamp");
const modeTabsContainer = document.querySelector(".mode-tabs"); // Get the tab container

const modalOverlay = document.getElementById('detail-modal');
const modalDetailsContent = document.getElementById('modal-details-content');
const modalCloseBtn = document.querySelector('.modal-close-btn'); // Use querySelector for class

// --- Global State ---
let fullStatusData = []; // Store the last full fetch results

// --- TfL Line Colours ---
const lineColors = {
    bakerloo: "#B36305",
    central: "#E32017",
    circle: "#FFD300",
    district: "#007849",
    'hammersmith-city': "#F4A9BE",
    jubilee: "#A0A5A9",
    metropolitan: "#9B0056",
    northern: "#000000",
    piccadilly: "#003688",
    victoria: "#0098D4",
    'waterloo-city': "#95CDBA",
    dlr: "#00A4A7",
    'london-overground': "#EE7C0E",
    overground: "#EE7C0E",
    'elizabeth-line': "#6950a1",
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
    // Add default 'unknown' mode if missing - helps filtering later
    return data.map(item => ({ ...item, mode: item.mode || 'unknown' }));
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
 * @param {Array} filteredData - Array of status objects [{id:..., line:..., status:..., mode:...}].
 */
function renderStatuses(filteredData) {
  statusContainer.innerHTML = ""; // Clear previous content/loading message

  if (!filteredData || filteredData.length === 0) {
    const activeTabButton = modeTabsContainer?.querySelector('.tab-button.active');
    const currentTabLabel = activeTabButton ? activeTabButton.textContent.trim() : 'selected view';
    statusContainer.innerHTML = `<p>No status available for ${currentTabLabel}.</p>`;
    return;
  }

  filteredData.forEach((item) => {
    const card = document.createElement("div");
    const lineDetailsDiv = document.createElement("div");
    const lineNameSpan = document.createElement("span");
    const statusSpan = document.createElement("span");

    // Use line id (more reliable) or name for color mapping key
    const lineIdForColor = (item.id || item.line || 'default')
                            .toLowerCase()
                            .replace(/&/g, 'and')
                            .replace(/\s+/g, '-');
    const color = lineColors[lineIdForColor] || lineColors.default;

    const statusClass = getStatusTextClass(item.status);

    card.classList.add("status-card");
    // Add the line ID as a data attribute for click handling
    if (item.id) {
        card.dataset.lineId = item.id;
    }
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
  if (timestampSpan) {
      timestampSpan.textContent = timeString;
  }
}

/**
 * Handles errors during the fetch/render process.
 * @param {Error} error - The error object.
 */
function handleError(error) {
    if (statusContainer) {
        statusContainer.innerHTML = `<p class="error-message">Failed to load status: ${error.message}</p>`;
    }
    if (timestampSpan) {
        timestampSpan.textContent = "Error";
    }
}

/**
 * Filters the stored full data based on the currently active tab and renders it.
 */
function displayStatusForActiveTab() {
    if (!modeTabsContainer) {
        console.warn("Tab container not found, rendering all data.");
        renderStatuses(fullStatusData || []);
        return;
    }

    const activeButton = modeTabsContainer.querySelector('.tab-button.active');
    if (!activeButton) {
        console.error("No active tab button found.");
        renderStatuses([]);
        return;
    }

    const modesToShowStr = activeButton.dataset.modes;
    if (typeof modesToShowStr !== 'string') {
         console.error("Active tab button missing valid data-modes attribute.");
         renderStatuses([]);
         return;
    }

    const modesToShowArr = modesToShowStr.split(',');
    console.log(`Filtering for active tab modes: ${modesToShowArr.join(', ')}`);

    if (!fullStatusData || fullStatusData.length === 0) {
        console.log("No data available to filter.");
        renderStatuses([]);
        return;
    }

    // Filter based on the 'mode' property returned by the Lambda
    const filteredData = fullStatusData.filter(item => item.mode && modesToShowArr.includes(item.mode)); // Check item.mode exists
    renderStatuses(filteredData);
}


/**
 * Main function to load data and update the UI based on the active tab.
 */
async function loadAndRenderStatus() {
  try {
    fullStatusData = await fetchStatusData();
    displayStatusForActiveTab();
    updateTimestamp();
  } catch (error) {
    handleError(error);
  }
}

/**
 * Handles clicks within the tab container using event delegation.
 * @param {Event} event - The click event object.
 */
function handleTabClick(event) {
    const clickedButton = event.target.closest('.tab-button');
    if (!clickedButton || clickedButton.classList.contains('active')) {
        return;
    }

    const currentActiveButton = modeTabsContainer.querySelector('.tab-button.active');
    if (currentActiveButton) {
        currentActiveButton.classList.remove('active');
    }
    clickedButton.classList.add('active');
    displayStatusForActiveTab(); // Re-filter and display
}

/**
 * Handles clicks on the status list container (delegated).
 * Fetches details for the clicked line and displays them.
 * @param {Event} event - The click event object.
 */
async function handleLineClick(event) { 
  const clickedCard = event.target.closest('.status-card');
  
  if (clickedCard && clickedCard.dataset.lineId) {
      const lineId = clickedCard.dataset.lineId;
      console.log("Clicked Line ID:", lineId); 

      // Highlight selected card
      document.querySelectorAll('.status-card.selected').forEach(el => el.classList.remove('selected'));
      clickedCard.classList.add('selected'); 

      // --- Check screen width ---
      const isDesktop = window.matchMedia("(min-width: 900px)").matches;

      let targetContentElement;
      if (isDesktop) {
          // Desktop: Use the panel
          const detailsPanel = document.getElementById('line-detail-container');
          targetContentElement = detailsPanel?.querySelector('.details-content'); 
           if (!targetContentElement) { console.error("Details panel content area not found!"); return; }
           // Ensure panel is visible (CSS should handle this via media query)
           // detailsPanel.style.display = 'flex'; // Probably not needed if CSS is correct
      } else {
          // Mobile: Use the modal
           targetContentElement = modalDetailsContent;
           if (!targetContentElement || !modalOverlay) { console.error("Modal elements not found!"); return; }
           modalOverlay.hidden = false; // Show the modal overlay
      }

      // Show loading state in the target container
      targetContentElement.innerHTML = '<p>Loading details...</p>'; 
      
      // Construct URL and Fetch
      const detailUrl = `${API_BASE_URL}/lines/${lineId}/details`;
      console.log("Fetching details from:", detailUrl);

      try {
          const response = await fetch(detailUrl);
          if (!response.ok) {
              let errorMsg = `API request failed: ${response.status}`;
              try { const errorBody = await response.json(); errorMsg = errorBody.error || errorMsg; } catch (e) {}
              throw new Error(errorMsg);
          }
          const detailData = await response.json();
          console.log("Received details:", detailData);

          // Render details into the correct container (panel or modal)
          renderLineDetails(detailData, targetContentElement);

      } catch (error) {
          console.error(`Error fetching details for ${lineId}:`, error);
          // Show error in the correct container
          targetContentElement.innerHTML = `<p class="error-message">Could not load details: ${error.message}</p>`;
      }
  }
}

// --- ADD Function to Close Modal ---
function closeModal() {
  if(modalOverlay) {
      modalOverlay.hidden = true; // Hide the modal
  }
}

// --- Add Event Listeners for Modal ---
if (modalCloseBtn) {
  modalCloseBtn.addEventListener('click', closeModal);
}

// Optional: Close modal if user clicks overlay background
if (modalOverlay) {
  modalOverlay.addEventListener('click', (event) => {
      // Only close if the click is directly on the overlay, not the content inside
      if (event.target === modalOverlay) {
          closeModal();
      }
  });
}

/**
 * Render details into the specified container.
 * @param {object} data - The detailed data object from the backend.
 * @param {HTMLElement} container - The HTML element to render content into.
 */
function renderLineDetails(data, container) {
  container.innerHTML = ''; // Clear loading/previous content

  if (!data) {
      container.innerHTML = '<p>No details available.</p>';
      return;
  }

  // Header with Line Name and Status (use line color?)
  const detailHeader = document.createElement('div');
  detailHeader.classList.add('detail-header'); // Add class for potential styling
  const lineIdForColor = (data.id || data.name || 'default').toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '-');
  const color = lineColors[lineIdForColor] || lineColors.default;
  detailHeader.style.borderLeft = `6px solid ${color}`; // Add color indicator
  detailHeader.style.paddingLeft = '10px';
  detailHeader.style.marginBottom = '1rem';

  const headerText = document.createElement('h3'); // Use H3 for details title
  headerText.textContent = `${data.name || data.id} - ${data.status || 'Status Unknown'}`;
  detailHeader.appendChild(headerText);
  container.appendChild(detailHeader);

  // Disruption Reason (if any)
  if (data.reason) {
      const reasonPara = document.createElement('p');
      reasonPara.classList.add('disruption-reason'); // Add class for styling
      reasonPara.style.fontWeight = 'bold'; // Make reason stand out
      reasonPara.style.marginBottom = '1rem';
      reasonPara.textContent = data.reason;
      container.appendChild(reasonPara);
  }

  // Stations List
  if (data.stations && data.stations.length > 0) {
      const stationsHeader = document.createElement('h4'); // Use H4 for sub-section
      stationsHeader.textContent = 'Stations Served:';
      stationsHeader.style.marginBottom = '0.5rem';
      container.appendChild(stationsHeader);

      const stationList = document.createElement('ul');
      stationList.classList.add('station-list'); // Add class for styling
      stationList.style.paddingLeft = '20px'; // Indent list
      stationList.style.maxHeight = '300px'; // Limit height and make scrollable
      stationList.style.overflowY = 'auto';

      data.stations.forEach(stationName => {
          const li = document.createElement('li');
          li.textContent = stationName;
          stationList.appendChild(li);
      });
      container.appendChild(stationList);
  } else {
      const noStationsPara = document.createElement('p');
      noStationsPara.textContent = 'Station information not available.';
      container.appendChild(noStationsPara);
  }
}

// --- Event Listeners & Initial Load ---

// Listener for Tab clicks
if (modeTabsContainer) {
    modeTabsContainer.addEventListener('click', handleTabClick);
} else {
    console.error("Mode tabs container not found!");
}

// Listener for Line clicks in the status list
if (statusContainer) {
    statusContainer.addEventListener('click', handleLineClick);
} else {
    console.error("Status container not found!");
}

// Perform initial load when the script runs
loadAndRenderStatus();

// Set up interval to refresh ALL data periodically
setInterval(loadAndRenderStatus, REFRESH_INTERVAL_MS);
