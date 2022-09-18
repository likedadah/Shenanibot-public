const itClosesTheQueue = require("../close.template-spec");
const itClearsTheQueue = require("../clear.template-spec");

describe("the !suspend command", () => {
  const cb = async bot => await bot.command("!suspend", "streamer");

  itClosesTheQueue(cb, {botConfig: {persistence: {enabled: true}}});
  itClearsTheQueue(async bot => {
    await cb(bot);
    await bot.command("!open", "streamer"); // per test template requirements
  }, {botConfig: {persistence: {enabled: true}}});

  it("does not allow removed levels to be readded", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    await bot.command("!add valid01", "viewer");
    await bot.command("!suspend", "streamer");
    await bot.command("!open", "streamer"); // not expected usage here, but ok

    await bot.command("!add valid01", "viewer2");
    expect(this.bookmarks).toEqual([]);
  });

  it("requeues the entries in the next session", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    await bot.command("!add valid01", "viewer");
    await bot.command("!mark", "streamer");
    await bot.command("!add emp001", "viewer");
    await bot.command("!add valid02", "viewer");
    await bot.command("!suspend", "streamer");

    const bot2 = await this.buildBotInstance({config: {
      persistence: {
        enabled: true
      },
      httpPort: 8080
    }});

    expect(await this.getSimpleQueue()).toEqual([
      {type: "level", id: "valid01"},
      {type: "mark", id: undefined},
      {type: "creator", id: "emp001"},
      {type: "level", id: "valid02"},
    ]);
  });

  it("doesn't crash due to API failures when requeueing", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    await bot.command("!add valid01", "viewer");
    await bot.command("!mark", "streamer");
    await bot.command("!add emp001", "viewer");
    await bot.command("!add valid02", "viewer");
    await bot.command("!suspend", "streamer");

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

  it("retries API calls (3 tries each) when requeueing", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    await bot.command("!add valid01", "viewer");
    await bot.command("!mark", "streamer");
    await bot.command("!add emp001", "viewer");
    await bot.command("!add valid02", "viewer");
    await bot.command("!suspend", "streamer");

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
      {type: "mark", id: undefined},
      {type: "creator", id: "emp001"},
      {type: "level", id: "valid02"},
    ]);
  });

  it("preserves round boundaries when it requeues entries", async function() {
    const bot = await this.buildBotInstance({config: {
      persistence: {
        enabled: true
      },
      priority: "rotation"
    }});
    await bot.command("!add valid01", "viewer");
    await bot.command("!add valid02", "viewer");
    await bot.command("!add valid03", "viewer2");
    await bot.command("!add valid04", "viewer3");
    await bot.command("!suspend", "streamer");

    const bot2 = await this.buildBotInstance({config: {
      persistence: {
        enabled: true
      },
      priority: "rotation"
    }});

    this.setRandomizerToMax();
    await bot2.command("!random", "streamer");

    expect(this.bookmarks).toEqual(["valid04"]);
  });

  it("only works if persistence is enabled", async function() {
    const bot = await this.buildBotInstance();
    await bot.command("!add valid01", "viewer");

    await bot.command("!suspend", "streamer");
    expect(this.bookmarks).toEqual(["valid01"]);

    await bot.command("!next", "streamer");
    await bot.command("!add valid02", "viewer");
    expect(this.bookmarks).toEqual(["valid02"]);
  });

  it("only works for the streamer", async function() {
    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true
    }}});
    await bot.command("!add valid01", "viewer");

    const response = await bot.command("!suspend", "viewer");
    expect(response).toBeFalsy();
    expect(this.bookmarks).toEqual(["valid01"]);

    await bot.command("!next", "streamer");
    await bot.command("!add valid02", "viewer");
    expect(this.bookmarks).toEqual(["valid02"]);
  });
});
