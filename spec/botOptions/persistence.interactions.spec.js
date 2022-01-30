describe("the persistence.interactions configuration option", () => {
  beforeEach(async function() {
    this.buildBot = async (persistInteractions, persist = true) =>
      await this.buildBotInstance({config: {persistence: {
        enabled: persist,
        interactions: persistInteractions
      }}});
  });

  for (const {desc, enabled, interactions} of [
    {desc: "when set to false", enabled: true, interactions: false},
    {desc: "when persistence is disabled", enabled: false, interactions: true}
  ]) {
    describe(desc, () => {
      it("does not preserve interactions for future sessions",
         async function() {
        const bot1 = await this.buildBot(interactions, enabled);
        await bot1.command("!add valid01", "viewer");
        await bot1.command("!add valid02", "viewer");
        await bot1.command("!lose", "streamer");
        await bot1.command("!win", "streamer");

        const bot2 = await this.buildBot(true);

        this.resetChat();
        await bot2.command("!check valid01", "viewer");
        expect(this.getChat().join('')).toContain("has not played");

        this.resetChat();
        await bot2.command("!check valid02", "viewer");
        expect(this.getChat().join('')).toContain("has not played");
      });

      it("does not recall interactions from previous sessions",
         async function() {
        const bot1 = await this.buildBot(true);
        await bot1.command("!add valid01", "viewer");
        await bot1.command("!add valid02", "viewer");
        await bot1.command("!lose", "streamer");
        await bot1.command("!win", "streamer");

        const bot2 = await this.buildBot(interactions, enabled);

        this.resetChat();
        await bot2.command("!check valid01", "viewer");
        expect(this.getChat().join('')).toContain("has not played");

        this.resetChat();
        await bot2.command("!check valid02", "viewer");
        expect(this.getChat().join('')).toContain("has not played");
      });
    });
  }

  describe("when set to true", () => {
    it("preserves interactions for future sessions",
       async function() {
      const bot1 = await this.buildBot(true);
      await bot1.command("!add valid01", "viewer");
      await bot1.command("!add valid02", "viewer");
      await bot1.command("!lose", "streamer");
      await bot1.command("!win", "streamer");

      const bot2 = await this.buildBot(true);

      this.resetChat();
      await bot2.command("!check valid01", "viewer");
      expect(this.getChat().join('')).toContain("has played");

      this.resetChat();
      await bot2.command("!check valid02", "viewer");
      expect(this.getChat().join('')).toContain("has beaten");
    });

    it("remembers interactions from any previous session",
       async function() {
      const bot1 = await this.buildBot(true);
      await bot1.command("!add valid01", "viewer");
      await bot1.command("!add valid02", "viewer");
      await bot1.command("!lose", "streamer");
      await bot1.command("!win", "streamer");

      const bot2 = await this.buildBot(false);

      const bot3 = await this.buildBot(true);

      this.resetChat();
      await bot3.command("!check valid01", "viewer");
      expect(this.getChat().join('')).toContain("has played");

      this.resetChat();
      await bot3.command("!check valid02", "viewer");
      expect(this.getChat().join('')).toContain("has beaten");
    });
  });
});
