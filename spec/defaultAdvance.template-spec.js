// This template generates tests for behaviors associated with commands that
// advance the queue according to the defaultAdvance config setting.

// Params:
// - cb(bot) : a callback that accepts a bot instance as its 1st parameter.
//   The callback should trigger the bot command or function being tested,
//   which is expected to advance the queue in the manner specified by the
//   configuration.

module.exports = itUsesDefaultAdvance = cb => {
  describe("advances the queue per the defaultAdvance setting, so it", () => {
    beforeEach(function () {
      this.buildBot = async opts => {
        const bot = this.buildBotInstance(opts);
        await this.addLevels(bot, 10);
        return bot;
      };
      this.setRandomSequence(.7);
    });

    it("acts like !next by default", async function() {
      const bot = await this.buildBot();
      await cb(bot);
      expect(this.bookmarks).toEqual(["valid02"]);
      await cb(bot);
      expect(this.bookmarks).toEqual(["valid03"]);
    });

    it("can be configured to act like !random", async function() {
      const bot = await this.buildBot({config: {defaultAdvance: "random"}});
      await cb(bot);
      expect(this.bookmarks).toEqual(["valid08"]);
      await cb(bot);
      expect(this.bookmarks).toEqual(["valid07"]);
    });

    it("can be configured to alternate between !next and !random behavior",
        async function() {
      const bot = await this.buildBot({config: {defaultAdvance: "alternate"}});
      await cb(bot);
      expect(this.bookmarks).toEqual(["valid02"]);
      await cb(bot);
      expect(this.bookmarks).toEqual(["valid08"]);
    });

    it("always uses !next after a !back command", async function() {
      this.setRandomizerToMax();
      const bot = await this.buildBot({config: {defaultAdvance: "alternate"}});
      await this.addLevels(bot, 5);

      await cb(bot);
      await bot.command("!back", "streamer");
      await cb(bot);

      expect(this.bookmarks).toEqual(["valid02"]);
    });

    it("updates the overlay", async function() {
      const bot = this.buildBotInstance({ config: {httpPort: 8080 }});
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
