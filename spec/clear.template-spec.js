// This template generates tests for behaviors associated with removal of
// all levels from the queue.

// Params:
// - cb(bot) : a callback that accepts a bot instance as its 1st parameter
//   The callback should trigger the bot command or function being tested,
//   which is expected to remove all levels from the queue.  The bot will
//   already have its queue initialized.  The callback is expected to end
//   with the queue open, so if the method being tested closes it, then
//   the callback should issue an !open command afterward.
// - options : an object which may include the follwoing values:
//   - botConfig : an ojbect that will be merged into the config for each
//     test's bot.  This allows for callbacks that only dequeue levels with
//     those settings.  However, note that some test scenarios require
//     specific options; so if a callback needs to set any of the following,
//     it may be unable to use this template:
//     - levelLimit
//     - levelLimitType (to anything except active)
//     - priority (to anything other than rotation)
//     - httpPort (to anything other than 8080)
//     (default is {})

const fp = require('lodash/fp');

module.exports = async (cb, { botConfig = {} } = {}) => {
  let buildBot;

  beforeAll(function() {
    buildBot = async (opts = {}) =>
                    this.buildBotInstance(fp.merge(opts, {config: botConfig}));
  });

  describe("clears the queue, so it", () => {
    it("removes all entries from the queue", async function() {
      const bot = await buildBot({config: {httpPort: 8080}});

      await bot.command("!mark", "streamer");
      await this.addLevels(bot, 3);
      await bot.command("!add emp001", "viewer");

      await cb(bot);

      expect(await this.getQueue()).toEqual([]);
    });

    it("clears the current level bookmark", async function() {
      const bot = await buildBot();

      await this.addLevels(bot, 3);
      await bot.command("!mark", "streamer");
      await bot.command("!add emp001", "viewer");

      await cb(bot);

      expect(this.bookmarks).toEqual([]);
    });

    it("clears active level limits", async function() {
      const bot = await buildBot({config: {
        levelLimit: 2,
        levelLimitType: 'active',
        httpPort: 8080
      }});

      await bot.command("!add valid11", "viewer1");
      await bot.command("!add valid12", "viewer2");
      await bot.command("!add valid13", "viewer2");

      await cb(bot);

      await bot.command("!add valid01", "viewer1");
      await bot.command("!add valid02", "viewer2");
      await bot.command("!add valid03", "viewer2");

      expect(await this.getSimpleQueue()).toEqual([
        {type: "level", id: "valid01" },
        {type: "level", id: "valid02" },
        {type: "level", id: "valid03" }
      ]);
    });

    it("resets 'next round' for all submitters", async function() {
      const bot = await buildBot({config: {
        priority: "rotation",
        httpPort: 8080
      }});

      await bot.command("!add valid11", "viewer1");
      await bot.command("!add valid12", "viewer1");
      await bot.command("!add valid13", "viewer2");
      await cb(bot);
      await bot.command("!add valid01", "viewer0");
      await bot.command("!add valid02", "viewer1");
      await bot.command("!add valid03", "viewer2");
      await bot.command("!add valid04", "viewer3");

      expect(await this.getSimpleQueue()).toEqual([
        {type: "level", id: "valid01" },
        {type: "level", id: "valid02" },
        {type: "level", id: "valid03" },
        {type: "level", id: "valid04" }
      ]);
    });

    it("removes the 'played' session interaction from the current level",
       async function() {
      const bot = await buildBot();

      await bot.command("!add 001l001", "viewer");
      await cb(bot);

      this.resetChat();
      await bot.command("!check emp001");

      expect(this.getChat().join('')).toContain('most recent unplayed');
    });

    it("does not change level counts", async function() {
      const bot = await buildBot({config: {httpPort: 8080}});

      await this.addLevels(bot, 3);
      await bot.command("!mark", "streamer");
      await bot.command("!add emp001", "viewer");

      await cb(bot);

      expect(await this.getCounts()).toEqual({session: {
        played: 0,
        won: 0,
        lost: 0
      }});
    });

    it("clears the 'previous' level", async function() {
      const bot = await buildBot();

      await bot.command("!add valid01", "viewer");
      await bot.command("!next", "streamer");
      await cb(bot);
      await bot.command("!back", "streamer");

      expect(this.bookmarks).toEqual([]);
    });

    it("can handle the queue being empty", async function() {
      const bot = await buildBot({config: {httpPort: 8080}});

      await cb(bot);

      // if we get here with no error, it's fine
    });
  });
};
