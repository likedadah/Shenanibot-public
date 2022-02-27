// This template generates tests for behaviors associated with removal of a
// level (other than the now playing level) from the queue.

// Params:
// - cb(bot, id, username) : a callback that accepts a bot instance as its
//   1st parameter, an id as its 2nd parameter, and a username as its 3rd
//   parameter.  The callback should trigger the bot command or function
//   being tested, which is expected to remove the level with the specified
//   id from the queue.  The bot will already have its queue initialized in
//   a manner consistent with the specified options (below).  A level with
//   the specified id will have been submitted to the queue by the user
//   named username; but it will not be in the 'now playing' position).
// - options : an object which may include the follwoing values:
//   - botConfig : an ojbect that will be merged into the config for each
//     test's bot.  This allows for callbacks that only dequeue levels with
//     those settings.  However, note that some test scenarios require
//     specific options; so if a callback needs to set any of the following,
//     it may be unable to use this template:
//     - levelLimit
//     - levelLimitType (to anything other than "session")
//     - priority (to anything other than "rotation")
//     - httpPort (to anything other than 8080)
//     (default is {})
//   - supportsCreatorCode : if true, cb() is expected to work whether the
//     entry to be removed is a level or a creator; if false, skips tests
//     where the entry is a creator.  (default is true)

const fp = require('lodash/fp');

module.exports = async (cb, {
  botConfig = {},
  supportsCreatorCode = true
} = {}) => {
  let buildBot;

  beforeAll(function() {
    buildBot = async (opts = {}) =>
                    this.buildBotInstance(fp.merge(opts, {config: botConfig}));
  });

  describe("removes an entry from later in the queue, so it", () => {
    it("removes a level from the queue", async function() {
      const bot = await buildBot();
      await bot.command("!add valid01", "viewer");
      await bot.command("!add valid02", "viewer");

      await cb(bot, "valid02", "viewer");

      await bot.command("!next", "streamer");
      expect(this.bookmarks).toEqual([]);
    });

    it("decreases the subbitter's level count", async function() {
      const bot = await buildBot({config: {
        levelLimitType: "session",
        levelLimit: 1
      }});
      await bot.command("!add valid01", "viewer1");
      await bot.command("!add valid02", "viewer2");

      await cb(bot, "valid02", "viewer2");

      await bot.command("!add valid03", "viewer2");
      await bot.command("!next", "streamer");
      expect(this.bookmarks).toEqual(["valid03"]);
    });

    it("advances the viewer's other levels to fill rounds", async function() {
      const bot = await buildBot({config: {
        httpPort: 8080,
        priority: "rotation"
      }});
      await bot.command("!add valid01", "viewer0");
      await bot.command("!add valid02", "viewer0");
      await bot.command("!add valid03", "viewer0");
      await bot.command("!add valid04", "viewer0");
      await bot.command("!add valid05", "viewer0");
      await bot.command("!add valid11", "viewer1");
      await bot.command("!add valid12", "viewer1");
      await bot.command("!add valid13", "viewer1");
      await bot.command("!add valid14", "viewer1");

      await cb(bot, "valid11", "viewer1");

      await bot.command("!add valid15", "viewer1");
      const queue = await this.getSimpleQueue();
      expect(queue.map(e => e.id)).toEqual([
        "valid01", "valid12",
        "valid02", "valid13",
        "valid03", "valid14",
        "valid04", "valid15",
        "valid05"
      ]);
    });

    it("updates the overlay", async function () {
      const bot = await buildBot({config: { httpPort: 8080 }});
      await bot.command("!add valid01", "viewer");
      await bot.command("!add valid02", "viewer");
      const token = await this.openWebSocket("overlay/levels");

      const msg = (await Promise.all([
        cb(bot, "valid02", "viewer"),
        this.waitForNextWsMessage(token)
      ]))[1];

      expect(msg).toEqual([{
        type: "level",
        entry: {
          id: "valid01",
          name: "Valid Level 01",
          type: "level",
          submittedBy: "viewer",
          avatar: "",
          previouslyPlayed: false,
          previouslyBeaten: false,
        }
      }]);
    });

    if (supportsCreatorCode) {
      it("removes one instance of a creator code", async function() {
        const bot = await buildBot({config: { httpPort: 8080 }});

        await bot.command("!add valid01", "viewer");
        await bot.command("!add emp001", "viewer");
        await bot.command("!add emp001", "viewer");

        await cb(bot, "emp001", "viewer");

        const queue = await this.getSimpleQueue();
        expect(queue).toEqual([
          {type: "level", id: "valid01"},
          {type: "creator", id: "emp001"}
        ]);
      });

      it("seeks out a creator instance submitted by the correct user",
         async function() {
        const bot = await buildBot({config: { httpPort: 8080 }});

        await bot.command("!add valid01", "viewer");
        await bot.command("!add emp001", "viewer1");
        await bot.command("!add emp001", "viewer");

        await cb(bot, "emp001", "viewer");

        const queue = await this.getQueue();
        expect(queue.map(e => ({
          type: e.type,
          id: e.entry.id,
          submittedBy: e.entry.submittedBy
        }))).toEqual([
          {type: "level", id: "valid01", submittedBy: "viewer"},
          {type: "creator", id: "emp001", submittedBy: "viewer1"}
        ]);
      });
    }
  });
};
