const express = require("express");
const Candidate = require("../models/candidates");
const multer = require("multer");
const router = express.Router();
const mime = require("mime-types");
const { getFullImagePath, cachedKeys } = require("../utils");
const Constituency = require("../models/constituency");
const Party = require("../models/party.model");
const RedisManager = require("../RedisManager");
const { isAdmin } = require("../middleware/admin");
const xlsx = require("xlsx");
const TempElection = require("../models/temp-election.model");
const ConstituencyModel = require("../models/constituency");
const ElectionCandidatesModel = require("../models/candidate-election-model");
const ElectionConstituencyModel = require("../models/constituency-election-model");
const PartyElectionModel = require("../models/party-election-model");

const redis = RedisManager.getInstance();

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, "public/uploads/candidates");
	},
	filename: (req, file, cb) => {
		const ext = mime.extension(file.mimetype);
		cb(null, Date.now() + "." + ext);
	},
});

const excelStorage = multer.memoryStorage();

const upload = multer({ storage });
const excelUpload = multer({ storage: excelStorage });

router.get("/hot-candidates", async (req, res, next) => {
	try {
		const cachedData = await redis.get(cachedKeys.HOT_CANDIDATES);

		if (cachedData) {
			return res.json(cachedData);
		}

		// If not in cache, query the database
		const candidates = await Candidate.find({ hotCandidate: true })
			.populate("party constituency")
			.sort({ totalVotes: -1 });

		const hotCandidates = await Promise.all(
			candidates.map(async (candidate) => {
				const constituencyId = candidate.constituency[0]?._id;

				if (constituencyId) {
					// Get all candidates in the same constituency, sorted by total votes
					const candidatesInConstituency = await Candidate.find({
						constituency: { $eq: constituencyId },
					})
						.populate("constituency")
						.sort({ totalVotes: -1 });

					// Check if the current candidate is leading or trailing
					const isLeading = candidatesInConstituency[0]._id.equals(
						candidate._id,
					);

					return {
						...candidate.toObject(),
						status: isLeading ? "leading" : "trailing",
					};
				} else {
					return {
						...candidate.toObject(),
						status: "no constituency", // Handle missing constituency
					};
				}
			}),
		);

		// Cache the result for 1 hour
		await redis.setWithTTL(cachedKeys.HOT_CANDIDATES, hotCandidates, 3600);
		// Send the result as a response
		res.json(hotCandidates);
	} catch (error) {
		next(error);
	}
});

// router.get("/cn-list", async (req, res, next) => {
// 	try {
// 		const constituencyId = req.query.constituency;

// 		const cachedData = await redis.get(
// 			`${cachedKeys.CN_LIST}:${constituencyId}`,
// 		);
// 		if (cachedData) {
// 			return res.json(cachedData);
// 		}

// 		const candidates = await Candidate.find()
// 			.populate("constituency party")
// 			.sort({ totalVotes: -1 });
// 		let sortedCandidates = [];
// 		let candidates_sorted = [];

// 		// Filter the candidates by the provided constituencyId
// 		candidates.forEach((can) => {
// 			can.constituency.forEach((consCan) => {
// 				if (consCan.name === constituencyId) {
// 					sortedCandidates.push(can);
// 				}
// 			});
// 		});

// 		sortedCandidates.sort((a, b) => {
// 			return b.totalVotes - a.totalVotes;
// 		});

// 		sortedCandidates.forEach((cand, index) => {
// 			if (index === 0) {
// 				candidates_sorted.push({ ...cand._doc, status: "leading" });
// 			} else {
// 				candidates_sorted.push({ ...cand._doc, status: "trailing" });
// 			}
// 		});

// 		await redis.setWithTTL(
// 			`${cachedKeys.CN_LIST}:${constituencyId}`,
// 			candidates_sorted,
// 			3600,
// 		);
// 		res.json(candidates_sorted);
// 	} catch (error) {
// 		next(error);
// 	}
// });

