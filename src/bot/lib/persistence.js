const fs = require('fs');
const path = require('path');
const readline = require('readline');

let levels;

class PersistenceManager {
  constructor(persistenceOptions) {
    this.file = path.join(persistenceOptions.path, "shenanibot-data.txt");
    this.options = persistenceOptions;
  }

  async init(levelCache) {
    if (this.options.enabled) {
      await this._loadData(this.file);
      const fd = fs.openSync(this.file, "w");

      this._processLevels(fd, levelCache);

      fs.closeSync(fd);
      this._clearData();
    }
  }

  interactionsChanged(level) {
    if (this.options.enabled && this.options.interactions) {
      fs.appendFileSync(this.file,
        `${level.id}:${level.played? "P" : "p"}${level.beaten? "B" : "b"}\n`,
        "utf8");
    }
  }

  async _loadData() {
    this._clearData();

    if (fs.existsSync(this.file)) {
      for await (const line of readline.createInterface({
                   input: fs.createReadStream(this.file, "utf8"),
                   crlfDelay: Infinity
                })) {
        this._parse(line);
      }
    }
  }

  _clearData() {
    levels = {};
  }

  _parse(line) {
    const levelMatch = line.match(/^([a-z0-9]{7}):(.*)$/)
    if (levelMatch) {
      this._parseLevel(levelMatch[1], levelMatch[2]);
    }
  }

  _parseLevel(id, info) {
    const level = levels[id] = levels[id] || {id};
    for (const op of info) {
      switch(op) {
        case 'P':
          level.played = true;
          break;
        case 'p':
          level.played = false;
          break;
        case 'B':
          level.beaten = true;
          break;
        case 'b':
          level.beaten = false;
          break;
      }
    }
  }

  _processLevels(fd, levelCache) {
    for (const levelId of Object.keys(levels)) {
      const level = levels[levelId];
      const info = (level.played ? 'P' : '')  + (level.beaten ? 'B' : '');
      if (this.options.interactions) {
        levelCache.updateSessionInteractions(level);
      }
      if (info) {
        fs.writeSync(fd, `${levelId}:${info}\n`, "utf8");
      }
    }
  }
}

module.exports = { PersistenceManager };
