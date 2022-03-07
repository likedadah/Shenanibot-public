const fp = require('lodash/fp');

let levels = {};
let creators = {};

class LevelCache {
  constructor(persistenceManager) {
    this.persistenceManager = persistenceManager;
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

  addCreator(creator) {
    creators[creator.id] = {
      ...creators[creator.id],
      creator
    };

    return creator;
  }

  getCreator(creatorId) {
    return fp.clone(creators[creatorId]?.creator || null);
  }

  addLevelsForCreator(creatorId, newLevels) {
    creators[creatorId] ||= {};
    creators[creatorId].levels ||= new Set();

    for (const level of newLevels) {
      this.removeLevel(level.id); // in case it somehow changed creatorId
      creators[creatorId].levels.add(level.id);
      levels[level.id] = {
        ...levels[level.id],
        creatorLevels: creators[creatorId],
        level
      };
    }
    return newLevels.map(mapLevel);
  }

  getLevelsForCreator(creatorId) {
    if (creators[creatorId]?.levels) {
      return Array.from(creators[creatorId].levels)
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
    this.persistenceManager.interactionsChanged(level);
  }

  setLevelRejectReason(levelId, rejectReason) {
    levels[levelId] = {
      ...levels[levelId],
      rejectReason
    }
  }

  levelIsBanned(levelId, banned = true) {
    levels[levelId] = {
      ...levels[levelId],
      banned
    }
  }

  removeLevel(levelId) {
    const entry = levels[levelId];
    if (entry) {
      if (entry.creatorLevels) {
        entry.creatorLevels.levels.delete(levelId);
        entry.creatorLevels = undefined;
      }
      entry.level = undefined;
    }
  }
}

const mapLevel = level => Object.assign(fp.clone(level), {
  played: levels[level.id].interactions?.played || level.played,
  beaten: levels[level.id].interactions?.beaten || level.beaten,
  banned: levels[level.id].banned,
  rejectReason: levels[level.id].banned ? "is banned from the queue"
                                        : levels[level.id].rejectReason
});

module.exports = { LevelCache };
