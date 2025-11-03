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
		const cachedResult = await redis.get(key);
		if (cachedResult) {
			return res.json(cachedResult);
		}

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

		const candidates = await ElectionCandidatesModel.find({
			election: election._id,
			constituency: constituency._id,
		})
			.populate({
				path: "candidate",
				populate: {
					path: "party",
					select: "party color_code",
				},
			})
			.lean()
			.then((results) =>
				results.map((result) => {
					return { ...result, constituencyStatus: electionConstituency.status };
				}),
			);

		redis.set(key, candidates);

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

		const formattedJsonData = await Promise.all(
			jsonData.map(async (elem) => {
				const constituency = await Constituency.findOne({
					name: elem.constituency,
				});
				const party = await Party.findOne({ party: elem.party });

				if (!constituency || !party) {
					res.status(400).json({
						message: "Bad Request. Check Your File Data And Try Again",
					});
				}

				return new Candidate({
					name: elem.name,
					constituency: [constituency._id],
					age: elem.age,
					party: party._id,
					hotCandidate:
						elem.hotCandidate === true ||
						elem.hotCandidate === "true" ||
						elem.hotCandidate === "TRUE",
					gender: elem.gender,
				});
			}),
		);

		const bulkSaveCandidates = await Candidate.bulkSave(formattedJsonData);
		console.log(bulkSaveCandidates.insertedCount);
		if (!bulkSaveCandidates.insertedCount === 0) {
			res
				.status(400)
				.json({ message: "Bad Request. Check Your File Data And Try Again" });
		}

		res.status(200).json({ success: true });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "internal server error", error });
	}
});

module.exports = router;
