const express = require("express");
const { isAdmin, isUser } = require("../middleware/admin");
const Election = require("../models/election.model");
const Party = require("../models/party.model");
const Constituency = require("../models/constituency");
const Candidate = require("../models/candidates");
const TempElection = require("../models/temp-election.model");
const AllianceModel = require("../models/alliance.model");
const AssemblyElection = require("../models/assembly-election.model");
const RedisManager = require("../RedisManager");
const PartyElectionModel = require("../models/party-election-model");
const isLoggedIn = require("../middleware/login");
const CandidateElectioModel = require("../models/candidate-election-model");
const UserModel = require("./../models/user.model");
const ElectionConstituencyModel = require("./../models/constituency-election-model");
const ElectionModel = require("../models/temp-election.model");
const router = express.Router();
const mongoose = require("mongoose");

const redis = RedisManager.getInstance();

async function getCandidateElectionDetails(
	userType,
	electionId,
	allowedConstituencies,
) {
	const pipeline = [
		{ $match: { election: new mongoose.Types.ObjectId(electionId) } },

		// Lookup candidate info
		{
			$lookup: {
				from: "candidates",
				localField: "candidate",
				foreignField: "_id",
				as: "candidateInfo",
			},
		},
		{ $unwind: "$candidateInfo" },

		// Optional user filter
		...(userType === "user"
			? [
				{
					$match: {
						"candidateInfo.constituency": {
							$in: allowedConstituencies.map((id) =>
								typeof id === "string" ? new mongoose.Types.ObjectId(id) : id,
							),
						},
					},
				},
			]
			: []),

		// Normalize constituency field (ensure always array)
		{
			$addFields: {
				"candidateInfo.constituency": {
					$cond: [
						{ $isArray: "$candidateInfo.constituency" },
						"$candidateInfo.constituency",
						["$candidateInfo.constituency"],
					],
				},
			},
		},

		// Unwind so we get one doc per constituency
		{ $unwind: "$candidateInfo.constituency" },

		// Lookup constituency info
		{
			$lookup: {
				from: "constituencies",
				localField: "candidateInfo.constituency",
				foreignField: "_id",
				as: "constituencyInfo",
			},
		},
		{ $unwind: "$constituencyInfo" },

		// Lookup party info
		{
			$lookup: {
				from: "parties",
				localField: "candidateInfo.party",
				foreignField: "_id",
				as: "partyInfo",
			},
		},
		{ $unwind: { path: "$partyInfo", preserveNullAndEmptyArrays: true } },

		// Lookup votes info
		{
			$lookup: {
				from: "electioncandidates",
				let: { candidateId: "$candidateInfo._id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$election", new mongoose.Types.ObjectId(electionId)],
									},
									{ $eq: ["$candidate", "$$candidateId"] },
								],
							},
						},
					},
					{ $project: { votesReceived: 1 } },
				],
				as: "voteInfo",
			},
		},
		{ $unwind: { path: "$voteInfo", preserveNullAndEmptyArrays: true } },

		// Lookup constituency election status (one per constituency now)
		{
			$lookup: {
				from: "electionconstituencies",
				let: {
					electionId: new mongoose.Types.ObjectId(electionId),
					constituencyId: "$candidateInfo.constituency",
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$election", "$$electionId"] },
									{ $eq: ["$constituency", "$$constituencyId"] },
								],
							},
						},
					},
					{ $project: { status: 1, _id: 0 } },
				],
				as: "constituencyElectionStatus",
			},
		},
		{
			$unwind: {
				path: "$constituencyElectionStatus",
				preserveNullAndEmptyArrays: true,
			},
		},

		// Final projection
		{
			$project: {
				_id: 1,
				election: 1,
				candidate: {
					_id: "$candidateInfo._id",
					name: "$candidateInfo.name",
					constituency: "$constituencyInfo",
					party: "$partyInfo",
					votesReceived: { $ifNull: ["$voteInfo.votesReceived", 0] },
				},
				constituencyStatus: {
					$ifNull: ["$constituencyElectionStatus.status", "unknown"],
				},
			},
		},
	];

	// Execute the aggregation
	const candidateElections = await CandidateElectioModel.aggregate(pipeline);

	return candidateElections;
}

/* GET home page. */
router.get("/", function(req, res, next) {
	if (!req.session.user) {
		return res.redirect("/login");
	}
	res.redirect("/temp-election-list");
});

router.get(
	"/edit-election/:id",
	isLoggedIn,
	isAdmin,
	async function(req, res, next) {
		try {
			const electionId = req.params.id;
			console.log(electionId);
			const election = await Election.findById(electionId);
			console.log(election);
			if (!election) {
				return res.status(404).send("Election not found");
			}
			res.render("edit-election.ejs", { election, user: req.session.user });
		} catch (error) {
			next(error);
		}
	},
);

router.get("/accounts-list", isLoggedIn, isAdmin, async (req, res) => {
	const users = await UserModel.find({}).populate(
		"allowedConstituencies",
		"name",
	);
	const constituencies = await Constituency.find({}, "_id name");

	console.log(users);

	res.render("accounts-list.ejs", {
		users,
		availableConstituencies: constituencies,
		userRole: req.userRole,
	});
});

