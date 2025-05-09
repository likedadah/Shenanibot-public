// This template generates tests for behaviors associated with removal of a
// level from the queue after that level has been played.

// Params:
// - cb(bot, id) : a callback that accepts a bot instance as its 1st
//   parameter and an id as its 2nd parameter.  The callback should trigger
//   the bot command or function being tested, which is expected to remove
//   the "now playing" level.  The bot will already have its queue
//   initialized in a manner consistent with the specified options (below),
//   and the 'now playing' level's id is passed as the 2nd parameter.  (If
//   the supportsMarker option is true, then the id could be falsy, which
//   would indicate that a marker is in the "now playing" position.)
// - options : an object which may include the follwoing values:
//   - botConfig : an ojbect that will be merged into the config for each
//     test's bot.  This allows for callbacks that only dequeue levels with
//     those settings.  However, note that some test scenarios require
//     specific options; so if a callback needs to set any of the following,
//     it may be unable to use this template:
//     - levelLimit
//     - levelLimitType
//     - priority
//     - roundDuration
//     - creatorCodeMode (to anything except webui)
//     - httpPort (to anything other than 8080)
//     (default is {})
//   - incrementPlayed : if true, it is expected that the command will add 1
//     to the "played levels" count; if false, the count is not checked by
//     these tests.  (default is true)
//   - nextPosition : the position in the queue that would be promoted to the
//     "now playing" position when cb() is called.  (default is 2)
//   - nextRequired : if truthy, cb() may assume there will be a level in
//     nextPosition with id "valid00"; other than the "now playing" level, it
//     will be the only level submitted by "viewer0".  If nextRequired is
//     false, then tests that don't depend on the next level will not place
//     any level at nextPosition.  (default is false)
//   - supportsCreatorCode : if true, cb() is expected to work whether the
//     "now playing" entry is a level or a creator; if false, skips tests
//     where the "now playing" entry is a creator.  (default is true)
//   - supportsMarker : if true, cb() is expected to work even if the "now
//     playing" entry is a marker; if false, skips tests where the "now
//     playing" entry is a marker.  (default is true)
//   - updateCurrentRound : a boolean indicating how the command updates the
//     round (in rotation priority mode) in the event that the entry moving
//     into the "now playing" position is not from the current round.  If true,
//     the current round should be increased to match the new "now playing"
//     level; if false, the new "now playing" level should be moved into the
//     current round.  (default is true)

const fp = require('lodash/fp');

