class CandidateSliderWidget {
	constructor(containerId) {
		this.container = document.getElementById(containerId);
		this.candidates = [];
		this.currentPosition = 0;
		this.autoSlideInterval = null;
		this.cardWidth = 0;
		this.totalWidth = 0;
		this.isLoading = true;
		this.currentYear = "";
		this.state = "Bihar";
		this.cardsPerSlide = 3; // Default, will be set dynamically
		this.init();
	}

	setCardsPerSlide() {
		if (window.innerWidth <= 768) {
			this.cardsPerSlide = 2;
		} else {
			this.cardsPerSlide = 3;
		}
	}

	async init() {
		this.setCardsPerSlide();
		this.createStyles();
		this.injectHTML();
		this.createYearTabs();
		this.addYearTabStyles();
		await this.fetchCandidates();
	}

	injectHTML() {
		const sliderContainer = document.createElement("div");
		sliderContainer.className = "election-hot-candidate-v1-slider-container";

		sliderContainer.innerHTML = `
            <div class="election-hot-candidate-v1-slider-title">प्रमुख उम्मीदवार (Bihar Elections)</div>
            <div id="election-hot-candidate-v1-yearTabs"></div>
            <div class="election-hot-candidate-v1-slider-wrapper">
              <button class="election-hot-candidate-v1-prev-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <div class="election-hot-candidate-v1-slider-content"></div>
              <button class="election-hot-candidate-v1-next-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          `;

		this.container.appendChild(sliderContainer);

		// Store references
		this.sliderWrapper = this.container.querySelector(
			".election-hot-candidate-v1-slider-wrapper",
		);
		this.sliderContent = this.container.querySelector(
			".election-hot-candidate-v1-slider-content",
		);
		this.prevBtn = this.container.querySelector(
			".election-hot-candidate-v1-prev-btn",
		);
		this.nextBtn = this.container.querySelector(
			".election-hot-candidate-v1-next-btn",
		);
	}

	// Generate avatar based on name
	generateAvatar(name) {
		const colors = [
			"#FF6B6B",
			"#4ECDC4",
			"#45B7D1",
			"#96CEB4",
			"#FFEAA7",
			"#DDA0DD",
			"#98D8C8",
			"#F7DC6F",
			"#BB8FCE",
			"#85C1E9",
		];

		const initials = name
			.split(" ")
			.map((word) => word.charAt(0))
			.join("")
			.substring(0, 2)
			.toUpperCase();

		const colorIndex = name.length % colors.length;
		const backgroundColor = colors[colorIndex];

		const svg = `
                <svg width="140" height="140" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="70" cy="70" r="70" fill="${backgroundColor}"/>
                  <text x="70" y="85" font-family="Arial, sans-serif" font-size="48"
                        font-weight="bold" fill="white" text-anchor="middle">${initials}</text>
                </svg>
              `;

		return `data:image/svg+xml;base64,${btoa(svg)}`;
	}

	async fetchCandidates(electionYear = "2020") {
		try {
			this.showLoading();
			const response = await fetch(
				`https://election-stage.prabhatkhabar.com/election/hot-candidates?state=${this.state}&year=${electionYear}`,
			);
			const data = await response.json();

			if (data.success && data.data) {
				this.candidates = data.data.map((candidate) => ({
					name: candidate.name,
					party: candidate.party.party,
					location: candidate.constituency.name,
					image: candidate.image
						? candidate.image
						: this.generateAvatar(candidate.name),
					colorCode: candidate.party.color_code,
				}));
			} else {
				throw new Error("Invalid API response");
			}
		} catch (error) {
			console.error("Error fetching candidates:", error);
			// Fallback data
			this.candidates = [
				{
					name: "राहुल गांधी",
					party: "INC",
					location: "वायनाड",
					image: this.generateAvatar("राहुल गांधी"),
					colorCode: "#19AAED",
				},
				{
					name: "नरेंद्र मोदी",
					party: "BJP",
					location: "वाराणसी",
					image: this.generateAvatar("नरेंद्र मोदी"),
					colorCode: "#FF9933",
				},
				{
					name: "ममता बनर्जी",
					party: "AITC",
					location: "नंदीग्राम",
					image: this.generateAvatar("ममता बनर्जी"),
					colorCode: "#20C6B7",
				},
				{
					name: "अरविंद केजरीवाल",
					party: "AAP",
					location: "नई दिल्ली",
					image: this.generateAvatar("अरविंद केजरीवाल"),
					colorCode: "#0066CC",
				},
				{
					name: "योगी आदित्यनाथ",
					party: "BJP",
					location: "गोरखपुर",
					image: this.generateAvatar("योगी आदित्यनाथ"),
					colorCode: "#FF9933",
				},
			];
		} finally {
			this.isLoading = false;
			this.hideLoading();
			this.updateSliderContent();
		}
	}