router.get("/create-account", isLoggedIn, isAdmin, async (req, res) => {
	const constituencies = await Constituency.find({}, "_id name");
	res.render("create-accounts.ejs", { constituencies, userRole: req.userRole });
});

router.get("/create-election", isLoggedIn, isAdmin, function(req, res, next) {
	return res.render("create-election.ejs", { userRole: req.userRole });
});

router.get(
	"/alliance-election/:electionId",
	isLoggedIn,
	isUser,
	async (req, res) => {
		const { electionId } = req.params;

		const alliancesData = await AllianceModel.aggregate([
			// Match alliances for this election
			{ $match: { election: new mongoose.Types.ObjectId(electionId) } },

			{
				$lookup: {
					from: "parties",
					localField: "parties",
					foreignField: "_id",
					as: "populatedParties",
				},
			},

			{ $unwind: "$populatedParties" },

			{
				$lookup: {
					from: "electionpartyresults",
					let: {
						partyId: "$populatedParties._id",
						electionId: "$election",
					},
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ["$party", "$$partyId"] },
										{ $eq: ["$election", "$$electionId"] },
									],
								},
							},
						},
						{ $project: { seatsWon: 1, _id: 0 } },
					],
					as: "partyResults",
				},
			},

			{
				$addFields: {
					seatsWon: {
						$ifNull: [{ $arrayElemAt: ["$partyResults.seatsWon", 0] }, 0],
					},
				},
			},

			{
				$group: {
					_id: "$_id",
					name: { $first: "$name" },
					election: { $first: "$election" },
					parties: {
						$push: {
							$mergeObjects: ["$populatedParties", { seatsWon: "$seatsWon" }],
						},
					},
				},
			},

			{
				$project: {
					_id: 1,
					name: 1,
					election: 1,
					parties: 1,
				},
			},
		]);

		console.log("This is alliances data -> ", alliancesData);
		return res.render("alliance-election", {
			alliancesData,
			userRole: req.userRole,
		});
	},
);

router.get("/login", function(req, res, next) {
	if (req.session.user) {
		return res.redirect("/temp-election-list");
	}
	res.render("login.ejs");
});

router.get("/dashboard", isLoggedIn, isAdmin, function(req, res, next) {
	if (!req.session.user) {
		return res.redirect("/login");
	}
	if (!req.session.user || req.session.user.role !== "admin") {
		return res.render("dashboard.ejs", {
			error: "you are not authorized to use this resource",
		});
	}
	res.render("dashboard.ejs", { error: null, userRole: req.userRole });
});

router.get("/alliances", isLoggedIn, isAdmin, async (req, res) => {
	const alliances = await AllianceModel.find()
		.populate("leaderParty", "party")
		.populate("parties")
		.populate("election", "electionSlug");
	res.render("alliance.ejs", { alliances, userRole: req.userRole });
});

router.get("/edit-alliance/:id", async (req, res) => {
	const alliance = await AllianceModel.findById(req.params.id)
		.populate("parties", "party")
		.populate("leaderParty", "party");

	console.log(alliance);

	const allParties = await Party.find({}, "_id party");
	res.render("edit-alliance", { alliance, allParties, userRole: req.userRole });
});

router.get("/create-alliance", isLoggedIn, isAdmin, async (req, res) => {
	// const parties = await Party.aggregate([
	// 	{
	// 		$lookup: {
	// 			from: "alliances",
	// 			localField: "_id",
	// 			foreignField: "parties",
	// 			as: "allianceInfo",
	// 		},
	// 	},
	// 	{
	// 		$match: { allianceInfo: { $size: 0 } },
	// 	},
	// 	{
	// 		$project: { _id: 1, party: 1 },
	// 	},
	// ]);
	const ongoingElections = await ElectionModel.find({ status: "ongoing" });
	res.render("create-alliance.ejs", {
		parties: [],
		userRole: req.userRole,
		ongoingElections,
	});
});

router.get("/temp-create-election", isLoggedIn, isAdmin, async (req, res) => {
	const parties = await Party.find({}, "_id party");
	const candidates = await Candidate.find()
		.populate("party", "party")
		.populate("constituency", "name");
	res.render("temp-create-election.ejs", {
		parties,
		candidates,
		userRole: req.userRole,
	});
});

