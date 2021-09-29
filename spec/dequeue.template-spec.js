// This template generates tests for behaviors associated with removal of a
// level from the queue after that level has been played.

// Params:
// - cb(bot) : a callback that accepts a bot instance as its 1st parameter
//   The callback should trigger the bot command or function being tested,
//   which is expected to remove the "now playing" level.  The bot will
//   already have its queue initialized in a manner consistent with the
//   other parameters.
// - nextPosition : the position in the queue that would be promoted to the
//   "now playing" position when cb() is called.
// - nextRequired : if truthy, cb() may assume there will be a level in
//   nextPosition with id "valid00"; other than the "now playing" level, it
//   will be the only level submitted by "viewer0".  If nextRequired is
//   false, then tests that don't depend on the next level will not place
//   any level at nextPosition.
// - updateCurrentRound : a boolean indicating how the command updates the
//   round (in rotation priority mode) in the event that the entry moving
//   into the "now playing" position is not from the current round.  If true,
//   the current round should be increased to match the new "now playing"
//   level; if false, the new "now playing" level should be moved into the
//   current round

module.exports = async (cb, nextPosition = 2, nextRequired = false,
                        updateCurrentRound = true) => {
  let addLevels;
  const buildQueue = async (bot, withNext, firstCode = "valid01") => {
    if (firstCode) {
      await bot.command(`!add ${firstCode}`, "viewer0");
    } else {
      await bot.command("!mark", "streamer");
    }

    if (withNext || nextRequired) {
      addLevels(bot, nextPosition - 2, 2);
      await bot.command("!add valid00", "viewer0");
    }
  };

  beforeAll(function() {addLevels = this.addLevels;});

  describe("dequeues an entry, so it", () => {
    it("clears the bookmark if dequeueing a level", async function() {
      const bot = this.buildBotInstance();
      await buildQueue(bot);
      expect(this.bookmarks).toContain("valid01");

      await cb(bot);

      expect(this.bookmarks).not.toContain("valid01");
    });

    it("decreases viewer level count for active limits", async function() {
      const bot = this.buildBotInstance({ config: {
        httpPort: 8080,
        levelLimit: nextRequired ? 2 : 1,
        levelLimitType: "active"
      }});
      await buildQueue(bot);

      await cb(bot);
      await bot.command("!add 001l001", "viewer0");

      const queue = await this.getSimpleQueue();
      expect(queue[queue.length - 1].id).toEqual("001l001");
    });

    it("keeps the round consistent", async function() {
      const bot = this.buildBotInstance({
        config: {
          creatorCodeMode: "webui",
          httpPort: 8080,
          priority: "rotation"
        }
      });
      await buildQueue(bot, true);

      await cb(bot);

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
        const bot = this.buildBotInstance({
          config: {
            creatorCodeMode: "webui",
            httpPort: 8080,
            priority: "rotation",
            roundDuration: 1
          }
        });
        jasmine.clock().install();

        await buildQueue(bot, true);

        jasmine.clock().tick(59999);
        await cb(bot);
        jasmine.clock().tick(1);
        await bot.command("!add 001l001", "newviewer");
        jasmine.clock().tick(60000);
        await bot.command("!add 002l001", "newviewer2");

        const queue = await this.getQueue();
        expect(queue.find(e => e.entry.id === "001l001").entry.round)
          .toEqual(2);
        expect(queue.find(e => e.entry.id === "002l001").entry.round)
          .toEqual(3);

        jasmine.clock().uninstall();
      });
    }

    it("notifies any nospoil users for this level", async function() {
      const bot = this.buildBotInstance();
      await buildQueue(bot);
      await bot.command('!nospoil', 'viewer1');
      await bot.command('!nospoil', 'viewer2');

      await cb(bot);

      expect(Object.keys(this.getAllDms())).toEqual(['viewer1', 'viewer2']);
      expect(this.getDmsFor('viewer1')).toEqual([
                    'streamer has finished playing Valid Level 01 (valid01)']);
      expect(this.getDmsFor('viewer2')).toEqual([
                    'streamer has finished playing Valid Level 01 (valid01)']);
    });

    it("notifies only the current level's nospoil users", async function() {
      const bot = this.buildBotInstance();

      await bot.command("!add 001l001", "viewer1");
      await buildQueue(bot);
      await bot.command('!nospoil', 'viewer1');
      await bot.command('!next', 'streamer');
      await bot.command('!nospoil', 'viewer2');

      this.resetDms();
      await cb(bot);

      expect(Object.keys(this.getAllDms())).toEqual(['viewer2']);
    });

    it("clears the creator code UI", async function() {
      const bot = this.buildBotInstance({
        config: {
          creatorCodeMode: "webui",
          httpPort: 8080
        }
      });
      await buildQueue(bot, false, "emp001");
      const token = await this.openWebSocket("ui/creatorCode");

      const wsMsg = (await Promise.all([
        cb(bot),
        this.waitForNextWsMessage(token)
      ]))[1];

      expect(wsMsg).toEqual({
        type: "info",
        creatorId: null,
        name: null,
        levels: []
      });
    });

    it("increases the played level count", async function() {
      const bot = this.buildBotInstance({config: {
        httpPort: 8080
      }});
      await buildQueue(bot);

      const preCounts = await this.getCounts();
      expect(preCounts.played).toEqual(0);

      await cb(bot);

      const postCounts = await this.getCounts();
      expect(postCounts.played).toEqual(1);
    });

    it("does not count a marker as a played level", async function() {
      const bot = this.buildBotInstance({config: {
        httpPort: 8080
      }});
      await buildQueue(bot, false, null);

      await cb(bot);

      const postCounts = await this.getCounts();
      expect(postCounts.played).toEqual(0);
    });
  });
};