router.get("/cn-list", async (req, res, next) => {
	try {
		const { constituencyName, state, year } = req.query;

		if (!state || !year) {
			return res.status(400).json({
				success: false,
				message: "State, year, and type are required query parameters",
			});
		}

		const key = `widget_cn_election_candidates_${constituencyName}_${state}_${year}`;
		// const cachedResult = await redis.get(key);
		// if (cachedResult) {
		// 	return res.json(cachedResult);
		// }

		// First, find the election to get its ID
		const election = await TempElection.findOne({
			state: state,
			year: parseInt(year),
		}).lean();

		if (!election) {
			return res.status(404).json({
				success: false,
				message: "Election not found",
			});
		}

		const constituency = await ConstituencyModel.findOne({
			name: constituencyName,
		});
		if (!constituency) {
			return res.status(404).json({
				success: false,
				message: "Constituency not found",
			});
		}

		const electionConstituency = await ElectionConstituencyModel.findOne({
			election: election._id,
			constituency: constituency._id,
		});

		const rawCandidates = await ElectionCandidatesModel.find({
			election: election._id,
			constituency: constituency._id,
		})
			.populate({
				path: "candidate",
				select: "name hindiName image age gender",
				populate: {
					path: "party",
					select: "party partyHindi color_code party_logo",
				},
			})
			.populate({
				path: "constituency",
				select: "name constituencyHindi",
			})
			.sort({ votesReceived: -1 })
			.lean();

		const candidates = rawCandidates.map((result) => ({
			...result,
			constituencyStatus: electionConstituency ? electionConstituency.status : "ongoing",
		}));

		res.json(candidates);
	} catch (error) {
		next(error);
	}
});

router.put("/:id", isAdmin, upload.single("image"), async (req, res, next) => {
	try {
		const existingCandidate = await Candidate.findById(req.params.id);
		if (!existingCandidate) return res.status(404).send("Candidate not found");

		// Prepare candidate updates
		const candidateUpdates = {
			name: req.body.name,
			party: req.body.party,
			age: req.body.age,
			gender: req.body.gender,
			hotCandidate:
				req.body.hotCandidate || existingCandidate.hotCandidate || false, // Assuming this is a boolean value
			constituency: req.body.constituency || existingCandidate.constituency, // Assuming this comes as an array of constituency IDs
			image: req.file
				? getFullImagePath(req, "candidates")
				: req.body.image || existingCandidate.image,
		};

		// Update the candidate
		const candidate = await Candidate.findByIdAndUpdate(
			req.params.id,
			candidateUpdates,
			{ new: true },
		);

		// Update constituencies
		// const currentConstituencyIds = existingCandidate.constituency.map(c => c.toString());
		// const newConstituencyIds = Array.isArray(req.body.constituency) ? req.body.constituency : [req.body.constituency];

		// Remove candidate from constituencies no longer assigned
		// const constituenciesToRemove = currentConstituencyIds.filter(id => !newConstituencyIds.includes(id));
		// for (const id of constituenciesToRemove) {
		//   const constituency = await Constituency.findById(id);
		//   if (constituency) {
		//     constituency.candidates = constituency.candidates.filter(candidateId => !candidateId.equals(candidate._id));
		//     await constituency.save();
		//   }
		// }

		// Add candidate to new constituencies
		// for (const id of newConstituencyIds) {
		//   const constituency = await Constituency.findById(id);
		//   if (constituency) {
		//     if (!constituency.candidates.includes(candidate._id)) {
		//       constituency.candidates.push(candidate._id);
		//       await constituency.save();
		//     }
		//   }
		// }

		await redis.clearAllKeys();

		res.json(candidate);
	} catch (error) {
		next(error);
	}
});

// Get single candidate by ID with error handling enabled
router.get("/:id", async (req, res, next) => {
	try {
		const candidate = await Candidate.findById(req.params.id);
		if (!candidate) return res.status(404).send("Candidate not found");
		res.json(candidate);
	} catch (error) {
		next(error);
	}
});