router.get(
	"/temp-edit-election/:id",
	isLoggedIn,
	isUser,
	async function(req, res, next) {
		try {
			const electionId = req.params.id;

			const election = await TempElection.findById(electionId)
				.populate("electionInfo.partyIds")
				.populate({
					path: "electionInfo.candidates",
					populate: [{ path: "party" }, { path: "constituency" }],
				});

			if (!election) {
				return res.status(404).send("Election not found");
			}
			const electionConstituencies = await ElectionConstituencyModel.find({
				election: electionId,
			}).populate("constituency");

			let partyElectionDetails;
			let candidateElectionDetails;

			if (req.userRole === "user") {
				candidateElectionDetails = await getCandidateElectionDetails(
					req.userRole,
					electionId,
					req.allowedConst,
				);

				candidateElectionDetails = candidateElectionDetails.filter(
					(doc) => doc.candidate !== null,
				);

				const allowedParties = candidateElectionDetails.map(
					(candidate) => candidate.candidate.party._id,
				);

				partyElectionDetails = await PartyElectionModel.find({
					party: { $in: allowedParties },
					election: electionId,
				}).populate("party");
			} else {
				partyElectionDetails = await PartyElectionModel.find({
					election: electionId,
				}).populate("party");

				candidateElectionDetails = await getCandidateElectionDetails(
					req.userRole,
					electionId,
					req.allowedConst,
				);
			}

			const partyIdsInElection = partyElectionDetails.map((partyElection) =>
				partyElection.party._id.toString(),
			);

			const candidatesInElection = candidateElectionDetails.map(
				(candidateElection) => candidateElection.candidate._id.toString(),
			);

			const allPartiesList = await Party.find(
				{ _id: { $nin: partyIdsInElection } },
				"party",
			);

			const candidatesQuery = {
				_id: { $nin: candidatesInElection },
				party: { $in: partyIdsInElection },
			};

			const allCandidatesList = await Candidate.find(candidatesQuery, "name")
				.populate("party", "party")
				.populate("constituency", "name");

			res.render("temp-edit-election.ejs", {
				election,
				user: req.session.user,
				partyElectionDetails,
				candidateElectionDetails,
				allPartiesList,
				allCandidatesList,
				electionConstituencies,
				userRole: req.userRole,
			});
		} catch (error) {
			next(error);
		}
	},
);

router.get("/temp-election-list", isLoggedIn, isUser, async (req, res) => {
	try {
		const elections = await TempElection.aggregate([
			{
				$lookup: {
					from: "electionpartyresults",
					localField: "electionInfo.partyIds",
					foreignField: "party",
					as: "partyResults",
				},
			},
			{
				$lookup: {
					from: "electioncandidates",
					localField: "electionInfo.candidates",
					foreignField: "candidate",
					as: "candidateResults",
				},
			},
			{
				$lookup: {
					from: "parties",
					localField: "electionInfo.partyIds",
					foreignField: "_id",
					as: "parties",
				},
			},
			{
				$lookup: {
					from: "candidates",
					localField: "electionInfo.candidates",
					foreignField: "_id",
					as: "candidates",
				},
			},
			{
				$lookup: {
					from: "constituencies",
					localField: "candidates.constituency", // Changed from candidates.constituency.0
					foreignField: "_id",
					as: "constituencies",
				},
			},
			{
				$addFields: {
					"electionInfo.partyIds": {
						$map: {
							input: "$parties",
							as: "party",
							in: {
								$mergeObjects: [
									"$$party",
									{
										seatsWon: {
											$let: {
												vars: {
													result: {
														$arrayElemAt: [
															{
																$filter: {
																	input: "$partyResults",
																	as: "result",
																	cond: {
																		$eq: ["$$result.party", "$$party._id"],
																	},
																},
															},
															0,
														],
													},
												},
												in: "$$result.seatsWon",
											},
										},
										votes: {
											$sum: {
												$map: {
													input: {
														$filter: {
															input: "$candidates",
															as: "candidate",
															cond: {
																$eq: ["$$candidate.party", "$$party._id"],
															},
														},
													},
													as: "candidate",
													in: {
														$let: {
															vars: {
																result: {
																	$arrayElemAt: [
																		{
																			$filter: {
																				input: "$candidateResults",
																				as: "result",
																				cond: {
																					$eq: [
																						"$$result.candidate",
																						"$$candidate._id",
																					],
																				},
																			},
																		},
																		0,
																	],
																},
															},
															in: "$$result.votesReceived",
														},
													},
												},
											},
										},
									},
								],
							},
						},
					},
					"electionInfo.candidates": {
						$map: {
							input: "$candidates",
							as: "candidate",
							in: {
								$mergeObjects: [
									"$$candidate",
									{
										votesReceived: {
											$let: {
												vars: {
													result: {
														$arrayElemAt: [
															{
																$filter: {
																	input: "$candidateResults",
																	as: "result",
																	cond: {
																		$eq: [
																			"$$result.candidate",
																			"$$candidate._id",
																		],
																	},
																},
															},
															0,
														],
													},
												},
												in: "$$result.votesReceived",
											},
										},
										party: {
											$arrayElemAt: [
												{
													$filter: {
														input: "$parties",
														as: "party",
														cond: {
															$eq: ["$$party._id", "$$candidate.party"],
														},
													},
												},
												0,
											],
										},
										constituency: {
											// Changed from array to direct object
											$arrayElemAt: [
												{
													$filter: {
														input: "$constituencies",
														as: "constituency",
														cond: {
															$eq: [
																"$$constituency._id",
																"$$candidate.constituency",
															], // Direct comparison now
														},
													},
												},
												0,
											],
										},
									},
								],
							},
						},
					},
				},
			},
			{
				$project: {
					partyResults: 0,
					candidateResults: 0,
					parties: 0,
					candidates: 0,
					constituencies: 0,
				},
			},
		]);
		// console.log(elections[0].electionInfo.candidates[0]);

		// Render the template with the elections data
		res.render("temp-election-list.ejs", { elections, userRole: req.userRole });
	} catch (error) {
		console.error("Error fetching elections:", error);
		res.status(500).render("error.ejs", {
			message: "Failed to fetch elections data",
			error,
		});
	}
});

