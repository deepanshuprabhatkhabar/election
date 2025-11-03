(function () {
  // Widget config
  const CONTAINER_ID = "cnew-container";
  const STYLE_ID = "cnew-widget-styles";

  // Widget CSS (scoped with .cnew-widget)
  const WIDGET_CSS = `
    .cnew-widget {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 100%;
      overflow: hidden;
      max-height: 80vh;
      overflow-y: auto;
    }
    .cnew-widget .cnew-header {
      padding: 0.75rem;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      position: sticky;
      top: 0;
      z-index: 2;
      height: 56px;
      box-sizing: border-box;
    }
    .cnew-widget .cnew-select {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      font-size: 15px;
      background-color: white;
    }
    .cnew-widget .cnew-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 15px;
    }
    .cnew-widget .cnew-table th {
      padding: 0.75rem;
      text-align: center;
      font-weight: 600;
      color: #475569;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      position: sticky;
      top: 56px;
      z-index: 1;
      box-sizing: border-box;
    }
    .cnew-widget .cnew-table td {
      padding: 0.75rem;
      text-align: center;
      border-bottom: 1px solid #e2e8f0;
    }
    .cnew-widget .cnew-table td.cnew-cand {
      text-align: left;
    }
    .cnew-widget .cnew-candidate-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .cnew-widget .cnew-avatar {
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      background: #f8fafc;
      overflow: hidden;
      flex-shrink: 0;
    }
    .cnew-widget .cnew-cand-name {
      font-weight: 500;
      color: #1f2937;
      font-size: 15px;
    }
    .cnew-widget .cnew-meta {
      color: #6b7280;
      font-size: 12px;
    }
    .cnew-widget .cnew-party-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      color: white;
      white-space: nowrap;
    }
    .cnew-widget .cnew-vote-share {
      font-weight: 500;
      color: #ff6b00;
    }
    .cnew-widget .cnew-loading {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 1rem;
      background: rgba(255,255,255,0.9);
    }
    .cnew-widget .cnew-spinner {
      width: 1.5rem;
      height: 1.5rem;
      border: 2px solid #e2e8f0;
      border-top-color: #ff6b00;
      border-radius: 50%;
      animation: cnew-spin 0.8s linear infinite;
    }
    .cnew-widget .cnew-status-icon {
      width: 1.25rem;
      height: 1.25rem;
      display: inline-block;
      vertical-align: middle;
      margin-right: 0.25rem;
    }
    .cnew-widget .cnew-status-up { color: green; }
    .cnew-widget .cnew-status-down { color: red; }
    @keyframes cnew-spin { to { transform: rotate(360deg); } }
    @media (max-width: 640px) {
      .cnew-widget .cnew-table td,
      .cnew-widget .cnew-table th { padding: 0.5rem; }
      .cnew-widget .cnew-avatar { width: 1.5rem; height: 1.5rem; }
      .cnew-widget .cnew-party-badge { padding: 0.125rem 0.375rem; font-size: 15px; }
    }
    .cnew-widget .cnew-gray { color: gray; }
  `;

  function injectStyles() {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = WIDGET_CSS;
      document.head.appendChild(style);
    }
  }

  class CnElectionWidget {
    constructor(containerId) {
      this.container = document.getElementById(containerId);
      if (!this.container) return;
      this.candidatesData = [];
      this.constituencies = new Set();
      this.isLoading = false;
      this.lastFetchTime = 0;
      this.currentYear = "";
      this.stateName = "Bihar";
      this.FETCH_COOLDOWN = 5000;
      this.renderSkeleton();
      this.initialize();
    }

    renderSkeleton() {
      this.container.className = "cnew-widget";
      this.container.innerHTML = `
      <div id="election_cnew_container_v1_pk_year_tabs"></div>
        <div class="cnew-header">
          <select id="cnew-select" class="cnew-select">
            <option value="">Loading constituencies...</option>
          </select>
        </div>
        <table class="cnew-table">
          <thead>
            <tr>
              <th>उम्मीदवार</th>
              <th>दल</th>
              <th class="cnew-hide-mobile">वोट</th>
              <th class="cnew-aage-piche">आगे / पीछे</th>
            </tr>
          </thead>
          <tbody id="cnew-table-body">
            <tr><td colspan="4" class="cnew-loading"><span class="cnew-spinner"></span></td></tr>
          </tbody>
        </table>
      `;
      this.select = this.container.querySelector("#cnew-select");
      this.tableBody = this.container.querySelector("#cnew-table-body");
    }

    async initialize() {
      this.addYearTabStyles();
      await this.createYearTabs();
      this.fetchConstituencies(); // first time when the page loads
      this.select.addEventListener("change", (e) =>
        this.handleConstituencyChange(e)
      );
      this.setupRefreshInterval();
    }

    // Add styles for year tabs
    addYearTabStyles() {
      const styleId = "election_cnew_container_year_tabs-styles";

      // Check if styles already exist
      if (document.getElementById(styleId)) {
        return;
      }

      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
      #election_cnew_container_v1_pk_year_tabs {
        display: flex;
        gap: 12px;
        margin: 20px 0;
        flex-wrap: wrap;
        align-items: center;
		justify-content: center;
      }

      .election_cnew_container_year_tab {
        padding: 8px 16px;
        border: 1px solid #ddd;
        border-radius: 20px;
        background-color: #fff;
        color: #666;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.3s ease;
        user-select: none;
        min-width: 60px;
        text-align: center;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }

      .election_cnew_container_year_tab:hover {
        border-color: #ff6b35;
        color: #ff6b35;
        background-color: #fff8f5;
        transform: translateY(-1px);
        box-shadow: 0 2px 6px rgba(255, 107, 53, 0.2);
      }

      .election_cnew_container_year_tab.active {
        background-color: #ff6b35;
        border-color: #ff6b35;
        color: #fff !important;
        font-weight: 600;
        box-shadow: 0 2px 6px rgba(255, 107, 53, 0.3);
      }

      .election_cnew_container_year_tab.active:hover {
        background-color: #e55a2b;
        border-color: #e55a2b;
        transform: translateY(-1px);
        box-shadow: 0 3px 8px rgba(229, 90, 43, 0.4);
      }

      @media (max-width: 768px) {
        #election_map_container_v1_pk_year_tabs {
          gap: 8px;
          margin: 15px 0;
        }
        
        .election_map_year_tab {
          padding: 6px 12px;
          font-size: 13px;
          min-width: 50px;
        }
      }
    `;

      document.head.appendChild(style);
    }

    async createYearTabs() {
      const yearTabs = document.querySelector(
        "#election_cnew_container_v1_pk_year_tabs"
      );

      try {
        const result = await fetch(
          `https://election.prabhatkhabar.com/election/years/Bihar`
        );
        const allYears = (await result.json()).data.availableYears;

        console.log(allYears);

        // Fix: Set currentYear as instance property
        this.currentYear = allYears[0];

        const years = [...new Set(allYears.map((item) => item))].sort(
          (a, b) => b - a
        );

        yearTabs.innerHTML = "";

        years.forEach((year) => {
          const tab = document.createElement("div");
          tab.className = `election_cnew_container_year_tab ${
            year === this.currentYear ? "active" : ""
          }`;
          tab.textContent = year;
          tab.addEventListener("click", () => {
            this.currentYear = year;
            this.updateActiveTab();
            // Optionally reload data for the selected year
            this.fetchConstituencies();
          });
          yearTabs.appendChild(tab);
        });
      } catch (error) {
        console.error("Error fetching years:", error);
      }
    }

    updateActiveTab() {
      document
        .querySelectorAll(".election_cnew_container_year_tab")
        .forEach((tab) => {
          tab.classList.remove("active");
          if (parseInt(tab.textContent) === this.currentYear) {
            tab.classList.add("active");
          }
        });
    }

    async fetchConstituencies() {
      try {
        const params = new URLSearchParams(document.location.search);
        const type = params.get("type") || "general";
        const response = await fetch(
          `https://election.prabhatkhabar.com/api/constituency?state=${this.stateName}&year=${this.currentYear}&type=${type}`
        );
        if (!response.ok) throw new Error("Failed to fetch constituencies");
        const constituencies = await response.json();
        this.constituencies = new Set(constituencies.map((c) => c.name));
        this.updateConstituencyDropdown();
        if (constituencies.length > 0) {
          const firstConstituency = constituencies[0].name;
          this.select.value = firstConstituency;
          await this.fetchCandidates(firstConstituency);
        }
      } catch (error) {
        this.select.innerHTML =
          '<option value="">Failed to load constituencies</option>';
      }
    }

    updateConstituencyDropdown() {
      const sortedConstituencies = Array.from(this.constituencies);
      this.select.innerHTML = sortedConstituencies
        .map(
          (constituency) =>
            `<option value="${constituency}">${constituency}</option>`
        )
        .join("");
    }

    async fetchCandidates(constituency) {
      this.isLoading = true;
      try {
        const params = new URLSearchParams(document.location.search);

        const type = params.get("type") || "general";
        const response = await fetch(
          `https://election.prabhatkhabar.com/api/candidate/cn-list?constituencyName=${constituency}&state=${this.stateName}&year=${this.currentYear}&type=${type}`
        );
        if (!response.ok) throw new Error("Failed to fetch candidates");
        const newCandidatesData = await response.json();
        this.candidatesData = newCandidatesData;
        this.renderCandidates();
        if (newCandidatesData.length > 0) {
          if (newCandidatesData[0].constituency[0].won !== "ongoing") {
            this.container.querySelector(".cnew-aage-piche").textContent =
              "हार / जीत";
          }
        }
      } catch (error) {
        this.showError("Failed to load candidates");
      } finally {
        this.isLoading = false;
      }
    }

    getContrastColor(hexColor) {
      const color = hexColor.replace("#", "");
      const r = parseInt(color.substring(0, 2), 16);
      const g = parseInt(color.substring(2, 4), 16);
      const b = parseInt(color.substring(4, 6), 16);
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      return luminance > 186 ? "black" : "white";
    }

    createCandidateRow(
      candidate,
      isFirstCandidate,
      showLeadAndTrailing,
      votesReceived,
      status,
      constituencyStatus,
      index
    ) {
      const statusIconClass =
        status === "Won" ? "cnew-status-up" : "cnew-status-down";
      const textColor = this.getContrastColor(candidate.party.color_code);
      const won = constituencyStatus || "ongoing";
      const badgeText =
        won !== "ongoing"
          ? won === "completed" && index === 0
            ? "जीते"
            : "हारे"
          : index === 0
          ? "आगे"
          : index !== 0
          ? "पीछे"
          : "-";
      return `
        <tr>
          <td class="cnew-cand">
            <div class="cnew-candidate-info">
              <div class="cnew-avatar">
                <img src="${
                  candidate.image ||
                  "https://s3.amazonaws.com/37assets/svn/765-default-avatar.png"
                }"
                  alt="${candidate.name}"
                  width="32" height="32"
                  loading="lazy"
                  class="cnew-cand-img"
                  onerror="this.src='https://s3.amazonaws.com/37assets/svn/765-default-avatar.png'">
              </div>
              <div>
                <div class="cnew-cand-name">${candidate.name}</div>
              </div>
            </div>
          </td>
          <td>
            <div class="cnew-party-badge" style="background-color: ${
              candidate.party.color_code
            }; color: ${textColor};">
              ${candidate.party.party}
            </div>
          </td>
          <td class="cnew-hide-mobile">${Number(
            votesReceived
          ).toLocaleString()}</td>
          <td class="${statusIconClass} font-bold">${badgeText}</td>
        </tr>
      `;
    }

    renderCandidates() {
      if (!this.candidatesData.length) {
        this.tableBody.innerHTML =
          '<tr><td colspan="4" class="text-center py-4">No candidates found</td></tr>';
        return;
      }
      const showLeadAndTrailing = this.candidatesData.reduce(
        (sum, candidate) => sum + candidate.votesReceived,
        0
      );
      this.tableBody.innerHTML = this.candidatesData
        .sort((a, b) => b.votesRecieved - a.votesRecieved)
        .map((candidate, index) =>
          this.createCandidateRow(
            candidate.candidate,
            candidate.status === "leading",
            showLeadAndTrailing,
            candidate.votesReceived,
            candidate.status,
            candidate.constituencyStatus,
            index
          )
        )
        .join("");
    }

    async handleConstituencyChange(event) {
      const constituency = event.target.value;
      if (constituency) {
        await this.fetchCandidates(constituency);
      }
    }

    setupRefreshInterval() {
      setInterval(() => {
        const selectedConstituency = this.select.value;
        if (selectedConstituency) {
          this.fetchCandidates(selectedConstituency);
        }
      }, 30000);
    }

    showError(message) {
      this.tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 cnew-gray">${message}</td></tr>`;
    }
  }

  // Widget initialization
  function initCnElectionWidget() {
    injectStyles();
    const container = document.getElementById(CONTAINER_ID);
    if (container && !container.dataset.cnewInitialized) {
      new CnElectionWidget(CONTAINER_ID);
      container.dataset.cnewInitialized = "true";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCnElectionWidget);
  } else {
    initCnElectionWidget();
  }

  // Export for manual use
  window.CnElectionWidget = CnElectionWidget;
  window.initCnElectionWidget = initCnElectionWidget;
})();