	showLoadingInSlider() {
		this.sliderContent.innerHTML = `
            <div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 200px;
              width: 100%;
              font-family: Arial, sans-serif;
            ">
              <div style="
                width: 40px;
                height: 40px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #FF9933;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 15px;
              "></div>
              <p style="color: #666; font-size: 14px;">उम्मीदवार लोड हो रहे हैं...</p>
            </div>
          `;
	}

	showLoading() {
		const loadingDiv = document.createElement("div");
		loadingDiv.id = "election-hot-candidate-v1-loading-indicator";
		loadingDiv.innerHTML = `
                <div style="
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  min-height: 300px;
                  font-family: Arial, sans-serif;
                ">
                  <div style="
                    width: 50px;
                    height: 50px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #FF9933;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 20px;
                  "></div>
                  <p style="color: #666; font-size: 16px;">उम्मीदवार डेटा लोड हो रहा है...</p>
                </div>
                <style>
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                </style>
              `;
		this.container.appendChild(loadingDiv);
	}

	hideLoading() {
		const loadingDiv = document.getElementById(
			"election-hot-candidate-v1-loading-indicator",
		);
		if (loadingDiv) {
			loadingDiv.remove();
		}
	}

	createStyles() {
		const style = document.createElement("style");
		style.textContent = `
                * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
                }

                html, body {
                  box-sizing: border-box;
                }

                body {
                  font-family: Arial, sans-serif;
                  background-color: #f4f4f4;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  min-width: 100vw;
                  max-width: 100vw;
                  max-height: 100vh;
                  padding: 0;
                  margin: 0;
                  overflow-x: hidden !important;
                  overflow-y: hidden !important;
                  box-sizing: border-box;
                }

                .election-hot-candidate-v1-slider-container {
                  width: 100%;
                  max-width: 1200px;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                }

                .election-hot-candidate-v1-slider-title {
                  text-align: center;
                  margin-bottom: 20px;
                  font-size: 24px;
                  color: #333;
                }

                .election-hot-candidate-v1-slider-wrapper {
                  position: relative;
                  width: 100%;
                  overflow: hidden;
                  min-height: 260px;
                }

                .election-hot-candidate-v1-prev-btn,
                .election-hot-candidate-v1-next-btn {
                  position: absolute;
                  top: 50%;
                  transform: translateY(-50%);
                  background-color: rgba(255, 255, 255, 0.9);
                  border: none;
                  border-radius: 50%;
                  width: 40px;
                  height: 40px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  cursor: pointer;
                  z-index: 10;
                  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
                  transition: all 0.3s ease;
                }

                .election-hot-candidate-v1-prev-btn:hover,
                .election-hot-candidate-v1-next-btn:hover {
                  background-color: rgba(255, 255, 255, 1);
                  transform: translateY(-50%) scale(1.1);
                }

                .election-hot-candidate-v1-prev-btn {
                  left: 10px;
                }

                .election-hot-candidate-v1-next-btn {
                  right: 10px;
                }

                .election-hot-candidate-v1-slider-content {
                  display: flex;
                  align-items: center;
                  gap: 20px;
                  transition: transform 0.7s cubic-bezier(0.77,0,0.175,1);
                  padding: 0 60px;
                  min-height: 260px;
                }

                .election-hot-candidate-v1-candidate-card {
                  flex: 0 0 220px;
                  min-width: 220px;
                  max-width: 220px;
                  min-height: 260px;
                  max-height: 320px;
                  background-color: white;
                  border-radius: 15px;
                  padding: 20px;
                  text-align: center;
                  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
                  transition: transform 0.3s ease;
                  position: relative;
                  overflow: hidden;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: flex-start;
                }

                .election-hot-candidate-v1-candidate-card::before {
                  content: '';
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  height: 4px;
                  background: var(--party-color, #ccc);
                }

                .election-hot-candidate-v1-candidate-card:hover {
                  transform: scale(1.05);
                  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
                }

                .election-hot-candidate-v1-candidate-card img {
                  width: 140px;
                  height: 140px;
                  min-width: 140px;
                  min-height: 140px;
                  max-width: 140px;
                  max-height: 140px;
                  border-radius: 50%;
                  object-fit: cover;
                  margin-bottom: 15px;
                  border: 3px solid #f0f0f0;
                  transition: border-color 0.3s ease;
                  background: #f8f8f8;
                }

                .election-hot-candidate-v1-candidate-card:hover img {
                  border-color: var(--party-color, #ccc);
                }

                .election-hot-candidate-v1-candidate-card h3 {
                  font-size: 18px;
                  margin-bottom: 10px;
                  color: #333;
                  font-weight: 600;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  width: 100%;
                }

                .election-hot-candidate-v1-party-badge {
                  display: inline-block;
                  padding: 6px 12px;
                  border-radius: 20px;
                  font-weight: bold;
                  font-size: 0.8rem;
                  margin-bottom: 10px;
                  color: white;
                  background: var(--party-color, #666);
                  min-width: 60px;
                }

                .election-hot-candidate-v1-candidate-location {
                  color: #666;
                  font-size: 14px;
                  font-weight: 500;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  width: 100%;
                }

                /* Tablet styles */
                @media (max-width: 1024px) {
                  .election-hot-candidate-v1-slider-container {
                    max-width: 900px;
                  }
                  .election-hot-candidate-v1-candidate-card {
                    flex: 0 0 180px;
                    min-width: 180px;
                    max-width: 180px;
                    min-height: 220px;
                    max-height: 260px;
                  }
                  .election-hot-candidate-v1-candidate-card img {
                    width: 110px;
                    height: 110px;
                    min-width: 110px;
                    min-height: 110px;
                    max-width: 110px;
                    max-height: 110px;
                  }
                  .election-hot-candidate-v1-slider-title {
                    font-size: 22px;
                  }
                  .election-hot-candidate-v1-slider-content {
                    padding: 0 30px;
                  }
                }

                /* Mobile styles */
                @media (max-width: 768px) {
                  html, body {
                    overflow: hidden !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    position: fixed !important;
                    overscroll-behavior: none !important;
                  }
                  body {
                    padding: 10px;
                    overflow-x: hidden;
                    overflow-y: hidden;
                    width: 100vw;
                    height: 100vh;
                    box-sizing: border-box;
                  }
                  #candidate-slider-widget{
                    width: 100vw;
                    min-width: 0;
                  }
                  .election-hot-candidate-v1-slider-container {
                    width: 100vw;
                    min-width: 0;
                  }
                  .election-hot-candidate-v1-slider-wrapper {
                    width: 100vw;
                    min-width: 0;
                  }
                  .election-hot-candidate-v1-slider-content {
                    padding: 0 10px;
                    gap: 0;
                  }
                  .election-hot-candidate-v1-candidate-card {
                    flex: 0 0 50%;
                    min-width: 50%;
                    max-width: 50%;
                    min-height: 420px;
                    max-height: 480px;
                    padding: 10px;
                  }
                  .election-hot-candidate-v1-candidate-card img {
                    width: 80px;
                    height: 80px;
                    min-width: 80px;
                    min-height: 80px;
                    max-width: 80px;
                    max-height: 80px;
                  }
                  .election-hot-candidate-v1-candidate-card h3 {
                    font-size: 15px;
                  }
                  .election-hot-candidate-v1-party-badge {
                    font-size: 0.7rem;
                    padding: 4px 8px;
                  }
                  .election-hot-candidate-v1-candidate-location {
                    font-size: 12px;
                  }
                  .election-hot-candidate-v1-slider-title {
                    font-size: 18px;
                    margin-bottom: 10px;
                  }
                  .election-hot-candidate-v1-prev-btn,
                  .election-hot-candidate-v1-next-btn {
                    width: 28px;
                    height: 28px;
                  }
                  .election-hot-candidate-v1-prev-btn svg,
                  .election-hot-candidate-v1-next-btn svg {
                    width: 14px;
                    height: 14px;
                  }
                }

                /* Small mobile styles */
                @media (max-width: 480px) {
                  html, body {
                    overflow: hidden !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    position: fixed !important;
                    overscroll-behavior: none !important;
                  }
                  body {
                    padding: 4px;
                    overflow-x: hidden;
                    overflow-y: hidden;
                    width: 100vw;
                    height: 100vh;
                    box-sizing: border-box;
                  }
                  .election-hot-candidate-v1-slider-content {
                    padding: 0 2px;
                    gap: 6px;
                  }
                  .election-hot-candidate-v1-candidate-card {
                    flex: 0 0 110px;
                    min-width: 110px;
                    max-width: 110px;
                    min-height: 140px;
                    max-height: 170px;
                    padding: 6px;
                  }
                  .election-hot-candidate-v1-candidate-card img {
                    width: 55px;
                    height: 55px;
                    min-width: 55px;
                    min-height: 55px;
                    max-width: 55px;
                    max-height: 55px;
                  }
                  .election-hot-candidate-v1-candidate-card h3 {
                    font-size: 12px;
                  }
                  .election-hot-candidate-v1-party-badge {
                    font-size: 0.6rem;
                    padding: 2px 5px;
                  }
                  .election-hot-candidate-v1-candidate-location {
                    font-size: 10px;
                  }
                  .election-hot-candidate-v1-slider-title {
                    font-size: 15px;
                  }
                  .election-hot-candidate-v1-prev-btn,
                  .election-hot-candidate-v1-next-btn {
                    width: 22px;
                    height: 22px;
                  }
                  .election-hot-candidate-v1-prev-btn svg,
                  .election-hot-candidate-v1-next-btn svg {
                    width: 10px;
                    height: 10px;
                  }
                }
              `;
		document.head.appendChild(style);
	}