// create a party route
router.get("/parties", isLoggedIn, isAdmin, async function(req, res, next) {
	try {
		const parties = await Party.find(); // Fetch all parties from the database
		return res.render("party.ejs", { parties, userRole: req.userRole });
	} catch (error) {
		console.log(error);
		res.status(500).send("Error fetching parties");
	}
});

// create party page
router.get("/create-party", isLoggedIn, isAdmin, function(req, res, next) {
	res.render("create-party.ejs", { userRole: req.userRole });
});

router.get(
	"/edit-party/:id",
	isLoggedIn,
	isAdmin,
	async function(req, res, next) {
		try {
			const partyId = req.params.id;
			const party = await Party.findById(partyId);
			if (!party) {
				return res.status(404).send("Party not found");
			}
			res.render("edit-party.ejs", { party, userRole: req.userRole });
		} catch (error) {
			next(error);
		}
	},
);

// create constituency route
router.get(
	"/constituency",
	isLoggedIn,
	isAdmin,
	async function(req, res, next) {
		try {
			const constituencies = await Constituency.find()
				.populate({
					path: "candidates",
					model: "Candidate",
					populate: {
						path: "party",
						model: "Party",
					},
				})
				.sort({ name: 1 }); // Fetch all constituencies from the database

			return res.render("constituency.ejs", {
				constituencies,
				userRole: req.userRole,
			});
		} catch (error) {
			console.log(error);
			res.status(500).send("Error fetching constituencies");
		}
	},
);

// create constituency page create-constituency
router.get(
	"/create-constituency",
	isLoggedIn,
	isAdmin,
	async function(req, res, next) {
		const candidates = await Candidate.find();
		const errorMessages = req.flash("error");
		res.render("create-constituency.ejs", {
			candidates,
			error: errorMessages,
			userRole: req.userRole,
		});
	},
);

router.get(
	"/edit-constituency/:id",
	isLoggedIn,
	isAdmin,
	async function(req, res, next) {
		try {
			const constituencyId = req.params.id;
			const constituency = await Constituency.findById(constituencyId).populate(
				{
					path: "candidates",
					model: "Candidate",
					populate: {
						path: "party",
						model: "Party",
					},
				},
			);
			if (!constituency) {
				return res.status(404).send("Constituency not found");
			}
			// get all the candidates
			const candidates = await Candidate.find().populate("party");
			res.render("edit-constituency.ejs", {
				constituency,
				candidates,
				error: null,
				userRole: req.userRole,
			});
		} catch (error) {
			console.log(error);
		}
	},
);

router.get("/candidates", isLoggedIn, isAdmin, async function(req, res, next) {
	try {
		const page = parseInt(req.query.page) || 1; // Get the current page number from query params
		const limit = parseInt(req.query.limit) || 10; // Set the limit of items per page
		const search = req.query.search || ""; // Get the search term from query params
		const skip = (page - 1) * limit; // Calculate the number of items to skip

		const cacheKey = `candidates:${page}:${limit}:${search}`; // Cache key based on page, limit, and search term

		// Try to fetch data from Redis cache
		const cachedData = await redis.get(cacheKey);

		if (cachedData) {
			// If data is found in the cache, return it
			return res.render("candidate.ejs", {
				candidates: cachedData.candidates,
				currentPage: page,
				totalPages: cachedData.totalPages,
				userRole: req.userRole,
				limit,
				search,
			});
		}

		// Create a search filter for MongoDB
		const searchFilter = search
			? {
				$or: [
					{ name: { $regex: search, $options: "i" } }, // Case-insensitive search in name
					{ "party.name": { $regex: search, $options: "i" } }, // Search in party name
					{ "constituency.name": { $regex: search, $options: "i" } }, // Search in constituency name
				],
			}
			: {};

		// Query the database
		const candidates = await Candidate.find(searchFilter)
			.populate("party constituency")
			.skip(skip) // Skip the items based on pagination
			.limit(limit); // Limit the number of items returned

		const totalCandidates = await Candidate.countDocuments(searchFilter); // Get the total number of candidates matching the search

		// Calculate total pages
		const totalPages = Math.ceil(totalCandidates / limit);

		// Store the data in Redis with TTL of 3600 seconds (1 hour)
		const dataToCache = {
			candidates,
			totalPages,
		};
		await redis.setWithTTL(cacheKey, dataToCache, 3600);

		return res.render("candidate.ejs", {
			candidates: candidates || [],
			currentPage: page,
			totalPages,
			limit,
			search,
			userRole: req.userRole,
		});
	} catch (error) {
		console.log(error);
		res.status(500).send("Error fetching candidates");
	}
});

router.get(
	"/create-candidate",
	isLoggedIn,
	isAdmin,
	async function(req, res, next) {
		try {
			const parties = await Party.find(); // Fetch all parties
			const constituencies = await Constituency.find(); // Fetch all constituencies
			return res.render("create-candidate.ejs", {
				parties,
				constituencies,
				error: null,
				userRole: req.userRole,
			});
		} catch (error) {
			console.log(error);
			res.status(500).send("Error fetching data for creating candidate");
		}
	},
);

