describe("the !clear command", () => {
  it("removes all entries from the queue", async function() {
    const bot = await this.buildBotInstance({config: {httpPort: 8080}});

    await bot.command("!mark", "streamer");
    await this.addLevels(bot, 3);
    await bot.command("!add emp001", "viewer");

    await bot.command("!clear", "streamer");

    expect(await this.getQueue()).toEqual([]);
  });

  it("clears the current level bookmark", async function() {
    const bot = await this.buildBotInstance();

    await this.addLevels(bot, 3);
    await bot.command("!mark", "streamer");
    await bot.command("!add emp001", "viewer");

    await bot.command("!clear", "streamer");

    expect(this.bookmarks).toEqual([]);
  });

  it("allows the removed levels to be added again", async function() {
    const bot = await this.buildBotInstance({config: {httpPort: 8080}});

    await this.addLevels(bot, 3);
    await bot.command("!clear", "streamer");
    await this.addLevels(bot, 3);

    expect(await this.getSimpleQueue()).toEqual([
      {type: "level", id: "valid01" },
      {type: "level", id: "valid02" },
      {type: "level", id: "valid03" }
    ]);
  });

  it("clears active level limits", async function() {
    const bot = await this.buildBotInstance({config: {
      levelLimit: 2,
      levelLimitType: 'active',
      httpPort: 8080
    }});

    await bot.command("!add valid01", "viewer1");
    await bot.command("!add valid02", "viewer2");
    await bot.command("!add valid03", "viewer2");
    await bot.command("!clear", "streamer");
    await bot.command("!add valid01", "viewer1");
    await bot.command("!add valid02", "viewer2");
    await bot.command("!add valid03", "viewer2");

    expect(await this.getSimpleQueue()).toEqual([
      {type: "level", id: "valid01" },
      {type: "level", id: "valid02" },
      {type: "level", id: "valid03" }
    ]);
  });

  it("resets 'next round' for all submitters", async function() {
    const bot = await this.buildBotInstance({config: {
      priority: "rotation",
      httpPort: 8080
    }});

    await bot.command("!add valid01", "viewer1");
    await bot.command("!add valid02", "viewer1");
    await bot.command("!add valid03", "viewer2");
    await bot.command("!clear", "streamer");
    await bot.command("!add valid01", "viewer0");
    await bot.command("!add valid02", "viewer1");
    await bot.command("!add valid03", "viewer2");
    await bot.command("!add valid04", "viewer3");

    expect(await this.getSimpleQueue()).toEqual([
      {type: "level", id: "valid01" },
      {type: "level", id: "valid02" },
      {type: "level", id: "valid03" },
      {type: "level", id: "valid04" }
    ]);
  });

  it("removes the 'played' session interaction from the current level",
      async function() {
    const bot = await this.buildBotInstance();
    
    await bot.command("!add 001l001", "viewer");
    await bot.command("!clear", "streamer");

    this.resetChat();
    await bot.command("!check emp001");

    expect(this.getChat().join('')).toContain('most recent unplayed');
  });

  it("does not change level counts", async function() {
    const bot = await this.buildBotInstance({config: {httpPort: 8080}});

    await this.addLevels(bot, 3);
    await bot.command("!mark", "streamer");
    await bot.command("!add emp001", "viewer");

    await bot.command("!clear", "streamer");

    expect(await this.getCounts()).toEqual({session: {
      played: 0,
      won: 0,
      lost: 0
    }});
  });

  it("clears the 'previous' level", async function() {
    const bot = await this.buildBotInstance();

    await bot.command("!add valid01", "viewer");
    await bot.command("!next", "streamer");
    await bot.command("!clear", "streamer");
    await bot.command("!back", "streamer");

    expect(this.bookmarks).toEqual([]);
  });

  it("does nothing if the queue is empty", async function() {
    const bot = await this.buildBotInstance({config: {httpPort: 8080}});

    await bot.command("!clear", "streamer");

    // if we get here with no error, it's fine
  });

  it("only works for the streamer", async function() {
    const bot = await this.buildBotInstance({config: {httpPort: 8080}});

    await this.addLevels(bot, 3);
    await bot.command("!mark", "streamer");
    await bot.command("!add emp001", "viewer");

    await bot.command("!clear", "viewer");

    expect(await this.getSimpleQueue()).toEqual([
      { type: 'level',   id: 'valid01' },
      { type: 'level',   id: 'valid02' },
      { type: 'level',   id: 'valid03' },
      { type: 'mark',    id: undefined },
      { type: 'creator', id: 'emp001'  }
    ]);
  });
});