// Add a new candidate with error handling enabled
router.post("/", isAdmin, upload.single("image"), async (req, res, next) => {
	try {
		// Convert the hotCandidate value to a boolean
		const hotCandidate = req.body.hotCandidate === "true";
		console.log(req.body, hotCandidate);

		const candidateData = {
			name: req.body.name,
			party: req.body.party,
			age: req.body.age,
			hotCandidate: hotCandidate, // Now it is a boolean
			gender: req.body.gender,
			image: req.file ? getFullImagePath(req, "candidates") : null,
			constituency: req.body.constituency,
		};

		// Validate constituency ID
		const existingConstituency = await Constituency.findById(
			candidateData.constituency,
		);
		if (!existingConstituency) {
			return res.status(404).send(`Constituency with ID ${id} is invalid`);
		}

		const candidate = new Candidate({
			name: candidateData.name,
			party: candidateData.party,

			age: candidateData.age,
			hotCandidate: candidateData.hotCandidate, // Boolean value
			gender: candidateData.gender,
			image: candidateData.image,
			constituency: candidateData.constituency, // Store valid constituencies
		});

		const newCandidate = await candidate.save();

		// Update each constituency with the new candidate's ID
		const constituency = await Constituency.findById(
			candidateData.constituency,
		);
		constituency.candidates.push(newCandidate._id); // Add new candidate ID to the constituency's candidates array
		await constituency.save();

		await redis.clearAllKeys();

		res.redirect(`/candidates`);
	} catch (error) {
		next(error);
	}
});

// // Update a candidate by ID with error handling enabled
// router.put('/:id', upload.single('image'), async (req, res, next) => {
//   try {
//     // Find the existing candidate
//     const existingCandidate = await Candidate.findById(req.params.id);
//     if (!existingCandidate) return res.status(404).send('Candidate not found');

//     // Prepare the candidate updates
//     const candidateUpdates = {
//       name: req.body.name,
//       party: req.body.party,
//       age: req.body.age,
//       gender: req.body.gender,
//       hotCandidate: req.body.hotCandidate || existingCandidate.hotCandidate || false,
//       totalVotes: req.body.totalVotes,
//       constituency: req.body.constituency,
//       image: req.file ? getFullImagePath(req, 'candidates') : req.body.image || existingCandidate.image,
//     };

//     // Update the candidate
//     const candidate = await Candidate.findByIdAndUpdate(req.params.id, candidateUpdates, { new: true });

//     // Update constituencies if provided
//     if (Array.isArray(req.body.constituency)) {
//       // Fetch the current constituencies from the existing candidate
//       const currentConstituencyIds = existingCandidate.constituency.map(c => c.toString());

//       // Update each constituency
//       for (const constituencyId of req.body.constituency) {
//         const constituency = await Constituency.findById(constituencyId);
//         if (!constituency) {
//           return res.status(404).send(`Constituency with ID ${constituencyId} is invalid`);
//         }

//         // Check if candidate is already in the constituency
//         if (!constituency.candidates.includes(candidate._id)) {
//           constituency.candidates.push(candidate._id); // Add candidate to constituency
//         }
//         await constituency.save();
//       }

//       // Remove candidate from constituencies not included in the new list
//       const constituenciesToRemove = currentConstitencyIds.filter(id => !req.body.constituency.includes(id));
//       for (const id of constituenciesToRemove) {
//         const constituency = await Constituency.findById(id);
//         if (constituency) {
//           constituency.candidates = constituency.candidates.filter(candidateId => !candidateId.equals(candidate._id)); // Remove candidate from constituency
//           await constituency.save();
//         }
//       }
//     }

//     await redis.clearAllKeys()

//     res.json(candidate);
//   } catch (error) {
//     next(error);
//   }
// });

// Delete a candidate by ID with error handling enabled
router.delete("/:id", isAdmin, async (req, res, next) => {
	try {
		const candidate = await Candidate.findByIdAndDelete(req.params.id);
		if (!candidate) return res.status(404).send("Candidate not found");

		await redis.clearAllKeys();

		res.json({ message: "Candidate deleted successfully" });
	} catch (error) {
		next(error);
	}
});

