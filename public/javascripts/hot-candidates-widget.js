class CandidateSliderWidget {
	constructor(containerId) {
		this.container = document.getElementById(containerId);
		this.candidates = [];
		this.currentPosition = 0;
		this.autoSlideInterval = null;
		this.autoSlideRestartTimeoutId = null;
		this.isSliding = false;
		this.eventHandlersBound = false;
		this.cardWidth = 0;
		this.totalWidth = 0;
		this.isLoading = true;
		this.currentYear = "";
		this.state = "Bihar";
		this.cardsPerSlide = 1; // Show only one candidate at a time
		this.init();
	}

	setCardsPerSlide() {
		// Simple responsive rule: 2 on mobile, 3 otherwise
		const isMobileViewport = window.matchMedia("(max-width: 768px)").matches;
		this.cardsPerSlide = isMobileViewport ? 2 : 3;
	}

	async init() {
		this.setCardsPerSlide();
		this.createStyles();
		this.injectHTML();
		await this.fetchCandidates();
	}

	injectHTML() {
		const sliderContainer = document.createElement("div");
		sliderContainer.className = "election-hot-candidate-v1-slider-container";

		sliderContainer.innerHTML = `
            <div class="election-hot-candidate-v1-slider-title">प्रमुख उम्मीदवार (Bihar Elections)</div>
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

	async fetchCandidates(electionYear = "2025") {
		try {
			this.showLoadingInSlider();
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
					electionStats: candidate.electionStats,
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

                .election-hot-candidate-v1-slider-container {
                  width: 100%;
                  max-width: 672px;
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

                // .election-hot-candidate-v1-prev-btn:hover,
                // .election-hot-candidate-v1-next-btn:hover {
                //   background-color: rgba(255, 255, 255, 1);
                //   transform: translateY(-50%) scale(1.1);
                // }

                .election-hot-candidate-v1-prev-btn {
                  left: 10px;
                }

                .election-hot-candidate-v1-next-btn {
                  right: 10px;
                }

                .election-hot-candidate-v1-slider-content {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  transition: transform 0.7s cubic-bezier(0.77,0,0.175,1);
                  padding: 0 60px;
                  gap: 20px;
                }

                .election-hot-candidate-v1-candidate-card {
                  background-color: white;
                  border-radius: 15px;
                  padding: 20px;
                  text-align: center;
                  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
                  transition: all 0.3s ease;
                  position: relative;
                  overflow: hidden;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: flex-start;
                }

                .election-hot-candidate-v1-candidate-card.current-candidate {
                  flex: 0 0 170px;
                }

                .election-hot-candidate-v1-candidate-card.next-candidate {
                  flex: 0 0 140px;
                  min-width: 200px;
                  max-width: 200px;
                  min-height: 240px;
                  max-height: 280px;
                  z-index: 1;
                  transform: scale(0.8);
                  // filter: blur(2px);
                  opacity: 0.7;
                }

                .election-hot-candidate-v1-candidate-card.prev-candidate {
                  flex: 0 0 140px;
                  min-width: 200px;
                  max-width: 200px;
                  min-height: 240px;
                  max-height: 280px;
                  z-index: 1;
                  transform: scale(0.8);
                  // filter: blur(2px);
                  opacity: 0.7;
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

                // .election-hot-candidate-v1-candidate-card:hover {
                //   transform: scale(1.05);
                //   box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
                // }

                .election-hot-candidate-v1-candidate-card img {
                  border-radius: 50%;
                  object-fit: cover;
                  margin-bottom: 8px;
                  border: 3px solid #f0f0f0;
                  transition: border-color 0.3s ease;
                  background: #f8f8f8;
                }

                .election-hot-candidate-v1-candidate-card.current-candidate img {
                  width: 100px;
                  height: 100px;
                }

                .election-hot-candidate-v1-candidate-card.next-candidate img {
                  width: 120px;
                  height: 120px;
                  min-width: 120px;
                  min-height: 120px;
                  max-width: 120px;
                  max-height: 120px;
                }

                .election-hot-candidate-v1-candidate-card.prev-candidate img {
                  width: 120px;
                  height: 120px;
                }

                .election-hot-candidate-v1-candidate-card:hover img {
                  border-color: var(--party-color, #ccc);
                }

                .election-hot-candidate-v1-candidate-card h3 {
                  margin-bottom: 10px;
                  color: #333;
                  font-weight: 600;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  width: 100%;
                }

                .election-hot-candidate-v1-candidate-card.current-candidate h3 {
                  font-size: 22px;
                }

                .election-hot-candidate-v1-candidate-card.next-candidate h3 {
                  font-size: 16px;
                }

                .election-hot-candidate-v1-candidate-card.prev-candidate h3 {
                  font-size: 16px;
                }

                .election-hot-candidate-v1-party-badge {
                  display: inline-block;
                  padding: 6px 12px;
                  border-radius: 20px;
                  font-weight: bold;
                  margin-bottom: 10px;
                  color: white;
                  background: var(--party-color, #666);
                  min-width: 60px;
                }

                .election-hot-candidate-v1-candidate-card.current-candidate .election-hot-candidate-v1-party-badge {
                  font-size: 0.9rem;
                  padding: 8px 16px;
                }

                .election-hot-candidate-v1-candidate-card.next-candidate .election-hot-candidate-v1-party-badge {
                  font-size: 0.7rem;
                  padding: 4px 8px;
                }

                .election-hot-candidate-v1-candidate-card.prev-candidate .election-hot-candidate-v1-party-badge {
                  font-size: 0.7rem;
                  padding: 4px 8px;
                }

                .election-hot-candidate-v1-candidate-location {
                  color: #666;
                  font-weight: 500;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  width: 100%;
                }

                .election-hot-candidate-v1-candidate-card.current-candidate .election-hot-candidate-v1-candidate-location {
                  font-size: 16px;
                }

                .election-hot-candidate-v1-candidate-card.next-candidate .election-hot-candidate-v1-candidate-location {
                  font-size: 12px;
                }

                .election-hot-candidate-v1-candidate-card.prev-candidate .election-hot-candidate-v1-candidate-location {
                  font-size: 12px;
                }

                /* Tablet styles */
                @media (max-width: 1024px) {
                  .election-hot-candidate-v1-slider-container {
                    max-width: 900px;
                  }
                  .election-hot-candidate-v1-candidate-card.current-candidate {
                    flex: 0 0 180px;
                  }
                  .election-hot-candidate-v1-candidate-card.next-candidate {
                    flex: 0 0 160px;
                    min-width: 160px;
                    max-width: 160px;
                  }
                  .election-hot-candidate-v1-candidate-card.current-candidate img {
                    width: 100px;
                    height: 100px;
                  }
                  .election-hot-candidate-v1-candidate-card.next-candidate img {
                    width: 100px;
                    height: 100px;
                    min-width: 100px;
                    min-height: 100px;
                    max-width: 100px;
                    max-height: 100px;
                  }
                  .election-hot-candidate-v1-slider-title {
                    font-size: 22px;
                  }
                  .election-hot-candidate-v1-slider-content {
                    padding: 0 30px;
                    gap: 30px;
                  }
                }

                /* Mobile styles */
                @media (max-width: 768px) {
		  .election-hot-candidate-v1-next-btn {
				right: 0px;
				top: 50%;
				transform: translate(-50%);
		  .election-hot-candidate-v1-prev-btn {
				left: 23px;
				top: 50%;
				transform: translate(-50%);
                  }
                  #candidate-slider-widget{
                    width: 100vw;
                    min-width: 0;
                  }
                  .election-hot-candidate-v1-slider-container {
                    min-width: 0;
		    display: flex;
		    justify-content: center;
                  }
                  .election-hot-candidate-v1-slider-wrapper {
                    min-width: 0;
                  }
                  .election-hot-candidate-v1-slider-content {
                    padding: 0 10px;
                    gap: 20px;
                    min-height: 300px;
                  }
                  .election-hot-candidate-v1-candidate-card.current-candidate {
                    flex: 0 0 150px;
                    padding: 15px;
                  }
                  .election-hot-candidate-v1-candidate-card.next-candidate {
                    flex: 0 0 140px;
                    min-width: 140px;
                    max-width: 140px;
                    min-height: 180px;
                    max-height: 220px;
                    padding: 10px;
                  }
                  .election-hot-candidate-v1-candidate-card.current-candidate img {
                    width: 100px;
                    height: 100px;
                    min-width: 100px;
                    min-height: 100px;
                    max-width: 100px;
                    max-height: 100px;
                  }
                  .election-hot-candidate-v1-candidate-card.next-candidate img {
                    width: 70px;
                    height: 70px;
                    min-width: 70px;
                    min-height: 70px;
                    max-width: 70px;
                    max-height: 70px;
                  }
                  .election-hot-candidate-v1-candidate-card.current-candidate h3 {
                    font-size: 18px;
                  }
                  .election-hot-candidate-v1-candidate-card.next-candidate h3 {
                    font-size: 14px;
                  }
                  .election-hot-candidate-v1-candidate-card.current-candidate .election-hot-candidate-v1-party-badge {
                    font-size: 0.8rem;
                    padding: 6px 12px;
                  }
                  .election-hot-candidate-v1-candidate-card.next-candidate .election-hot-candidate-v1-party-badge {
                    font-size: 0.6rem;
                    padding: 3px 6px;
                  }
                  .election-hot-candidate-v1-candidate-card.current-candidate .election-hot-candidate-v1-candidate-location {
                    font-size: 14px;
                  }
                  .election-hot-candidate-v1-candidate-card.next-candidate .election-hot-candidate-v1-candidate-location {
                    font-size: 11px;
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
                  .election-hot-candidate-v1-slider-content {
                    padding: 0 2px;
                    gap: 15px;
                    min-height: 250px;
                  }
                  .election-hot-candidate-v1-candidate-card.next-candidate {
                    flex: 0 0 100px;
                    min-width: 100px;
                    max-width: 100px;
                    min-height: 140px;
                    max-height: 180px;
                    padding: 8px;
                  }
                  .election-hot-candidate-v1-candidate-card.current-candidate img {
                    width: 80px;
                    height: 80px;
                    min-width: 80px;
                    min-height: 80px;
                    max-width: 80px;
                    max-height: 80px;
                  }
                  .election-hot-candidate-v1-candidate-card.next-candidate img {
                    width: 50px;
                    height: 50px;
                    min-width: 50px;
                    min-height: 50px;
                    max-width: 50px;
                    max-height: 50px;
                  }
                  .election-hot-candidate-v1-candidate-card.current-candidate h3 {
                    font-size: 16px;
                  }
                  .election-hot-candidate-v1-candidate-card.next-candidate h3 {
                    font-size: 12px;
                  }
                  .election-hot-candidate-v1-candidate-card.current-candidate .election-hot-candidate-v1-party-badge {
                    font-size: 0.7rem;
                    padding: 4px 8px;
                  }
                  .election-hot-candidate-v1-candidate-card.next-candidate .election-hot-candidate-v1-party-badge {
                    font-size: 0.5rem;
                    padding: 2px 4px;
                  }
                  .election-hot-candidate-v1-candidate-card.current-candidate .election-hot-candidate-v1-candidate-location {
                    font-size: 12px;
                  }
                  .election-hot-candidate-v1-candidate-card.next-candidate .election-hot-candidate-v1-candidate-location {
                    font-size: 9px;
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

		// Simple uniform slider overrides (3 cards desktop/tablet, 2 on mobile)
		const overrideId = "election-hot-candidate-v1-simple-overrides";
		if (!document.getElementById(overrideId)) {
			const overrideStyle = document.createElement("style");
			overrideStyle.id = overrideId;
			overrideStyle.textContent = `
			  /* Base: uniform card sizing and no zoom/opacity differences */
			  .election-hot-candidate-v1-candidate-card,
			  .election-hot-candidate-v1-candidate-card.current-candidate,
			  .election-hot-candidate-v1-candidate-card.next-candidate,
			  .election-hot-candidate-v1-candidate-card.prev-candidate {
			    flex: 0 0 170px;
			    transform: none !important;
			    opacity: 1 !important;
			  }

			  .election-hot-candidate-v1-candidate-card img {
			    width: 90px;
			    height: 90px;
			    min-width: 90px;
			    min-height: 90px;
			    max-width: 90px;
			    max-height: 90px;
			  }

			  .election-hot-candidate-v1-candidate-card h3 { font-size: 18px !important; margin: 0px;}
			  .election-hot-candidate-v1-party-badge { font-size: 0.8rem !important; padding: 6px 12px !important; margin-top: 5px; }
			  .election-hot-candidate-v1-candidate-location { font-size: 14px !important; }

			  /* Tablet */
			  @media (max-width: 1024px) {
			    .election-hot-candidate-v1-candidate-card,
			    .election-hot-candidate-v1-candidate-card.current-candidate,
			    .election-hot-candidate-v1-candidate-card.next-candidate,
			    .election-hot-candidate-v1-candidate-card.prev-candidate {
			      flex: 0 0 180px;
			    }
			    .election-hot-candidate-v1-candidate-card img { width: 90px; height: 90px; }
			  }

			  /* Mobile (2 cards) */
			  @media (max-width: 768px) {
			    .election-hot-candidate-v1-candidate-card,
			    .election-hot-candidate-v1-candidate-card.current-candidate,
			    .election-hot-candidate-v1-candidate-card.next-candidate,
			    .election-hot-candidate-v1-candidate-card.prev-candidate {
			      flex: 0 0 160px;
			    }
			    .election-hot-candidate-v1-candidate-card img { width: 80px; height: 80px; min-width: 80px; min-height: 80px; }
			    .election-hot-candidate-v1-candidate-card h3 { font-size: 16px !important; }
			    .election-hot-candidate-v1-party-badge { font-size: 0.75rem !important; padding: 5px 10px !important; }
			    .election-hot-candidate-v1-candidate-location { font-size: 12px !important; }
			  }

			  /* Small mobile */
			  @media (max-width: 480px) {
			    .election-hot-candidate-v1-candidate-card,
			    .election-hot-candidate-v1-candidate-card.current-candidate,
			    .election-hot-candidate-v1-candidate-card.next-candidate,
			    .election-hot-candidate-v1-candidate-card.prev-candidate {
			      flex: 0 0 130px;
			    }
			    .election-hot-candidate-v1-candidate-card img { width: 64px; height: 64px; min-width: 64px; min-height: 64px; }
			    .election-hot-candidate-v1-candidate-card h3 { font-size: 14px !important; }
			    .election-hot-candidate-v1-party-badge { font-size: 0.65rem !important; padding: 4px 8px !important; }
			    .election-hot-candidate-v1-candidate-location { font-size: 11px !important; }
			  }

			  /* Slide transition animations */
			  .ehc-slide-out-next .election-hot-candidate-v1-candidate-card { animation: ehcSlideLeft 0.35s ease both; }
			  .ehc-slide-out-prev .election-hot-candidate-v1-candidate-card { animation: ehcSlideRight 0.35s ease both; }
			  .ehc-slide-in-next .election-hot-candidate-v1-candidate-card { animation: ehcEnterFromRight 0.35s ease both; }
			  .ehc-slide-in-prev .election-hot-candidate-v1-candidate-card { animation: ehcEnterFromLeft 0.35s ease both; }

			  @keyframes ehcSlideLeft { from { transform: translateX(0); opacity: 1; } to { transform: translateX(-120%); opacity: 0; } }
			  @keyframes ehcSlideRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(120%); opacity: 0; } }
			  @keyframes ehcEnterFromRight { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
			  @keyframes ehcEnterFromLeft { from { transform: translateX(-120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
			`;
			document.head.appendChild(overrideStyle);
		}
	}

	updateSliderContent() {
		// Clear existing content
		this.sliderContent.innerHTML = "";

		if (!this.candidates || this.candidates.length === 0) {
			return;
		}

		// Render a simple window of N cards starting at currentPosition
		const visibleCount = Math.min(this.cardsPerSlide, this.candidates.length);
		for (let i = 0; i < visibleCount; i++) {
			const index = (this.currentPosition + i) % this.candidates.length;
			const candidate = this.candidates[index];
			const card = this.createCandidateCard(candidate, false, false, false);
			this.sliderContent.appendChild(card);
		}

		// Setup event listeners once
		this.setupEventListeners();
	}

	createCandidateCard(
		candidate,
		isCurrent = true,
		isNext = false,
		isPrev = false,
	) {
		const card = document.createElement("div");
		card.className = `election-hot-candidate-v1-candidate-card ${isCurrent ? "current-candidate" : ""} ${isNext ? "next-candidate" : ""} ${isPrev ? "prev-candidate" : ""}`;
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
		console.log(candidate);
		if (candidate.electionStats && candidate.electionStats.status) {
			const status = document.createElement("div");
			status.className = "election-hot-candidate-v1-candidate-location";
			status.textContent = candidate.electionStats.status;
			card.appendChild(status);
		}

		return card;
	}

	setupEventListeners() {
		if (this.eventHandlersBound) return;

		// Set cards per slide on resize
		window.addEventListener("resize", () => {
			this.setCardsPerSlide();
		});

		// Debounce for navigation buttons (instance-level guard)
		this.slideWithDebounce = (direction) => {
			if (this.isSliding) return;
			this.isSliding = true;
			this.stopAutoSlide();
			this.slide(direction);
			setTimeout(() => {
				this.isSliding = false;
				this.restartAutoSlideWithDelay();
			}, 500); // prevent rapid clicks
		};

		this.handleNextClick = () => this.slideWithDebounce("next");
		this.handlePrevClick = () => this.slideWithDebounce("prev");
		this.nextBtn.addEventListener("click", this.handleNextClick);
		this.prevBtn.addEventListener("click", this.handlePrevClick);

		// Auto-slide controls
		this.sliderWrapper.addEventListener("mouseenter", () =>
			this.stopAutoSlide(),
		);
		this.sliderWrapper.addEventListener("mouseleave", () =>
			this.startAutoSlide(),
		);

		// Touch support for mobile
		this.setupTouchEvents(this.slideWithDebounce);

		// Start auto-slide initially
		this.startAutoSlide();

		this.eventHandlersBound = true;
	}

	startAutoSlide() {
		if (this.candidates.length <= 1) return;
		if (this.autoSlideInterval) clearInterval(this.autoSlideInterval);
		this.autoSlideInterval = setInterval(
			() => this.slideWithDebounce("next"),
			5000,
		);
	}

	stopAutoSlide() {
		if (this.autoSlideInterval) {
			clearInterval(this.autoSlideInterval);
			this.autoSlideInterval = null;
		}
		if (this.autoSlideRestartTimeoutId) {
			clearTimeout(this.autoSlideRestartTimeoutId);
			this.autoSlideRestartTimeoutId = null;
		}
	}

	restartAutoSlideWithDelay(delayMs = 2000) {
		this.stopAutoSlide();
		this.autoSlideRestartTimeoutId = setTimeout(
			() => this.startAutoSlide(),
			delayMs,
		);
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
			this.restartAutoSlideWithDelay();
		});
	}

	slide(direction) {
		if (this.candidates.length <= 1) return;

		const durationMs = 350;
		const outClass = direction === "next" ? "ehc-slide-out-next" : "ehc-slide-out-prev";
		const inClass = direction === "next" ? "ehc-slide-in-next" : "ehc-slide-in-prev";

		// Animate current cards out
		this.sliderContent.classList.remove("ehc-slide-out-next", "ehc-slide-out-prev", "ehc-slide-in-next", "ehc-slide-in-prev");
		this.sliderContent.classList.add(outClass);

		setTimeout(() => {
			// Update index after out animation completes
			if (direction === "next") {
				this.currentPosition = (this.currentPosition + 1) % this.candidates.length;
			} else {
				this.currentPosition = this.currentPosition === 0
					? this.candidates.length - 1
					: this.currentPosition - 1;
			}

			// Render next set and animate them in
			this.updateSliderContent();
			this.sliderContent.classList.remove(outClass);
			this.sliderContent.classList.add(inClass);

			setTimeout(() => {
				this.sliderContent.classList.remove(inClass);
			}, durationMs);
		}, durationMs);
	}

	async createYearTabs() {
		const yearTabs = document.querySelector(
			"#election-hot-candidate-v1-yearTabs",
		);

		try {
			const result = await fetch(`https://election-stage.prabhatkhabar.com/election/years/Bihar`);
			const allYears = (await result.json()).data.availableYears;

			// Set currentYear as instance property
			this.currentYear = allYears[0];

			const years = [...new Set(allYears.map((item) => item))].sort(
				(a, b) => b - a,
			);

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
			console.log(data);

			if (data.success && data.data) {
				this.candidates = data.data.map((candidate) => ({
					name: candidate.name,
					party: candidate.party.party,
					location: candidate.constituency.name,
					image: candidate.image
						? candidate.image
						: this.generateAvatar(candidate.name),
					colorCode: candidate.party.color_code,
					electionStats: candidate.electionStats || null,
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
