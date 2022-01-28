const fp = require('lodash/fp');

let levels = {};
let creators = {};

class LevelCache {
  constructor() {
    levels = {};
    creators = {};
  }

  addLevel(level) {
    levels[level.id] = {
      ...levels[level.id],
      level
    };

    return mapLevel(level);
  }

  getLevel(levelId) {
    if (levels[levelId]?.level) {
      return mapLevel(levels[levelId].level);
    }
    return null;
  }

  addLevelsForCreator(creatorId, newLevels) {
    creators[creatorId] = creators[creatorId] || new Set();
    for (const level of newLevels) {
      this.removeLevel(level.id); // in case it somehow changed creatorId
      creators[creatorId].add(level.id);
      levels[level.id] = {
        ...levels[level.id],
        creatorLevels: creators[creatorId],
        level
      };
    }
    return newLevels.map(mapLevel);
  }

  getLevelsForCreator(creatorId) {
    if (creators[creatorId]) {
      return Array.from(creators[creatorId])
                  .map(id => mapLevel(levels[id].level));
    }
    return null;
  }

  updateSessionInteractions(level) {
    levels[level.id] = {
      ...levels[level.id],
      interactions: levels[level.id]?.interactions || {}
    };
    if (typeof level.played === 'boolean') {
      levels[level.id].interactions.played = level.played;
    }
    if (typeof level.beaten === 'boolean') {
      levels[level.id].interactions.beaten = level.beaten;
    }
  }

  removeLevel(levelId) {
    const entry = levels[levelId];
    if (entry) {
      if (entry.creatorLevels) {
        entry.creatorLevels.delete(levelId);
        entry.creatorLevels = undefined;
      }
      entry.level = undefined;
    }
  }
}

const mapLevel = level => Object.assign(fp.clone(level), {
  played: levels[level.id].interactions?.played || level.played,
  beaten: levels[level.id].interactions?.beaten || level.beaten
})

module.exports = { LevelCache };
