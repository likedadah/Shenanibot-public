describe("the !unban command", () => {
  it("removes the ban on a level", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    await bot.command("!nope 001l001", "streamer");
    await bot.command("!unban 001l001", "streamer");

    this.resetChat();
    await bot.command("!check emp001", "viewer");
    expect(this.getChat().join("")).toContain("001l001");

    await bot.command("!add 001l001", "viewer");
    expect(this.bookmarks).toEqual(["001l001"]);

    await bot.command("!next", "streamer");

    const bot2 = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});

    this.resetChat();
    await bot2.command("!check emp001", "viewer");
    expect(this.getChat().join("")).toContain("001l001");

    await bot2.command("!add 001l001", "viewer");
    expect(this.bookmarks).toEqual(["001l001"]);
  });

  it("works on the previous level", async function() {
    // normally this wouldn't be a notable edge case; but the bot may treat
    // this case specially to maintain consistent state, so we want to make
    // sure the special handling doesn't break anything

    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    await bot.command("!add 001l001", "viewer");
    await bot.command("!nope", "streamer");
    await bot.command("!unban 001l001", "streamer");

    this.resetChat();
    await bot.command("!check emp001", "viewer");
    expect(this.getChat().join("")).toContain("001l001");

    const bot2 = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    await bot2.command("!add 001l001", "viewer");
    expect(this.bookmarks).toEqual(["001l001"]);
  });

  it("updates the creator code UI if it's active", async function() {
    const bot = await this.buildBotInstance({config: {
      persistence: { enabled: true },
      httpPort: 8080,
      creatorCodeMode: "webui"
    }});

    await bot.command("!nope 001l001", "streamer");
    await bot.command("!add emp001", "viewer");

    const token = await this.openWebSocket("ui/creatorCode");
    const levelMessage = (await Promise.all([
      bot.command("!unban 001l001", "streamer"),
      this.waitForNextWsMessage(token)
    ]))[1];

    expect(levelMessage).toEqual({
      type: "level-update",
      level: {
        id: "001l001",
        name: "Employee 001 Level 001",
        type: "level",
        avatar: "http://localhost/avatar.png",
        players: 1,
        difficulty: null,
        played: false,
        beaten: false,
        banned: false
      }
    });
  });

  it("warns if the level was already not banned", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    const response = await bot.command("!unban valid01", "streamer");
    expect(response).toContain("was already not banned");
  });

  it("does nothing if given invalid level id", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    const response = await bot.command("!unban emp001", "streamer");
    expect(response).toContain("not a valid level code");
  });

  it("does nothing if given a nonexistent level", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    const response = await bot.command("!unban invalid", "streamer");
    expect(response).toContain("level does not exist");
  });

  it("only works if persistence is enabled", async function() {
    const bot = await this.buildBotInstance();
    const response = await bot.command("!unban valid01", "streamer");
    expect(response).toContain("enable persistence");
  });

  it("only works for the straemer", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    await bot.command("!nope 001l001", "streamer");
    await bot.command("!unban 001l001", "viewer");

    this.resetChat();
    await bot.command("!check emp001", "viewer");
    expect(this.getChat().join("")).not.toContain("001l001");

    await bot.command("!add 001l001", "viewer");
    expect(this.bookmarks).toEqual([]);

    const bot2 = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});

    this.resetChat();
    await bot2.command("!check emp001", "viewer");
    expect(this.getChat().join("")).not.toContain("001l001");

    await bot2.command("!add 001l001", "viewer");
    expect(this.bookmarks).toEqual([]);
  });
});
