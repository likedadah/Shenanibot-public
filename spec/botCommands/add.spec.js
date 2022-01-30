const itAddsALevel = require("../addLevel.template-spec");
const itPlaysALevel = require("../playLevel.template-spec");

describe("the !add command", () => {
  const cb = (bot, user, id) => bot.command(`!add ${id}`, user);
  itAddsALevel(cb)
  itPlaysALevel(1, cb);

  it("adds a creator code to the queue", async function() {
    const bot = await this.buildBotInstance({config: { httpPort: 8080 }});

    await bot.command("!add emp001", "viewer");

    const queue = await this.getSimpleQueue();
    expect(queue).toEqual([{ type: "creator", id: "emp001" }]);
  });
});
