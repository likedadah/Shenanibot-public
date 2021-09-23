const fp = require("lodash/fp");

const ShenaniBot = require("../../src/bot/index");
const defaultConfig = require("../../src/config/defaultConfig");
const httpServer = require("../../src/web/server");

defaultConfig.auth = {
  streamer: "streamer"
};
defaultConfig.twitch = {
  rewardBehaviors: {}
};

let dms;

beforeAll(function() {
  this.buildBotInstance = (configOverrides = {}) => {
    const config = fp.merge(defaultConfig, configOverrides);
    return new ShenaniBot(config, _ => {}, (u,m) => {
      dms[u] = dms[u] || [];
      dms[u].push(m);
    }, u => !u.includes("nodm"));
  };

  this.optionQueueJumpRewards = {
    "reward-id-urgent": "urgent",
    "reward-id-priority": "priority",
    "reward-id-expedite": "expedite"
  }

  this.addLevels = (bot, count, first = 1, username = undefined) => {
    for(let i = 0; i < count; i++) {
      const n = first + i;
      const id = (n < 10 ? "0" : "") + n;
      bot.command(`!add valid${id}`, username || `viewer${id}`);
    }
  }

  this.getDmsFor = user => dms[user] || [];
  this.getAllDms = () => dms;
  this.resetDms = () => dms = {};
});

beforeEach(function() {
  this.resetDms();
});

afterEach(async () => {
  await httpServer.reset();
});
