describe("the !stats command", () => {
  it("shows the number of levels played", async function() {
    const bot = await this.buildBotInstance();
    await bot.command("!add", "valid01", "viewer1");

    expect(await bot.command("!stats")).toContain("Played: 0");
    await bot.command("!next", "streamer");
    expect(await bot.command("!stats")).toContain("Played: 0");
  });
});
