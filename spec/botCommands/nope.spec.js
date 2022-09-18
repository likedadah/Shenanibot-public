const itSkips = require("../skip.template-spec");
const itDequeues = require("../dequeue.template-spec");
const itPlaysALevel = require("../playLevel.template-spec");
const itUsesDefaultAdvance = require("../defaultAdvance.template-spec");
const itPicksALevel = require("../pickLevel.template-spec");
const itRemoves = require("../remove.template-spec");

describe("the !nope command", () => {
  const botConfig = {persistence: {enabled: true}};

  describe("when used to advance the queue", () => {
    const cb = async bot => await bot.command("!nope", "streamer");

    itSkips(cb, {botConfig});
    itDequeues(cb, {
      botConfig,
      incrementPlayed: false,
      supportsCreatorCode: false,
      supportsMarker: false
    });
    itPlaysALevel(2, cb, {botConfig});
    itUsesDefaultAdvance(cb, {botConfig});
    itPicksALevel("!nope and play", {
      botConfig,
      incrementPlayed: false,
      supportsCreatorCode: false
    });

    it("bans 'now playing' level from future resubmission", async function() {
      const bot = await this.buildBotInstance({config: botConfig});
      await bot.command("!add valid02", "viewer");
      await bot.command("!nope", "streamer");

      const bot2 = await this.buildBotInstance({config: botConfig});
      await bot2.command("!add valid02", "viewer");

      expect(this.bookmarks).toEqual([]);
    });

    it("can handle an empty queue", async function() {
      const bot = await this.buildBotInstance({config: botConfig});
      await bot.command("!nope", "streamer");

      // if we get here with no error, it's fine
    });
  });

  describe("when give the argument 'prev' or 'previous'", () => {
    it("bans the previous level from future resubmission", async function() {
      const bot = await this.buildBotInstance({config: botConfig});
      await bot.command("!add valid01", "viewer");
      await bot.command("!add valid02", "viewer");
      await bot.command("!add valid03", "viewer");
      await bot.command("!win", "streamer");
      await bot.command("!nope prev", "streamer");
      await bot.command("!next", "streamer");
      await bot.command("!lose", "streamer");
      await bot.command("!nope previous", "streamer");

      const bot2 = await this.buildBotInstance({config: botConfig});
      await bot2.command("!add valid01", "viewer");
      await bot2.command("!add valid03", "viewer");
      expect(this.bookmarks).toEqual([]);

      await bot2.command("!add valid02", "viewer");
      expect(this.bookmarks).toEqual(['valid02']);
    });

    it("can handle having no previous entry", async function() {
      const bot = await this.buildBotInstance({config: botConfig});
      await bot.command("!nope prev", "streamer");

      // if we get here with no error, it's fine
    });
  });

  describe("when given a level id", () => {
    describe("if it's the id of the 'now playing' level", () => {
      const cb = (bot, id) => bot.command(`!nope ${id}`, "streamer");

      itSkips(cb, {botConfig});
      itDequeues(cb, {
        botConfig,
        incrementPlayed: false,
        supportsCreatorCode: false,
        supportsMarker: false
      });
      itPlaysALevel(2, (bot, _u, _o, id) => cb(bot, id), {botConfig});
      itUsesDefaultAdvance(cb, {botConfig});
    });

    describe("if the level is later in the queue", () => {
      itRemoves((bot, id, _u) => bot.command(`!nope ${id}`, "streamer"), {
        botConfig,
        supportsCreatorCode: false
      });
    });

    it("bans the specified level from future resubmission", async function() {
      const bot = await this.buildBotInstance({config: botConfig});
      await bot.command("!nope valid02", "streamer");

      const bot2 = await this.buildBotInstance({config: botConfig});
      await bot2.command("!add valid02", "viewer");

      expect(this.bookmarks).toEqual([]);
    });

    it("also pevents immediate submission of the level", async function() {
      const bot = await this.buildBotInstance({config: botConfig});
      await bot.command("!nope valid02", "streamer");
      await bot.command("!add valid02", "viewer");

      expect(this.bookmarks).toEqual([]);
    });

    it("doesn't crash if the API fails to load the level", async function() {
      this.MockRumpusCE.setSearchLevelsFailure(-1);
      const bot = await this.buildBotInstance({config: botConfig});
      await bot.command("!nope valid02", "streamer");

      expect(this.getChat().join("")).toContain("Unable to load level data");
      expect(this.getChat().join("")).toContain(
         "Couldn't verify the id due to API issues; please try again later");

      this.MockRumpusCE.setSearchLevelsFailure(0);
      await bot.command("!add valid02", "viewer");

      expect(this.bookmarks).toEqual(["valid02"]);
    });

    it("retries the API call (3 total tries)", async function() {
      this.MockRumpusCE.setSearchLevelsFailure(2);
      const bot = await this.buildBotInstance({config: botConfig});
      await bot.command("!nope valid02", "streamer");
      await bot.command("!add valid02", "viewer");

      expect(this.bookmarks).toEqual([]);
    });
  });

  it("shows the ban in the creator code ui", async function() {
    const bot = await this.buildBotInstance({config: {
      persistence: { enabled: true },
      httpPort: 8080,
      creatorCodeMode: "webui"
    }});

    await bot.command("!nope 001l001", "streamer");
    await bot.command("!add emp001", "viewer");

    const creatorInfo = await this.getCreatorInfo();
    expect(creatorInfo.levels[0].banned).toBeTruthy();
  });

  it("updates the creator code ui if it's already active", async function() {
    const bot = await this.buildBotInstance({config: {
      persistence: { enabled: true },
      httpPort: 8080,
      creatorCodeMode: "webui"
    }});

    await bot.command("!add emp001", "viewer");

    const token = await this.openWebSocket("ui/creatorCode");
    const levelMessage = (await Promise.all([
      bot.command("!nope 001l001", "streamer"),
      this.waitForNextWsMessage(token)
    ]))[1];

    expect(levelMessage).toEqual({
      type: "level-update",
      level: {
        id: '001l001',
        name: 'Employee 001 Level 001',
        type: 'level',
        avatar: 'http://localhost/avatar.png',
        players: 1,
        difficulty: null,
        played: false,
        beaten: false,
        banned: true
      }
    });
  });

  it("does nothing if pointed to a marker", async function() {
    const bot = await this.buildBotInstance({config: {
      persistence: { enabled: true },
      httpPort: 8080
    }});

    await bot.command("!mark", "streamer");
    await bot.command("!nope", "streamer");
    expect(await this.getSimpleQueue()).toEqual([
      { type: "mark", id: undefined }
    ]);

    await bot.command("!next", "streamer");
    const response = await bot.command("!nope prev", "streamer");
    expect(response).toContain("no previous level");
  });

  it("does not work on creator codes", async function() {
    const bot = await this.buildBotInstance({config: {
      persistence: { enabled: true },
      httpPort: 8080
    }});

    await bot.command("!add emp001", "viewer");
    await bot.command("!nope", "streamer");
    expect(await this.getSimpleQueue()).toEqual([
      { type: "creator", id: "emp001" }
    ]);

    await bot.command("!skip", "streamer");
    const response = await bot.command("!nope prev", "streamer");
    expect(response).toContain('only works on levels');

    const bot2 = await this.buildBotInstance({config: {
      persistence: { enabled: true },
      httpPort: 8080
    }});
    await bot2.command("!add emp001", "viewer");
    expect(await this.getSimpleQueue()).toEqual([
      { type: "creator", id: "emp001" }
    ]);
  });

  it("only works if persistence is enabled", async function() {
    const bot = await this.buildBotInstance({ config: {httpPort: 8080 }});
    await this.addLevels(bot, 2);

    await bot.command("!nope", "streamer");

    const queue = await this.getSimpleQueue();
    expect(queue.map(e => e.id)).toEqual(["valid01", "valid02"]);
  });

  it("only works for the streamer", async function() {
    const bot = await this.buildBotInstance({ config: {httpPort: 8080 }});
    await this.addLevels(bot, 2);

    await bot.command("!nope", "viewer");

    const queue = await this.getSimpleQueue();
    expect(queue.map(e => e.id)).toEqual(["valid01", "valid02"]);
  });
});
