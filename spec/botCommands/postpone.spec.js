const itDequeues = require("../dequeue.template-spec");
const itPlaysALevel = require("../playLevel.template-spec");
const itUsesDefaultAdvance = require("../defaultAdvance.template-spec");
const itPicksALevel = require("../pickLevel.template-spec");

describe("the !postpone command", () => {
  const cb = async bot => await bot.command("!postpone", "streamer");
  itDequeues(cb, {
    botConfig: {persistence: {enabled: true}},
    incrementPlayed: false
  });
  itPlaysALevel(2, cb, {botConfig: {persistence: {enabled: true}}});
  itUsesDefaultAdvance(cb, {botConfig: {persistence: {enabled: true}}});
  itPicksALevel("!postpone and play", {
    botConfig: {persistence: {enabled: true}},
    incrementPlayed: false
  });

  it("saves a level for the next session", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    await bot.command("!add valid01", "viewer");
    await bot.command("!postpone", "streamer");

    const bot2 = await this.buildBotInstance({config: {
      persistence: { enabled: true },
      httpPort: 8080
    }});
    const queue = await this.getSimpleQueue();
    expect(queue.map(e => e.id)).toEqual(["valid01"]);
  });

  it("saves a creator for the next session", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    await bot.command("!add emp001", "viewer");
    await bot.command("!postpone", "streamer");

    const bot2 = await this.buildBotInstance({config: {
      persistence: { enabled: true },
      httpPort: 8080
    }});
    const queue = await this.getSimpleQueue();
    expect(queue.map(e => e.id)).toEqual(["emp001"]);
  });

  it("does not work with a marker in the 'now playing' position",
     async function() {
    const bot = await this.buildBotInstance({config: {
      persistence: { enabled: true },
      httpPort: 8080
    }});
    await bot.command("!mark", "streamer");
    await bot.command("!postpone", "streamer");

    expect(await this.getSimpleQueue()).toEqual([
      { type: 'mark', id: undefined }
    ]);
  });

  it("does nothing if the queue is empty", async function() {
    const bot = await this.buildBotInstance({config: {
      persistence: { enabled: true },
      httpPort: 8080
    }});
    await bot.command("!postpone", "streamer");

    // if we get here with no error, it's fine
  });

  it("does not increase any level count stats", async function() {
    const bot = await this.buildBotInstance({config: {
      persistence: { enabled: true },
      httpPort: 8080
    }});

    await bot.command("!add valid01", "viewer");
    await bot.command("!postpone", "streamer");

    expect(await this.getCounts()).toEqual({session: {
      played: 0,
      won: 0,
      lost: 0
    }});
  });

  it("removes the 'played' session interaction", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    await bot.command("!add 002l001", "viewer");
    await bot.command("!postpone", "streamer");

    this.resetChat();
    await bot.command("!check emp002");
    expect(this.getChat().join('')).toContain("002l001");
  });

  it("does not allow the level to be resubmitted", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});

    await bot.command("!add valid01", "viewer");
    await bot.command("!postpone", "streamer");
    await bot.command("!add valid01", "viewer2");

    expect(this.bookmarks).toEqual([]);
  });

  it("only reloads a level once after a postpone command", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    await bot.command("!add valid01", "viewer");
    await bot.command("!postpone", "streamer");

    const bot2 = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});

    const bot3 = await this.buildBotInstance({config: {
      persistence: { enabled: true },
      httpPort: 8080
    }});
    const queue = await this.getSimpleQueue();
    expect(queue.map(e => e.id)).toEqual([]);
  });

  it("requeues entries in the order they were postponed", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    await bot.command("!add valid03", "viewer");
    await bot.command("!add emp002", "viewer");
    await bot.command("!add valid01", "viewer");
    await bot.command("!add emp001", "viewer");
    await bot.command("!add valid02", "viewer");
    await bot.command("!add emp003", "viewer");
    await bot.command("!postpone", "streamer");
    await bot.command("!postpone", "streamer");
    await bot.command("!postpone", "streamer");
    await bot.command("!postpone", "streamer");
    await bot.command("!postpone", "streamer");
    await bot.command("!postpone", "streamer");

    const bot2 = await this.buildBotInstance({config: {
      persistence: { enabled: true },
      httpPort: 8080
    }});
    const queue = await this.getSimpleQueue();
    expect(queue.map(e => e.id)).toEqual(
            [ 'valid03', 'emp002', 'valid01', 'emp001', 'valid02', 'emp003' ]);
  });

  it("can requeue lots of entries", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    for (let i = 0; i < 6; i++) {
      await bot.command(`!add valid0${i}`, "viewer");
      await bot.command(`!add emp00${i}`, "viewer");
    }
    for (let i = 0; i < 12; i++) {
      await bot.command("!postpone", "streamer");
    }

    const bot2 = await this.buildBotInstance({config: {
      persistence: { enabled: true },
      httpPort: 8080
    }});
    const queue = await this.getSimpleQueue();
    expect(queue.map(e => e.id).sort()).toEqual([
      'emp000',  'emp001',  'emp002',
      'emp003',  'emp004',  'emp005',
      'valid00', 'valid01', 'valid02',
      'valid03', 'valid04', 'valid05'
    ]);
  });

  it("in rotation mode puts reloaded levels in a round before new submissions",
     async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    await bot.command("!add valid01", "viewer");
    await bot.command("!postpone", "streamer");
    await bot.command("!add valid02", "viewer");
    await bot.command("!postpone", "streamer");

    const bot2 = await this.buildBotInstance({config: {
      persistence: {
        enabled: true
      },
      priority: "rotation"
    }});
    await bot2.command("!add valid03", "viewer");

    this.setRandomizerToMax();
    await bot2.command("!random", "streamer");
    expect(this.bookmarks).toEqual(["valid02"]);
  });

  it("when reloading, re-postpones levels that require too many players",
     async function() {
    const bot = await this.buildBotInstance({config: {
      persistence: {
        enabled: true
      },
      players: 2
    }});
    await bot.command("!add 2plevel", "viewer");
    await bot.command("!postpone", "streamer");

    const bot2 = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    expect(this.bookmarks).toEqual([]);

    const bot3 = await this.buildBotInstance({config: {
      persistence: {
        enabled: true
      },
      players: 2
    }});
    expect(this.bookmarks).toEqual(["2plevel"]);
  });

  it("doesn't crash due to API failures when reloading", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    await bot.command("!add valid01", "viewer");
    await bot.command("!add emp001", "viewer");
    await bot.command("!postpone", "streamer");
    await bot.command("!postpone", "streamer");

    this.MockRumpusCE.setSearchPlayersFailure(-1);
    this.MockRumpusCE.setSearchLevelsFailure(-1);
    this.resetChat();

    const bot2 = await this.buildBotInstance({config: {
      persistence: {
        enabled: true
      },
      httpPort: 8080
    }});
    expect(this.getChat().join("")).toContain("Unable to load level data");
    expect(this.getChat().join("")).toContain("Unable to load creator data");
  });

  it("retries API calls (3 tries each) when reloading", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    await bot.command("!add valid01", "viewer");
    await bot.command("!add emp001", "viewer");
    await bot.command("!postpone", "streamer");
    await bot.command("!postpone", "streamer");

    this.MockRumpusCE.setSearchPlayersFailure(2);
    this.MockRumpusCE.setSearchLevelsFailure(2);
    const bot2 = await this.buildBotInstance({config: {
      persistence: {
        enabled: true
      },
      httpPort: 8080
    }});

    expect(await this.getSimpleQueue()).toEqual([
      {type: "level", id: "valid01"},
      {type: "creator", id: "emp001"},
    ]);
  });

  it("only works when persistence is enabled", async function() {
    const bot = await this.buildBotInstance({config: {
      httpPort: 8080
    }});
    await this.addLevels(bot, 2);

    await bot.command("!postpone", "streamer");

    const queue = await this.getSimpleQueue();
    expect(queue.map(e => e.id)).toEqual(["valid01", "valid02"]);
  });

  it("only works for the streamer", async function() {
    const bot = await this.buildBotInstance({config: {
      persistence: { enabled: true },
      httpPort: 8080
    }});
    await this.addLevels(bot, 2);

    await bot.command("!postpone", "viewer");

    const queue = await this.getSimpleQueue();
    expect(queue.map(e => e.id)).toEqual(["valid01", "valid02"]);
  });
});
