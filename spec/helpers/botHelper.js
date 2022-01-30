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
const chat = [];

beforeAll(function() {
  this.buildBotInstance = async (configOverrides = {}) => {
    const config = fp.merge(defaultConfig, configOverrides);
    const bot = new ShenaniBot(config, m => {
      chat.push(m);
    }, (u,m) => {
      dms[u] = dms[u] || [];
      dms[u].push(m);
    }, u => !u.includes("nodm"));
    await bot.init();

    const command = bot.command;
    bot.command = async (m, u, r) => {
      const output = await command.call(bot, m, u, r);
      for (const message of output.split("\n")) {
        chat.push(message);
      }
      return output;
    }
    return bot;
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

  this.getChat = () => chat;
  this.resetChat = () => chat.length = 0;
});

beforeEach(function() {
  this.resetDms();
  this.resetChat();
});

afterEach(async () => {
  await httpServer.reset();
});
