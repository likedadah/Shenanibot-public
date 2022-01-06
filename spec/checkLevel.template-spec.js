// This template generates tests for behaviors associated with checking if a
// level has been played/beaten.

// Params:
// - cb(bot, username, levelId) : a callback that accpets a bot instance as
//   its 1st parameter, a username as its 2nd parameter, and a level ID as its
//   3rd parameter.  The callback should trigger the bot command or function
//   being tested (as theough the specified user had issued the command), which
//   is expected to check if the level with the given ID has been played.

module.exports = itChecksALevel = cb => {
  describe("checks a level, so it", () => {
    it("sees if you've beaten a level", async function() {
      const bot = this.buildBotInstance();

      const response = await cb(bot, "viewer", "beaten1");

      expect(response).toContain("has beaten");
    });

    it("sees if you've played a level", async function() {
      const bot = this.buildBotInstance();

      const response = await cb(bot, "viewer", "played1");

      expect(response).toContain("has played");
    });

    it("warns if a played level requires too many players", async function() {
      const bot = this.buildBotInstance({config: {players: 2}});

      await bot.command("!add 2plevel", "viewer");
      await bot.command("!next", "streamer");
      await bot.command("!players 1", "streamer");

      const response = await bot.command("!check 2plevel", "viewer");
      expect(response).toContain('not accepting 2-player levels')
    });

    it("sees if you've not played a level", async function() {
      const bot = this.buildBotInstance();

      const response = await cb(bot, "viewer", "valid01");

      expect(response).toContain("has not played");
    });

    it("warns if an unplayed level requires too many players",
       async function() {
      const bot = this.buildBotInstance();

      const response = await bot.command("!check 2plevel", "viewer");
      expect(response).toContain('not accepting 2-player levels')
    });
  });
}