	updateSliderContent() {
		// Clear existing content
		this.sliderContent.innerHTML = "";

		// Reset position
		this.currentPosition = 0;

		// Clear any existing auto-slide interval
		if (this.autoSlideInterval) {
			clearInterval(this.autoSlideInterval);
			this.autoSlideInterval = null;
		}

		// Create candidate cards
		this.candidates.forEach((candidate) => {
			const card = this.createCandidateCard(candidate);
			this.sliderContent.appendChild(card);
		});

		// Setup event listeners
		this.setupEventListeners();
	}

	createCandidateCard(candidate) {
		const card = document.createElement("div");
		card.className = "election-hot-candidate-v1-candidate-card";
		card.style.setProperty("--party-color", candidate.colorCode || "#666");

		const img = document.createElement("img");
		img.src = candidate.image;
		img.alt = candidate.name;
		img.onerror = () => {
			img.src = this.generateAvatar(candidate.name);
		};

		const name = document.createElement("h3");
		name.textContent = candidate.name;

		const partyBadge = document.createElement("span");
		partyBadge.className = "election-hot-candidate-v1-party-badge";
		partyBadge.textContent = candidate.party;
		partyBadge.style.background = candidate.colorCode || "#666";

		const location = document.createElement("div");
		location.className = "election-hot-candidate-v1-candidate-location";
		location.textContent = candidate.location;

		card.appendChild(img);
		card.appendChild(name);
		card.appendChild(partyBadge);
		card.appendChild(location);

		return card;
	}

