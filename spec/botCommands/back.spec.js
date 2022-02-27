describe("the !back command", () => {
  it("restores the previous 'now playing' entry", async function() {
    const bot = await this.buildBotInstance();
    await bot.command("!add valid01", "viewer");
    await bot.command("!next", "streamer");

    await bot.command("!back", "streamer");

    expect(this.bookmarks).toEqual(['valid01']);
  });

  it("can only remember one previous entry", async function() {
    const bot = await this.buildBotInstance();
    await this.addLevels(bot, 2);
    await bot.command("!next", "streamer");
    await bot.command("!next", "streamer");

    await bot.command("!back", "streamer");
    await bot.command("!back", "streamer");

    expect(this.bookmarks).toEqual(['valid02']);
  });

  it("can be used multiple times - just not back to back", async function() {
    const bot = await this.buildBotInstance();
    await this.addLevels(bot, 3);
    await bot.command("!next", "streamer");
    await bot.command("!back", "streamer");
    await bot.command("!next", "streamer");
    await bot.command("!next", "streamer");

    await bot.command("!back", "streamer");

    expect(this.bookmarks).toEqual(['valid02']);
  });

  it("keeps the current order of other queued levels", async function() {
    const bot = await this.buildBotInstance({config: {httpPort: 8080}});
    await this.addLevels(bot, 5);
    await bot.command("!play from viewer04", "streamer");

    await bot.command("!back", "streamer");
    const queue = await this.getSimpleQueue();
    expect(queue).toEqual([
      { type: 'level', id: 'valid01' },
      { type: 'level', id: 'valid04' },
      { type: 'level', id: 'valid02' },
      { type: 'level', id: 'valid03' },
      { type: 'level', id: 'valid05' }
    ]);
  });

  it("when pushing a level out of 'now playing' removes the bookmark",
      async function() {
    const bot = await this.buildBotInstance();
    await this.addLevels(bot, 2);
    await bot.command("!next", "streamer");

    await bot.command("!back", "streamer");

    expect(this.bookmarks).toEqual(['valid01']);
  });

  it("when pushing a creator out of 'now playing' resets the ui",
      async function() {
    const bot = await this.buildBotInstance({config: {
      httpPort: 8080,
      creatorCodeMode: "webui",
    }});
    await bot.command("!add valid01", "viewer");
    await bot.command("!add emp001", "viewer");
    await bot.command("!next", "streamer");

    await bot.command("!back", "streamer");
    const creatorInfo = await this.getCreatorInfo();
    expect(creatorInfo.creatorId).toEqual(null);
  });

  it("reduces 'played' count when restoring a played level", async function() {
    const bot = await this.buildBotInstance({config: {httpPort: 8080}});
    await this.addLevels(bot, 3);
    await bot.command("!win", "streamer");
    await bot.command("!lose", "streamer");
    await bot.command("!next", "streamer");

    await bot.command("!back", "streamer");
    const counts = await this.getCounts();
    expect(counts.session).toEqual({
      played: 2,
      won: 1,
      lost: 1
    });
  });

  it("leaves 'played' count when restoring a skipped level", async function() {
    const bot = await this.buildBotInstance({config: {httpPort: 8080}});
    await this.addLevels(bot, 3);
    await bot.command("!win", "streamer");
    await bot.command("!lose", "streamer");
    await bot.command("!skip", "streamer");

    await bot.command("!back", "streamer");
    const counts = await this.getCounts();
    expect(counts.session).toEqual({
      played: 2,
      won: 1,
      lost: 1
    });
  });

  it("when restoring a skipped level re-adds 'played in session' interaction",
     async function() {
    const bot = await this.buildBotInstance({ config: {
      httpPort: 8080,
      creatorCodeMode: "webui"
    }});

    await bot.command("!add 001l001", "viewer");
    await bot.command("!skip", "streamer");
    await bot.command("!back", "streamer");
    await bot.command("!add emp001", "viewer2");
    await bot.command("!next", "streamer");

    const creatorInfo = await this.getCreatorInfo();
    expect(creatorInfo.levels[0].played).toBeTruthy();
  });

  it("reduces 'won' count when restoring a won level", async function() {
    const bot = await this.buildBotInstance({config: {httpPort: 8080}});
    await this.addLevels(bot, 3);
    await bot.command("!lose", "streamer");
    await bot.command("!skip", "streamer");
    await bot.command("!win", "streamer");

    await bot.command("!back", "streamer");
    const counts = await this.getCounts();
    expect(counts.session).toEqual({
      played: 1,
      won: 0,
      lost: 1
    });
  });

  it("when restoring a won level removes the 'beaten in session' interaction",
     async function() {
    const bot = await this.buildBotInstance({ config: {
      httpPort: 8080,
      creatorCodeMode: "webui"
    }});

    await bot.command("!add 001l001", "viewer");
    await bot.command("!win", "streamer");
    await bot.command("!back", "streamer");
    await bot.command("!add emp001", "viewer2");
    await bot.command("!next", "streamer");

    const creatorInfo = await this.getCreatorInfo();
    expect(creatorInfo.levels[0].beaten).toBeFalsy();
  });

  it("doesn't remove 'beaten' if set in prior session", async function() {
    const bot = await this.buildBotInstance({ config: {persistence: {
      enabled: true,
      interactions: true
    }}});
    await bot.command("!add 001l001", "viewer");
    await bot.command("!win", "streamer");

    const bot2 = await this.buildBotInstance({ config: {persistence: {
      enabled: true,
      interactions: true
    }}});
    await bot2.command("!add 001l001", "viewer");
    await bot2.command("!win", "streamer");
    await bot2.command("!back", "streamer");

    this.resetChat();
    await bot2.command("!check 001l001", "viewer");
    expect(this.getChat().join('')).toContain('beaten');
  });

  it("doesn't remove 'beaten' if set earlier in session", async function() {
    const bot = await this.buildBotInstance({config: {
      creatorCodeMode: "auto"
    }});

    await bot.command("!add valid01", "viewer");
    await bot.command("!add emp001", "viewer");
    await bot.command("!add 001l001", "viewer");
    await bot.command("!next", "streamer");
    await bot.command("!win", "streamer");

    await bot.command("!win", "streamer");
    await bot.command("!back", "streamer");

    this.resetChat();
    await bot.command("!check 001l001", "viewer");
    expect(this.getChat().join('')).toContain('beaten');
  });

  it("reduces 'lost' count when restoring a lost level", async function() {
    const bot = await this.buildBotInstance({config: {httpPort: 8080}});
    await this.addLevels(bot, 3);
    await bot.command("!skip", "streamer");
    await bot.command("!win", "streamer");
    await bot.command("!lose", "streamer");

    await bot.command("!back", "streamer");
    const counts = await this.getCounts();
    expect(counts.session).toEqual({
      played: 1,
      won: 1,
      lost: 0
    });
  });

  it("reduces counts only based on the last dequeue", async function() {
    const bot = await this.buildBotInstance({config: {httpPort: 8080}});
    await this.addLevels(bot, 3);
    await bot.command("!win", "streamer");
    await bot.command("!lose", "streamer");
    await bot.command("!win", "streamer");
    await bot.command("!back", "streamer");
    await bot.command("!lose", "streamer");
    await bot.command("!back", "streamer");
    await bot.command("!skip", "streamer");
    await bot.command("!back", "streamer");

    const counts = await this.getCounts();
    expect(counts.session).toEqual({
      played: 2,
      won: 1,
      lost: 1
    });
  });

  it("leaves counts alone when restoring a marker", async function () {
    const bot = await this.buildBotInstance({config: {httpPort: 8080}});
    await this.addLevels(bot, 3);
    await bot.command("!mark", "streamer");

    await bot.command("!win", "streamer");
    await bot.command("!lose", "streamer");
    await bot.command("!skip", "streamer");
    await bot.command("!advance", "streamer");

    await bot.command("!back", "streamer");
    const counts = await this.getCounts();
    expect(counts.session).toEqual({
      played: 2,
      won: 1,
      lost: 1
    });
  });

  it("does not affect the original submitter's limit", async function() {
    const bot = await this.buildBotInstance({config: {
      httpPort: 8080,
      levelLimitType: "active",
      levelLimit: 1
    }});

    await bot.command("!add valid01", "viewer");
    await bot.command("!next", "streamer");
    await bot.command("!back", "streamer");
    await bot.command("!add valid02", "viewer");

    expect(await this.getSimpleQueue()).toEqual([
      {type: "level", id: "valid01"},
      {type: "level", id: "valid02"}
    ]);

    await bot.command("!next", "streamer");
    await bot.command("!add valid03", "viewer");

    expect(await this.getSimpleQueue()).toEqual([
      {type: "level", id: "valid02"}
    ]);
  });

  it("creates a separate nospoil list for the restored level",
      async function() {
    const bot = await this.buildBotInstance();
    await this.addLevels(bot, 2);
    await bot.command("!next", "streamer");

    await bot.command("!nospoil", "viewer1");
    await bot.command("!back", "streamer");
    await bot.command("!nospoil", "viewer2");

    await bot.command("!next", "streamer");
    expect(Object.keys(this.getAllDms())).toEqual(["viewer2"]);

    this.resetDms();
    await bot.command("!next", "streamer");
    expect(Object.keys(this.getAllDms())).toEqual(["viewer1"]);
  });

  it(  "when pushing a level out of 'now plaing', removes the 'played in"
     + "session' interaction from the creator level cache", async function() {
    const bot = await this.buildBotInstance({ config: {
      httpPort: 8080,
      creatorCodeMode: "webui"
    }});

    await bot.command("!add valid01", "viewer");
    await bot.command("!add 001l001", "viewer");
    await bot.command("!next", "streamer");
    await bot.command("!back", "streamer");
    await bot.command("!add emp001", "viewer2");
    await bot.command("!play next from viewer2", "streamer");

    const creatorInfo = await this.getCreatorInfo();
    expect(creatorInfo.levels[0].played).toBeFalsy();
  });

  it("does not remove 'played' if set in prior session", async function() {
    const bot = await this.buildBotInstance({ config: {persistence: {
      enabled: true,
      interactions: true
    }}});
    await bot.command("!add 001l001", "viewer");
    await bot.command("!next", "streamer");

    const bot2 = await this.buildBotInstance({ config: {persistence: {
      enabled: true,
      interactions: true
    }}});
    await bot2.command("!add valid01", "viewer");
    await bot2.command("!add 001l001", "viewer");
    await bot2.command("!next", "streamer");
    await bot2.command("!back", "streamer");

    this.resetChat();
    await bot2.command("!check 001l001", "viewer");
    expect(this.getChat().join('')).not.toContain('not played');
  });

  it("doesn't remove 'played' if set earlier in session", async function() {
    const bot = await this.buildBotInstance({config: {
      creatorCodeMode: "auto"
    }});

    await bot.command("!add valid01", "viewer");
    await bot.command("!add emp001", "viewer");
    await bot.command("!add valid02", "viewer");
    await bot.command("!add 001l001", "viewer");
    await bot.command("!next", "streamer");
    await bot.command("!next", "streamer");
    await bot.command("!next", "streamer");
    await bot.command("!back", "streamer");

    this.resetChat();
    await bot.command("!check 001l001", "viewer");
    expect(this.getChat().join('')).not.toContain('not played');
  });

  it("can 'un-postpone' a level", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    await bot.command("!add valid01", "viewer");
    await bot.command("!postpone", "streamer");

    await bot.command("!back", "streamer");
    expect(this.bookmarks).toEqual(['valid01']);

    await bot.command("!skip", "streamer");
    const bot2 = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    expect(this.bookmarks).toEqual([]);
  });

  it("doesn't accidentally 'un-postpone' multiple instances of a creator",
     async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    await bot.command("!add emp001", "viewer");
    await bot.command("!postpone", "streamer");
    await bot.command("!add emp001", "viewer");
    await bot.command("!postpone", "streamer");
    await bot.command("!back", "streamer");

    // ... even if we try to confuse it
    await bot.command("!skip", "streamer");
    await bot.command("!back", "streamer");

    const bot2 = await this.buildBotInstance({config: {
      persistence: {enabled: true},
      httpPort: 8080
    }});
    expect(await this.getSimpleQueue()).toEqual([
      {type: 'creator', id: 'emp001'}
    ]);
  });

  it("can unban a level", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    await bot.command("!add valid01", "viewer");
    await bot.command("!nope", "streamer");
    expect(await bot.command("!check valid01", "viewer")).toContain("banned");
    await bot.command("!back", "streamer");
    expect(await bot.command("!check valid01", "viewer"))
                                                     .not.toContain("banned");
    await bot.command("!skip", "streamer");

    await bot.command("!add valid02", "viewer");
    await bot.command("!win", "streamer");
    await bot.command("!nope prev", "streamer");
    expect(await bot.command("!check valid02", "viewer")).toContain("banned");
    await bot.command("!back", "streamer");
    expect(await bot.command("!check valid02", "viewer"))
                                                     .not.toContain("banned");
    await bot.command("!skip", "streamer");

    await bot.command("!add valid03", "viewer");
    await bot.command("!win", "streamer");
    await bot.command("!nope valid03", "streamer");
    expect(await bot.command("!check valid03", "viewer")).toContain("banned");
    await bot.command("!back", "streamer");
    expect(await bot.command("!check valid03", "viewer"))
                                                     .not.toContain("banned");
    await bot.command("!skip", "streamer");

    await bot.command("!add valid04", "viewer");
    await bot.command("!nope valid04", "streamer");
    expect(await bot.command("!check valid04", "viewer")).toContain("banned");
    await bot.command("!back", "streamer");
    expect(await bot.command("!check valid04", "viewer"))
                                                     .not.toContain("banned");
    expect(this.bookmarks).toEqual(["valid04"]);
    await bot.command("!skip", "streamer");

    const bot2 = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    await bot2.command("!add valid01", "viewer");
    expect(this.bookmarks).toEqual(['valid01']);
    await bot2.command("!skip", "streamer");
    await bot2.command("!add valid02", "viewer");
    expect(this.bookmarks).toEqual(['valid02']);
    await bot2.command("!skip", "streamer");
    await bot2.command("!add valid03", "viewer");
    expect(this.bookmarks).toEqual(['valid03']);
    await bot2.command("!skip", "streamer");
    await bot2.command("!add valid04", "viewer");
    expect(this.bookmarks).toEqual(['valid04']);
  });

  it("only works for the streamer", async function() {
    const bot = await this.buildBotInstance();
    await bot.command("!add valid01", "viewer");
    await bot.command("!next", "streamer");

    await bot.command("!back", "viewer");

    expect(this.bookmarks).toEqual([]);
  });
});
