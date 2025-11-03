function getFullImagePath(req, folderName) {
  return (
    `https://election.prabhatkhabar.com/uploads/${folderName}/` +
    req.file.filename
  );
}

const cachedKeys = {
  CANDIDATES: "candidates",
  CONSTITUENCY: "constituency",
  HOT_CANDIDATES: "hot_candidates",
  PARTY: "party",
  ASSEMBLY_ELECTION: "assembly_election",
  CN_LIST: "cn_list",
  STATE_ELECTION: "state_election",
  ELECTION: "election",
  WIDGET: "widget",
};

module.exports = { getFullImagePath, cachedKeys };
