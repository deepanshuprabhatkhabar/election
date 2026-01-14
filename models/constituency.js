const mongoose = require("mongoose");

const constituencySchema = new mongoose.Schema({
	name: { type: String, required: true, unique: true },
	state: { type: String, required: true },
	constituencyId: { type: Number, required: true },
	candidates: [{ type: mongoose.Schema.Types.ObjectId, ref: "Candidate" }],
	constituencyHindi: { type: String }
});

const Constituency = mongoose.model("Constituency", constituencySchema);

module.exports = Constituency;
