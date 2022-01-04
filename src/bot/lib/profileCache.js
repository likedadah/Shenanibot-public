const levels = {};
let creators = {};
let playedInSession = null;

class ProfileCache {
  constructor() {
    this.invalidate();
    playedInSession = new Set();
  }

  addLevelsForCreator(creatorId, newLevels) {
    creators[creatorId] = creators[creatorId] || new Set();
    for (const level of newLevels) {
      this.removeLevel(level.id); // in case it somehow changed creatorId
      creators[creatorId].add(level.id);
      levels[level.id] = {
        creators: creators[creatorId],
        level
      };
    }
  }

  invalidate(creatorId) {
    if (creatorId) {
      delete creators[creatorId];
    } else {
      creators = {};
    }
  }

  getLevelsForCreator(creatorId) {
    if (creators[creatorId]) {
      return Array.from(creators[creatorId]).map(l => ({
        ...levels[l].level,
        played: playedInSession.has(levels[l].level.id)
                                                ? true : levels[l].level.played
      }));
    }
    return null;
  }

  updateLevel(level) {
    const entry = levels[level.id];
    if (entry) {
      for (const key of Object.keys(level)) {
        entry.level[key] = level[key];
      }
    }
    if (level.played) {
      playedInSession.add(level.id);
    }
  }

  removeLevel(levelId) {
    const entry = levels[levelId];
    if (entry) {
      entry.creators.delete(levelId);
      levels[levelId] = undefined;
    }
  }
}

module.exports = { ProfileCache };
