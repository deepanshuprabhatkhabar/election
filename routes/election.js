const express = require("express");
const { z } = require("zod"); // Import Zod for validation
const Election = require("../models/election.model");
const TempElection = require("../models/temp-election.model");
const PartyElectionModel = require("../models/party-election-model");
const { isAdmin } = require("../middleware/admin");
const RedisManager = require("../RedisManager");
const { cachedKeys } = require("../utils");
const CandidateElectionModel = require("../models/candidate-election-model");
const ConstituencyElectionModel = require("../models/constituency-election-model");
const CandidatesModel = require("../models/candidates");
const AllianceModel = require("../models/alliance.model");
const ConstituencyModel = require("../models/constituency");
const mongoose = require("mongoose");

const redis = RedisManager.getInstance();
const crypto = require("crypto");
// Helper to recompute and update widget caches
async function updateWidgetCaches({ state, year, type, electionId, affectedConstituencyId }) {
	try {
		// 1) Result widget: /elections/state-elections -> key: widget_election_widget
		console.log('Params being passed here', state, year, type, electionId)
		const stateElections = await TempElection.aggregate([
			{ $match: { state } },
			{ $sort: { year: 1 } },
			{
				$lookup: {
					from: "electionpartyresults",
					localField: "_id",
					foreignField: "election",
					as: "partyResults",
				},
			},
			{ $unwind: { path: "$partyResults", preserveNullAndEmptyArrays: true } },
			{
				$lookup: {
					from: "parties",
					localField: "partyResults.party",
					foreignField: "_id",
					as: "partyResults.partyDetails",
				},
			},
			{ $unwind: { path: "$partyResults.partyDetails", preserveNullAndEmptyArrays: true } },
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
										partyHindi: "$partyResults.partyDetails.partyHindi",
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
			{
				$addFields: {
					parties: {
						$filter: { input: "$parties", as: "party", cond: { $ne: ["$$party", null] } },
					},
				},
			},
			{ $addFields: { parties: { $sortArray: { input: "$parties", sortBy: { seatsWon: -1 } } } } },
			{ $project: { _id: 0, year: 1, state: 1, electionType: 1, totalSeats: 1, halfWayMark: 1, status: 1, parties: 1 } },
		]);

		await redis.set("widget_election_widget", stateElections);

		// Shortcode widget2 (win/lose): caches full state array under election_data_{stateLower}
		const stateLowerKey = `election_data_${String(state).toLowerCase()}`;
		await redis.setWithTTL(stateLowerKey, stateElections, 300);

		// Shortcode widget1 (result): caches per-year item under election_data_{md5(state|year)}
		const md5Key = `election_data_${crypto
			.createHash("md5")
			.update(`${state}|${year}`)
			.digest("hex")}`;
		let yearData = null;
		if (Array.isArray(stateElections)) {
			yearData = stateElections.find(
				(item) => String(item.year) === String(year),
			);
		}
		if (yearData) {
			await redis.setWithTTL(md5Key, yearData, 300);
		}

		// 2) Map widget: /elections/map/top-candidates -> key: widget_bihar_election_map_${state}_${year}
		const electionDoc = await TempElection.findOne({ state: state, year: parseInt(year) }).lean();
		if (electionDoc) {
			const allParties = await PartyElectionModel.aggregate([
				{ $match: { election: electionDoc._id } },
				{ $lookup: { from: "parties", localField: "party", foreignField: "_id", as: "partyData" } },
				{ $unwind: "$partyData" },
				{ $project: { _id: 0, partyName: "$partyData.party", partyHindi: "$partyData.partyHindi", seatsWon: "$seatsWon", partyColor: "$partyData.color_code" } },
				{ $sort: { seatsWon: -1 } },
			]);

			const consAgg = await CandidateElectionModel.aggregate([
				{ $match: { election: electionDoc._id } },
				{ $sort: { constituency: 1, votesReceived: -1 } },
				{ $lookup: { from: "candidates", localField: "candidate", foreignField: "_id", as: "candidate" } },
				{ $unwind: "$candidate" },
				{ $lookup: { from: "parties", localField: "candidate.party", foreignField: "_id", as: "party" } },
				{ $unwind: "$party" },
				{ $lookup: { from: "constituencies", localField: "constituency", foreignField: "_id", as: "constituency" } },
				{ $unwind: "$constituency" },
				{
					$group: {
						_id: "$constituency._id",
						constituencyName: { $first: "$constituency.name" },
						constituencyHindi: { $first: "$constituency.constituencyHindi" },
						constituencyId: { $first: "$constituency.constituencyId" },
						candidates: {
							$push: {
								name: "$candidate.name",
								hindiName: "$candidate.hindiName",
								partyName: "$party.party",
								partyHindi: "$party.partyHindi",
								votesReceived: "$votesReceived",
								status: "$status",
								partyColor: "$party.color_code",
								partyLogo: "$party.party_logo",
							},
						},
					},
				},
				{ $project: { _id: 0, constituencyName: 1, constituencyHindi: 1, constituencyId: 1, candidates: { $slice: ["$candidates", 2] } } },
			]);

			const mapPayload = {
				success: true,
				data: {
					electionId: electionDoc._id,
					electionName: `${state} ${electionDoc.electionType} election ${year}`,
					totalSeats: electionDoc.totalSeats,
					halfWayMark: electionDoc.halfWayMark,
					constituencies: consAgg,
					parties: allParties,
				},
			};

			await redis.set(`widget_bihar_election_map_${state}_${year}`, mapPayload);
			if (type) await redis.set(`widget_bihar_election_map_${state}_${year}_${type}`, mapPayload);
		}

		// 3) CN widget constituencies: /constituency -> key: widget_cn_election_constituencies_${state}_${year}
		if (electionId) {
			// Use distinct constituency IDs to avoid duplicates in cache
			const distinctConIds = await ConstituencyElectionModel.distinct("constituency", { election: electionId });
			const consList = await ConstituencyModel.find({ _id: { $in: distinctConIds } })
				.select("-candidates").collation({locale: "en", strength: 2}).sort({name: 1})
				.lean();
			await redis.set(`widget_cn_election_constituencies_${state}_${year}`, consList);
			if (type) await redis.set(`widget_cn_election_constituencies_${state}_${year}_${type}`, consList);
		}

		// 4) CN widget candidates for affected constituency (only if provided)
		if (electionId && affectedConstituencyId) {
			const constituencyDoc = await require("../models/constituency").findById(affectedConstituencyId);
			if (constituencyDoc) {
				const electionCon = await ConstituencyElectionModel.findOne({ election: electionId, constituency: affectedConstituencyId });
				const canList = await CandidateElectionModel.find({ election: electionId, constituency: affectedConstituencyId })
					.populate({
						path: "candidate",
						populate: { path: "party", select: "party partyHindi color_code" },
					})
					.lean()
					.then((rows) => rows.map((row) => ({ ...row, constituencyStatus: electionCon?.status })));
				await redis.set(`widget_cn_election_candidates_${constituencyDoc.name}_${state}_${year}`, canList);
				if (type) await redis.set(`widget_cn_election_candidates_${constituencyDoc.name}_${state}_${year}_${type}`, canList);
			}
		}

		// 5) Alliance widget: /api/alliance/alliances-data/:electionId -> key: election_data_allianz_team
		if (electionId && String(year) === '2025') {
			const alliancesData = await AllianceModel.aggregate([
				// Match alliances for this election
				{
					$match: {
						election: new mongoose.Types.ObjectId(electionId),
					},
				},
				// Lookup parties in the alliance
				{
					$lookup: {
						from: "parties",
						localField: "parties",
						foreignField: "_id",
						as: "populatedParties",
					},
				},
				// Unwind parties so we can attach individual results
				{
					$unwind: "$populatedParties",
				},
				// Lookup each party's election result (to get seatsWon)
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
				// Extract seatsWon or default to 0
				{
					$addFields: {
						seatsWon: {
							$ifNull: [{ $arrayElemAt: ["$partyResults.seatsWon", 0] }, 0],
						},
					},
				},
				// Group back by alliance, combining parties and summing total seats
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
						allianceSeats: { $sum: "$seatsWon" },
					},
				},
				{
					$sort: { allianceSeats: -1 },
				},
				// Final projection
				{
					$project: {
						_id: 1,
						name: 1,
						election: 1,
						allianceSeats: 1,
						parties: 1,
					},
				},
			]);

			await redis.set("election_data_allianz_team", alliancesData);
		}
	} catch (err) {
		console.error("Error updating widget caches:", err);
	}
}
// Helper function to recalculate all seats for an election
async function recalculateAllSeatsForElection(electionId) {
	try {
		console.log(`\n=== Recalculating all seats for election ${electionId} ===`);

		// Get distinct constituencies in this election (avoid duplicates)
		const constituencyIds = await ConstituencyElectionModel.distinct(
			"constituency",
			{ election: electionId },
		);
		const constituencies = await ConstituencyModel.find({
			_id: { $in: constituencyIds },
		});

		console.log(`Found ${constituencies.length} unique constituencies`);

		// Reset all party seats to 0
		await PartyElectionModel.updateMany(
			{ election: electionId },
			{ seatsWon: 0 },
		);

		// For each constituency, find the winner and award the seat
		for (const constituency of constituencies) {
			const candidatesInConstituency = await CandidateElectionModel.find({
				election: electionId,
				constituency: constituency._id,
			}).populate("candidate");

			if (candidatesInConstituency.length === 0) continue;

			// Find the candidate with maximum votes
			const maxVotes = Math.max(
				...candidatesInConstituency.map((c) => c.votesReceived || 0),
			);
			const winningCandidate = candidatesInConstituency.find(
				(c) => c.votesReceived === maxVotes,
			);

			if (!winningCandidate || maxVotes === 0) continue;

			// Get the party of the winning candidate
			const candidateData = await CandidatesModel.findById(
				winningCandidate.candidate,
			).populate("party");
			if (!candidateData || !candidateData.party) continue;

			const winningPartyId = candidateData.party._id;

			// Award the seat to the winning party
			let partyElectionRecord = await PartyElectionModel.findOne({
				election: electionId,
				party: winningPartyId,
			});

			if (!partyElectionRecord) {
				partyElectionRecord = new PartyElectionModel({
					election: electionId,
					party: winningPartyId,
					seatsWon: 1,
				});
				await partyElectionRecord.save();
				console.log(
					`Created new record with 1 seat for ${candidateData.party.party} in ${constituency.name}`,
				);
			} else {
				partyElectionRecord.seatsWon = (partyElectionRecord.seatsWon || 0) + 1;
				await partyElectionRecord.save();
				console.log(
					`Awarded seat to ${candidateData.party.party} in ${constituency.name} (total: ${partyElectionRecord.seatsWon})`,
				);
			}
		}

		console.log(`=== Recalculation completed for election ${electionId} ===\n`);
	} catch (error) {
		console.error("Error recalculating seats:", error);
	}
}

