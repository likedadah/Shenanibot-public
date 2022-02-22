const itClearsTheQueue = require("../clear.template-spec");

describe("the !clear command", () => {
  itClearsTheQueue(async bot => bot.command("!clear", "streamer"));

  it("allows the removed levels to be added again", async function() {
    const bot = await this.buildBotInstance({config: {httpPort: 8080}});

    await this.addLevels(bot, 3);
    await bot.command("!clear", "streamer");
    await this.addLevels(bot, 3);

    expect(await this.getSimpleQueue()).toEqual([
      {type: "level", id: "valid01" },
      {type: "level", id: "valid02" },
      {type: "level", id: "valid03" }
    ]);
  });

  it("only works for the streamer", async function() {
    const bot = await this.buildBotInstance({config: {httpPort: 8080}});

    await this.addLevels(bot, 3);
    await bot.command("!mark", "streamer");
    await bot.command("!add emp001", "viewer");

    await bot.command("!clear", "viewer");

    expect(await this.getSimpleQueue()).toEqual([
      { type: 'level',   id: 'valid01' },
      { type: 'level',   id: 'valid02' },
      { type: 'level',   id: 'valid03' },
      { type: 'mark',    id: undefined },
      { type: 'creator', id: 'emp001'  }
    ]);
  });
});
