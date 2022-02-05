const fs = require('fs');
const path = require('path');
const readline = require('readline');

let stats;
const statNames = {
  'p': 'played',
  'w': 'won',
  'l': 'lost'
}

let levels;

class PersistenceManager {
  constructor(persistenceOptions) {
    this.file = path.join(persistenceOptions.path, "shenanibot-data.txt");
    this.options = persistenceOptions;
  }

  async init(bot, levelCache) {
    if (this.options.enabled) {
      await this._loadData(this.file);
      const fd = fs.openSync(this.file, "w");

      this._processStats(fd, bot);
      this._processLevels(fd, levelCache);

      fs.closeSync(fd);
      this._clearData();
    }
  }

  statIncremented(statName) {
    if (this.options.enabled && this.options.stats) {
      const code = Object.keys(statNames).find(k => statNames[k] === statName);
      fs.appendFileSync(this.file,
        `:${code}+\n`,
        "utf8");
    }
  }

  statDecremented(statName) {
    if (this.options.enabled && this.options.stats) {
      const code = Object.keys(statNames).find(k => statNames[k] === statName);
      fs.appendFileSync(this.file,
        `:${code}-\n`,
        "utf8");
    }
  }

  statSetTo(statName, value) {
    if (this.options.enabled && this.options.stats) {
      const code = Object.keys(statNames).find(k => statNames[k] === statName);
      fs.appendFileSync(this.file,
        `:${code}${value}\n`,
        "utf8");
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
    stats = {
      played: 0,
      won: 0,
      lost: 0
    };
    levels = {};
  }

  _parse(line) {
    const statMatch = line.match(/^:([wlp])([+-]|\d+)$/);
    if (statMatch) {
      this._parseStat(statMatch[1], statMatch[2]);
      return;
    }

    const levelMatch = line.match(/^([a-z0-9]{7}):(.*)$/)
    if (levelMatch) {
      this._parseLevel(levelMatch[1], levelMatch[2]);
      return;
    }
  }

  _parseStat(statId, op) {
    switch(op) {
      case '+':
        stats[statNames[statId]]++;
        break;
      case '-':
        stats[statNames[statId]]--;
        break;
      default:
        stats[statNames[statId]] = +op;
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

  _processStats(fd, bot) {
    for (const id of Object.keys(statNames)) {
      fs.writeSync(fd, `:${id}${stats[statNames[id]]}\n`, "utf8");
    }
    if (this.options.stats) {
      bot.counts.history = stats;
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
