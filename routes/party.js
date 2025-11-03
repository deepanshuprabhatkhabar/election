const Joi = require("joi");
const express = require("express");
const router = express.Router();
const Party = require("../models/party.model"); // Adjust the path as necessary
const Constituency = require("../models/constituency"); // Adjust the path as necessary
const multer = require("multer");
const mime = require("mime-types");
const { getFullImagePath, cachedKeys } = require("../utils");
const RedisManager = require("../RedisManager");
const Candidate = require("../models/candidates");
const { default: mongoose } = require("mongoose");

const redis = RedisManager.getInstance(); // Get the Redis instance

// Define the validation schema for the party
const partySchema = Joi.object({
  party: Joi.string().required(),
  color_code: Joi.string()
    .pattern(/^#([0-9A-F]{3}){1,2}$/i),
  party_logo: Joi.string().optional(), // URL of the party logo,
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/party_logos"); // Destination folder
  },
  filename: (req, file, cb) => {
    const filename = req.body.party;
    const ext = mime.extension(file.mimetype);
    cb(null, Date.now() + "-" + filename + "." + ext); // Unique file name
  },
});

const upload = multer({ storage });

router.get("/top-parties", async (req, res) => {
  const fullUrl = req.get("Referer");
  const AllStateParties = {
    delhi: [
      "67a217ceaede35a3487141b8",
      "67a217e1aede35a3487141bc",
      "67a217f2aede35a3487141c0",
      "67a21803aede35a3487141c6",
    ],
    jharkhand: [
      "673b16b4568e8acfd1213d6f",
      "673b16b4568e8acfd1213d73",
      "673b16b4568e8acfd1213d86",
      "673b16b4568e8acfd1213d83",
      "673b16b4568e8acfd1213d77",
    ],
  };

  try {
    const parties = fullUrl.includes("delhi")
      ? AllStateParties["delhi"]
      : AllStateParties["jharkhand"];

    let topParties = await Party.aggregate([
      {
        $match: {
          _id: { $in: parties.map((id) => new mongoose.Types.ObjectId(id)) },
        },
      },
      {
        $addFields: {
          sortIndex: {
            $indexOfArray: [
              parties.map((id) => new mongoose.Types.ObjectId(id)),
              "$_id",
            ],
          },
        },
      },
      {
        $sort: { sortIndex: 1 },
      },
    ]);

    topParties = [
      ...topParties,
      {
        _id: new mongoose.Types.ObjectId(),
        party: "Others",
        color_code: "#2F05FF",
        total_votes: 0,
        total_seat: 0,
        party_logo: null,
        votes_percentage: 0,
      },
    ];

    res.status(200).json(topParties);
  } catch (error) {
    console.log("top-parties error", error);
    res.status(500).json({ error: "Failed to retrieve Top parties" });
  }
});

router.get("/parties-summary", async (req, res) => {
  try {
    // Cache miss, proceed to fetch data from the database
    const parties = await Party.find({
      party: { $in: ["BJP+", "JMM+", "बीजेपी+", "जेएमएम+"] },
    }).sort({ createdAt: -1 });

    // Map the filtered parties into the desired structure
    let partiesList = parties.map((part) => ({
      party: part.party,
      color_code: part.color_code,
      total_votes: part.total_votes,
      total_seat: part.total_seat,
      party_logo: part.party_logo
        ? getFullImagePath(req, "party_logos/" + part.party_logo)
        : null,
    }));

    // Fetch total number of constituencies
    const totalSeats = await Constituency.countDocuments();

    // Prepare the response data
    const responseData = { totalSeats, partiesList };

    res.json(responseData);
  } catch (error) {
    console.log("Error fetching parties summary:", error);
    res.status(500).json({ error: "Failed to fetch parties summary" });
  }
});

