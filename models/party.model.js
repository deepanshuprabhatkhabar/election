const mongoose = require("mongoose");

const partySchema = new mongoose.Schema({
  party: { type: String, required: true, unique: true },
  color_code: { type: String, default: "#000000" },
  party_logo: { type: String },
  partyHindi: { type: String }
});

const Party = mongoose.model("Party", partySchema);

module.exports = Party;
