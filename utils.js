function getFullImagePath(req, folderName){
    return req.protocol + '://' + req.get('host') + `/uploads/${folderName}/` + req.file.filename;
}

const cachedKeys = {
    CANDIDATES: 'candidates',
    CONSTITUENCY: "constituency",
    HOT_CANDIDATES: 'hot_candidates',
    PARTY: 'party',
    ASSEMBLY_ELECTION: 'assembly_election',
    CN_LIST: 'cn_list'
}

module.exports = {getFullImagePath, cachedKeys}