router.get("/party-count", async (req, res) => {
  try {
    const debugTies = await Candidate.aggregate([
      { $unwind: "$constituency" },
      {
        $group: {
          _id: "$constituency",
          maxVotes: { $max: "$totalVotes" },
        },
      },
      {
        $lookup: {
          from: "candidates",
          localField: "_id",
          foreignField: "constituency",
          as: "candidates",
        },
      },
      { $unwind: "$candidates" },
      {
        $match: {
          $expr: { $eq: ["$candidates.totalVotes", "$maxVotes"] },
        },
      },
      {
        $lookup: {
          from: "parties",
          localField: "candidates.party",
          foreignField: "_id",
          as: "partyDetails",
        },
      },
      { $unwind: "$partyDetails" },
      {
        $group: {
          _id: "$partyDetails.party",
          constituenciesWon: { $addToSet: "$_id" }, // Collect unique constituencies for each party
        },
      },
      {
        $project: {
          party: "$_id",
          constituencyCount: { $size: "$constituenciesWon" }, // Count unique constituencies
        },
      },
      { $sort: { constituencyCount: -1 } }, // Sort parties by the number of constituencies
    ]);

    // const result = await Candidate.aggregate([
    //   { $unwind: '$constituency' },
    //   {
    //     $group: {
    //       _id: '$constituency',
    //       maxVotes: { $max: '$totalVotes' },
    //     },
    //   },
    //   {
    //     $lookup: {
    //       from: 'candidates',
    //       localField: '_id',
    //       foreignField: 'constituency',
    //       as: 'candidates',
    //     },
    //   },
    //   { $unwind: '$candidates' },
    //   {
    //     $match: {
    //       $expr: { $eq: ['$candidates.totalVotes', '$maxVotes'] },
    //     },
    //   },
    //   {
    //     $group: {
    //       _id: '$_id',
    //       candidate: { $first: '$candidates' }, // Ensure only one candidate per constituency
    //     },
    //   },
    //   {
    //     $lookup: {
    //       from: 'parties',
    //       localField: 'candidate.party',
    //       foreignField: '_id',
    //       as: 'partyDetails',
    //     },
    //   },
    //   { $unwind: '$partyDetails' },
    //   {
    //     $group: {
    //       _id: '$partyDetails.party',
    //       constituencyCount: { $sum: 1 },
    //     },
    //   },
    //   { $sort: { constituencyCount: -1 } },
    // ]);

    res.json(debugTies);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST route to create a new party
router.post("/", upload.single("party_logo"), async (req, res) => {
  try {
    const partyData = {
      party: req.body.party,
      color_code: req.body.color_code,
    };

    if (req.file) {
      partyData["party_logo"] = getFullImagePath(req, "party_logos"); // Use file path if available
    }

    // Validate the request body against the schema
    const { error } = partySchema.validate(partyData);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Check if the party already exists
    const existingParty = await Party.findOne({ party: partyData.party });
    if (existingParty) {
      return res.status(400).json({ error: "Party already exists" });
    }

    // Create a new party and save it
    const newParty = new Party(partyData);
    await newParty.save();

    await redis.clearAllKeys();

    // Redirect to the list of parties (or return response if desired)
    res.redirect("/parties");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create new party" });
  }
});

// GET route to retrieve all parties
router.get("/", async (req, res) => {
  try {
    const cachedData = await redis.get(cachedKeys.PARTY);
    if (cachedData) {
      return res.json(cachedData);
    }
    const parties = await Party.find();
    await redis.set(cachedKeys.PARTY, parties); // Cache the result
    res.json(parties);
  } catch (err) {
    console.error(err); // Log the error for debugging
    res.status(500).json({ error: "Failed to retrieve party data" });
  }
});

// GET route to retrieve a single party by ID
router.get("/:id", async (req, res) => {
  try {
    const cachedData = await redis.get(cachedKeys.PARTY + ":" + req.params.id);
    if (cachedData) {
      return res.json(cachedData);
    }
    const party = await Party.findById(req.params.id);

    if (!party) {
      return res.status(404).json({ message: "Party not found" });
    }

    await redis.set(cachedKeys.PARTY + ":" + req.params.id, party); // Cache the result

    res.json(party);
  } catch (err) {
    console.error(err); // Log the error for debugging
    res.status(500).json({ error: "Failed to retrieve party data" });
  }
});

// PUT route to update a party by ID
router.put("/:id", upload.single("party_logo"), async (req, res) => {
  try {
    const partyData = {
      party: req.body.party,
      color_code: req.body.color_code,
      // total_seat: req.body.total_seat,
      // total_votes: req.body.total_votes,
      // electors: req.body.electors,
      // votes_percentage: req.body.votes_percentage,
    };

    if (req.file) {
      partyData["party_logo"] = getFullImagePath(req, "party_logos"); // Use file path if available
    }

    const { error } = partySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message }); // Return validation error
    }

    const party = await Party.findByIdAndUpdate(req.params.id, partyData, {
      new: true,
    });

    if (!party) {
      return res.status(404).json({ message: "Party not found" });
    }

    await redis.clearAllKeys(); // Clear Redis cache when a party is updated or deleted

    res.json(party);
  } catch (err) {
    console.error(err); // Log the error for debugging
    res.status(500).json({ error: "Failed to update party data" });
  }
});

// DELETE route to delete a party by ID
router.delete("/:id", async (req, res) => {
  try {
    const party = await Party.findByIdAndDelete(req.params.id);

    if (!party) {
      return res.status(404).json({ message: "Party not found" });
    }
    await redis.clearAllKeys();
    return res.status(200).json({ message: "Deleted party" });
  } catch (err) {
    console.error(err); // Log the error for debugging
    res.status(500).json({ error: "Failed to delete party data" });
  }
});

module.exports = router;