	setupEventListeners() {
		// Set cards per slide on resize
		window.addEventListener("resize", () => {
			this.setCardsPerSlide();
			this.updateCardDimensions();
			this.currentPosition = 0;
			this.updateSliderPosition();
		});

		this.updateCardDimensions();

		// Debounce for navigation buttons
		let isSliding = false;
		const slideWithDebounce = (direction) => {
			if (isSliding) return;
			isSliding = true;
			this.slide(direction);
			setTimeout(() => {
				isSliding = false;
			}, 700); // prevent rapid clicks
		};

		this.nextBtn.addEventListener("click", () => slideWithDebounce("next"));
		this.prevBtn.addEventListener("click", () => slideWithDebounce("prev"));

		// Only setup auto-sliding if we have enough candidates
		if (this.candidates.length > this.cardsPerSlide) {
			this.autoSlideInterval = setInterval(
				() => slideWithDebounce("next"),
				5000,
			);
			// Pause on hover
			this.sliderWrapper.addEventListener("mouseenter", () => {
				clearInterval(this.autoSlideInterval);
			});
			this.sliderWrapper.addEventListener("mouseleave", () => {
				this.autoSlideInterval = setInterval(
					() => slideWithDebounce("next"),
					5000,
				);
			});
		}

		// Touch support for mobile
		this.setupTouchEvents(slideWithDebounce);
	}

