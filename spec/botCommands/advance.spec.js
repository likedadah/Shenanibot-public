const itDequeues = require("../dequeue.template-spec");
const itPlaysALevel = require("../playLevel.template-spec");
const itUsesDefaultAdvance = require("../defaultAdvance.template-spec");

describe("the !advance command", () => {
  const cb = async bot => await bot.command("!advance", "streamer");
  itDequeues(cb);
  itPlaysALevel(2, cb);
  itUsesDefaultAdvance(cb);

  it("updates the overlay", async function() {
    const bot = this.buildBotInstance({ config: {httpPort: 8080 }});
    await this.addLevels(bot, 2);
    const token = await this.openWebSocket("overlay/levels");

    const levelsMessage = (await Promise.all([
      bot.command("!advance", "streamer"),
      this.waitForNextWsMessage(token)
    ]))[1];
    expect(levelsMessage).toEqual([{
      type: "level",
      entry: {
        id: "valid02",
        name: "Valid Level 02",
        type: "level",
        submittedBy: "viewer02"
      }
    }]);
  });

  it("only works for the streamer", async function() {
    const bot = this.buildBotInstance({ config: {httpPort: 8080 }});
    await this.addLevels(bot, 2);

    await bot.command("!advance", "viewer");

    const queue = await this.getSimpleQueue();
    expect(queue.map(e => e.id)).toEqual(["valid01", "valid02"]);
  });
});
