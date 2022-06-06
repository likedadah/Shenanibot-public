// This template generates tests for behaviors associated with removal of a
// level from the "now playing" position in the queue without counting the
// level as "played".
//
// These tests do not examine the ordering of any remaining entries left in
// the queue; they only deal with behaviors common to actions that "un-play"
// the level that had been marked "now playing".  So e.g. if the command
// also advances the queue, it may also want to use dequeue.template-spec.js;
// or if it clears the queue, it may want to use clear.template-spec.js; etc.

// Params:
// - cb(bot, id) : a callback that accepts a bot instance as its 1st
//   parameter and an id as the 2nd parameter.  The callback should trigger
//   the bot command or function being tested, which is expected to remove
//   the "now playing" level and treat it as not having been played.  The
//   bot will already have its queue initialized in a manner consistent with
//   the specified options (below), and the id passed to the callback will
//   be the id of the entry to be skipped.
// - options : an object which may include the follwoing values:
//   - botConfig : an ojbect that will be merged into the config for each
//     test's bot.  This allows for callbacks that only dequeue levels with
//     those settings.  However, certain tests require certain settings; if
//     the callback needs to set any of the following, it may be unable to
//     use this tempalte:
//     - persistence (to false)
//     - interaction persistence (to false)
//     - creatorCodeMode (to anything other than "auto")
//     (default is {})

const fp = require('lodash/fp');

module.exports = async (cb, { botConfig = {} } = {}) => {
  let buildBot;

  beforeAll(function() {
    buildBot = async (opts = {}) =>
                    this.buildBotInstance(fp.merge(opts, {config: botConfig}));
  });

  describe("skips the 'now playing' level, so it", () => {
    it("leaves the played level count unchanged", async function() {
      const bot = await buildBot();

      console.log(await bot.command("!add valid01", "viewer"));
      await cb(bot, "valid01");

      const counts = await bot.command("!stats");
      expect(counts).toContain('Played: 0');
    });

    it("removes 'played' interaction", async function() {
      const bot = await buildBot({config: {
        httpPort: 8080,
        creatorCodeMode: "webui"
      }});

      await bot.command("!add 001l001", "viewer");
      await cb(bot, "001l001");
      await bot.command("!add emp001", "viewer");

      const {levels} = await this.getCreatorInfo();
      expect(levels[0].played).toBeFalsy();
    });

    it("does not remove 'played' interactions from prior sessions",
       async function() {
      const bot = await buildBot({config: {persistence: {
        enabled: true,
        interactions: true
      }}});
      await bot.command("!add 001l001", "viewer");
      await bot.command("!next", "streamer");

      const bot2 = await buildBot({config: {persistence: {
        enabled: true,
        interactions: true
      }}});
      await bot2.command("!add 001l001", "viewer");
      await cb(bot2, "001l001");

      this.resetChat();
      await bot2.command("!check emp001", "viewer");
      expect(this.getChat().join('')).not.toContain('unplayed');
    });

    it("does not remove 'played' interaction from earlier in the session",
       async function() {
      const bot = await buildBot({config: {
        creatorCodeMode: 'auto'
      }});

      await this.withMockTime(async () => {
        await bot.command("!add valid01", "viewer");
        await bot.command("!add emp001", "viewer");
        await bot.command("!add 001l001", "viewer");
        await bot.command("!next", "streamer");
        await bot.command("!next", "streamer");
        await cb(bot, "001l001");

        this.resetChat();
        await bot.command("!check emp001", "viewer");
        jasmine.clock().tick(0);
        expect(this.getChat().join('')).not.toContain('unplayed');
      });
    });
  });
};