// Get all candidates with error handling enabled
router.get("/", async (req, res, next) => {
	try {
		// Extract the constituency query parameter
		const { constituency } = req.query;
		// Check for cached data for constituency-based request
		if (constituency) {
			// Check if the constituency list is cached

			const cachedData = await redis.get(
				`${cachedKeys.CANDIDATES}:${constituency}`,
			);
			if (cachedData) {
				return res.json(cachedData);
			}

			// If not cached, fetch from DB
			const constituencies = await Constituency.find({
				name: { $regex: constituency, $options: "i" },
			}) // Added case-insensitive search
				.populate({
					path: "candidates",
					model: "Candidate",
					populate: [
						{
							path: "party", // Populate party for each candidate
							model: "Party",
						},
						{
							path: "constituency", // Populate constituency for each candidate
							model: "Constituency",
						},
					],
				});

			// Check if any constituencies were found
			if (constituencies.length === 0) {
				return res.json({ candidates: [] });
			}

			// Sort candidates by totalVotes in descending order
			const sortedCandidates = constituencies[0].candidates.sort(
				(a, b) => b.totalVotes - a.totalVotes,
			); // Sort in descending order

			return res.json(sortedCandidates);
		}

		// If not cached, fetch from DB
		const candidates = await Candidate.find()
			.populate("party constituency")
			.sort({ totalVotes: -1 }); // Sort by totalVotes in descending order

		res.json(candidates);
	} catch (error) {
		next(error);
	}
});

