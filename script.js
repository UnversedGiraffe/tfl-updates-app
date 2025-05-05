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

const lineSearchInput = document.getElementById('line-search-input');

const reverseBtnDesktop = document.getElementById('reverse-direction-btn');
const reverseBtnModal = document.getElementById('reverse-direction-btn-modal');

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
    mildmay: "#0077AD",
    northern: "#000000",
    piccadilly: "#003688",
    victoria: "#0098D4",
    'waterloo-city': "#95CDBA",
    dlr: "#00A4A7",
    'london-overground': "#EE7C0E",
    overground: "#EE7C0E",
    liberty: "#5D6061",
    lioness: "#FAA61A",
    suffragette: "#5BBD72",
    weaver: "#823A62",
    windrush: "#ED1B00",
    'elizabeth': "#60399E",
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
 * Handles errors during fetch/render process, displaying message in target.
 * @param {Error} error - The error object.
 * @param {HTMLElement} [targetElement=statusContainer] - The element to display the error in.
 */
function handleError(error, targetElement = statusContainer) {
    console.error("handleError called:", error, "Target:", targetElement); // Log details
    
    // Determine correct prefix based on where the error should be shown
    const messagePrefix = (targetElement === statusContainer) ? "Failed to load status: " : "Could not load details: ";
    // Construct error message using template literal (backticks)
    const errorMessage = `${messagePrefix}${error ? error.message : 'Unknown error'}`; // Add safety check for error object

    if (targetElement) {
         // Assign the HTML string using template literal (backticks)
         targetElement.innerHTML = `<p class="error-message">${errorMessage}</p>`; 
    } else {
        // Fallback if no target somehow
         console.error("Error handler called without a target element!");
         if (statusContainer) { 
              // Assign the HTML string using template literal (backticks)
              statusContainer.innerHTML = `<p class="error-message">${errorMessage}</p>`;
         }
    }
    // Update timestamp only on general status load failure
    if (targetElement === statusContainer && timestampSpan) { 
        timestampSpan.textContent = "Error"; 
    }
}

/**
 * Filters the stored full data based on the currently active tab AND search input, then renders it.
 */
function displayStatusForActiveTab() {
  if (!modeTabsContainer || !statusContainer || !lineSearchInput) { 
      console.error("Required elements not found for filtering/rendering.");
      return; 
  }

  // --- Filter by Active Tab ---
  const activeButton = modeTabsContainer.querySelector('.tab-button.active');
  if (!activeButton) { renderStatuses([]); return; } // Should have an active tab

  const modesToShowStr = activeButton.dataset.modes;
  if (typeof modesToShowStr !== 'string') { renderStatuses([]); return; }

  const modesToShowArr = modesToShowStr.split(',');
  console.log(`Filtering for active tab modes: ${modesToShowArr.join(', ')}`);

  let tabFilteredData = [];
  if (fullStatusData && fullStatusData.length > 0) {
      tabFilteredData = fullStatusData.filter(item => 
          item.mode && modesToShowArr.includes(item.mode)
      );
  }

  // --- Filter by Search Term ---
  const searchTerm = lineSearchInput.value.trim().toLowerCase();
  let finalFilteredData = tabFilteredData; // Start with tab results

  if (searchTerm) { // Only apply search filter if there's a search term
      finalFilteredData = tabFilteredData.filter(item => 
          item.line && item.line.toLowerCase().includes(searchTerm) // Check if line name includes term
      );
      console.log(`Additionally filtering for search term: "${searchTerm}". Count: ${finalFilteredData.length}`);
  }

  // --- Render the final list ---
  renderStatuses(finalFilteredData); 
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
 * Fetches details and displays in panel (desktop) or modal (mobile).
 * @param {Event} event - The click event object.
 */
async function handleLineClick(event) {
  const clickedCard = event.target.closest('.status-card');
  if (!clickedCard || !clickedCard.dataset.lineId) return;

  const lineId = clickedCard.dataset.lineId;
  console.log("Clicked Line ID:", lineId);

  document.querySelectorAll('.status-card.selected').forEach(el => el.classList.remove('selected'));
  clickedCard.classList.add('selected');

  const isDesktop = window.matchMedia("(min-width: 900px)").matches;
  let targetPanelElement; 
  let targetContentElement; 
  let currentButton;      

  if (isDesktop) {
      targetPanelElement = document.getElementById('line-detail-container');
      targetContentElement = targetPanelElement?.querySelector('.details-content');
      currentButton = reverseBtnDesktop; 
      if (!targetPanelElement || !targetContentElement) { console.error("Desktop details panel elements not found!"); return; }
      targetPanelElement.style.display = 'flex';
  } else {
      targetPanelElement = modalOverlay;
      targetContentElement = modalDetailsContent;
      currentButton = reverseBtnModal;
      if (!targetPanelElement || !targetContentElement) { console.error("Modal elements not found!"); return; }
      targetPanelElement.hidden = false; 
  }

  // Disable button before fetch
  if (currentButton) currentButton.disabled = true; 
  targetContentElement.innerHTML = '<p>Loading details...</p>'; 

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

      // Store state needed for reverse button handler BEFORE rendering
      targetContentElement.dataset.lineId = lineId; 
      targetContentElement.dataset.direction = detailData.direction || 'outbound'; 

      renderLineDetails(detailData, targetContentElement); 

      // Enable button only AFTER successful render
      if (currentButton) {
          currentButton.disabled = false;
      }

  } catch (error) {
      // --- ADDED LOGGING IN CATCH BLOCK ---
      console.error(`Error fetching details inside handleLineClick for ${lineId}:`, error);
      console.log("Target element passed to handleError:", targetContentElement);
      // --- END ADDED LOGGING ---
      handleError(error, targetContentElement); // Pass specific target
  }
}

