const itDequeues = require("../dequeue.template-spec");
const itPlaysALevel = require("../playLevel.template-spec");
const itUsesDefaultAdvance = require("../defaultAdvance.template-spec");
const itPicksALevel = require("../pickLevel.template-spec");

describe("the !win command", () => {
  const cb = async bot => await bot.command("!win", "streamer");
  itDequeues(cb);
  itPlaysALevel(2, cb);
  itUsesDefaultAdvance(cb);
  itPicksALevel("!win and play");

  it("increases the 'won' count", async function() {
    const bot = await this.buildBotInstance({ config: {httpPort: 8080 }});
    await bot.command("!add valid01", "viewer");

    const preCounts = await this.getCounts();
    expect(preCounts.session.won).toEqual(0);

    await bot.command("!win", "streamer");

    const postCounts = await this.getCounts();
    expect(postCounts.session.won).toEqual(1);
  });

  it("does not work on markers", async function() {
    const bot = await this.buildBotInstance({ config: {httpPort: 8080 }});
    await bot.command("!mark", "streamer");
    await bot.command("!add valid01", "viewer");

    await bot.command("!win", "streamer");

    const postCounts = await this.getCounts();
    expect(postCounts.session.won).toEqual(0);
    expect(this.bookmarks).toEqual([]);
  });

  it("does nothing when the queue is empty", async function() {
    const bot = await this.buildBotInstance({ config: {httpPort: 8080 }});

    await bot.command("!win", "streamer");

    const postCounts = await this.getCounts();
    expect(postCounts.session.won).toEqual(0);
  });

  it("marks the level 'beaten' in the creator cache", async function() {
    const bot = await this.buildBotInstance({ config: {
      httpPort: 8080,
      creatorCodeMode: "webui"
    }});

    await bot.command("!add 001l001", "viewer");
    await bot.command("!win", "streamer");
    await bot.command("!add emp001", "viewer");

    const creatorInfo = await this.getCreatorInfo();
    expect(creatorInfo.levels[0].beaten).toBeTruthy();
  });

  it("only works for the streamer", async function() {
    const bot = await this.buildBotInstance({ config: {httpPort: 8080 }});
    await this.addLevels(bot, 2);

    await bot.command("!win", "viewer");

    const queue = await this.getSimpleQueue();
    expect(queue.map(e => e.id)).toEqual(["valid01", "valid02"]);
  });
});
