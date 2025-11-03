// API endpoints
const API_URL = "https://election.prabhatkhabar.com/election/hot-candidate/result";
const YEARS_API_URL = "https://election.prabhatkhabar.com/election/years/Bihar"; // stateName is 'Bihar' by default

// Inject styles
function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    #hot-candidate-status-widget-pk * { box-sizing: border-box; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; }
    #hot-candidate-status-widget-pk { background: #fff; padding: 16px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .widget_hot_candidate_list_title { font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #000; }
    .widget_hot_candidate_list_filters { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
    .widget_hot_candidate_list_filter_group { display: flex; align-items: center; gap: 6px; }
    .widget_hot_candidate_list_filter_label { font-size: 13px; color: #666; margin-right: 6px; }
    .widget_hot_candidate_list_years { display: flex; gap: 6px; }
    .widget_hot_candidate_list_filter_btn { 
      padding: 6px 12px; 
      border-radius: 16px; 
      border: 1px solid #ddd; 
      background: #fff; 
      cursor: pointer; 
      font-size: 13px; 
      font-weight: 500;
      color: #666;
      transition: all 0.2s ease;
      min-width: 50px;
      text-align: center;
    }
    .widget_hot_candidate_list_filter_btn.active { 
      background: #ff6b35; 
      color: #fff; 
      border-color: #ff6b35; 
    }
    .widget_hot_candidate_list_party_select { 
      padding: 6px 12px; 
      border-radius: 16px; 
      border: 1px solid #ddd; 
      font-size: 13px; 
      background: #fff;
      color: #666;
      min-width: 90px;
      cursor: pointer;
    }
    .widget_hot_candidate_list_search { 
      margin-left: auto; 
      position: relative;
    }
    .widget_hot_candidate_list_search input { 
      padding: 6px 12px 6px 32px; 
      border-radius: 16px; 
      border: 1px solid #ddd; 
      font-size: 13px; 
      width: 180px;
      background: #fff;
      color: #333;
    }
    .widget_hot_candidate_list_search::before {
      content: '🔍';
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: #999;
      font-size: 13px;
    }
    .widget_hot_candidate_list_list { margin-top: 12px; }
    .widget_hot_candidate_list_row {
      display: flex;
      align-items: center;
      padding: 10px 0;
      gap: 15px;
      border-bottom: 1px solid #f0f0f0;
      transition: background 0.2s;
      justify-content: space-between;
    }
    .widget_hot_candidate_list_row:last-child { border-bottom: none; }
    .widget_hot_candidate_list_row:hover { background: #fafafa; }
    .widget_hot_candidate_list_candidate_info {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-grow: 1;
      min-width: 150px;
    }
    .widget_hot_candidate_list_img { 
      width: 40px; 
      height: 40px; 
      border-radius: 50%; 
      object-fit: cover; 
      background: #f5f5f5;
      border: 2px solid #eee;
      flex-shrink: 0;
    }
    .widget_hot_candidate_list_name { 
      font-weight: 600; 
      font-size: 14px; 
      color: #000;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .widget_hot_candidate_list_status { 
      padding: 4px 8px;
      border-radius: 16px;
      font-size: 11px;
      font-weight: 700;
      color: #fff;
      min-width: 40px;
      text-align: center;
    }
    .widget_hot_candidate_list_status.won { background: #22c55e; }
    .widget_hot_candidate_list_status.lost { background: #ef4444; }
    .widget_hot_candidate_list_party { 
      display: flex; 
      align-items: center; 
      gap: 6px;
      min-width: 100px;
      flex-shrink: 0;
    }
    .widget_hot_candidate_list_party_logo { 
      width: 28px; 
      height: 28px; 
      border-radius: 50%; 
      object-fit: contain;
      background: #fff;
      border: 1px solid #eee;
      flex-shrink: 0;
    }
    .widget_hot_candidate_list_party_color { 
      width: 28px; 
      height: 28px; 
      border-radius: 50%; 
      border: 1px solid #eee;
      flex-shrink: 0;
    }
    .widget_hot_candidate_list_party_name { 
      font-weight: 700; 
      font-size: 13px; 
      color: #000;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 70px;
    }
    
    @media (max-width: 768px) {
      #hot-candidate-status-widget-pk { padding: 12px; margin: 8px; }
      .widget_hot_candidate_list_title { font-size: 18px; text-align: center; }
      .widget_hot_candidate_list_filters { 
        flex-direction: column; 
        align-items: stretch; 
        gap: 8px; 
      }
      .widget_hot_candidate_list_filter_label { display: block; margin-bottom: 6px; }
      .widget_hot_candidate_list_years { justify-content: left; }
      .widget_hot_candidate_list_search { margin-left: 0; }
      .widget_hot_candidate_list_search input { width: 100%; }
      .widget_hot_candidate_list_row { 
        padding: 8px 0; 
      }
      .widget_hot_candidate_list_img { width: 36px; height: 36px; }
      .widget_hot_candidate_list_candidate_info { min-width: 120px; }
      .widget_hot_candidate_list_name { font-size: 13px; }
      .widget_hot_candidate_list_status { 
        padding: 3px 6px; 
        font-size: 10px; 
        min-width: 35px;
      }
      .widget_hot_candidate_list_party { min-width: 90px; }
      .widget_hot_candidate_list_party_logo, 
      .widget_hot_candidate_list_party_color { width: 24px; height: 24px; }
      .widget_hot_candidate_list_party_name { 
        font-size: 12px; 
        max-width: 55px;
      }
    }
    
    @media (max-width: 480px) {
      .widget_hot_candidate_list_title { font-size: 16px; text-align: center; }
      .widget_hot_candidate_list_filter_btn { padding: 5px 10px; font-size: 11px; }
      .widget_hot_candidate_list_party_select { font-size: 11px; padding: 5px 10px; min-width: 70px; }
      .widget_hot_candidate_list_search input { font-size: 11px; padding: 5px 10px 5px 30px; width: 100%; }
      .widget_hot_candidate_list_search::before {
        left: 8px;
        font-size: 12px;
      }
      .widget_hot_candidate_list_row { 
        justify-content: space-between; padding: 6px 0; 
      }
      .widget_hot_candidate_list_candidate_info { min-width: 100px; gap: 6px; }
      .widget_hot_candidate_list_img { width: 32px; height: 32px; }
      .widget_hot_candidate_list_name { font-size: 12px; }
      .widget_hot_candidate_list_status { 
        padding: 2px 5px; 
        font-size: 8px; 
        min-width: 30px;
      }
      .widget_hot_candidate_list_party { min-width: 70px; gap: 4px; }
      .widget_hot_candidate_list_party_logo, 
      .widget_hot_candidate_list_party_color { width: 20px; height: 20px; }
      .widget_hot_candidate_list_party_name { 
        font-size: 10px; 
        max-width: 40px;
      }
    }
  `;
  document.head.appendChild(style);
}

function renderWidget() {
  const root = document.getElementById("hot-candidate-status-widget-pk");
  root.innerHTML = "";

  // Title
  const title = document.createElement("div");
  title.className = "widget_hot_candidate_list_title";
  title.textContent = "बिहार चुनाव के बड़े चेहरों";
  root.appendChild(title);

  // Filters
  const filters = document.createElement("div");
  filters.className = "widget_hot_candidate_list_filters";

  // State
  let years = [];
  let selectedYear = null;
  let selectedParty = "all";
  let searchTerm = "";
  let allPartiesForYear = [];

  // Filter by label and year buttons
  const filterByLabel = document.createElement("div");
  filterByLabel.className = "widget_hot_candidate_list_filter_label";
  filterByLabel.textContent = "Filter by:";

  // Year filter container
  const yearBtnsContainer = document.createElement("div");
  yearBtnsContainer.className = "widget_hot_candidate_list_years";

  // Filter group for label and years
  const filterGroup = document.createElement("div");
  filterGroup.className = "widget_hot_candidate_list_filter_group";
  filterGroup.appendChild(filterByLabel);
  filterGroup.appendChild(yearBtnsContainer);
  filters.appendChild(filterGroup);

  // Party filter
  const partySelect = document.createElement("select");
  partySelect.className = "widget_hot_candidate_list_party_select";
  partySelect.onchange = (e) => {
    selectedParty = e.target.value;
    fetchAndRender();
  };
  filters.appendChild(partySelect);

  // Search
  const searchDiv = document.createElement("div");
  searchDiv.className = "widget_hot_candidate_list_search";
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "खोजें";
  searchInput.oninput = (e) => {
    searchTerm = e.target.value;
    // Debounce search
    clearTimeout(searchInput._debounce);
    searchInput._debounce = setTimeout(() => fetchAndRender(), 300);
  };
  searchDiv.appendChild(searchInput);
  filters.appendChild(searchDiv);

  root.appendChild(filters);

  // List
  const list = document.createElement("div");
  list.className = "widget_hot_candidate_list_list";
  root.appendChild(list);

  // Fetch years and initialize
  async function fetchYearsAndInit() {
    yearBtnsContainer.innerHTML =
      '<div style="padding:8px 0; color:#999; font-size:14px;">Loading years...</div>';
    try {
      const res = await fetch(YEARS_API_URL);
      const result = await res.json();
      years = Array.isArray(result.data.availableYears)
        ? result.data.availableYears
        : [];
      if (!years.length) throw new Error("No years");
      selectedYear = years[0];
      renderYearButtons();
      await fetchPartiesForYear();
      fetchAndRender();
    } catch (e) {
      yearBtnsContainer.innerHTML =
        '<div style="color:#ef4444; font-size:14px;">Error loading years</div>';
    }
  }

  // Render year buttons
  function renderYearButtons() {
    yearBtnsContainer.innerHTML = "";
    years.forEach((year) => {
      const btn = document.createElement("button");
      btn.className =
        "widget_hot_candidate_list_filter_btn" +
        (year === selectedYear ? " active" : "");
      btn.textContent = year;
      btn.onclick = () => {
        selectedYear = year;
        selectedParty = "all"; // Reset party on year change
        fetchPartiesForYear().then(fetchAndRender);
      };
      yearBtnsContainer.appendChild(btn);
    });
  }

  // Fetch all parties for the selected year
  async function fetchPartiesForYear() {
    // Fetch all candidates for the year, then extract unique parties
    try {
      const params = new URLSearchParams();
      params.append("year", selectedYear);
      const res = await fetch(`${API_URL}?${params.toString()}`);
      const result = await res.json();
      const data = result.data || [];
      allPartiesForYear = Array.from(
        new Map(
          data
            .filter((item) => item.party && item.party.name)
            .map((item) => [item.party.name, item.party])
        ).values()
      );
      renderPartyDropdown();
    } catch (e) {
      allPartiesForYear = [];
      renderPartyDropdown();
    }
  }

  // Render party dropdown
  function renderPartyDropdown() {
    partySelect.innerHTML = "";
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "पार्टी";
    partySelect.appendChild(allOption);
    allPartiesForYear.forEach((party) => {
      const opt = document.createElement("option");
      opt.value = party.name;
      opt.textContent = party.name;
      if (party.name === selectedParty) opt.selected = true;
      partySelect.appendChild(opt);
    });
  }

  // Fetch and render data
  async function fetchAndRender() {
    // Update year buttons
    Array.from(yearBtnsContainer.children).forEach((btn) => {
      btn.className =
        "widget_hot_candidate_list_filter_btn" +
        (btn.textContent == selectedYear ? " active" : "");
    });
    // Build query params
    const params = new URLSearchParams();
    params.append("year", selectedYear);
    if (selectedParty !== "all") params.append("party", selectedParty);
    if (searchTerm) params.append("candidateName", searchTerm);
    // Show loading
    list.innerHTML =
      '<div style="padding:32px;text-align:center;color:#999;font-size:14px;">Loading...</div>';
    try {
      const res = await fetch(`${API_URL}?${params.toString()}`);
      const result = await res.json();
      const data = result.data || [];
      // Render list
      list.innerHTML = "";
      if (data.length === 0) {
        list.innerHTML =
          '<div style="padding:32px;text-align:center;color:#999;font-size:14px;">कोई परिणाम नहीं मिला</div>';
        return;
      }
      data.forEach((item) => {
        const row = document.createElement("div");
        row.className = "widget_hot_candidate_list_row";

        // Candidate image and name group
        const candidateInfo = document.createElement("div");
        candidateInfo.className = "widget_hot_candidate_list_candidate_info";

        if (item.candidateImage) {
          const img = document.createElement("img");
          img.className = "widget_hot_candidate_list_img";
          img.src = item.candidateImage;
          img.alt = item.name;
          candidateInfo.appendChild(img);
        } else {
          const img = document.createElement("div");
          img.className = "widget_hot_candidate_list_img";
          img.style.background = "#f5f5f5";
          candidateInfo.appendChild(img);
        }

        // Name
        const name = document.createElement("div");
        name.className = "widget_hot_candidate_list_name";
        name.textContent = item.name;

        candidateInfo.appendChild(name);
        row.appendChild(candidateInfo); // Append the grouped info to the row

        // Status (circular)
        const status = document.createElement("div");
        const isWon = item.status && item.status.toLowerCase() === "won";
        status.className =
          "widget_hot_candidate_list_status " + (isWon ? "won" : "lost");
        status.textContent = isWon ? "W" : "L";
        row.appendChild(status); // Append status to the row

        // Party
        if (item.party) {
          const partyDiv = document.createElement("div");
          partyDiv.className = "widget_hot_candidate_list_party";

          if (item.party.logo) {
            const logo = document.createElement("img");
            logo.className = "widget_hot_candidate_list_party_logo";
            logo.src = item.party.logo;
            logo.alt = item.party.name;
            partyDiv.appendChild(logo);
          } else {
            // Show colored circle if no logo
            const colorCircle = document.createElement("div");
            colorCircle.className = "widget_hot_candidate_list_party_color";
            colorCircle.style.background = item.party.color_code || "#ccc";
            partyDiv.appendChild(colorCircle);
          }

          const pname = document.createElement("div");
          pname.className = "widget_hot_candidate_list_party_name";
          pname.textContent = item.party.name;
          partyDiv.appendChild(pname);

          row.appendChild(partyDiv); // Append party to the row
        }

        list.appendChild(row); // Append the completed row to the list
      });
    } catch (e) {
      list.innerHTML =
        '<div style="padding:32px;text-align:center;color:#ef4444;font-size:14px;">Error loading data</div>';
    }
  }

  // Start
  fetchYearsAndInit();
}

// Initialize
injectStyles();
renderWidget();
