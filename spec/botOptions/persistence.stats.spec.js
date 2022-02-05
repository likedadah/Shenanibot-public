describe("the persistence.stats configuration option", () => {
  beforeEach(async function() {
    this.buildBot = async (http, persistStats, persist = true) =>
      await this.buildBotInstance({config: {
        persistence: {
          enabled: persist,
          stats: persistStats
        },
        httpPort: http ? 8080 : undefined
      }});
  });

  for (const {desc, enabled, stats} of [
    {desc: "when set to false", enabled: true, stats: false},
    {desc: "when persistence is disabled", enabled: false, stats: true}
  ]) {
    describe(desc, () => {
      it("does not preserve stats for future sessions",
         async function() {
        const bot1 = await this.buildBot(false, stats, enabled);
        await bot1.command("!add valid01", "viewer");
        await bot1.command("!add valid02", "viewer");
        await bot1.command("!add valid03", "viewer");
        await bot1.command("!lose", "streamer");
        await bot1.command("!win", "streamer");
        await bot1.command("!next", "streamer");

        const bot2 = await this.buildBot(true, true);
        const counts = await this.getCounts();
        expect(counts).toEqual({
          session: {played: 0, won: 0, lost: 0},
          history: {played: 0, won: 0, lost: 0}
        });
      });

      it("does not show stat history",
         async function() {
        const bot1 = await this.buildBot(false, true);
        await bot1.command("!add valid01", "viewer");
        await bot1.command("!add valid02", "viewer");
        await bot1.command("!add valid03", "viewer");
        await bot1.command("!lose", "streamer");
        await bot1.command("!win", "streamer");
        await bot1.command("!next", "streamer");

        const bot2 = await this.buildBot(true, stats, enabled);
        const counts = await this.getCounts();
        expect(counts).toEqual({
          session: {played: 0, won: 0, lost: 0},
        });
      });
    });
  }

  describe("when set to true", () => {
    it("preserves stats for future sessions ",
       async function() {
      const bot1 = await this.buildBot(false, true);
      await bot1.command("!add valid01", "viewer");
      await bot1.command("!add valid02", "viewer");
      await bot1.command("!add valid03", "viewer");
      await bot1.command("!lose", "streamer");
      await bot1.command("!win", "streamer");
      await bot1.command("!skip", "streamer");
      await bot1.command("!back", "streamer");
      await bot1.command("!win", "streamer");
      await bot1.command("!back", "streamer");
      await bot1.command("!lose", "streamer");
      await bot1.command("!back", "streamer");
      await bot1.command("!next", "streamer");

      const bot2 = await this.buildBot(true, true);
      const counts = await this.getCounts();
      expect(counts).toEqual({
        session: {played: 0, won: 0, lost: 0},
        history: {played: 3, won: 1, lost: 1}
      });
    });

    it("remembers interactions from any previous session",
       async function() {
      const bot1 = await this.buildBot(false, true);
      await bot1.command("!add valid01", "viewer");
      await bot1.command("!add valid02", "viewer");
      await bot1.command("!add valid03", "viewer");
      await bot1.command("!lose", "streamer");
      await bot1.command("!win", "streamer");
      await bot1.command("!skip", "streamer");
      await bot1.command("!back", "streamer");
      await bot1.command("!win", "streamer");
      await bot1.command("!back", "streamer");
      await bot1.command("!lose", "streamer");
      await bot1.command("!back", "streamer");
      await bot1.command("!next", "streamer");

      const bot2 = await this.buildBot(false, false);

      const bot3 = await this.buildBot(true, true);
      const counts = await this.getCounts();
      expect(counts).toEqual({
        session: {played: 0, won: 0, lost: 0},
        history: {played: 3, won: 1, lost: 1}
      });
    });
  });
});