// Helper function to calculate and update party seats based on constituency winners

async function calculateAndUpdateSeats(electionId, constituencyId) {
	try {
		console.log(
			`\n=== Calculating seats for election ${electionId}, constituency ${constituencyId} ===`,
		);

		// Get all candidates in this constituency for this election
		const candidatesInConstituency = await CandidateElectionModel.find({
			election: electionId,
			constituency: constituencyId,
		}).populate("candidate");

		console.log(
			`Found ${candidatesInConstituency.length} candidates in constituency`,
		);
		candidatesInConstituency.forEach((c) => {
			console.log(`- ${c.candidate.name}: ${c.votesReceived} votes`);
		});

		if (candidatesInConstituency.length === 0) {
			console.log("No candidates found, returning");
			return;
		}

		// Find the candidate with maximum votes
		const maxVotes = Math.max(
			...candidatesInConstituency.map((c) => c.votesReceived || 0),
		);
		const winningCandidate = candidatesInConstituency.find(
			(c) => c.votesReceived === maxVotes,
		);

		console.log(
			`Max votes: ${maxVotes}, Winner: ${winningCandidate?.candidate?.name}`,
		);

		if (!winningCandidate || maxVotes === 0) {
			console.log(
				"No clear winner or no votes, clearing statuses and recalculating seats",
			);

			// Clear candidate statuses for this constituency when no leader is determined
			await Promise.all(
				candidatesInConstituency.map((c) =>
					CandidateElectionModel.updateOne(
						{ _id: c._id },
						{ $unset: { status: "" } },
					),
				),
			);

			// Recalculate seats so previously assigned wins are removed
			await recalculateAllSeatsForElection(electionId);
			return;
		}

		// Update status
		const updates = candidatesInConstituency.map((c) => {
			const status =
				c._id.toString() === winningCandidate._id.toString()
					? "Winning"
					: "Trailing";

			return CandidateElectionModel.findByIdAndUpdate(
				c._id,
				{ status },
				{ new: true },
			);
		});

		await Promise.all(updates);
		console.log(
			`Updated statuses: ${winningCandidate.candidate.name} -> Won, others -> Lost`,
		);

		// Get the party of the winning candidate
		const candidateData = await CandidatesModel.findById(
			winningCandidate.candidate,
		).populate("party");
		if (!candidateData || !candidateData.party) {
			console.log("No party data found for winning candidate");
			return;
		}

		const winningPartyId = candidateData.party._id;
		console.log(
			`Winning party: ${candidateData.party.party} (${winningPartyId})`,
		);

		// Recalculate all seats for this election
		await recalculateAllSeatsForElection(electionId);

		console.log(
			`=== Seat calculation completed for ${candidateData.party.party} ===\n`,
		);
	} catch (error) {
		console.error("Error calculating seats:", error);
	}
}

