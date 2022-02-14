// This template generates tests for behaviors associated with commands that
// advance the queue according to the defaultAdvance config setting.

// Params:
// - cb(bot) : a callback that accepts a bot instance as its 1st parameter.
//   The callback should trigger the bot command or function being tested,
//   which is expected to advance the queue in the manner specified by the
//   configuration.
// - options : an object which may specify any of the following values:
//   - botConfig : an object that will be merged into the config for each
//     test's bot.  This allows for callbacks that only advance the qeuue
//     with those settings.  However, note that some test scenarios require
//     specific options; so if a callback needs to set any of the following,
//     it may be unable to use this template:
//     - defaultAdvance
//     - httpPort (to anything except 8080)
//     (default is {})

const fp = require("lodash/fp");

module.exports = itUsesDefaultAdvance = (cb, {botConfig = {}} = {}) => {
  describe("advances the queue per the defaultAdvance setting, so it", () => {
    let buildBot;
    beforeAll(function() {
      buildBot =
            opts => this.buildBotInstance(fp.merge(opts, {config: botConfig}));
    });

    beforeEach(function () {
      this.setupBot = async opts => {
        const bot = await buildBot(opts);
        await this.addLevels(bot, 10);
        return bot;
      };
      this.setRandomSequence(.7);
    });

    it("acts like !next by default", async function() {
      const bot = await this.setupBot();
      await cb(bot);
      expect(this.bookmarks).toEqual(["valid02"]);
      await cb(bot);
      expect(this.bookmarks).toEqual(["valid03"]);
    });

    it("can be configured to act like !random", async function() {
      const bot = await this.setupBot({config: {defaultAdvance: "random"}});
      await cb(bot);
      expect(this.bookmarks).toEqual(["valid08"]);
      await cb(bot);
      expect(this.bookmarks).toEqual(["valid07"]);
    });

    it("can be configured to alternate between !next and !random behavior",
        async function() {
      const bot = await this.setupBot({config: {defaultAdvance: "alternate"}});
      await cb(bot);
      expect(this.bookmarks).toEqual(["valid02"]);
      await cb(bot);
      expect(this.bookmarks).toEqual(["valid08"]);
    });

    it("always uses !next after a !back command", async function() {
      this.setRandomizerToMax();
      const bot = await this.setupBot({config: {defaultAdvance: "alternate"}});
      await this.addLevels(bot, 5);

      await cb(bot);
      await bot.command("!back", "streamer");
      await cb(bot);

      expect(this.bookmarks).toEqual(["valid02"]);
    });

    it("updates the overlay", async function() {
      const bot = await buildBot({ config: {httpPort: 8080 }});
      await this.addLevels(bot, 2);
      const token = await this.openWebSocket("overlay/levels");

      const levelsMessage = (await Promise.all([
        cb(bot),
        this.waitForNextWsMessage(token)
      ]))[1];
      expect(levelsMessage).toEqual([{
        type: "level",
        entry: {
          id: "valid02",
          name: "Valid Level 02",
          type: "level",
          submittedBy: "viewer02",
          avatar: ""
        }
      }]);
    });
  });
};