router.get(
	"/edit-candidate/:id",
	isLoggedIn,
	isAdmin,
	async function(req, res, next) {
		try {
			const candidateId = req.params.id;
			const candidate =
				await Candidate.findById(candidateId).populate("party constituency");
			if (!candidate) {
				return res.status(404).send("Candidate not found");
			}
			const parties = await Party.find(); // Fetch all parties
			const constituencies = await Constituency.find(); // Fetch all constituencies
			res.render("edit-candidate.ejs", {
				candidate,
				parties,
				constituencies,
				userRole: req.userRole,
			});
		} catch (error) {
			console.log(error);
			res.status(500).send("Error fetching data for editing candidate");
		}
	},
);

// create for assembly-election
router.get(
	"/create-assembly-election",
	isLoggedIn,
	isAdmin,
	async function(req, res, next) {
		try {
			const constituencies = await Constituency.find(); // Fetch all constituencies
			return res.render("create-assembly-election.ejs", {
				constituencies,
				error: null,
			});
		} catch (error) {
			console.log(error);
			res
				.status(500)
				.send("Error fetching data for creating assembly election");
		}
	},
);

// create for edit assembly-election
router.get(
	"/edit-assembly-election/:id",
	isLoggedIn,
	isAdmin,
	async function(req, res, next) {
		try {
			const electionId = req.params.id;
			const assemblyElection = await AssemblyElection.findById(electionId);
			if (!assemblyElection) {
				return res.status(404).send("Assembly election not found");
			}
			const elections = await Election.find(); // Fetch all elections
			const constituencies = await Constituency.find(); // Fetch all constituencies
			res.render("edit-assembly-election.ejs", {
				assemblyElection,
				elections,
				constituencies,
				userRole: req.userRole,
			});
		} catch (error) {
			console.log(error);
			res.status(500).send("Error fetching data for editing assembly election");
		}
	},
);

// get route for show the assembly-election
router.get(
	"/assembly-election",
	isLoggedIn,
	isAdmin,
	async function(req, res, next) {
		try {
			const assemblyElections =
				await AssemblyElection.find().populate("constituencies"); // Fetch all elections
			res.render("assembly-election.ejs", {
				assemblyElections,
				userRole: req.userRole,
			});
		} catch (error) {
			console.log(error);
			res.status(500).send("Error fetching assembly election");
		}
	},
);

router.get(
	"/cons-candidates",
	isLoggedIn,
	isAdmin,
	async function(req, res, next) {
		try {
			console.log("This is user role", req.userRole);

			const constituencies = await Constituency.find().sort({ name: 1 });
			const parties = await Party.find();

			if (req.query.cons) {
				// Find constituency by name (case-insensitive) and fetch candidates associated with it
				const constituency = await Constituency.findOne({
					name: { $regex: req.query.cons, $options: "i" },
				});

				// If the constituency does not exist, render empty candidates array
				const candidates = constituency
					? await Candidate.find({ constituency: constituency._id })
						.populate("party")
						.sort({ totalVotes: -1 }) // Sort candidates by totalVotes in descending order
					: [];

				return res.render("cons-candidates.ejs", {
					candidates,
					constituencies,
					parties,
					selectedCons: req.query.cons, // Pass selected constituency name to the template
					userRole: req.userRole,
				});
			}

			// Render with all candidates if no constituency selected
			const candidates = await Candidate.find()
				.populate("party")
				.sort({ totalVotes: -1 }); // Sort all candidates by totalVotes in descending order

			res.render("cons-candidates.ejs", {
				candidates,
				constituencies,
				parties,
				selectedCons: "", // No constituency selected by default
				userRole: req.userRole,
			});
		} catch (error) {
			console.log(error);
			res.status(500).send("Error fetching candidates.");
		}
	},
);

