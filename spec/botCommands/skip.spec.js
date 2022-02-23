const itSkips = require("../skip.template-spec");
const itDequeues = require("../dequeue.template-spec");
const itPlaysALevel = require("../playLevel.template-spec");
const itUsesDefaultAdvance = require("../defaultAdvance.template-spec");
const itPicksALevel = require("../pickLevel.template-spec");

describe("the !skip command", () => {
  const cb = async bot => await bot.command("!skip", "streamer");
  itSkips(cb);
  itDequeues(cb, {incrementPlayed: false});
  itPlaysALevel(2, cb);
  itUsesDefaultAdvance(cb);
  itPicksALevel("!skip and play", { incrementPlayed: false });

  it("only works for the streamer", async function() {
    const bot = await this.buildBotInstance({ config: {httpPort: 8080 }});
    await this.addLevels(bot, 2);

    await bot.command("!skip", "viewer");

    const queue = await this.getSimpleQueue();
    expect(queue.map(e => e.id)).toEqual(["valid01", "valid02"]);
  });
});