// add candidates from excel sheet
router.post("/file-upload", excelUpload.single("file"), async (req, res) => {
	try {
		const workBook = xlsx.read(req.file.buffer, { type: "buffer" });
		const sheet = workBook.SheetNames[0];
		const jsonData = xlsx.utils.sheet_to_json(workBook.Sheets[sheet]);

		// Group data by electionSlug to handle multiple elections in one upload
		const electionSlugMap = new Map();

		const formattedJsonData = await Promise.all(
			jsonData.map(async (elem) => {
				const constituencyName = (elem.constituency || "").trim();
				const constituency = await Constituency.findOne({
					name: constituencyName,
				});

				// Ensure party exists; create it with just the party name if not found
				const partyName = (elem.party || "").trim();
				if (!partyName) {
					throw new Error(`Missing party for candidate: ${elem.name}`);
				}
				const party = await Party.findOneAndUpdate(
					{ party: partyName },
					{ $setOnInsert: { party: partyName } },
					{ new: true, upsert: true },
				);

				if (!constituency) {
					throw new Error(
						`Invalid constituency for candidate: ${elem.name}. Constituency "${constituencyName}" not found.`,
					);
				}

				// Update Hindi names if provided and not already set
				const updatePromises = [];

				// Update constituency Hindi name if provided and missing
				if (elem.constituencyHindi && !constituency.constituencyHindi) {
					updatePromises.push(
						Constituency.updateOne(
							{ _id: constituency._id },
							{ $set: { constituencyHindi: elem.constituencyHindi.trim() } }
						)
					);
				}

				// Update party Hindi name if provided and missing
				if (elem.partyHindi && !party.partyHindi) {
					updatePromises.push(
						Party.updateOne(
							{ _id: party._id },
							{ $set: { partyHindi: elem.partyHindi.trim() } }
						)
					);
				}

				// Execute updates for Hindi names
				if (updatePromises.length > 0) {
					await Promise.all(updatePromises);
				}

				// Track electionSlug if provided
				if (elem.electionSlug) {
					electionSlugMap.set(elem.electionSlug, true);
				}

				// Check if candidate already exists with same name, age, party, gender, and constituency
				// Build query object with all required fields
				// Note: constituency is an array in the Candidate model, so we use $in
				const candidateQuery = {
					name: elem.name.trim(),
					party: party._id,
					constituency: { $in: [constituency._id] },
				};

				// Add optional fields if they exist
				// Handle age: convert to number if present, but allow 0 as a valid age
				if (elem.age !== undefined && elem.age !== null && elem.age !== "") {
					const ageNum = Number(elem.age);
					if (!isNaN(ageNum)) {
						candidateQuery.age = ageNum;
					}
				}
				// Handle gender: include in query if present
				if (elem.gender !== undefined && elem.gender !== null && elem.gender !== "") {
					candidateQuery.gender = elem.gender.trim();
				}

				let existingCandidate = await Candidate.findOne(candidateQuery);

				// Update candidate Hindi name if provided and candidate exists but doesn't have hindiName
				if (existingCandidate && elem.hindiName && !existingCandidate.hindiName) {
					await Candidate.updateOne(
						{ _id: existingCandidate._id },
						{ $set: { hindiName: elem.hindiName.trim() } }
					);
					// Refresh the candidate document to get updated data
					existingCandidate = await Candidate.findById(existingCandidate._id);
				}

				return {
					candidate: existingCandidate
						? null
						: new Candidate({
								name: elem.name.trim(),
								hindiName: elem.hindiName ? elem.hindiName.trim() : undefined,
								constituency: [constituency._id],
								age: elem.age !== undefined && elem.age !== null && elem.age !== "" 
									? (isNaN(Number(elem.age)) ? undefined : Number(elem.age))
									: undefined,
								party: party._id,
								hotCandidate:
									elem.hotCandidate === true ||
									elem.hotCandidate === "true" ||
									elem.hotCandidate === "TRUE",
								gender: elem.gender ? elem.gender.trim() : undefined,
						  }),
					existingCandidateId: existingCandidate ? existingCandidate._id : null,
					electionSlug: elem.electionSlug,
					constituencyId: constituency._id,
					partyId: party._id,
				};
			}),
		);

		// Separate new candidates from existing ones and track indices
		const newCandidates = [];
		const newCandidateIndices = []; // Track original indices in formattedJsonData
		const allCandidateIds = [];

		formattedJsonData.forEach((item, index) => {
			if (item.existingCandidateId) {
				// Use existing candidate ID
				allCandidateIds[index] = item.existingCandidateId;
			} else {
				// Track new candidate and its index
				newCandidates.push(item.candidate);
				newCandidateIndices.push(index);
			}
		});

		// Save only new candidates
		let savedCandidateIds = [];
		if (newCandidates.length > 0) {
			const bulkSaveCandidates = await Candidate.bulkSave(newCandidates);
			console.log(
				`Inserted ${bulkSaveCandidates.insertedCount} new candidates, reused ${formattedJsonData.length - newCandidates.length} existing candidates`,
			);

			// Get the saved candidate IDs (they should be in the same order as newCandidates)
			savedCandidateIds = bulkSaveCandidates.insertedIds
				? Object.values(bulkSaveCandidates.insertedIds)
				: [];

			// Map new candidate IDs back to their original positions
			newCandidateIndices.forEach((originalIndex, newIndex) => {
				allCandidateIds[originalIndex] = savedCandidateIds[newIndex];
			});
		}

		const totalCandidatesProcessed = formattedJsonData.length;
		if (totalCandidatesProcessed === 0) {
			return res
				.status(400)
				.json({ message: "Bad Request. Check Your File Data And Try Again" });
		}

		// If electionSlug is provided, mirror individual add behavior:
		// 1) Link candidates to election (ElectionCandidatesModel)
		// 2) Ensure constituency-election records exist (ElectionConstituencyModel)
		// 3) Ensure parties are linked to election (PartyElectionModel) and add to TempElection.electionInfo.partyIds
		// 4) Push candidates into TempElection.electionInfo.candidates
		// 5) Clear relevant redis caches
		if (electionSlugMap.size > 0) {
			for (const electionSlug of electionSlugMap.keys()) {
				const election = await TempElection.findOne({ electionSlug });
				if (!election) {
					console.warn(
						`Election with slug "${electionSlug}" not found. Skipping election linkage for candidates.`,
					);
					continue;
				}

				const electionId = election._id;
				const state = election.state;
				const year = election.year;
				const type = election.electionType;

				const electionCandidateEntries = [];
				const constituencyEnsures = [];
				const partyEnsures = new Map(); // partyId -> ensured
				const addToElectionCandidates = [];
				const addToElectionParties = new Set();

				// Get all existing candidate-election links for this election to avoid duplicates
				const existingCandidateElections = await ElectionCandidatesModel.find({
					election: electionId,
				}).select("candidate constituency");
				
				// Create a Set for quick lookup: "candidateId-constituencyId"
				const existingLinks = new Set(
					existingCandidateElections.map(
						(ce) => `${ce.candidate.toString()}-${ce.constituency.toString()}`
					)
				);

				for (let i = 0; i < formattedJsonData.length; i++) {
					const item = formattedJsonData[i];
					if (item.electionSlug !== electionSlug) continue;
					const candidateId = allCandidateIds[i];
					if (candidateId === undefined) continue;

					// Retrieve partyId from item (works for both new and existing candidates)
					const partyId = item.partyId;
					const constituencyId = item.constituencyId;

					// Check if this candidate-constituency is already linked to this election
					const linkKey = `${candidateId.toString()}-${constituencyId.toString()}`;
					if (existingLinks.has(linkKey)) {
						console.log(
							`Candidate ${candidateId} already linked to election ${electionId} for constituency ${constituencyId}. Skipping.`
						);
						continue;
					}

					// 1) Link candidate to election
					electionCandidateEntries.push(
						new ElectionCandidatesModel({
							election: electionId,
							candidate: candidateId,
							constituency: constituencyId,
						}),
					);

					// Mark as existing to avoid duplicates in the same batch
					existingLinks.add(linkKey);

					// 2) Ensure constituency-election exists
					constituencyEnsures.push(
						ElectionConstituencyModel.findOneAndUpdate(
							{ election: electionId, constituency: constituencyId },
							{ $setOnInsert: { election: electionId, constituency: constituencyId } },
							{ new: true, upsert: true },
						),
					);

					// 3) Ensure party-election exists; also add party to TempElection if needed
					if (!partyEnsures.has(String(partyId))) {
						partyEnsures.set(String(partyId), true);
						addToElectionParties.add(String(partyId));
					}

					// 4) Track candidate to push into electionInfo.candidates (only if not already added)
					if (!addToElectionCandidates.includes(candidateId)) {
						addToElectionCandidates.push(candidateId);
					}
				}

				// Execute saves/ensures
				if (electionCandidateEntries.length > 0) {
					await ElectionCandidatesModel.bulkSave(electionCandidateEntries);
				}
				if (constituencyEnsures.length > 0) {
					await Promise.all(constituencyEnsures);
				}
				if (addToElectionParties.size > 0) {
					const partyIds = Array.from(addToElectionParties).map((id) => id);
					// Create PartyElectionModel entries if missing
					const partyElectionCreates = partyIds.map((partyId) =>
						PartyElectionModel.findOneAndUpdate(
							{ election: electionId, party: partyId },
							{ $setOnInsert: { election: electionId, party: partyId } },
							{ new: true, upsert: true },
						),
					);
					await Promise.all(partyElectionCreates);

					// Add parties to TempElection.electionInfo.partyIds
					await TempElection.updateOne(
						{ _id: electionId },
						{ $addToSet: { "electionInfo.partyIds": { $each: partyIds } } },
					);
				}

				if (addToElectionCandidates.length > 0) {
					await TempElection.updateOne(
						{ _id: electionId },
						{ $addToSet: { "electionInfo.candidates": { $each: addToElectionCandidates } } },
					);
				}

				// 5) Clear related redis caches like the individual add does
				try {
					redis.delete(`widget_election_widget`);
					redis.delete(`widget_bihar_election_map_${state}_${year}_${type}`);
					redis.delete(
						`widget_cn_election_constituencies_${state}_${year}_${type}`,
					);
					redis.deleteByPattern(
						`widget_cn_election_candidates_*_${state}_${year}_${type}`,
					);
				} catch (e) {
					console.warn("Failed to clear some redis keys:", e?.message);
				}
			}
		}

		const newCount = newCandidates.length;
		const existingCount = totalCandidatesProcessed - newCount;
		res.status(200).json({
			success: true,
			message: `Successfully processed ${totalCandidatesProcessed} candidates (${newCount} new, ${existingCount} existing)${
				electionSlugMap.size > 0
					? ` and linked them to ${electionSlugMap.size} election(s)`
					: ""
			}`,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "internal server error", error: error.message });
	}
});

module.exports = router;