router.get("/election/candidates", async (req, res) => {
	try {
		const { state, constituencyId, year } = req.query;

		// Validate required parameters
		if (!state || !year) {
			return res.status(400).json({
				success: false,
				message: "State and year are required parameters",
			});
		}

		// Convert year to number
		const yearNum = parseInt(year);
		const constituencyIdNum = constituencyId ? parseInt(constituencyId) : null;

		// Aggregation pipeline
		const pipeline = [
			// Stage 1: Match the election first
			{
				$lookup: {
					from: "tempelections",
					let: { electionState: state, electionYear: yearNum },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ["$state", "$$electionState"] },
										{ $eq: ["$year", "$$electionYear"] },
									],
								},
							},
						},
					],
					as: "election",
				},
			},
			// Unwind the election array (since lookup returns an array)
			{ $unwind: "$election" },

			// Stage 2: Handle constituency if provided
			...(constituencyIdNum
				? [
					{
						$lookup: {
							from: "constituencies",
							let: { constId: constituencyIdNum, constState: state },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{ $eq: ["$constituencyId", "$$constId"] },
												{ $eq: ["$state", "$$constState"] },
											],
										},
									},
								},
							],
							as: "constituency",
						},
					},
					{ $unwind: "$constituency" },
					{
						$match: {
							constituency: { $exists: true, $ne: null },
						},
					},
				]
				: []),

			// Stage 3: Lookup election candidates
			{
				$lookup: {
					from: "electioncandidates",
					let: {
						electionId: "$election._id",
						...(constituencyIdNum
							? { constituencyId: "$constituency._id" }
							: {}),
					},
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ["$election", "$$electionId"] },
										...(constituencyIdNum
											? [{ $eq: ["$constituency", "$$constituencyId"] }]
											: []),
									],
								},
							},
						},
						// Populate candidate details
						{
							$lookup: {
								from: "candidates",
								localField: "candidate",
								foreignField: "_id",
								as: "candidate",
							},
						},
						{ $unwind: "$candidate" },
						// Populate party details
						{
							$lookup: {
								from: "parties",
								localField: "candidate.party",
								foreignField: "_id",
								as: "candidate.party",
							},
						},
						{ $unwind: "$candidate.party" },
						// Populate constituency if not already in pipeline
						...(!constituencyIdNum
							? [
								{
									$lookup: {
										from: "constituencies",
										localField: "constituency",
										foreignField: "_id",
										as: "constituency",
									},
								},
								{ $unwind: "$constituency" },
							]
							: []),
					],
					as: "candidates",
				},
			},

			// Stage 4: Project the final result
			{
				$project: {
					_id: 0,
					election: {
						id: "$election._id",
						state: "$election.state",
						year: "$election.year",
						type: "$election.electionType",
						totalSeats: "$election.totalSeats",
					},
					...(constituencyIdNum
						? {
							constituency: {
								id: "$constituency._id",
								name: "$constituency.name",
								constituencyId: "$constituency.constituencyId",
							},
						}
						: {}),
					candidates: {
						$map: {
							input: "$candidates",
							as: "c",
							in: {
								candidate: {
									id: "$$c.candidate._id",
									name: "$$c.candidate.name",
									party: {
										id: "$$c.candidate.party._id",
										name: "$$c.candidate.party.party",
										logo: "$$c.candidate.party.party_logo",
										// Add other party fields as needed
									},
								},
								...(!constituencyIdNum
									? {
										constituency: {
											id: "$$c.constituency._id",
											name: "$$c.constituency.name",
											constituencyId: "$$c.constituency.constituencyId",
										},
									}
									: {}),
								votesReceived: "$$c.votesReceived",
								status: "$$c.status",
							},
						},
					},
				},
			},
		];

		const result = await TempElection.aggregate(pipeline);

		if (result.length === 0) {
			return res.status(404).json({
				success: false,
				message: "No data found for the given parameters",
			});
		}

		res.json({
			success: true,
			data: result[0], // Since we're querying for one election, take the first result
		});
	} catch (error) {
		console.error("Error fetching candidates:", error);
		res.status(500).json({
			success: false,
			message: "Internal server error",
		});
	}
});

router.get("/election/years/:state", async (req, res) => {
	try {
		const { state } = req.params;

		// Validate required parameter
		if (!state) {
			return res.status(400).json({
				success: false,
				message: "State parameter is required",
			});
		}
		const key = `election_state_years:${state}`;
		const cachedResults = await redis.get(key);

		if (cachedResults) {
			return res.json(cachedResults);
		}

		const result = await TempElection.aggregate([
			{
				$match: {
					state: state,
				},
			},
			{
				$group: {
					_id: null,
					availableYears: { $addToSet: "$year" },
				},
			},
			{
				$project: {
					_id: 0,
					availableYears: {
						$sortArray: {
							input: "$availableYears",
							sortBy: -1, // -1 for descending (most recent first), 1 for ascending
						},
					},
				},
			},
		]);

		redis.set(key, {
			success: true,
			data: {
				state: state,
				availableYears: result[0].availableYears,
			},
		});

		if (result.length === 0 || result[0].availableYears.length === 0) {
			return res.status(404).json({
				success: false,
				message: "No election data found for the given state",
			});
		}

		redis.set;

		res.json({
			success: true,
			data: {
				state: state,
				availableYears: result[0].availableYears,
			},
		});
	} catch (error) {
		console.error("Error fetching available years:", error);
		res.status(500).json({
			success: false,
			message: "Internal server error",
		});
	}
});

