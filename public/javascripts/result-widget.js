(function () {
  "use strict";

  // Default configuration
  const DEFAULT_CONFIG = {
    containerId: "erw-container",
    title: "बिहार विधानसभा चुनाव परिणाम",
    apiEndpoint: "https://election-stage.prabhatkhabar.com/elections/state-elections",
    state: "Bihar",
    years: ["2020", "2015", "2010"],
    defaultYear: "2020",
    loadingText: "डेटा लोड हो रहा है...",
    errorPrefix: "त्रुटि: ",
    retryText: "पुनः प्रयास करें",
    totalSeatsText: "कुल सीटें: ",
    seatsText: "सीटें",
    majorityText: "बहुमत",
    othersText: "अन्य",
  };

  // CSS Styles - Your original design
  const CSS_STYLES = `
            .erw-widget * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            .erw-widget {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                background-color: #f5f3f0;
            }

            .erw-widget .erw-loading {
                display: flex;
                justify-content: center;
                align-items: center;
                height: 200px;
                font-size: 18px;
                color: #4a5568;
            }

            .erw-widget .erw-error {
                background-color: #fed7d7;
                color: #c53030;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                text-align: center;
            }

            .erw-widget .erw-error button {
                margin-top: 10px;
                padding: 8px 16px;
                background-color: #c53030;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
            }

            .erw-widget .erw-container {
                margin: 0 auto;
                padding: 12px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
                max-width: 1200px;
            }

            .erw-widget .erw-header {
                display: flex;
                align-items: center;
                gap: 16px;
                margin-bottom: 8px;
            }

            .erw-widget .erw-title {
                font-size: 24px;
                font-weight: 600;
                color: #2d3748;
            }

            .erw-widget .erw-year-tabs {
                display: flex;
                gap: 8px;
            }

            .erw-widget .erw-year-tab {
                padding: 6px 12px;
                border-radius: 16px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
                border: none;
                background: none;
            }

            .erw-widget .erw-year-tab.active {
                background-color: #ff8c42;
                color: white !important;
            }

            .erw-widget .erw-year-tab:not(.active) {
                background-color: transparent;
                color: #718096;
            }

            .erw-widget .erw-year-tab:hover:not(.active) {
                background-color: #e2e8f0;
            }

            .erw-widget .erw-year-tab:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .erw-widget .erw-total-seats {
                margin-bottom: 8px;
                font-size: 16px;
                color: #4a5568;
            }

            .erw-widget .erw-main-results {
                margin-bottom: 24px;
                position: relative;
            }

            .erw-widget .erw-results-labels {
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                margin-bottom: 12px;
                padding: 0 16px;
            }

            .erw-widget .erw-party-result {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 5px;
            }

            .erw-widget .erw-party-result-name {
                font-size: 16px;
                font-weight: 600;
                color: #2d3748;
            }

            .erw-widget .erw-party-result-seats {
                font-size: 24px;
                font-weight: 700;
                color: #2d3748;
            }

            .erw-widget .erw-progress-bar-container {
                position: relative;
            }

            .erw-widget .erw-progress-bar {
                height: 12px;
                background-color: #e2e8f0;
                border-radius: 6px;
                overflow: hidden;
                position: relative;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08), inset 0 1px 2px rgba(0, 0, 0, 0.06);
                display: flex;
            }

            .erw-widget .erw-party-segment {
                transition: width 0.8s ease;
                height: 100%;
            }

            .erw-widget .erw-party-segment:first-child {
                border-radius: 8px 0 0 8px;
            }

            .erw-widget .erw-party-segment:last-child {
                border-radius: 0 8px 8px 0;
            }

            .erw-widget .erw-majority-divider {
                position: absolute;
                top: -8px;
                height: 32px;
                width: 2px;
                background-color: #2d3748;
                left: 50%;
                transform: translateX(-50%);
            }

            .erw-widget .erw-party-cards {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                gap: 12px;
                margin-top: 20px;
            }

            .erw-widget .erw-party-card {
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                padding: 8px;
                display: flex;
                align-items: center;
                gap: 10px;
                transition: all 0.3s ease;
                cursor: pointer;
            }

            .erw-widget .erw-party-card:hover {
                border-color: #cbd5e0;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }

            .erw-widget .erw-party-icon {
                width: 32px;
                height: 32px;
                min-width: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                color: white;
                font-size: 11px;
                background-size: cover;
                background-position: center;
                overflow: hidden;
            }

            .erw-widget .erw-party-icon img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 50%;
            }

            .erw-widget .erw-party-info {
                flex-grow: 1;
                min-width: 0;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }

            .erw-widget .erw-party-name {
                font-size: 14px;
                font-weight: 600;
                color: #2d3748;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .erw-widget .erw-party-seats {
                font-size: 16px;
                font-weight: 700;
                color: #1a202c;
                white-space: nowrap;
            }

            @media (max-width: 768px) {
                .erw-widget .erw-container {
                    padding: 16px;
                }

                .erw-widget .erw-title {
                    font-size: 20px;
                }

                .erw-widget .erw-header {
                    flex-direction: column;
                    gap: 12px;
                    text-align: center;
                }

                .erw-widget .erw-results-labels {
                    flex-direction: row;
                    gap: 12px;
                    text-align: center;
                }

                .erw-widget .erw-party-cards {
                    grid-template-columns: 1fr;
                }

                .erw-widget .erw-party-card {
                    padding: 10px;
                }

                .erw-widget .erw-party-icon {
                    width: 36px;
                    height: 36px;
                    min-width: 36px;
                }

                .erw-widget .erw-party-name {
                    font-size: 15px;
                }

                .erw-widget .erw-party-seats {
                    font-size: 18px;
                }
            }
        `;

  // Cache for API responses
  let apiCache = {};

  // Utility functions
  function getConfig(container) {
    // Return hardcoded config instead of reading from data attributes
    return DEFAULT_CONFIG;
  }

  function processElectionData(data, config) {
    const totalSeats = data.totalSeats || 243;
    const halfWayMark = data.halfWayMark || Math.ceil(totalSeats / 2);

    // Process and sort parties by seats
    const parties = (data.parties || [])
      .map((item) => ({
        name: item.party.party,
        seats: item.seatsWon || 0,
        color: item.party.color_code || "#666666",
        logo: item.party.party_logo || null,
        icon: item.party.party.substring(0, 3).toUpperCase(),
      }))
      .sort((a, b) => b.seats - a.seats);

    // Get top 4 parties and calculate others
    const top4Parties = parties.slice(0, 4);
    const otherParties = parties.slice(4);
    const othersSeats = otherParties.reduce((sum, p) => sum + p.seats, 0);

    // Create display parties (top 4 + others if there are remaining parties)
    const displayParties = [...top4Parties];
    if (otherParties.length > 0 && othersSeats > 0) {
      displayParties.push({
        name: config.othersText,
        seats: othersSeats,
        color: "#94a3b8",
        logo: null,
        icon: "अन्य",
      });
    }

    // Get top 2 for progress bar
    const top2Parties = parties.slice(0, 2);

    return {
      totalSeats,
      halfWayMark,
      top2Parties,
      displayParties,
      allParties: parties,
    };
  }

  async function fetchElectionData(apiEndpoint, state, year) {
    const cacheKey = `${state}-${year}`;

    if (apiCache[cacheKey]) {
      return apiCache[cacheKey];
    }

    try {
      const url = new URL(apiEndpoint);
      url.searchParams.append("state", state);

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Find data for the specific year
      let yearData = null;
      if (Array.isArray(data)) {
        yearData = data.find(
          (item) => item.year.toString() === year.toString(),
        );
      } else if (data.year && data.year.toString() === year.toString()) {
        yearData = data;
      }

      if (!yearData) {
        throw new Error(`No data found for year ${year}`);
      }

      apiCache[cacheKey] = yearData;
      return yearData;
    } catch (error) {
      console.error("Error fetching election data:", error);
      throw error;
    }
  }

  // Widget Class
  class ElectionWidget {
    constructor(containerId) {
      this.containerId = containerId;
      this.container = document.getElementById(containerId);

      if (!this.container) {
        console.error(`Element with id "${containerId}" not found`);
        return;
      }

      try {
        this.config = getConfig(this.container);
        this.currentYear = this.config.defaultYear;
        this.currentData = null;
        this.isLoading = false;

        this.init();
      } catch (error) {
        this.showError(error.message);
        return;
      }
    }

    async init() {
      this.injectStyles();
      this.showLoading();

      try {
        await this.loadData(this.currentYear);
        this.render();
        this.bindEvents();
        this.animateProgressBars();
      } catch (error) {
        this.showError(error.message);
      }
    }

    injectStyles() {
      if (!document.getElementById("election-widget-styles")) {
        const styleElement = document.createElement("style");
        styleElement.id = "election-widget-styles";
        styleElement.textContent = CSS_STYLES;
        document.head.appendChild(styleElement);
      }
    }

    showLoading() {
      this.container.className = "erw-widget";
      this.container.innerHTML = `<div class="erw-container"><div class="erw-loading">${this.config.loadingText}</div></div>`;
    }

    showError(message) {
      this.container.className = "erw-widget";
      this.container.innerHTML = `
        <div class="erw-container">
          <div class="erw-error">
            ${this.config.errorPrefix}${message}
            <br><button onclick="location.reload()">${this.config.retryText}</button>
          </div>
        </div>
      `;
    }

    async loadData(year) {
      this.isLoading = true;

      try {
        const rawData = await fetchElectionData(
          this.config.apiEndpoint,
          this.config.state,
          year,
        );
        this.currentData = processElectionData(rawData, this.config);
        this.currentYear = year;
      } catch (error) {
        throw new Error(`डेटा लोड करने में समस्या: ${error.message}`);
      } finally {
        this.isLoading = false;
      }
    }

    render() {
      if (!this.currentData) return;

      this.container.className = "erw-widget";
      this.container.innerHTML = this.generateHTML();
    }

    generateHTML() {
      const data = this.currentData;

      // Calculate percentages for progress bar segments (top 2 parties)
      let segments = [];
      data.top2Parties.forEach((party) => {
        if (party.seats > 0) {
          const percentage = (party.seats / data.totalSeats) * 100;
          segments.push({
            name: party.name,
            seats: party.seats,
            percentage: percentage,
            color: party.color,
          });
        }
      });

      return `
        <div class="erw-container">
          <div class="erw-header">
            <h1 class="erw-title">${this.config.title}</h1>
            <div class="erw-year-tabs">
              ${this.config.years
                .map(
                  (year) => `
                  <button class="erw-year-tab ${year === this.currentYear ? "active" : ""}" 
                          data-year="${year}" 
                          ${this.isLoading ? "disabled" : ""}>${year}</button>
              `,
                )
                .join("")}
            </div>
          </div>

          <div class="erw-total-seats">${this.config.totalSeatsText}${data.totalSeats}</div>

          <div class="erw-main-results">
            <div class="erw-results-labels">
              <div class="erw-party-result">
                <div class="erw-party-result-name">${segments[0].name}</div>
                <div class="erw-party-result-seats">${segments[0].seats}</div>
              </div>
              
              <div class="erw-party-result">
                <div class="erw-party-result-name">${this.config.majorityText}</div>
                <div class="erw-party-result-seats">${data.halfWayMark}</div>
              </div>
              
              <div class="erw-party-result">
                <div class="erw-party-result-name">${segments[1].name}</div>
                <div class="erw-party-result-seats">${segments[1].seats}</div>
              </div>
            </div>

            <div class="erw-progress-bar-container">
              <div class="erw-progress-bar">
                ${segments
                  .map(
                    (segment, index) => `
                    <div class="erw-party-segment" 
                         style="width: ${segment.percentage}%; background-color: ${segment.color}; ${index === 1 ? "margin-left: auto;" : ""}">
                    </div>
                `,
                  )
                  .join("")}
              </div>
              <div class="erw-majority-divider"></div>
            </div>
          </div>

          <div class="erw-party-cards">
            ${data.displayParties
              .map(
                (party) => `
                <div class="erw-party-card" data-party="${party.name}">
                  <div class="erw-party-icon" style="background-color: ${party.color}">
                    ${
                      party.logo
                        ? `<img src="${party.logo}" alt="${party.name}" onerror="this.style.display='none'; this.parentNode.textContent='${party.icon}';">`
                        : party.icon
                    }
                  </div>
                  <div class="erw-party-info">
                    <div class="erw-party-name">${party.name}</div>
                    <div class="erw-party-seats">${party.seats}</div>
                  </div>
                </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `;
    }

    bindEvents() {
      if (!this.container) return;

      // Year tab switching
      const yearTabs = this.container.querySelectorAll(".erw-year-tab");
      yearTabs.forEach((tab) => {
        tab.addEventListener("click", async (e) => {
          const year = e.target.dataset.year;
          if (year !== this.currentYear && !this.isLoading) {
            this.showLoading();
            try {
              await this.loadData(year);
              this.render();
              this.bindEvents();
              this.animateProgressBars();
            } catch (error) {
              this.showError(error.message);
            }
          }
        });
      });

      // Party card interactions
      const partyCards = this.container.querySelectorAll(".erw-party-card");
      partyCards.forEach((card) => {
        card.addEventListener("mouseenter", () => {
          card.style.transform = "translateY(-4px)";
        });

        card.addEventListener("mouseleave", () => {
          card.style.transform = "translateY(0px)";
        });
      });
    }

    animateProgressBars() {
      if (!this.container) return;

      const segments = this.container.querySelectorAll(".erw-party-segment");

      segments.forEach((segment) => {
        const finalWidth = segment.style.width;
        segment.style.width = "0%";

        setTimeout(() => {
          segment.style.width = finalWidth;
        }, 300);
      });
    }

    // Public methods
    async refresh() {
      const cacheKey = `${this.config.state}-${this.currentYear}`;
      delete apiCache[cacheKey];

      this.showLoading();
      try {
        await this.loadData(this.currentYear);
        this.render();
        this.bindEvents();
        this.animateProgressBars();
      } catch (error) {
        this.showError(error.message);
      }
    }

    async setYear(year) {
      if (this.config.years.includes(year.toString()) && !this.isLoading) {
        this.showLoading();
        try {
          await this.loadData(year);
          this.render();
          this.bindEvents();
          this.animateProgressBars();
        } catch (error) {
          this.showError(error.message);
        }
      }
    }
  }

  // Auto-initialize when DOM is ready
  function initWidget() {
    const container = document.getElementById("erw-container");
    if (container && !container.dataset.initialized) {
      try {
        new ElectionWidget("erw-container");
        container.dataset.initialized = "true";
      } catch (error) {
        console.error("Failed to initialize election widget:", error);
      }
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWidget);
  } else {
    initWidget();
  }

  // Export for manual use
  window.ElectionWidget = ElectionWidget;
  window.initElectionWidget = function (containerId) {
    return new ElectionWidget(containerId);
  };
})();