/**
 * --- MODIFIED: Closes the Modal and disables its button. ---
 */
function closeModal() {
    if(modalOverlay) {
        modalOverlay.hidden = true;
    }
    // De-select card
    document.querySelectorAll('.status-card.selected').forEach(el => el.classList.remove('selected'));
    // Disable modal button when closing
    if (reverseBtnModal) {
        reverseBtnModal.disabled = true;
    }
}

/**
 * NEW: Handles clicks on the "Switch Direction" buttons.
 * @param {Event} event - The click event object.
 */
async function handleReverseDirectionClick(event) {
  const clickedButton = event.target; // The button element that was clicked
  // Determine if we are in the modal or the panel to find the correct content container
  const targetContentElement = clickedButton.closest('.details-content') || clickedButton.closest('#modal-details-content');
  
  if (!targetContentElement || !targetContentElement.dataset.lineId || !targetContentElement.dataset.direction) {
      console.error("Could not find lineId or current direction from target container's dataset.");
      return;
  }

  const lineId = targetContentElement.dataset.lineId;
  const currentDirection = targetContentElement.dataset.direction;
  const newDirection = currentDirection === 'outbound' ? 'inbound' : 'outbound';

  console.log(`Reversing direction for ${lineId} from ${currentDirection} to ${newDirection}`);

  // Disable button and show loading
  clickedButton.disabled = true;
  targetContentElement.innerHTML = `<p>Loading ${newDirection} route...</p>`;

  const detailUrl = `${API_BASE_URL}/lines/${lineId}/details?direction=${newDirection}`;
  console.log("Fetching details from:", detailUrl);

  try {
      const response = await fetch(detailUrl);
      if (!response.ok) {
          let errorMsg = `API request failed: ${response.status}`;
          try { const errorBody = await response.json(); errorMsg = errorBody.error || errorMsg; } catch (e) {}
          throw new Error(errorMsg);
      }
      const detailData = await response.json();
      console.log("Received reversed details:", detailData);

      // Update the stored direction state
      targetContentElement.dataset.direction = detailData.direction || newDirection;

      // Re-render the details
      renderLineDetails(detailData, targetContentElement);

  } catch (error) {
      console.error(`Error fetching reversed details for ${lineId}:`, error);
      handleError(error, targetContentElement); // Show error in the details container
  } finally {
      // Re-enable the button regardless of success or failure (unless error indicates permanent issue)
      clickedButton.disabled = false; 
  }
}

/**
 * --- NEW FUNCTION: Handles clicks on the "Switch Direction" buttons. ---
 * Fetches and displays the opposite route sequence.
 * @param {Event} event - The click event object.
 */