	setupTouchEvents(slideWithDebounce) {
		let startX = 0;
		let startY = 0;
		let isDragging = false;

		this.sliderWrapper.addEventListener("touchstart", (e) => {
			startX = e.touches[0].clientX;
			startY = e.touches[0].clientY;
			isDragging = true;
			if (this.autoSlideInterval) {
				clearInterval(this.autoSlideInterval);
			}
		});

		this.sliderWrapper.addEventListener("touchmove", (e) => {
			if (!isDragging) return;
			const deltaX = Math.abs(e.touches[0].clientX - startX);
			const deltaY = Math.abs(e.touches[0].clientY - startY);
			if (deltaX > deltaY) {
				e.preventDefault();
			}
		});

		this.sliderWrapper.addEventListener("touchend", (e) => {
			if (!isDragging) return;
			const endX = e.changedTouches[0].clientX;
			const deltaX = startX - endX;
			if (Math.abs(deltaX) > 50) {
				if (deltaX > 0) {
					slideWithDebounce("next");
				} else {
					slideWithDebounce("prev");
				}
			}
			isDragging = false;
			if (this.candidates.length > this.cardsPerSlide) {
				this.autoSlideInterval = setInterval(
					() => slideWithDebounce("next"),
					5000,
				);
			}
		});
	}

	updateCardDimensions() {
		const cards = Array.from(
			this.sliderContent.querySelectorAll(
				".election-hot-candidate-v1-candidate-card",
			),
		);
		if (cards.length > 0) {
			const cardWidth = cards[0].offsetWidth;
			const gap =
				parseInt(window.getComputedStyle(this.sliderContent).gap) || 20;
			this.cardWidth = cardWidth + gap;
			this.totalWidth = this.cardWidth * this.candidates.length;
		}
	}

	updateSliderPosition() {
		this.sliderContent.style.transform = `translateX(-${this.currentPosition}px)`;
	}

	slide(direction) {
		if (this.candidates.length <= 1) return;

		const slideAmount = this.cardWidth * this.cardsPerSlide;
		const maxPosition =
			this.cardWidth * (this.candidates.length - this.cardsPerSlide);

		if (direction === "next") {
			this.currentPosition += slideAmount;
			if (this.currentPosition > maxPosition) {
				this.currentPosition = 0;
				this.sliderContent.style.transition = "none";
				this.updateSliderPosition();
				this.sliderContent.offsetHeight;
				this.sliderContent.style.transition = "transform 0.5s ease";
			}
		} else {
			this.currentPosition -= slideAmount;
			if (this.currentPosition < 0) {
				this.currentPosition = maxPosition > 0 ? maxPosition : 0;
				this.sliderContent.style.transition = "none";
				this.updateSliderPosition();
				this.sliderContent.offsetHeight;
				this.sliderContent.style.transition = "transform 0.5s ease";
			}
		}
		this.updateSliderPosition();
	}

