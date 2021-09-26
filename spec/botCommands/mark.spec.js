describe("the !mark command", () => {
  it("occupies a spot in the queue", async function() {
    const bot = this.buildBotInstance();

    await bot.command("!mark", "streamer");

    await bot.command("!add valid01", "viewer");
    expect(this.bookmarks).toEqual([]);
    await bot.command("!next", "streamer");
    expect(this.bookmarks).toEqual(["valid01"]);
  });

  it("can take a marker name", async function() {
    const bot = this.buildBotInstance();

    await bot.command("!mark Power Build Time!", "streamer");

    expect(await bot.command("!queue")).toContain("Power Build Time!");
  });

  it("will not place back-to-back unnamed markers", async function() {
    const bot = this.buildBotInstance();

    await bot.command("!mark", "streamer");
    await bot.command("!mark", "streamer");

    await bot.command("!add valid01", "viewer");
    expect(this.bookmarks).toEqual([]);
    await bot.command("!next", "streamer");
    expect(this.bookmarks).toEqual(["valid01"]);
  });

  it("will place named markers next to other markers", async function() {
    const bot = this.buildBotInstance({config: {
      httpPort: 8080
    }});

    await bot.command("!mark", "streamer");
    await bot.command("!mark name1", "streamer");
    await bot.command("!mark name2", "streamer");
    await bot.command("!mark", "streamer");

    const queue = await this.getQueue();
    expect(queue.length).toEqual(4);
  });

  it("updates the overlay", async function() {
    const bot = this.buildBotInstance({config: { httpPort: 8080 }});
    const token = await this.openWebSocket('overlay/levels')

    const msg = (await Promise.all([
      bot.command("!mark", "streamer"),
      this.waitForNextWsMessage(token)
    ]))[1];

    expect(msg).toEqual([{
      type: "mark",
      entry: {
        type: 'mark',
        name: ''
      }
    }]);
  });

  it("only works for the streamer", async function() {
    const bot = this.buildBotInstance();

    await bot.command("!mark", "viewer");

    await bot.command("!add valid01", "viewer");
    expect(this.bookmarks).toEqual(["valid01"]);
  });
});
