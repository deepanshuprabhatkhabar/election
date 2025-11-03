(function() {
    'use strict';

    // Default configuration
    const DEFAULT_CONFIG = {
        containerId: 'ew-container',
        title: 'बिहार विधानसभा चुनाव परिणाम',
        baseUrl: 'https://election.prabhatkhabar.com',
        apiEndpoint: '/elections/state-elections',
        state: 'Bihar',
        refreshInterval: 30000, // 30 seconds
        updateInterval: 10000,  // 10 seconds
    };

    // CSS Styles
    const CSS_STYLES = `
        .ew-widget * {
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
            margin: 0;
            padding: 0;
        }

        .ew-widget {
            background-color: #f0f2f5;
        }

        .ew-widget .ew-container {
            margin: 0 auto;
            background-color: #fff;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
        }

        .ew-widget .ew-header {
            background: linear-gradient(135deg, #4d3c22 0%, #705c3d 100%);
            color: white;
            padding: 20px 30px;
            text-align: center;
        }

        .ew-widget .ew-header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }

        .ew-widget .ew-tabs {
            display: flex;
            border-bottom: 1px solid #eaeaea;
            background: #fff;
            overflow-x: auto;
            scrollbar-width: thin;
            -webkit-overflow-scrolling: touch;
        }

        .ew-widget .ew-tabs::-webkit-scrollbar {
            height: 4px;
        }

        .ew-widget .ew-tabs::-webkit-scrollbar-thumb {
            background-color: rgba(0, 0, 0, 0.2);
            border-radius: 4px;
        }

        .ew-widget .ew-tab {
            padding: 15px 25px;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.3s ease;
            color: #666;
            border-bottom: 3px solid transparent;
            white-space: nowrap;
        }

        .ew-widget .ew-tab.active {
            border-bottom: 3px solid #ff6a00;
            color: #000;
            font-weight: 600;
        }

        .ew-widget .ew-tab:hover:not(.active) {
            background-color: #f8f9fa;
            border-bottom: 3px solid #ddd;
        }

        .ew-widget .ew-content {
            display: flex;
            padding: 30px;
            gap: 40px;
        }

        .ew-widget .ew-chart-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            position: relative;
            min-width: 320px;
        }

        .ew-widget .ew-summary-bar {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
            gap: 20px;
            width: 100%;
        }

        .ew-widget .ew-progress-bar {
            height: 4px;
            width: 100%;
            background-color: #eee;
            position: relative;
            margin-top: 10px;
            border-radius: 2px;
            overflow: hidden;
        }

        .ew-widget .ew-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #ff6a00, #ff9d00);
            width: 0%;
            transition: width 0.5s ease;
        }

        .ew-widget .ew-donut-chart {
            width: 320px;
            height: 320px;
            position: relative;
            margin-bottom: 10px;
            transition: all 0.3s ease;
        }

        .ew-widget .ew-center-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            pointer-events: none;
            background: rgba(255, 255, 255, 0.7);
            border-radius: 50%;
            width: 160px;
            height: 160px;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .ew-widget .ew-center-text h2 {
            font-size: 42px;
            font-weight: bold;
            margin-bottom: 5px;
            color: #4d3c22;
        }

        .ew-widget .ew-legend {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            justify-content: center;
            max-height: 200px;
            overflow-y: auto;
            padding: 10px;
            margin-top: 10px;
            border-radius: 8px;
            background-color: #fafafa;
            scrollbar-width: thin;
        }

        .ew-widget .ew-legend::-webkit-scrollbar {
            width: 4px;
        }

        .ew-widget .ew-legend::-webkit-scrollbar-thumb {
            background-color: rgba(0, 0, 0, 0.2);
            border-radius: 4px;
        }

        .ew-widget .ew-legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 10px;
            border-radius: 4px;
            background-color: white;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            transition: transform 0.2s;
        }

        .ew-widget .ew-legend-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 3px 6px rgba(0, 0, 0, 0.1);
        }

        .ew-widget .ew-results-container {
            flex: 1.2;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .ew-widget .ew-results-table {
            flex: 1;
            overflow: auto;
            max-height: 500px;
            scrollbar-width: thin;
        }

        .ew-widget .ew-results-table::-webkit-scrollbar {
            width: 6px;
        }

        .ew-widget .ew-results-table::-webkit-scrollbar-thumb {
            background-color: rgba(0, 0, 0, 0.2);
            border-radius: 4px;
        }

        .ew-widget table {
            width: 100%;
            border-collapse: collapse;
        }

        .ew-widget th {
            background-color: #4d3c22;
            color: white;
            padding: 14px 15px;
            text-align: left;
            font-weight: 500;
            position: sticky;
            top: 0;
            z-index: 10;
        }

        .ew-widget td {
            padding: 14px 15px;
            border-bottom: 1px solid #eee;
        }

        .ew-widget tr:nth-child(even) {
            background-color: #f8f9fa;
        }

        .ew-widget tr:hover {
            background-color: #f0f2f5;
        }

        .ew-widget .ew-party-cell {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .ew-widget .ew-party-color {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            display: inline-block;
        }

        .ew-widget .ew-seats-won {
            font-weight: 600;
        }

        .ew-widget .ew-refresh-info {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 15px;
            background-color: #f8f9fa;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #666;
        }

        .ew-widget .ew-loading {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(255, 255, 255, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s;
        }

        .ew-widget .ew-loading.active {
            opacity: 1;
            pointer-events: all;
        }

        .ew-widget .ew-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(77, 60, 34, 0.1);
            border-radius: 50%;
            border-top-color: #4d3c22;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        @media (max-width: 992px) {
            .ew-widget .ew-content {
                flex-direction: column;
                padding: 20px;
            }
        }

        @media (max-width: 768px) {
            .ew-widget .ew-content {
                padding: 15px;
            }

            .ew-widget .ew-donut-chart {
                width: 280px;
                height: 280px;
            }

            .ew-widget .ew-center-text {
                width: 140px;
                height: 140px;
            }

            .ew-widget .ew-center-text h2 {
                font-size: 36px;
            }

            .ew-widget .ew-header h1 {
                font-size: 24px;
            }

            .ew-widget th,
            .ew-widget td {
                padding: 12px 10px;
            }
        }

        @media (max-width: 480px) {
            .ew-widget .ew-donut-chart {
                width: 240px;
                height: 240px;
            }

            .ew-widget .ew-center-text {
                width: 120px;
                height: 120px;
            }

            .ew-widget .ew-center-text h2 {
                font-size: 32px;
            }

            .ew-widget .ew-tab {
                padding: 12px 15px;
                font-size: 14px;
            }

            .ew-widget .ew-legend-item {
                padding: 4px 8px;
                font-size: 14px;
            }
        }
    `;

    class ElectionWidget {
        constructor(config = {}) {
            this.config = { ...DEFAULT_CONFIG, ...config };
            this.container = document.getElementById(this.config.containerId);
            this.currentElectionData = null;
            this.autoRefreshInterval = null;
            this.activeTabKey = null;
            this.lastUpdatedTime = new Date();

            if (!this.container) {
                console.error(`Element with id "${this.config.containerId}" not found`);
                return;
            }

            this.init();
        }

        init() {
            this.injectStyles();
            this.createWidgetStructure();
            this.fetchElectionData();
            this.startAutoRefresh();
        }

        injectStyles() {
            if (!document.getElementById('election-widget-styles')) {
                const styleElement = document.createElement('style');
                styleElement.id = 'election-widget-styles';
                styleElement.textContent = CSS_STYLES;
                document.head.appendChild(styleElement);
            }
        }

        createWidgetStructure() {
            this.container.className = 'ew-widget';
            this.container.innerHTML = `
                <div class="ew-container">
                    <div class="ew-header">
                        <h1>${this.config.title}</h1>
                    </div>
                    <div class="ew-tabs"></div>
                    <div class="ew-content">
                        <div class="ew-chart-container">
                            <div class="ew-summary-bar">
                                <div>
                                    <span id="ew-electionYear"></span>
                                    <div class="ew-progress-bar">
                                        <div class="ew-progress-fill" id="ew-progressFill"></div>
                                    </div>
                                </div>
                                <div id="ew-seatCounter"></div>
                            </div>
                            <div class="ew-donut-chart" id="ew-donutChart"></div>
                            <div class="ew-center-text">
                                <h2></h2>
                                <p>बहुमत</p>
                            </div>
                            <div class="ew-legend"></div>
                        </div>
                        <div class="ew-results-container">
                            <div class="ew-results-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>पार्टी</th>
                                            <th id="ew-vote-status">जीते</th>
                                        </tr>
                                    </thead>
                                    <tbody></tbody>
                                </table>
                            </div>
                            <div class="ew-refresh-info">
                                <span>Auto-refreshing every 30 seconds</span>
                                <span id="ew-lastUpdated">Last updated: Just now</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="ew-loading">
                    <div class="ew-spinner"></div>
                </div>
            `;
        }

        async fetchElectionData() {
            this.showLoading(true);

            try {
                const apiUrl = `${this.config.baseUrl}${this.config.apiEndpoint}?state=${this.config.state}`;
                console.log('Fetching election data from:', apiUrl);
                
                const response = await fetch(apiUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    mode: 'cors'
                });

                console.log('API Response status:', response.status);
                
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('Received election data:', data);
                this.processElectionData(data);
            } catch (error) {
                console.error('Error fetching election data:', error);
                // Show error in the widget
                const tbody = this.container.querySelector('tbody');
                if (tbody) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="2" style="text-align: center; color: #dc3545;">
                                Error loading election data. Please try again later.
                            </td>
                        </tr>
                    `;
                }
            } finally {
                this.showLoading(false);
                this.updateLastUpdatedTime();
            }
        }

        processElectionData(data) {
            const biharElections = data.filter(election => election.state === this.config.state);
            if (!biharElections.length) {
                console.error(`No ${this.config.state} election data found`);
                return;
            }

            const electionData = {};
            biharElections.forEach(election => {
                const key = `${this.config.state} ${election.year}`;
                const processedParties = election.parties.map(p => ({
                    name: p.party.party,
                    won: p.seatsWon,
                    color: p.party.color_code
                }));

                electionData[key] = {
                    totalSeats: election.totalSeats,
                    declaredSeats: election.status === 'completed' ? 
                        election.totalSeats : 
                        processedParties.reduce((sum, p) => sum + p.won, 0),
                    majorityMark: election.halfWayMark,
                    parties: processedParties,
                    status: election.status
                };
            });

            if (!this.currentElectionData || 
                JSON.stringify(this.currentElectionData) !== JSON.stringify(electionData)) {
                this.currentElectionData = electionData;
                this.updateElectionTabs(electionData);
            }
        }

        updateElectionTabs(electionData) {
            const years = Object.keys(electionData)
                .map(key => key.split(' ')[1])
                .sort((a, b) => b - a);

            if (years.length === 0) {
                console.error('No election years available');
                return;
            }

            if (!this.activeTabKey) {
                this.activeTabKey = `${this.config.state} ${years[0]}`;
            }

            if (!Object.keys(electionData).includes(this.activeTabKey)) {
                this.activeTabKey = `${this.config.state} ${years[0]}`;
            }

            const tabsContainer = this.container.querySelector('.ew-tabs');
            tabsContainer.innerHTML = '';

            years.forEach(year => {
                const tabKey = `${this.config.state} ${year}`;
                const tab = document.createElement('div');
                tab.className = `ew-tab${tabKey === this.activeTabKey ? ' active' : ''}`;
                tab.textContent = tabKey;
                tab.addEventListener('click', () => {
                    this.container.querySelector('.ew-tab.active').classList.remove('active');
                    tab.classList.add('active');
                    this.activeTabKey = tab.textContent.trim();
                    this.renderElectionData(this.activeTabKey);
                });
                tabsContainer.appendChild(tab);
            });

            this.renderElectionData(this.activeTabKey);
        }

        renderElectionData(key) {
            const data = this.currentElectionData[key];
            if (!data) return;

            // Update election year and progress info
            const yearText = key.split(' ')[1];
            document.getElementById('ew-electionYear').textContent = `${key} (${data.declaredSeats}/${data.totalSeats} सीटें)`;
            document.getElementById('ew-seatCounter').textContent = `बहुमत: ${data.majorityMark} सीटें`;

            // Update progress bar
            const progressPercentage = (data.declaredSeats / data.totalSeats) * 100;
            document.getElementById('ew-progressFill').style.width = `${progressPercentage}%`;

            // Update center text
            this.container.querySelector('.ew-center-text h2').textContent = data.majorityMark;

            // Update table
            const tbody = this.container.querySelector('tbody');
            tbody.innerHTML = '';
            data.parties.forEach(party => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>
                        <div class="ew-party-cell">
                            <span class="ew-party-color" style="background-color: ${party.color}"></span>
                            ${party.name}
                        </div>
                    </td>
                    <td class="ew-seats-won">${party.won}</td>
                `;
                tbody.appendChild(row);
            });

            // Update legend
            const legendContainer = this.container.querySelector('.ew-legend');
            legendContainer.innerHTML = '';
            data.parties.forEach(party => {
                if (party.won > 0) {
                    const legendItem = document.createElement('div');
                    legendItem.className = 'ew-legend-item';
                    legendItem.innerHTML = `
                        <div class="ew-legend-color" style="background-color: ${party.color}"></div>
                        <span>${party.name}: ${party.won}</span>
                    `;
                    legendContainer.appendChild(legendItem);
                }
            });

            this.drawDonutChart(data);
        }

        drawDonutChart(data) {
            const container = this.container.querySelector('#ew-donutChart');
            container.innerHTML = '';

            const svgNS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
            svg.setAttribute('viewBox', '0 0 100 100');

            const centerX = 50;
            const centerY = 50;
            const radius = 40;
            const strokeWidth = 15;
            let startAngle = -90;

            // Add background circle
            const bgCircle = document.createElementNS(svgNS, 'circle');
            bgCircle.setAttribute('cx', centerX);
            bgCircle.setAttribute('cy', centerY);
            bgCircle.setAttribute('r', radius);
            bgCircle.setAttribute('fill', 'none');
            bgCircle.setAttribute('stroke', '#eaeaea');
            bgCircle.setAttribute('stroke-width', strokeWidth);
            svg.appendChild(bgCircle);

            // Draw party segments
            const activeParties = [...data.parties]
                .filter(party => party.won > 0)
                .sort((a, b) => b.won - a.won);

            activeParties.forEach(party => {
                const percentage = party.won / data.totalSeats;
                const angle = percentage * 360;
                const endAngle = startAngle + angle;

                const startRad = (startAngle * Math.PI) / 180;
                const endRad = (endAngle * Math.PI) / 180;

                const x1 = centerX + radius * Math.cos(startRad);
                const y1 = centerY + radius * Math.sin(startRad);
                const x2 = centerX + radius * Math.cos(endRad);
                const y2 = centerY + radius * Math.sin(endRad);

                const largeArc = angle > 180 ? 1 : 0;

                const path = document.createElementNS(svgNS, 'path');
                path.setAttribute('d', `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`);
                path.setAttribute('stroke', party.color);
                path.setAttribute('stroke-width', strokeWidth);
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke-linecap', 'butt');
                path.setAttribute('stroke-opacity', '0.9');

                path.addEventListener('mouseenter', () => {
                    path.setAttribute('stroke-opacity', '1');
                    path.setAttribute('stroke-width', strokeWidth + 2);
                });
                path.addEventListener('mouseleave', () => {
                    path.setAttribute('stroke-opacity', '0.9');
                    path.setAttribute('stroke-width', strokeWidth);
                });

                svg.appendChild(path);
                startAngle = endAngle;
            });

            // Add majority mark line
            const majorityPercentage = data.majorityMark / data.totalSeats;
            const majorityAngle = -90 + majorityPercentage * 360;
            const majorityRad = (majorityAngle * Math.PI) / 180;
            const majorityX = centerX + (radius + strokeWidth / 2 + 2) * Math.cos(majorityRad);
            const majorityY = centerY + (radius + strokeWidth / 2 + 2) * Math.sin(majorityRad);
            const innerX = centerX + (radius - strokeWidth / 2 - 2) * Math.cos(majorityRad);
            const innerY = centerY + (radius - strokeWidth / 2 - 2) * Math.sin(majorityRad);

            const majorityLine = document.createElementNS(svgNS, 'line');
            majorityLine.setAttribute('x1', innerX);
            majorityLine.setAttribute('y1', innerY);
            majorityLine.setAttribute('x2', majorityX);
            majorityLine.setAttribute('y2', majorityY);
            majorityLine.setAttribute('stroke', '#333');
            majorityLine.setAttribute('stroke-width', '2');
            majorityLine.setAttribute('stroke-dasharray', '2,2');
            svg.appendChild(majorityLine);

            container.appendChild(svg);
        }

        showLoading(show) {
            const loadingElement = this.container.querySelector('.ew-loading');
            if (show) {
                loadingElement.classList.add('active');
            } else {
                loadingElement.classList.remove('active');
            }
        }

        updateLastUpdatedTime() {
            this.lastUpdatedTime = new Date();
            this.updateLastUpdatedText();
        }

        updateLastUpdatedText() {
            const now = new Date();
            const diff = Math.floor((now - this.lastUpdatedTime) / 1000);

            let text = '';
            if (diff < 10) {
                text = 'Just now';
            } else if (diff < 60) {
                text = `${diff} seconds ago`;
            } else if (diff < 3600) {
                const minutes = Math.floor(diff / 60);
                text = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
            } else {
                const hours = Math.floor(diff / 3600);
                text = `${hours} hour${hours > 1 ? 's' : ''} ago`;
            }

            this.container.querySelector('#ew-lastUpdated').textContent = `Last updated: ${text}`;
        }

        startAutoRefresh() {
            if (!this.autoRefreshInterval) {
                this.autoRefreshInterval = setInterval(() => this.fetchElectionData(), this.config.refreshInterval);
                setInterval(() => this.updateLastUpdatedText(), this.config.updateInterval);
            }
        }

        stopAutoRefresh() {
            if (this.autoRefreshInterval) {
                clearInterval(this.autoRefreshInterval);
                this.autoRefreshInterval = null;
            }
        }
    }

    // Auto-initialize when DOM is ready
    function initWidget() {
        console.log('Initializing election widget...');
        
        // First try to find containers with data-election-widget attribute
        const containers = document.querySelectorAll('[data-ew-widget]');
        console.log('Found containers with data-ew-widget:', containers.length);
        
        if (containers.length === 0) {
            // If no containers found with data attribute, try to find by ID
            const container = document.getElementById('ew-container');
            if (container) {
                console.log('Found container by ID:', container.id);
                try {
                    new ElectionWidget({
                        containerId: container.id,
                        state: container.dataset.state || 'Bihar',
                        apiEndpoint: container.dataset.apiEndpoint || '/elections/state-elections',
                        baseUrl: 'https://election.prabhatkhabar.com'
                    });
                    container.dataset.initialized = 'true';
                } catch (error) {
                    console.error('Failed to initialize election widget:', error);
                }
            } else {
                console.error('No election widget container found!');
            }
        } else {
            containers.forEach(container => {
                if (!container.dataset.initialized) {
                    console.log('Initializing container:', container.id);
                    try {
                        new ElectionWidget({
                            containerId: container.id,
                            state: container.dataset.state || 'Bihar',
                            apiEndpoint: container.dataset.apiEndpoint || '/elections/state-elections',
                            baseUrl: 'https://election.prabhatkhabar.com'
                        });
                        container.dataset.initialized = 'true';
                    } catch (error) {
                        console.error('Failed to initialize election widget:', error);
                    }
                }
            });
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        console.log('Document still loading, waiting for DOMContentLoaded...');
        document.addEventListener('DOMContentLoaded', initWidget);
    } else {
        console.log('Document already loaded, initializing immediately...');
        initWidget();
    }

    // Also try to initialize after a short delay to ensure everything is loaded
    setTimeout(initWidget, 1000);

    // Export for manual use
    window.ElectionWidget = ElectionWidget;
    window.initElectionWidget = function(containerId, config = {}) {
        console.log('Manually initializing election widget for container:', containerId);
        return new ElectionWidget({ 
            containerId, 
            ...config,
            baseUrl: 'https://election.prabhatkhabar.com'
        });
    };

    // Add a global function to force refresh
    window.refreshElectionWidget = function(containerId) {
        console.log('Forcing refresh of election widget:', containerId);
        const widget = window.ElectionWidget.instances?.[containerId];
        if (widget) {
            widget.fetchElectionData();
        }
    };
})(); 
