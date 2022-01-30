const itDequeues = require("./dequeue.template-spec");

// This template generates tests for commands that let the streamer pick a
// level to play next.

// Params:
// - command : the base command text (i.e. "!play" or "!win and play"); not
//   the full text with args (i.e. "!play next")
// - incrementPlayed : if true, it is expected that the command will add 1
//   to the "played levels" count; if false, the count is not checked by
//   these tests

module.exports = itPicksALevel = (cmd, incrementPlayed = true) => {
  describe("picks the next level to play, so", () => {
    // Under certain circumstances, these commands may advance the "current
    // round" when using rotation priority.  This behavior is currenty
    // considered neither required nor harmful; the tests don't check for it.
    // Specifically, whwn invoking the "dequeue" template, this edge case is
    // avoided.

    describe("when given a queue position it", () => {
      const cb = async bot => await bot.command(`${cmd} 3`, "streamer");
      itDequeues(cb, 3, true, false, incrementPlayed);
      itPlaysALevel(3, cb);

      it("only works for the streamer", async function() {
        const bot = await this.buildBotInstance({ config: {httpPort: 8080 }});
        await this.addLevels(bot, 5);
  
        await bot.command(`${cmd} 3`, "viewer");
  
        const queue = await this.getSimpleQueue();
        expect(queue.map(e => e.id)).toEqual([
          "valid01", "valid02", "valid03", "valid04", "valid05"
        ]);
      });

      it("updates the overlay", async function() {
        const bot = await this.buildBotInstance({ config: {httpPort: 8080 }});
        await this.addLevels(bot, 5);
        const token = await this.openWebSocket("overlay/levels");

        const levelsMessage = (await Promise.all([
          bot.command(`${cmd} 3`, "streamer"),
          this.waitForNextWsMessage(token)
        ]))[1];
        expect(levelsMessage.map(e => e.entry.id)).toEqual([
          "valid03", "valid02", "valid04", "valid05"
        ]);
      });
    });

    describe("when given 'next from @username' it", () => {
      const cb = async bot =>
                    await bot.command(`${cmd} next from @viewer0`, "streamer");
      itDequeues(cb, 5, true, false, incrementPlayed);
      itPlaysALevel(5, cb);

      it("picks the earliest match if there are multiple", async function() {
        const bot = await this.buildBotInstance();
        await this.addLevels(bot, 3);
        await this.addLevels(bot, 2, 4, "targetviewer");
        await this.addLevels(bot, 3, 6);

        await bot.command(`${cmd} next from @targetviewer`, "streamer");

        expect(this.bookmarks).toEqual(["valid04"]);
      });

      it("assumes 'next' if it's omitted", async function() {
        const bot = await this.buildBotInstance();
        await this.addLevels(bot, 2);
        await this.addLevels(bot, 2, 3, "targetviewer");
        await this.addLevels(bot, 1, 5);

        await bot.command(`${cmd} from @targetviewer`, "streamer");

        expect(this.bookmarks).toEqual(["valid03"]);
      });

      it("does not require the @", async function() {
        const bot = await this.buildBotInstance();
        await this.addLevels(bot, 4);
        await this.addLevels(bot, 2, 5, "targetviewer");
        await this.addLevels(bot, 3, 7);

        await bot.command(`${cmd} from targetviewer`, "streamer");

        expect(this.bookmarks).toEqual(["valid05"]);
      });

      it("updates the overlay", async function() {
        const bot = await this.buildBotInstance({ config: {httpPort: 8080 }});
        await this.addLevels(bot, 5);
        const token = await this.openWebSocket("overlay/levels");

        const levelsMessage = (await Promise.all([
          bot.command(`${cmd} next from viewer03`, "streamer"),
          this.waitForNextWsMessage(token)
        ]))[1];
        expect(levelsMessage.map(e => e.entry.id)).toEqual([
          "valid03", "valid02", "valid04", "valid05"
        ]);
      });
    });

    describe("when given 'last from @username' it", () => {
      const cb = async bot =>
                    await bot.command(`${cmd} last from @viewer0`, "streamer");
      itDequeues(cb, 5, true, false, incrementPlayed);
      itPlaysALevel(5, cb);

      it("picks the latest match if there are multiple", async function() {
        const bot = await this.buildBotInstance();
        await this.addLevels(bot, 3);
        await this.addLevels(bot, 2, 4, "targetviewer");
        await this.addLevels(bot, 3, 6);

        await bot.command(`${cmd} last from @targetviewer`, "streamer");

        expect(this.bookmarks).toEqual(["valid05"]);
      });

      it("does not require the @", async function() {
        const bot = await this.buildBotInstance();
        await this.addLevels(bot, 4);
        await this.addLevels(bot, 2, 5, "targetviewer");
        await this.addLevels(bot, 3, 7);

        await bot.command(`${cmd} last from targetviewer`, "streamer");

        expect(this.bookmarks).toEqual(["valid06"]);
      });

      it("updates the overlay", async function() {
        const bot = await this.buildBotInstance({ config: {httpPort: 8080 }});
        await this.addLevels(bot, 5);
        const token = await this.openWebSocket("overlay/levels");

        const levelsMessage = (await Promise.all([
          bot.command(`${cmd} last from viewer03`, "streamer"),
          this.waitForNextWsMessage(token)
        ]))[1];
        expect(levelsMessage.map(e => e.entry.id)).toEqual([
          "valid03", "valid02", "valid04", "valid05"
        ]);
      });
    });
  });
};