module.exports = async (cb, {
  botConfig = {},
  incrementPlayed = true,
  nextPosition = 2,
  nextRequired = false,
  supportsCreatorCode = true,
  supportsMarker = true,
  updateCurrentRound = true
} = {}) => {
  let buildBot;
  let addLevels;

  const buildQueue = async (bot, withNext, firstCode = "valid01") => {
    if (firstCode) {
      await bot.command(`!add ${firstCode}`, "viewer0");
    } else {
      await bot.command("!mark", "streamer");
    }

    if (withNext || nextRequired) {
      await addLevels(bot, nextPosition - 2, 2);
      await bot.command("!add valid00", "viewer0");
    }
  };

  beforeAll(function() {
    addLevels = this.addLevels;
    buildBot = async (opts = {}) =>
                    this.buildBotInstance(fp.merge(opts, {config: botConfig}));
  });

  describe("dequeues an entry, so it", () => {
    it("clears the bookmark if dequeueing a level", async function() {
      const bot = await buildBot();
      await buildQueue(bot);
      expect(this.bookmarks).toContain("valid01");

      await cb(bot, "valid01");

      expect(this.bookmarks).not.toContain("valid01");
    });

    it("doesn't crash if unable to remove the bookmark", async function() {
      this.MockRumpusCE.setRemoveBookmarkFailure(-1);
      const bot = await buildBot();
      await buildQueue(bot);
      expect(this.bookmarks).toContain("valid01");

      this.resetChat();
      await cb(bot, "valid01");

      expect(this.getChat().join("")).toContain("Unable to remove bookmark");
    });

    it("retries clearing the bookmark (3 total tries)", async function() {
      this.MockRumpusCE.setRemoveBookmarkFailure(2);
      const bot = await buildBot();
      await buildQueue(bot);
      expect(this.bookmarks).toContain("valid01");

      await cb(bot, "valid01");

      expect(this.bookmarks).not.toContain("valid01");
    });

    it("decreases viewer level count for active limits", async function() {
      const bot = await buildBot({ config: {
        httpPort: 8080,
        levelLimit: nextRequired ? 2 : 1,
        levelLimitType: "active"
      }});
      await buildQueue(bot);

      await cb(bot, "valid01");
      await bot.command("!add 001l001", "viewer0");

      const queue = await this.getSimpleQueue();
      expect(queue[queue.length - 1].id).toEqual("001l001");
    });

    it("keeps the round consistent", async function() {
      const bot = await buildBot({
        config: {
          creatorCodeMode: "webui",
          httpPort: 8080,
          priority: "rotation"
        }
      });
      await buildQueue(bot, true);

      await cb(bot, "valid01");

      if (updateCurrentRound) {
        await bot.command("!add 001l001", "newviewer");
        const queue = await this.getQueue();
        expect(queue.find(e => e.entry.id === "001l001").entry.round)
          .toEqual(2);
      } else {
        const queue = await this.getQueue();
        expect(queue[0].entry.round).toEqual(1);
      }
    });

    if(updateCurrentRound) {
      it("clears the previous round's timer", async function() {
        const bot = await buildBot({
          config: {
            creatorCodeMode: "webui",
            httpPort: 8080,
            priority: "rotation",
            roundDuration: 1
          }
        });

        await this.withMockTime(async () => {
          await buildQueue(bot, true);

          jasmine.clock().tick(59999);
          await cb(bot, "valid01");
          jasmine.clock().tick(1);
          await bot.command("!add 001l001", "newviewer");
          jasmine.clock().tick(60000);
          await bot.command("!add 002l001", "newviewer2");

          const queue = await this.getQueue();
          expect(queue.find(e => e.entry.id === "001l001").entry.round)
            .toEqual(2);
          expect(queue.find(e => e.entry.id === "002l001").entry.round)
            .toEqual(3);
        });
      });
    }

    it("notifies any nospoil users for this level", async function() {
      const bot = await buildBot();
      await buildQueue(bot);
      await bot.command("!nospoil", "viewer1");
      await bot.command("!nospoil", "viewer2");

      await cb(bot, "valid01");

      expect(Object.keys(this.getAllDms())).toEqual(["viewer1", "viewer2"]);
      expect(this.getDmsFor("viewer1")).toEqual([
                    "streamer has finished playing Valid Level 01 (valid01)"]);
      expect(this.getDmsFor("viewer2")).toEqual([
                    "streamer has finished playing Valid Level 01 (valid01)"]);
    });

    it("notifies only the current level's nospoil users", async function() {
      const bot = await buildBot();

      await bot.command("!add 001l001", "viewer1");
      await buildQueue(bot);
      await bot.command("!nospoil", "viewer1");
      await bot.command("!next", "streamer");
      await bot.command("!nospoil", "viewer2");

      this.resetDms();
      await cb(bot, "valid01");

      expect(Object.keys(this.getAllDms())).toEqual(["viewer2"]);
    });

    if (supportsCreatorCode) {
      it("clears the creator code UI", async function() {
        const bot = await buildBot({
          config: {
            creatorCodeMode: "webui",
            httpPort: 8080
          }
        });
        await buildQueue(bot, false, "emp001");
        const token = await this.openWebSocket("ui/creatorCode");

        const wsMsg = (await Promise.all([
          cb(bot, "emp001"),
          this.waitForNextWsMessage(token)
        ]))[1];

        expect(wsMsg).toEqual({
          type: "info",
          creatorId: null,
          name: null,
          levels: []
        });
      });
    }

    if (incrementPlayed) {
      it("increases the played level count", async function() {
        const bot = await buildBot({config: { httpPort: 8080 }});
        await buildQueue(bot);

        const preCounts = await this.getCounts();
        expect(preCounts.session.played).toEqual(0);

        await cb(bot, "valid01");

        const postCounts = await this.getCounts();
        expect(postCounts.session.played).toEqual(1);
      });

      it("counts the level even if it had perviously been skipped",
          async function() {
        const bot = await buildBot({config: { httpPort: 8080 }});
        await buildQueue(bot);
        await bot.command("!skip", "streamer");
        await bot.command("!back", "streamer");

        await cb(bot, "valid01");

        const postCounts = await this.getCounts();
        expect(postCounts.session.played).toEqual(1);
      });

      if (supportsMarker) {
        it("does not count a marker as a played level", async function() {
          const bot = await buildBot({config: { httpPort: 8080 }});
          await buildQueue(bot, false, null);

          await cb(bot);

          const postCounts = await this.getCounts();
          expect(postCounts.session.played).toEqual(0);
        });
      }
    }
  });
};
