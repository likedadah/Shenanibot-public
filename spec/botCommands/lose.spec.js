const itDequeues = require("../dequeue.template-spec");
const itPlaysALevel = require("../playLevel.template-spec");
const itUsesDefaultAdvance = require("../defaultAdvance.template-spec");
const itPIcksALevel = require("../pickLevel.template-spec");

describe("the !lose command", () => {
  const cb = async bot => await bot.command("!lose", "streamer");
  itDequeues(cb);
  itPlaysALevel(2, cb);
  itUsesDefaultAdvance(cb);
  itPicksALevel("!lose and play");

  it("increases the 'lost' count", async function() {
    const bot = await this.buildBotInstance({ config: {httpPort: 8080 }});
    await bot.command("!add valid01", "viewer");

    const preCounts = await this.getCounts();
    expect(preCounts.session.lost).toEqual(0);

    await bot.command("!lose", "streamer");

    const postCounts = await this.getCounts();
    expect(postCounts.session.lost).toEqual(1);
  });

  it("does not work on markers", async function() {
    const bot = await this.buildBotInstance({ config: {httpPort: 8080 }});
    await bot.command("!mark", "streamer");
    await bot.command("!add valid01", "viewer");

    await bot.command("!lose", "streamer");

    const postCounts = await this.getCounts();
    expect(postCounts.session.lost).toEqual(0);
    expect(this.bookmarks).toEqual([]);
  });

  it("does nothing when the queue is empty", async function() {
    const bot = await this.buildBotInstance({ config: {httpPort: 8080 }});

    await bot.command("!lose", "streamer");

    const postCounts = await this.getCounts();
    expect(postCounts.session.lost).toEqual(0);
  });

  it("only works for the streamer", async function() {
    const bot = await this.buildBotInstance({ config: {httpPort: 8080 }});
    await this.addLevels(bot, 2);

    await bot.command("!lose", "viewer");

    const queue = await this.getSimpleQueue();
    expect(queue.map(e => e.id)).toEqual(["valid01", "valid02"]);
  });
});
