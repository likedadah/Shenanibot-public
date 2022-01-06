describe("the !players command", () => {
  it("overrides the players config setting", async function() {
    const bot = this.buildBotInstance();

    await bot.command("!players 2", "streamer");

    await bot.command("!add 3plevel", "viewer");
    expect(this.bookmarks).toEqual([]);

    await bot.command("!add 2plevel", "viewer");
    expect(this.bookmarks).toEqual(['2plevel']);
  });

  it("only works for the streamer", async function() {
    const bot = this.buildBotInstance();

    await bot.command("!players 2", "viewer");

    await bot.command("!add 2plevel", "viewer");
    expect(this.bookmarks).toEqual([]);
  });
});
