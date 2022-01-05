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

    return newLevels.map(mapLevel);
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
      return Array.from(creators[creatorId])
                  .map(id => mapLevel(levels[id].level));
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

const mapLevel = level => ({
  ...level,
  played: playedInSession.has(level.id) ? true : level.played
})

module.exports = { ProfileCache };