async function handleReverseDirectionClick(event) {
  const clickedButton = event.target; // The button element that was clicked
  // Find the relevant content container associated with the button clicked
  const isModalButton = clickedButton.id === 'reverse-direction-btn-modal';
  const targetContentElement = isModalButton 
      ? modalDetailsContent 
      : document.querySelector('#line-detail-container .details-content');

  if (!targetContentElement) { console.error("Cannot find target content element for reverse direction."); return; }
  
  // Retrieve state stored by handleLineClick
  const lineId = targetContentElement.dataset.lineId;
  const currentDirection = targetContentElement.dataset.direction;

  if (!lineId || !currentDirection) {
      console.error("Missing lineId or direction state on target container's dataset.");
      handleError(new Error("Cannot determine current line or direction to reverse."), targetContentElement);
      return;
  }

  // Determine the direction to fetch
  const newDirection = currentDirection === 'outbound' ? 'inbound' : 'outbound';
  console.log(`Reversing direction for ${lineId} from ${currentDirection} to ${newDirection}`);

  clickedButton.disabled = true; // Disable button during fetch
  targetContentElement.innerHTML = `<p>Loading ${newDirection} route...</p>`; // Show loading in details area

  // Construct URL with direction parameter
  const detailUrl = `${API_BASE_URL}/lines/${lineId}/details?direction=${newDirection}`;
  console.log("Fetching reversed details from:", detailUrl);

  try {
      const response = await fetch(detailUrl);
      if (!response.ok) {
          let errorMsg = `API request failed: ${response.status}`;
          try { const errorBody = await response.json(); errorMsg = errorBody.error || errorMsg; } catch (e) {}
          throw new Error(errorMsg);
      }
      const detailData = await response.json();
      console.log("Received reversed details:", detailData);

      // Update the stored direction state on the container
      targetContentElement.dataset.direction = detailData.direction || newDirection;

      // Re-render the details with the new data
      renderLineDetails(detailData, targetContentElement);

  } catch (error) {
      console.error(`Error fetching reversed details for ${lineId}:`, error);
      handleError(error, targetContentElement); // Show error in the details container
  } finally {
      // Re-enable the button once done (in finally block)
      clickedButton.disabled = false; 
  }
}

// --- Add Event Listeners for Modal ---
if (modalCloseBtn) {
  modalCloseBtn.addEventListener('click', closeModal);
} else { console.warn("Modal close button not found!"); }

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
 * Renders the detailed data into the specified container (panel OR modal).
 * Creates structure using nested divs within list items for better alignment control.
 * Creates dedicated <li> for zone dividers.
 * Sets --line-color CSS variable for the list.
 * @param {object} data - The detailed data object from the backend.
 * @param {HTMLElement} container - The HTML element to render content into.
 */