const router = express.Router();

router.get("/party-summary", async (req, res) => {
	const fullUrl = req.get("Referer");
	console.log("fullUrl -> ", fullUrl);

	const stateName = { delhi: "दिल्ली 2025", jharkhand: "झारखंड 2024" };

	const state = fullUrl.includes("delhi")
		? stateName["delhi"]
		: stateName["jharkhand"];
	try {
		const election = await Election.findOne({
			state: state,
		});

		if (!election) {
			return res.status(404).json({ error: "Election not found" });
		}

		// Filter for BJP+ and JMM+ parties
		// const filteredParties = election.parties.filter(party =>
		//   party.name === 'BJP+' || party.name === 'JMM+'
		// );

		res.status(200).json({
			state: election.state,
			totalSeats: election.totalSeats,
			declaredSeats: election.declaredSeats,
			parties: election.parties,
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

router.post("/temp-elections", async (req, res) => {
	try {
		const {
			state,
			halfWayMark,
			electionType,
			year,
			totalSeats,
			electionInfo,
			constituencies,
		} = req.body;

		const electionSlug = `${state.toLowerCase()}_${year}`;

		// Check if an election for the given state already exists
		const existingElection = await TempElection.findOne({ electionSlug });
		if (existingElection) {
			return res
				.status(409)
				.json({ error: "Election for this state already exists" });
		}

		const election = new TempElection({
			state,
			year,
			electionSlug,
			totalSeats,
			electionType,
			halfWayMark,
			electionInfo,
		});

		const savedElection = await election.save();
		if (!savedElection) {
			return res.status(400).json({ message: "Bad request" });
		}
		const parties = electionInfo.partyIds.map(
			(partyId) =>
				new PartyElectionModel({
					election: savedElection._id,
					party: partyId,
				}),
		);
		await PartyElectionModel.bulkSave(parties);

		const candidates = electionInfo.candidates.map(
			(canId) =>
				new CandidateElectionModel({
					election: savedElection._id,
					candidate: canId,
				}),
		);

		// Deduplicate constituencies array to prevent duplicate entries
		const uniqueConstituencies = [...new Set(constituencies.map(id => id.toString()))];
		
		// Use bulkWrite with updateOne and upsert to handle duplicates gracefully
		// This ensures that if a constituency-election relationship already exists, it won't create a duplicate
		const constituencyOperations = uniqueConstituencies.map((constituencyId) => ({
			updateOne: {
				filter: {
					election: savedElection._id,
					constituency: constituencyId,
				},
				update: {
					$setOnInsert: {
						election: savedElection._id,
						constituency: constituencyId,
						status: "ongoing",
					},
				},
				upsert: true,
			},
		}));

		if (constituencyOperations.length > 0) {
			await ConstituencyElectionModel.bulkWrite(constituencyOperations);
		}

		await CandidateElectionModel.bulkSave(candidates);

		return res.status(200).json(savedElection);
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
});

router.post("/", async (req, res) => {
	try {
		const { state, totalSeats, declaredSeats, halfWayMark, parties } = req.body;
		const stateSlug = state.toLowerCase().replace(/ /g, "_");

		// Check if an election for the given state already exists
		const existingElection = await Election.findOne({ stateSlug });
		if (existingElection) {
			return res
				.status(409)
				.json({ error: "Election for this state already exists" });
		}

		const election = new Election({
			state,
			stateSlug,
			totalSeats,
			declaredSeats,
			halfWayMark,
			parties,
		});

		const savedElection = await election.save();
		await redis.clearAllKeys(); // Clear all Redis keys when a new election is created
		res.status(201).json(savedElection);
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
});

router.get("/states", async (req, res) => {
	try {
		const states = await Election.find({}).sort({ createdAt: -1 });
		const statesWithSlugs = states.map((state) => ({
			name: state.state,
			slug: state.stateSlug,
			id: state._id,
		}));
		return res.status(200).json({
			message: "States, their slugs, and ids retrieved successfully",
			data: statesWithSlugs,
		});
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
});

// Get API to retrieve election data by state
router.get("/:id", async (req, res) => {
	try {
		const { id } = req.params;

		// Check if data exists in Redis cache
		const cachedData = await redis.get(cachedKeys.ASSEMBLY_ELECTION + ":" + id);
		if (cachedData) {
			return res.json(cachedData); // Ensure cached data is parsed back to JSON
		}

		// Fetch election data from database
		const election = await Election.findById(id);

		if (!election) {
			return res.status(404).json({ message: "Election data not found" });
		}

		// Sort parties and their subParties by 'won' in descending order
		if (election.parties && election.parties.length > 0) {
			election.parties.sort((a, b) => b.won - a.won); // Sort parties

			election.parties.forEach((party) => {
				if (party.subParties && party.subParties.length > 0) {
					party.subParties.sort((a, b) => b.won - a.won); // Sort subParties
				}
			});
		}

		// Cache the sorted data for 10 minutes (600 seconds)
		await redis.setWithTTL(
			cachedKeys.ASSEMBLY_ELECTION + ":" + id,
			election,
			3600,
		);

		res.status(200).json(election);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

router.get("/", async (req, res) => {
	try {
		const { page, limit } = req.query;
		const pageInt = parseInt(page) || 1;
		const limitInt = parseInt(limit) || 10;
		const startIndex = (pageInt - 1) * limitInt;
		const endIndex = pageInt * limitInt;

		const elections = await Election.find().sort({ createdAt: -1 });
		const paginatedData = elections.slice(startIndex, endIndex);

		if (!paginatedData) {
			return res.status(404).json({ message: "No elections found" });
		}

		const result = {
			currentPage: pageInt,
			totalPages: Math.ceil(elections.length / limitInt),
			totalItems: elections.length,
			data: paginatedData,
		};

		return res.status(200).json(result);
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
});

router.delete("/:id", isAdmin, async (req, res) => {
	try {
		const { id } = req.params;
		const election = await Election.findByIdAndDelete(id);

		if (!election) {
			return res.status(404).json({ message: "Election not found" });
		}

		await redis.clearAllKeys(); // Clear Redis cache when an election is deleted

		res.status(200).json({ message: "Election successfully deleted" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

router.patch(
	"/temp-election/constituencies/update-status",
	async (req, res) => {
		try {
			const { constituencies, redisKeys } = req.body;

			if (!constituencies || Object.keys(constituencies).length === 0) {
				return res
					.status(400)
					.json({ success: false, message: "No constituency data provided" });
			}

			const updatePromises = Object.entries(constituencies).map(
				([documentId, status]) => {
					return ConstituencyElectionModel.findByIdAndUpdate(
						documentId,
						{ status: status },
						{ new: true },
					);
				},
			);

			await Promise.all(updatePromises);

			const { state, year, type } = redisKeys;

			// clear the election widgets cached result from redis
			redis.delete(`widget_election_widget`);
			redis.delete(`widget_bihar_election_map_${state}_${year}_${type}`);
			redis.delete(
				`widget_cn_election_constituencies_${state}_${year}_${type}`,
			);
			redis.deleteByPattern(
				`widget_cn_election_candidates_*_${state}_${year}_${type}`,
			);

			return res.json({
				success: true,
				message: "Constituency statuses updated successfully",
			});
		} catch (error) {
			console.error("Error updating constituency statuses:", error);
			return res.status(500).json({
				success: false,
				message:
					error.message ||
					"An error occurred while updating constituency statuses",
			});
		}
	},
);

router.patch("/temp-election/party/add", async (req, res) => {
	try {
		const { election, parties, redisKeys } = req.body;
		const updatedElection = await TempElection.findByIdAndUpdate(
			election,
			{ $push: { "electionInfo.partyIds": parties } },
			{ new: true },
		);
		const newParties = parties.map(
			(partyId) => new PartyElectionModel({ election, party: partyId }),
		);

		const newAddedParties = await PartyElectionModel.bulkSave(newParties);
		if (!updatedElection || !newAddedParties.insertedCount === 0) {
			return res.status(400).json({ message: "Bad Request" });
		}

		const { state, year, type } = redisKeys;

		// clear the election widgets cached result from redis
		redis.delete(`widget_election_widget`);
		redis.delete(`widget_bihar_election_map_${state}_${year}_${type}`);
		redis.delete(`widget_cn_election_constituencies_${state}_${year}_${type}`);
		redis.deleteByPattern(
			`widget_cn_election_candidates_*_${state}_${year}_${type}`,
		);

		return res.status(200).json({ message: "Party added successfully" });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
});

router.patch("/temp-election/main-info-update/:id", async (req, res) => {
	try {
		const { status, state, halfWayMark, totalSeats, year, electionType } =
			req.body;
		console.log(req.body);
		const { id } = req.params;

		const electionSlug = `${state.toLowerCase()}_${year}`;

		const updatedElectionInfo = await TempElection.findByIdAndUpdate(
			id,
			{
				$set: {
					status: status.toLowerCase(),
					state,
					halfWayMark,
					totalSeats,
					year,
					electionSlug,
					electionType,
				},
			},
			{ new: true },
		);

		if (!updatedElectionInfo) {
			return res.status(400).json({ message: "Bad Request" });
		}

		// If election is marked as completed, automatically mark all constituencies as completed
		if (status.toLowerCase() === "completed") {
			await ConstituencyElectionModel.updateMany(
				{ election: id },
				{ status: "completed" },
			);
			console.log(`All constituencies for election ${id} marked as completed`);
		}

		// clear the election widgets cached result from redis
		redis.delete(`widget_election_widget`);
		redis.delete(`widget_bihar_election_map_${state}_${year}_${electionType}`);
		redis.delete(
			`widget_cn_election_constituencies_${state}_${year}_${electionType}`,
		);
		redis.deleteByPattern(
			`widget_cn_election_candidates_*_${state}_${year}_${electionType}`,
		);

		return res
			.status(200)
			.json({ success: true, message: "Updated Successfully" });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
});

router.patch("/temp-election/candidate/add", async (req, res) => {
	try {
		const { election, candidates, redisKeys } = req.body;
		const updatedElection = await TempElection.findByIdAndUpdate(
			election,
			{ $push: { "electionInfo.candidates": candidates } },
			{ new: true },
		);

		// First, get all candidate data including constituency information
		const candidateData = await CandidatesModel.find({
			_id: { $in: candidates },
		}).select("constituency");

		// Create new candidates with constituency information
		const newCandidates = candidateData.map((candidate) => {
			return new CandidateElectionModel({
				election,
				candidate: candidate._id,
				constituency: candidate.constituency[0], // Use the first constituency
			});
		});

		const newAddedCandidates =
			await CandidateElectionModel.bulkSave(newCandidates);

		// Create constituency-election relationships
		for (let i = 0; i < candidateData.length; i++) {
			const candidate = candidateData[i];
			const isFound = await ConstituencyElectionModel.findOne({
				election,
				constituency: candidate.constituency[0],
			});
			if (!isFound) {
				await new ConstituencyElectionModel({
					election,
					constituency: candidate.constituency[0],
				}).save();
			}
		}

		console.log(
			"newAddedCandidates.insertedCount -> ",
			newAddedCandidates.insertedCount,
		);

		if (
			!updatedElection ||
			!newAddedCandidates.insertedCount === 0 ||
			candidates.length <= 0
		) {
			return res.status(400).json({ message: "Bad Request" });
		}

		const { state, year, type } = redisKeys;

		// clear the election widgets cached result from redis
		redis.delete(`widget_election_widget`);
		redis.delete(`widget_bihar_election_map_${state}_${year}_${type}`);
		redis.delete(`widget_cn_election_constituencies_${state}_${year}_${type}`);
		redis.deleteByPattern(
			`widget_cn_election_candidates_*_${state}_${year}_${type}`,
		);

		return res.status(200).json({ message: "Party added successfully" });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
});

router.delete(
	"/temp-election/party/delete/:partyId/:electionId",
	async (req, res) => {
		try {
			const { partyId, electionId } = req.params;
			const { redisKeys } = req.body;

			if (!partyId || !electionId) {
				return res.status(400).json({ message: "Missing required parameters" });
			}

			const deletedPartyElection = await PartyElectionModel.findOneAndDelete({
				election: electionId,
				party: partyId,
			});

			if (!deletedPartyElection) {
				return res.status(400).json({ message: "Party election not found" });
			}

			const election = await TempElection.findById(electionId).populate({
				path: "electionInfo.candidates",
				match: { party: partyId },
			});

			if (
				election &&
				election.electionInfo &&
				election.electionInfo.candidates
			) {
				const candidateIds = election.electionInfo.candidates.map(
					(candidate) => candidate._id,
				);

				if (candidateIds.length > 0) {
					await CandidateElectionModel.deleteMany({
						election: electionId,
						candidate: { $in: candidateIds },
					});
				}

				await TempElection.findByIdAndUpdate(
					electionId,
					{
						$pull: {
							"electionInfo.candidates": { $in: candidateIds },
							"electionInfo.partyIds": partyId,
						},
					},
					{ new: true },
				);
			} else {
				await TempElection.findByIdAndUpdate(
					electionId,
					{ $pull: { "electionInfo.partyIds": partyId } },
					{ new: true },
				);
			}

			const { state, year, type } = redisKeys;

			// clear the election widgets cached result from redis
			redis.delete(`widget_election_widget`);
			redis.delete(`widget_bihar_election_map_${state}_${year}_${type}`);
			redis.delete(
				`widget_cn_election_constituencies_${state}_${year}_${type}`,
			);
			redis.deleteByPattern(
				`widget_cn_election_candidates_*_${state}_${year}_${type}`,
			);

			return res.status(200).send({ success: true });
		} catch (error) {
			return res.status(500).json({ error: error.message });
		}
	},
);

router.delete(
	"/temp-election/candidate/delete/:candidateId/:electionId",

	async (req, res) => {
		try {
			const { electionId, candidateId } = req.params;
			const { redisKeys } = req.body;

			if (!candidateId || !electionId) {
				return res.status(400).json({ message: "Missing required parameters" });
			}

			const deletedPartyCandidate =
				await CandidateElectionModel.findOneAndDelete({
					election: electionId,

					candidate: candidateId,
				});

			await calculateAndUpdateSeats(electionId, deletedPartyCandidate.constituency);

			if (!deletedPartyCandidate) {
				return res.status(400).json({ message: "Party election not found" });
			}

			await TempElection.findByIdAndUpdate(
				electionId,

				{ $pull: { "electionInfo.candidates": candidateId } },

				{ new: true },
			);

			// clear the election widgets cached result from redis
			await redis.clearAllKeys();

			return res.status(200).send({ success: true });
		} catch (error) {
			return res.status(500).json({ error: error.message });
		}
	},
);

router.put("/temp-election/candidate/update", async (req, res) => {
	try {
		console.log(req.body);

		const { election, candidate, votesReceived, redisKeys } = req.body;

		const query = {
			election: election,
			candidate: candidate,
		};

		const updatedDocument = await CandidateElectionModel.findOneAndUpdate(
			query,
			{ $set: { votesReceived } },
			{ new: true },
		);
		if (!updatedDocument) {
			return res.status(400).json({ message: "Bad Request" });
		}
		console.log(updatedDocument);

		// Check if election is ongoing and automatically calculate seats
		const electionData = await TempElection.findById(election);
		console.log(
			`Election status: ${electionData?.status}, Election ID: ${election}`,
		);
		if (electionData && electionData.status === "ongoing") {
			console.log("Election is ongoing, calculating seats...");
			await calculateAndUpdateSeats(election, updatedDocument.constituency);
		} else {
			console.log("Election is not ongoing, skipping seat calculation");
		}

		// recompute and update widget caches
		// if (redisKeys) {
		// 	const { state, year, type } = redisKeys;
		// 	await updateWidgetCaches({
		// 		state,
		// 		year,
		// 		type,
		// 		electionId: election,
		// 		affectedConstituencyId: updatedDocument.constituency,
		// 	});
		// }

		return res.status(200).json(updatedDocument);
	} catch (error) {
		console.error(error);
		return res.status(500).json({ error: error.message });
	}
});

router.put("/temp-election/candidates/update-all", async (req, res) => {
	try {
		console.log(req.body);

		const { election, candidates, redisKeys } = req.body;
		// candidates: [{ candidate: candidateId, votesReceived: 123 }, ...]

		if (!Array.isArray(candidates) || candidates.length === 0) {
			return res.status(400).json({ message: "No candidates provided" });
		}

		// Prepare bulk operations
		const bulkOps = candidates.map(({ candidate, votesReceived }) => ({
			updateOne: {
				filter: { election, candidate },
				update: { $set: { votesReceived } },
			},
		}));

		// Execute all updates in one go
		const result = await CandidateElectionModel.bulkWrite(bulkOps);

		console.log("Bulk update result:", result);

		// Fetch updated documents
		const updatedDocuments = await CandidateElectionModel.find({
			election,
			candidate: { $in: candidates.map((c) => c.candidate) },
		});

		// Check if election is ongoing
		const electionData = await TempElection.findById(election);
		console.log(
			`Election status: ${electionData?.status}, Election ID: ${election}`,
		);

		if (electionData && electionData.status === "ongoing") {
			console.log("Election is ongoing, calculating seats...");

			// Extract distinct constituencies for updated candidates
			const constituencies = [
				...new Set(updatedDocuments.map((doc) => doc.constituency.toString())),
			];

			for (const constituency of constituencies) {
				await calculateAndUpdateSeats(election, constituency);
			}
		} else {
			console.log("Election is not ongoing, skipping seat calculation");
		}

		// Recompute and update widget caches
		// if (redisKeys) {
		// 	const { state, year, type } = redisKeys;
		// 	await updateWidgetCaches({
		// 		state,
		// 		year,
		// 		type,
		// 		electionId: election,
		// 		// Multiple constituencies updated; leave affectedConstituencyId undefined (we updated map/result/cons lists)
		// 	});
		// }

		return res.status(200).json(updatedDocuments);
	} catch (error) {
		console.error(error);
		return res.status(500).json({ error: error.message });
	}
});

router.put("/temp-election/party/update", async (req, res) => {
	try {
		const { election, party, seatsWon, redisKeys } = req.body;

		const query = {
			election: election,
			party: party,
		};

		const updatedDocument = await PartyElectionModel.findOneAndUpdate(
			query,
			{ $set: { seatsWon } },
			{ new: true },
		);
		if (!updatedDocument) {
			return res.status(400).json({ message: "Bad Request" });
		}

		const { state, year, type } = redisKeys;

		// Recompute and update widget caches
		if (redisKeys) {
			const { state, year, type } = redisKeys;
			await updateWidgetCaches({
				state,
				year,
				type,
				electionId: election,
			});
		}

		return res.status(200).json(updatedDocument);
	} catch (error) {
		console.error(error);
		return res.status(500).json({ error: error.message });
	}
});

router.delete("/temp-election-delete/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const election = await TempElection.findByIdAndDelete(id);

		await PartyElectionModel.deleteMany({
			election: id,
		});

		await CandidateElectionModel.deleteMany({
			election: id,
		});

		await ConstituencyElectionModel.deleteMany({
			election: id,
		});

		await AllianceModel.deleteMany({
			election: id,
		});

		if (!election) {
			return res.status(404).json({ message: "Election not found" });
		}

		res.status(200).json({ message: "Election successfully deleted" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

router.put("/:id", isAdmin, async (req, res) => {
	try {
		const { id } = req.params;
		const updatedElection = await Election.findByIdAndUpdate(id, req.body, {
			new: true,
		});

		if (!updatedElection) {
			return res.status(404).json({ message: "Election not found" });
		}

		await redis.clearAllKeys(); // Clear Redis cache when an election is updated
		res.status(200).json(updatedElection);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

module.exports = router;
