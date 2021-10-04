describe("the !stats command", () => {
  it("shows the number of levels played", async function() {
    const bot = await this.buildBotInstance();
    await bot.command("!add", "valid01", "viewer1");

    expect(await bot.command("!stats")).toContain("Played: 0");
    await bot.command("!next", "streamer");
    expect(await bot.command("!stats")).toContain("Played: 0");
  });

  it("shows wins if there are any", async function() {
    const bot = await this.buildBotInstance();
    await this.addLevels(bot, 4);

    expect(await bot.command("!stats")).not.toContain("Wins");
    await bot.command("!lose", "streamer");
    await bot.command("!skip", "streamer");
    await bot.command("!advance", "streamer");
    expect(await bot.command("!stats")).not.toContain("Wins");
    await bot.command("!win", "streamer");
    expect(await bot.command("!stats")).toContain("Wins: 1");
  });

  it("shows losses if there are any", async function() {
    const bot = await this.buildBotInstance();
    await this.addLevels(bot, 4);

    expect(await bot.command("!stats")).not.toContain("Losses");
    await bot.command("!win", "streamer");
    await bot.command("!skip", "streamer");
    await bot.command("!advance", "streamer");
    expect(await bot.command("!stats")).not.toContain("Losses");
    await bot.command("!lose", "streamer");
    expect(await bot.command("!stats")).toContain("Losses: 1");
  });
});
