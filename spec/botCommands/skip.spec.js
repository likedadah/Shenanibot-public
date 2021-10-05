const itDequeues = require("../dequeue.template-spec");
const itPlaysALevel = require("../playLevel.template-spec");
const itUsesDefaultAdvance = require("../defaultAdvance.template-spec");
const itPicksALevel = require("../pickLevel.template-spec");

describe("the !skip command", () => {
  const cb = async bot => await bot.command("!skip", "streamer");
  itDequeues(cb, 2, false, true, false);
  itPlaysALevel(2, cb);
  itUsesDefaultAdvance(cb);
  itPicksALevel("!skip and play", false);

  it("leaves the played level count unchanged", async function() {
    const bot = this.buildBotInstance({config: {
      httpPort: 8080,
      defaultAdvance: "alternate"
    }});
    await bot.command("!add valid01", "viewer");
    await bot.command("!add valid02", "viewer");
    await bot.command("!skip", "streamer");
    await bot.command("!skip", "streamer");

    const postCounts = await this.getCounts();
    expect(postCounts.played).toEqual(0);
  });

  it("only works for the streamer", async function() {
    const bot = this.buildBotInstance({ config: {httpPort: 8080 }});
    await this.addLevels(bot, 2);

    await bot.command("!skip", "viewer");

    const queue = await this.getSimpleQueue();
    expect(queue.map(e => e.id)).toEqual(["valid01", "valid02"]);
  });
});