router.get("/elections/state-elections", async (req, res) => {
	try {
		const { state } = req.query;

		if (!state) {
			return res.status(400).json({ message: "State parameter is required" });
		}

		const cachedResults = await redis.get("widget_election_widget");

		if (cachedResults) {
			return res.json(cachedResults);
		}

		const results = await TempElection.aggregate([
			// Match elections for the requested state
			{ $match: { state } },

			// Sort by year ascending
			{ $sort: { year: 1 } },

			// Lookup party results for each election
			{
				$lookup: {
					from: "electionpartyresults",
					localField: "_id",
					foreignField: "election",
					as: "partyResults",
				},
			},

			// Unwind the party results array
			{ $unwind: { path: "$partyResults", preserveNullAndEmptyArrays: true } },

			// Lookup party details for each result
			{
				$lookup: {
					from: "parties",
					localField: "partyResults.party",
					foreignField: "_id",
					as: "partyResults.partyDetails",
				},
			},

			// Unwind the party details (since lookup returns an array)
			{
				$unwind: {
					path: "$partyResults.partyDetails",
					preserveNullAndEmptyArrays: true,
				},
			},

			// Group back by election and collect party results
			{
				$group: {
					_id: "$_id",
					year: { $first: "$year" },
					state: { $first: "$state" },
					electionType: { $first: "$electionType" },
					totalSeats: { $first: "$totalSeats" },
					halfWayMark: { $first: "$halfWayMark" },
					status: { $first: "$status" },
					parties: {
						$push: {
							$cond: [
								{ $ne: ["$partyResults", {}] },
								{
									party: {
										party: "$partyResults.partyDetails.party",
										color_code: "$partyResults.partyDetails.color_code",
										party_logo: "$partyResults.partyDetails.party_logo",
									},
									seatsWon: "$partyResults.seatsWon",
								},
								null,
							],
						},
					},
				},
			},

			// Filter out null values from parties array
			{
				$addFields: {
					parties: {
						$filter: {
							input: "$parties",
							as: "party",
							cond: { $ne: ["$$party", null] },
						},
					},
				},
			},

			{
				$addFields: {
					parties: {
						$sortArray: {
							input: "$parties",
							sortBy: { seatsWon: -1 },
						},
					},
				},
			},

			// Project to clean up the output
			{
				$project: {
					_id: 0,
					year: 1,
					state: 1,
					electionType: 1,
					totalSeats: 1,
					halfWayMark: 1,
					status: 1,
					parties: 1,
				},
			},
		]);

		if (!results || results.length === 0) {
			return res
				.status(404)
				.json({ message: "No elections found for the specified state" });
		}

		redis.set("widget_election_widget", results);

		res.json(results);
	} catch (error) {
		console.error("Error fetching state elections:", error);
		res.status(500).json({ message: "Internal server error" });
	}
});

router.get("/elections/map/top-candidates", async (req, res) => {
	try {
		const { state, year } = req.query;

		if (!state || !year) {
			return res.status(400).json({
				success: false,
				message: "State, year are required query parameters",
			});
		}

		const key = `widget_bihar_election_map_${state}_${year}`;
		const cachedResults = await redis.get(key);

		if (cachedResults) {
			return res.json(cachedResults);
		}

		// First, find the election to get its ID
		const election = await TempElection.findOne({
			state: state,
			year: parseInt(year),
		}).lean();

		const type = election.electionType;

		if (!election) {
			return res.status(404).json({
				success: false,
				message: "Election not found",
			});
		}

		// Get all participating parties first
		const allParties = await PartyElectionModel.aggregate([
			{ $match: { election: election._id } },
			{
				$lookup: {
					from: "parties",
					localField: "party",
					foreignField: "_id",
					as: "partyData",
				},
			},
			{ $unwind: "$partyData" },
			{
				$project: {
					_id: 0,
					partyName: "$partyData.party",
					seatsWon: "$seatsWon",
					partyColor: "$partyData.color_code",
				},
			},
			{ $sort: { seatsWon: -1 } },
		]);

		// Get constituency data with top candidates
		const constituencies = await CandidateElectioModel.aggregate([
			{ $match: { election: election._id } },
			{ $sort: { constituency: 1, votesReceived: -1 } },
			{
				$lookup: {
					from: "candidates",
					localField: "candidate",
					foreignField: "_id",
					as: "candidate",
				},
			},
			{ $unwind: "$candidate" },
			{
				$lookup: {
					from: "parties",
					localField: "candidate.party",
					foreignField: "_id",
					as: "party",
				},
			},
			{ $unwind: "$party" },
			{
				$lookup: {
					from: "constituencies",
					localField: "constituency",
					foreignField: "_id",
					as: "constituency",
				},
			},
			{ $unwind: "$constituency" },
			{
				$group: {
					_id: "$constituency._id",
					constituencyName: { $first: "$constituency.name" },
					constituencyId: { $first: "$constituency.constituencyId" },

					candidates: {
						$push: {
							name: "$candidate.name",
							partyName: "$party.party",
							votesReceived: "$votesReceived",
							status: "$status",
							partyColor: "$party.color_code",
						},
					},
				},
			},
			{
				$project: {
					_id: 0,
					constituencyName: 1,
					constituencyId: 1,
					candidates: { $slice: ["$candidates", 2] },
				},
			},
		]);

		redis.set(key, {
			success: true,
			data: {
				electionId: election._id,
				electionName: `${state} ${type} election ${year}`,
				totalSeats: election.totalSeats,
				halfWayMark: election.halfWayMark,
				constituencies: constituencies,
				parties: allParties,
			},
		});

		res.status(200).json({
			success: true,
			data: {
				electionId: election._id,
				electionName: `${state} ${type} election ${year}`,
				totalSeats: election.totalSeats,
				halfWayMark: election.halfWayMark,
				constituencies: constituencies,
				parties: allParties,
			},
		});
	} catch (error) {
		console.error("Error fetching election data:", error);
		res.status(500).json({
			success: false,
			message: "Internal server error",
		});
	}
});