	async createYearTabs() {
		const yearTabs = document.querySelector(
			"#election-hot-candidate-v1-yearTabs",
		);

		try {
			const result = await fetch(
				`https://election-stage.prabhatkhabar.com/election/years/Bihar`,
			);
			const allYears = (await result.json()).data.availableYears;

			// Set currentYear as instance property
			this.currentYear = allYears[0];

			const years = [...new Set(allYears.map((item) => item))].sort(
				(a, b) => b - a,
			);

			console.log(years);

			years.forEach((year) => {
				const tab = document.createElement("div");
				tab.className = `election-hot-candidate-v1-year-tab ${year === this.currentYear ? "active" : ""
					}`;
				tab.textContent = year;
				tab.addEventListener("click", async () => {
					// Don't do anything if clicking on the already active year
					if (year === this.currentYear) {
						return;
					}

					this.currentYear = year;
					this.updateActiveTab();

					// Show loading in slider area only
					this.showLoadingInSlider();

					// Fetch new candidates without full page refresh
					await this.fetchCandidatesForYear(this.currentYear.toString());
				});
				yearTabs.appendChild(tab);
			});
		} catch (error) {
			console.error("Error fetching years:", error);
			// Add fallback years if API fails
			const fallbackYears = ["2020", "2015", "2010"];
			this.currentYear = fallbackYears[0];

			fallbackYears.forEach((year) => {
				const tab = document.createElement("div");
				tab.className = `election-hot-candidate-v1-year-tab ${year === this.currentYear ? "active" : ""
					}`;
				tab.textContent = year;
				tab.addEventListener("click", async () => {
					if (year === this.currentYear) {
						return;
					}

					this.currentYear = year;
					this.updateActiveTab();
					this.showLoadingInSlider();
					await this.fetchCandidatesForYear(this.currentYear.toString());
				});
				yearTabs.appendChild(tab);
			});
		}
	}

	async fetchCandidatesForYear(electionYear) {
		try {
			const response = await fetch(
				`https://election-stage.prabhatkhabar.com/election/hot-candidates?state=${this.state}&year=${electionYear}`,
			);
			const data = await response.json();

			if (data.success && data.data) {
				this.candidates = data.data.map((candidate) => ({
					name: candidate.name,
					party: candidate.party.party,
					location: candidate.constituency.name,
					image: candidate.image
						? candidate.image
						: this.generateAvatar(candidate.name),
					colorCode: candidate.party.color_code,
				}));
			} else {
				throw new Error("Invalid API response");
			}
		} catch (error) {
			console.error("Error fetching candidates:", error);
			// Fallback data
			this.candidates = [
				{
					name: "उम्मीदवार डेटा लोड नहीं हो सका",
					party: "N/A",
					location: "कृपया बाद में पुनः प्रयास करें",
					image: this.generateAvatar("Error"),
					colorCode: "#666666",
				},
			];
		} finally {
			this.updateSliderContent();
		}
	}

	updateActiveTab() {
		document
			.querySelectorAll(".election-hot-candidate-v1-year-tab")
			.forEach((tab) => {
				tab.classList.remove("active");
				if (parseInt(tab.textContent) === this.currentYear) {
					tab.classList.add("active");
				}
			});
	}

	addYearTabStyles() {
		const styleId = "election-hot-candidate-v1-year-tabs-styles";

		// Check if styles already exist
		if (document.getElementById(styleId)) {
			return;
		}

		const style = document.createElement("style");
		style.id = styleId;
		style.textContent = `
          #election-hot-candidate-v1-yearTabs {
            display: flex;
            gap: 12px;
            margin: 20px 0;
            flex-wrap: wrap;
            align-items: center;
            justify-content: center;
          }

          .election-hot-candidate-v1-year-tab {
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

          .election-hot-candidate-v1-year-tab:hover:not(.active) {
            border-color: #ff6b35;
            color: #ff6b35;
            background-color: #fff8f5;
            transform: translateY(-1px);
            box-shadow: 0 2px 6px rgba(255, 107, 53, 0.2);
          }

          .election-hot-candidate-v1-year-tab.active {
            background-color: #ff6b35;
            border-color: #ff6b35;
            color: #fff;
            font-weight: 600;
            box-shadow: 0 2px 6px rgba(255, 107, 53, 0.3);
            cursor: default;
            pointer-events: none;
          }

          @media (max-width: 768px) {
            #election-hot-candidate-v1-yearTabs {
              gap: 8px;
              margin: 15px 0;
            }

            .election-hot-candidate-v1-year-tab {
              padding: 6px 12px;
              font-size: 13px;
              min-width: 50px;
            }
          }

          @media (max-width: 480px) {
            #election-hot-candidate-v1-yearTabs {
              gap: 6px;
              margin: 12px 0;
            }

            .election-hot-candidate-v1-year-tab {
              padding: 5px 10px;
              font-size: 12px;
              min-width: 45px;
            }
          }
        `;

		document.head.appendChild(style);
	}
}

// Initialize the widget when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
	new CandidateSliderWidget("candidate-slider-widget");
});
