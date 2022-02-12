describe("the !reset command", () => {
  it("sets all session stats to 0", async function() {
    const bot = await this.buildBotInstance({config: { httpPort: 8080 }});
    await this.addLevels(bot, 3);
    await bot.command("!win", "streamer");
    await bot.command("!lose", "streamer");
    await bot.command("!advance", "streamer");

    await bot.command("!reset stats", "streamer");

    const counts = await this.getCounts();
    expect(counts).toEqual({session: {played: 0, won: 0, lost: 0}});
  });

  it("sets all historical stats to 0", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true,
      stats: true
    }}});
    await this.addLevels(bot, 3);
    await bot.command("!win", "streamer");
    await bot.command("!lose", "streamer");
    await bot.command("!advance", "streamer");

    const bot2 = await this.buildBotInstance({config: {persistence: {
      enabled: true,
      stats: true
    }}});
    await this.addLevels(bot2, 3);
    await bot2.command("!win", "streamer");
    await bot2.command("!lose", "streamer");
    await bot2.command("!advance", "streamer");

    await bot2.command("!reset stats", "streamer");

    const statsResponse = await bot2.command("!stats", "viewer");
    expect(statsResponse).not.toContain("Running Totals");
    expect(statsResponse).not.toContain("Wins");
    expect(statsResponse).not.toContain("Losses");
    expect(statsResponse).toContain("Played: 0");

    const bot3 = await this.buildBotInstance({config: {
      persistence: {
        enabled: true,
        stats: true
      },
      httpPort: 8080
    }});
    const counts = await this.getCounts();
    expect(counts).toEqual({
      session: {played: 0, won: 0, lost: 0},
      history: {played: 0, won: 0, lost: 0}
    });
  });

  it("only works for the streamer", async function() {
    const bot = await this.buildBotInstance({config: { httpPort: 8080 }});
    await this.addLevels(bot, 3);
    await bot.command("!win", "streamer");
    await bot.command("!lose", "streamer");
    await bot.command("!advance", "streamer");

    await bot.command("!reset stats", "viewer");

    const counts = await this.getCounts();
    expect(counts).toEqual({session: {played: 3, won: 1, lost: 1}});
  });
});
