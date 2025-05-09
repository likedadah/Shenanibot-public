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
    it("sees if a level is banned", async function() {
      const bot = await this.buildBotInstance({config: {persistence: {
        enabled: true
      }}});
      await bot.command("!nope valid01", "streamer");

      const response = await cb(bot, "viewer", "valid01");

      expect(response).toContain("has banned Valid Level 01 (valid01)");
    });

    it("sees if the API says you've beaten a level", async function() {
      const bot = await this.buildBotInstance();

      const response = await cb(bot, "viewer", "beaten1");

      expect(response).toContain("has beaten");
    });

    it("sees if session interactions say you've beaten a level",
       async function() {
      const bot = await this.buildBotInstance();

      await bot.command("!add valid01", "viewer");
      await bot.command("!win", "streamer");
      const response = await bot.command("!check valid01", "viewer2");

      expect(response).toContain("has beaten");
    });

    it("sees if the API says you've played a level", async function() {
      const bot = await this.buildBotInstance();

      const response = await cb(bot, "viewer", "played1");

      expect(response).toContain("has played");
    });

    it("sees if session interactions say you've played a level",
       async function() {
      const bot = await this.buildBotInstance();

      await bot.command("!add valid01", "viewer");
      const response = await bot.command("!check valid01", "viewer2");

      expect(response).toContain("has played");
    });

    it("warns if a played level requires too many players", async function() {
      const bot = await this.buildBotInstance({config: {players: 2}});

      await bot.command("!add 2plevel", "viewer");
      await bot.command("!next", "streamer");
      await bot.command("!players 1", "streamer");

      const response = await bot.command("!check 2plevel", "viewer");
      expect(response).toContain('not accepting 2-player levels')
    });

    it("sees if you've not played a level", async function() {
      const bot = await this.buildBotInstance();

      const response = await cb(bot, "viewer", "valid01");

      expect(response).toContain("has not played");
    });

    it("warns if an unplayed level requires too many players",
       async function() {
      const bot = await this.buildBotInstance();

      const response = await bot.command("!check 2plevel", "viewer");
      expect(response).toContain('not accepting 2-player levels')
    });

    it("warns if API failures prevent loading data", async function() {
      const bot = await this.buildBotInstance();

      this.MockRumpusCE.setSearchLevelsFailure(-1);
      await cb(bot, "viewer", "beaten1");

      expect(this.getChat().join(""))
                              .toContain("WARNING: Unable to load level data");
    });

    it("retries API calls (3 tries)", async function() {
      const bot = await this.buildBotInstance();

      this.MockRumpusCE.setSearchLevelsFailure(2);
      const response = await cb(bot, "viewer", "beaten1");

      expect(response).toContain("has beaten");
    });
  });
}
