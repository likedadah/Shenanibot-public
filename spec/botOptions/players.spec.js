describe("the players configuration option", () => {
  it("excludes multi-player levels when set to 1", async function() {
    const bot = await this.buildBotInstance({config: {
      players: 1
    }});

    const response2p = await bot.command("!add 2plevel", "viewer");
    expect(response2p)
                 .toEqual("Sorry, streamer is not accepting 2-player levels.");
    expect(this.bookmarks).toEqual([]);

    const response3p = await bot.command("!add 3plevel", "viewer");
    expect(response3p)
                 .toEqual("Sorry, streamer is not accepting 3-player levels.");
    expect(this.bookmarks).toEqual([]);

    const response4p = await bot.command("!add 4plevel", "viewer");
    expect(response4p)
                 .toEqual("Sorry, streamer is not accepting 4-player levels.");
    expect(this.bookmarks).toEqual([]);

    await bot.command("!add 1plevel", "viewer");
    expect(this.bookmarks).toEqual(['1plevel']);
  });

  it("excludes 3- and 4-player levels when set to 2", async function() {
    const bot = await this.buildBotInstance({config: {
      players: 2
    }});

    const response3p = await bot.command("!add 3plevel", "viewer");
    expect(response3p)
                 .toEqual("Sorry, streamer is not accepting 3-player levels.");
    expect(this.bookmarks).toEqual([]);

    const response4p = await bot.command("!add 4plevel", "viewer");
    expect(response4p)
                 .toEqual("Sorry, streamer is not accepting 4-player levels.");
    expect(this.bookmarks).toEqual([]);

    await bot.command("!add 1plevel", "viewer");
    expect(this.bookmarks).toEqual(['1plevel']);

    await bot.command("!next", "streamer");
    await bot.command("!add 2plevel", "viewer");
    expect(this.bookmarks).toEqual(['2plevel']);
  });

  it("excludes 4-player levels when set to 3", async function() {
    const bot = await this.buildBotInstance({config: {
      players: 3
    }});

    const response4p = await bot.command("!add 4plevel", "viewer");
    expect(response4p)
                 .toEqual("Sorry, streamer is not accepting 4-player levels.");
    expect(this.bookmarks).toEqual([]);

    await bot.command("!add 1plevel", "viewer");
    expect(this.bookmarks).toEqual(['1plevel']);

    await bot.command("!next", "streamer");
    await bot.command("!add 2plevel", "viewer");
    expect(this.bookmarks).toEqual(['2plevel']);

    await bot.command("!next", "streamer");
    await bot.command("!add 3plevel", "viewer");
    expect(this.bookmarks).toEqual(['3plevel']);
  });

  it("allows all levels when set to 4", async function() {
    const bot = await this.buildBotInstance({config: {
      players: 4
    }});

    await bot.command("!add 1plevel", "viewer");
    expect(this.bookmarks).toEqual(['1plevel']);

    await bot.command("!next", "streamer");
    await bot.command("!add 2plevel", "viewer");
    expect(this.bookmarks).toEqual(['2plevel']);

    await bot.command("!next", "streamer");
    await bot.command("!add 3plevel", "viewer");
    expect(this.bookmarks).toEqual(['3plevel']);

    await bot.command("!next", "streamer");
    await bot.command("!add 4plevel", "viewer");
    expect(this.bookmarks).toEqual(['4plevel']);
  });

  it("limits the results from checking a creator code", async function() {
    await this.withMockTime(async () => {
      const bot = await this.buildBotInstance({config: {
        players: 1
      }});

      await bot.command("!add 1plevel", "viewer");
      await bot.command("!win", "streamer");
      this.resetChat();
      await bot.command("!check cooper", "viewer");
      jasmine.clock().tick(0);

      expect(this.getChat().join('')).toContain("All levels from Co-op Level Maker's Profile (@cooper) have been beaten");

      await bot.command("!players 2", "streamer");
      this.resetChat();
      await bot.command("!check cooper", "viewer");
      jasmine.clock().tick(0);

      expect(this.getChat().join('')).toContain("2plevel");
    });
  });

  it("limits auto-selection of levels for a creator code", async function() {
    const bot = await this.buildBotInstance({config: {
      players: 1,
      creatorCodeMode: "auto",
      httpPort: 8080
    }});
    const ws = await this.openWebSocket('overlay/levels');

    this.setRandomizerToMin();

    await bot.command("!add 1plevel", "viewer");
    await bot.command("!win", "streamer");
    await Promise.all([
      bot.command("!add cooper", "viewer"),
      this.waitForWsMessages(ws, 4)
    ]);

    expect(this.bookmarks).toEqual(['1plevel']);

    await bot.command("!win", "streamer");
    await bot.command("!players 2", "streamer");
    await Promise.all([
      bot.command("!add cooper", "viewer"),
      this.waitForWsMessages(ws, 3)
    ]);

    expect(this.bookmarks).toEqual(['2plevel']);

    await bot.command("!win", "streamer");
    await Promise.all([
      bot.command("!add cooper", "viewer"),
      this.waitForWsMessages(ws, 3)
    ]);

    expect(this.bookmarks).toEqual(['1plevel']);

    this.closeWebSocket(ws);
  });
});