function renderLineDetails(data, container) {
  container.innerHTML = ''; // Clear loading/previous content
  if (!data) {
      container.innerHTML = '<p>No details available.</p>';
      return;
  }

  // --- Render Header --- (Keep as is)
  const detailHeader = document.createElement('div');
  detailHeader.classList.add('detail-header');
  const lineIdForColor = (data.id || data.name || 'default').toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '-');
  const color = lineColors[lineIdForColor] || lineColors.default;
  detailHeader.style.borderLeft = `6px solid ${color}`;
  detailHeader.style.paddingLeft = '10px';
  detailHeader.style.marginBottom = '1rem';
  const headerText = document.createElement('h3');
  headerText.textContent = `${data.name || data.id} - ${data.status || 'Status Unknown'}`;
  detailHeader.appendChild(headerText);
  container.appendChild(detailHeader);

  // --- Render Disruption Reason --- (Keep as is)
  if (data.reason) {
      const reasonPara = document.createElement('p');
      reasonPara.classList.add('disruption-reason');
      // Style using CSS class '.disruption-reason'
      reasonPara.textContent = data.reason;
      container.appendChild(reasonPara);
  }

  // --- Render Ordered Stations List ---
  if (data.stations && data.stations.length > 0) {
      const stationsHeader = document.createElement('h4');
      stationsHeader.textContent = 'Stations';
      // Style using CSS: .details-panel h4, #modal-details-content h4 { margin-bottom: 0.5rem; }
      container.appendChild(stationsHeader);

      const stationList = document.createElement('ul');
      stationList.classList.add('station-sequence-list');
      // Set CSS Variable for line color on the list itself (for ::before line & markers)
      stationList.style.setProperty('--line-color', color);

      let currentZone = null; // Track zone changes

      // --- Loop through stations to create list items ---
      data.stations.forEach(station => {
          // --- Add Zone Divider LI if zone changed (Reverted Logic) ---
          if (station.zone && station.zone !== currentZone) {
              currentZone = station.zone;
              const zoneDivider = document.createElement('li');
              zoneDivider.classList.add('zone-divider');
              zoneDivider.textContent = `Zone ${currentZone}`;
              // Style using .zone-divider CSS rule (from response #199)
              stationList.appendChild(zoneDivider); // Add divider LI first
          }
          // --- End Zone Logic ---

          // --- Create Station LI (Flex Container) ---
          const li = document.createElement('li');
          li.classList.add('station-item'); // Should have display: flex in CSS

          // --- NEW: Graphic Container (Flex Item 1) ---
          const graphicContainer = document.createElement('div');
          graphicContainer.classList.add('station-graphic');
          // Circle marker will be attached via CSS .station-graphic::before
          li.appendChild(graphicContainer);
          // --- END NEW ---

          // --- NEW: Text Container (Flex Item 2) ---
          const textContainer = document.createElement('div');
          textContainer.classList.add('station-text');

          // Station Name Span (inside text container)
          const stationNameSpan = document.createElement('span');
          stationNameSpan.classList.add('station-name-detail');
          stationNameSpan.textContent = station.name || 'Unknown Station';
          if (station.id) { // station.id is the naptanId
              stationNameSpan.dataset.naptanId = station.id;
              stationNameSpan.title = `View details for ${station.name}`;
              // Style cursor via CSS: .station-name-detail { cursor: pointer; }
          }
          textContainer.appendChild(stationNameSpan);

          // Interchange Indicator Logic (inside text container)
          if (station.lines && Array.isArray(station.lines) && station.lines.length > 1) {
              const indicatorsContainer = document.createElement('span'); // Container for icons
              indicatorsContainer.classList.add('interchange-indicators-container');

              station.lines.forEach(lineId => { // Inner loop for indicator spans
                  if (lineId && data.id && lineId.toLowerCase() === data.id.toLowerCase()) {
                    return; // Skip this line, don't create an indicator for it
                  }
                  const interchangeLineIdKey = (lineId || 'default').toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '-');
                  const interchangeColor = lineColors[interchangeLineIdKey] || lineColors.default;
                  const indicator = document.createElement('span');
                  indicator.classList.add('interchange-line-indicator');
                  indicator.style.backgroundColor = interchangeColor; // Use background color for dot
                  indicator.title = lineId; // Tooltip shows line ID
                  indicatorsContainer.appendChild(indicator);
              });
              textContainer.appendChild(indicatorsContainer); // Append indicators container
          }
          li.appendChild(textContainer); // Add text container to li
          // --- END NEW ---

          stationList.appendChild(li); // Add the complete station li

      }); // --- End of data.stations.forEach loop ---

      container.appendChild(stationList); // Add the populated list to the main container

  } else {
     // --- No Stations Logic ---
     const noStationsPara = document.createElement('p');
     if (data.status && data.status !== "Status Fetch Error" && data.status !== "Status Unavailable") {
          noStationsPara.textContent = 'Route sequence information currently unavailable for this line.';
     } else {
          noStationsPara.textContent = 'Station information not available.';
     }
     container.appendChild(noStationsPara);
  }
  // --- End Stations List Section ---
}

// --- Event Listeners & Initial Load ---

if (reverseBtnDesktop) {
  reverseBtnDesktop.addEventListener('click', handleReverseDirectionClick);
} else { console.warn("Desktop reverse direction button not found!"); }

if (reverseBtnModal) {
  reverseBtnModal.addEventListener('click', handleReverseDirectionClick);
} else { console.warn("Modal reverse direction button not found!"); }

// --- ADD NEW LISTENER for Search Input ---
if (lineSearchInput) {
  // Use 'input' event to trigger on every keystroke/change
  lineSearchInput.addEventListener('input', displayStatusForActiveTab); 
} else {
  console.error("Line search input not found!");
}
// --- END ADDED LISTENER ---

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
