// This template generates tests for behaviors associated with adding a level
// to the queue.

// Params:
// - cb(bot, username, levelId) : a callback that accepts a bot instance as
//   its 1st parameter, a username as its 2nd parameter, and a level ID as its
//   3rd parameter.  The callback should trigger the bot command or function
//   being tested (as though the specified user had issued the command), which
//   is expected to try to add a level with the given ID.
//   If the command or function has its own reasons for rejecting a level
//   (apart from the reasons that all add commands would fail), then the
//   callback should avoid those circumstances.

module.exports = itAddsALevel = cb => {
  describe("adds a level, so it", () => {
    it("adds a level to the queue", async function() {
      const bot = this.buildBotInstance();
      await cb(bot, "viewer", "valid01");

      expect(this.bookmarks).toEqual(["valid01"]);
    });

    it("respects fifo ordering", async function() {
      const bot = this.buildBotInstance({config: {
        httpPort: 8080,
        priority: "fifo"
      }});

      await bot.command("!add valid01", "viewer2");
      await bot.command("!add valid02", "viewer2");
      await cb(bot, "viewer", "valid03");

      const queue = await this.getQueue();
      expect(queue.map(e => e.entry.id))
                                  .toEqual(["valid01", "valid02", "valid03"]);
    });

    it("respects rotation ordering", async function() {
      const bot = this.buildBotInstance({config: {
        httpPort: 8080,
        priority: "rotation"
      }});

      await bot.command("!add valid01", "viewer2");
      await bot.command("!add valid02", "viewer2");
      await cb(bot, "viewer", "valid03");

      const queue = await this.getQueue();
      expect(queue.map(e => e.entry.id))
                                  .toEqual(["valid01", "valid03", "valid02"]);
    });

    it("does nothing if the queue is closed", async function() {
      const bot = this.buildBotInstance();
      await bot.command("!close", "streamer");

      await cb(bot, "viewer", "valid01");
      expect(this.bookmarks).toEqual([]);
    });

    it("can be used when permitted", async function() {
      const bot = this.buildBotInstance();
      await bot.command("!close", "streamer");

      await bot.command("!permit viewer", "streamer");
      await cb(bot, "viewer", "valid01");
      expect(this.bookmarks).toEqual(['valid01']);
    });

    it("affects the level limit", async function() {
      const bot = this.buildBotInstance({config: {
        levelLimit: 1,
        levelLimitType: "session",
        httpPort: 8080
      }});

      await cb(bot, "viewer", "valid01");
      await cb(bot, "viewer", "valid02");

      await bot.command("!add valid11", "viewer2");
      await cb(bot, "viewer2", "valid12");

      await cb(bot, "viewer3", "valid21");
      await bot.command("!add valid22", "viewer3");

      const queue = await this.getQueue();
      expect(queue.map(e => e.entry.id))
                                  .toEqual(["valid01", "valid11", "valid21"]);
    });

    it("does not bypass the add reward", async function() {
      const bot = this.buildBotInstance({twitch: {
        rewardBehaviors: {"reward-id-add": "add"}
      }});

      await cb(bot, "viewer", "valid01");
      expect(this.bookmarks).toEqual([]);
    });

    it("rejects levels that are already in the queue", async function() {
      const bot = this.buildBotInstance({config: { httpPort: 8080 }});

      await bot.command("!add valid01", "viewer1");
      await cb(bot, "viewer2", "valid01");

      const queue = await this.getQueue();
      expect(queue.map(e => ({
        id: e.entry.id,
        submittedBy: e.entry.submittedBy
      }))).toEqual([{id: "valid01", submittedBy: "viewer1"}]);
    });

    it("rejects levels that were already played this session",
                                                            async function() {
      const bot = this.buildBotInstance();

      await bot.command("!add valid01", "viewer1");
      await bot.command("!next", "streamer");
      await cb(bot, "viewer2", "valid01");

      expect(this.bookmarks).toEqual([]);
    });

    it("rejects levels that were removed by the streamer", async function() {
      const bot = this.buildBotInstance();

      await bot.command("!add valid01", "viewer1");
      await bot.command("!add valid02", "viewer1");
      await bot.command("!add valid03", "viewer1");

      await bot.command("!remove valid02", "streamer");
      await bot.command("!remove valid03", "viewer1");
      await bot.command("!next", "streamer");

      await cb(bot, "viewer1", "valid02");
      await cb(bot, "viewer1", "valid03");

      expect(this.bookmarks).toEqual(["valid03"]);
    });

    it("updates the overlay", async function() {
      const bot = this.buildBotInstance({config: { httpPort: 8080 }});
      const token = await this.openWebSocket("overlay/levels");

      const msg = (await Promise.all([
        cb(bot, "viewer", "valid01"),
        this.waitForNextWsMessage(token)
      ]))[1];

      expect(msg).toEqual([{
        type: "level",
        entry: {
          id: "valid01",
          name: "Valid Level 01",
          type: "level",
          submittedBy: "viewer",
          avatar: ""
        }
      }]);
    });

    it("closes prior rounds if the new entry is in the 'now playing' position",
       async function() {
      const bot = this.buildBotInstance({config: {
        httpPort: 8080,
        priority: "rotation"
      }});

      await bot.command("!add valid01", "viewer0");
      await bot.command("!next", "streamer");
      await cb(bot, "viewer0", "valid02");
      await bot.command("!add valid03", "viewer1");

      const queue = await this.getQueue();
      expect(queue.map(e => ({id: e.entry.id, round: e.entry.round}))).toEqual([
        {id: "valid02", round: 2},
        {id: "valid03", round: 2}
      ]);
    });

    it("clears the previous round's timer if the new entry is 'now playing'",
       async function() {
      const bot = this.buildBotInstance({config: {
        httpPort: 8080,
        priority: "rotation",
        roundDuration: 1
      }});
      jasmine.clock().install();

      await bot.command("!add valid01", "viewer0");
      jasmine.clock().tick(59999);
      await bot.command("!next", "streamer");
      await cb(bot, "viewer0", "valid02");
      jasmine.clock().tick(1);
      await bot.command("!add valid03", "viewer1");
      jasmine.clock().tick(60000);
      await bot.command("!add valid04", "viewer2");

      const queue = await this.getQueue();
      expect(queue.map(e => ({id: e.entry.id, round: e.entry.round})))
                                                                    .toEqual([
        {id: "valid02", round: 2},
        {id: "valid03", round: 2},
        {id: "valid04", round: 3}
      ]);
      jasmine.clock().uninstall();
    });
  });
};