router.get("/election/hot-candidates", async (req, res) => {
	try {
		const { state, year } = req.query;

		const key = `widget_bihar_hot_candidate_${state}_${year}`;
		const cachedResults = await redis.get(key);

		if (cachedResults) {
			return res.json(cachedResults);
		}

		const result = await TempElection.aggregate([
			// Match the election
			{ $match: { state: state, year: Number(year) } },

			// Lookup candidates with population
			{
				$lookup: {
					from: "candidates",
					let: { candidateIds: "$electionInfo.candidates" },
					pipeline: [
						{
							$match: {
								$expr: { $in: ["$_id", "$$candidateIds"] },
								hotCandidate: true,
							},
						},
						// Populate party
						{
							$lookup: {
								from: "parties",
								localField: "party",
								foreignField: "_id",
								as: "party",
								pipeline: [
									{ $project: { party: 1, color_code: 1 } }, // Only get party name and color
								],
							},
						},
						// Populate constituency
						{
							$lookup: {
								from: "constituencies",
								localField: "constituency",
								foreignField: "_id",
								as: "constituency",
								pipeline: [
									{ $project: { name: 1 } }, // Only get constituency name
								],
							},
						},
						// Project only needed fields
						{
							$project: {
								name: 1,
								image: 1,
								party: { $arrayElemAt: ["$party", 0] }, // Unwind party
								constituency: { $arrayElemAt: ["$constituency", 0] }, // Get first constituency
							},
						},
					],
					as: "hotCandidates",
				},
			},

			// Project final structure
			{
				$project: {
					_id: 0,
					hotCandidates: {
						name: 1,
						image: 1,
						"party.party": 1,
						"party.color_code": 1,
						"constituency.name": 1,
					},
				},
			},
		]);

		if (!result.length) {
			return res.status(404).json({
				success: false,
				message: "Election not found",
			});
		}
		redis.set(key, {
			success: true,
			data: result[0].hotCandidates,
		});

		return res.json({
			success: true,
			data: result[0].hotCandidates,
		});
	} catch (error) {
		console.error("Error:", error);
		res.status(500).json({
			success: false,
			message: "Internal server error",
		});
	}
});

router.get("/election/hot-candidate/result", async (req, res) => {
	try {
		const { year, party, candidateName } = req.query;

		if (!year) {
			return res.status(400).json({
				success: false,
				message: "Year parameter is required",
			});
		}

		let key = `widget_bihar_hot_candidate_result_${year}`;

		if (party) {
			key += `_${party}`;
		}
		if (candidateName) {
			key += `_${candidateName}`;
		}

		const cachedResults = await redis.get(key);

		if (cachedResults) {
			return res.json(cachedResults);
		}

		const aggregationPipeline = [
			// Match completed elections for the specified year
			{
				$match: {
					status: "completed",
					year: parseInt(year),
				},
			},
			// Lookup to join with ElectionCandidate collection
			{
				$lookup: {
					from: "electioncandidates",
					localField: "_id",
					foreignField: "election",
					as: "candidates",
				},
			},
			// Unwind the candidates array
			{ $unwind: "$candidates" },
			// Match only Won/Lost candidates
			{
				$match: {
					"candidates.status": { $in: ["Won", "Lost"] },
				},
			},
			// Lookup to get candidate details
			{
				$lookup: {
					from: "candidates",
					localField: "candidates.candidate",
					foreignField: "_id",
					as: "candidateDetails",
				},
			},
			// Unwind candidateDetails
			{ $unwind: "$candidateDetails" },
			// Lookup to get party details
			{
				$lookup: {
					from: "parties",
					localField: "candidateDetails.party",
					foreignField: "_id",
					as: "partyDetails",
				},
			},
			// Unwind partyDetails
			{ $unwind: "$partyDetails" },
			// Only return hot candidates (regardless of candidateName parameter)
			{
				$match: {
					"candidateDetails.hotCandidate": true,
				},
			},
			// Optional party name filter
			...(party
				? [
					{
						$match: {
							"partyDetails.party": party,
						},
					},
				]
				: []),
			// Optional candidate name filter
			...(candidateName
				? [
					{
						$match: {
							"candidateDetails.name": {
								$regex: candidateName,
								$options: "i",
							},
						},
					},
				]
				: []),
			// Project the required fields
			{
				$project: {
					_id: 0,
					name: "$candidateDetails.name",
					candidateImage: "$candidateDetails.image",
					party: {
						name: "$partyDetails.party",
						color_code: "$partyDetails.color_code",
						logo: "$partyDetails.party_logo",
					},
					status: "$candidates.status",
					// votesReceived: "$candidates.votesReceived",
					// electionYear: "$year",
				},
			},
			// Sort by votes in descending order
			{ $sort: { votesReceived: -1 } },
		];

		const results = await TempElection.aggregate(aggregationPipeline);

		if (!results || results.length === 0) {
			return res.status(404).json({
				success: false,
				message: "No hot candidates found matching the criteria",
			});
		}
		redis.set(key, {
			success: true,
			data: results,
		});

		res.status(200).json({
			success: true,
			data: results,
		});
	} catch (error) {
		console.error("Error:", error);
		res.status(500).json({
			success: false,
			message: "Internal server error",
		});
	}
});

module.exports = router;
