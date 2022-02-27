const itRemovesALevel = require("../remove.template-spec");

describe("the !remove command", () => {
  itRemovesALevel((bot, id, username) =>
                                     bot.command(`!remove ${id}`, username));

  it("won't remove the 'now playing' level", async function() {
    const bot = await this.buildBotInstance();
    await bot.command("!add valid01", "viewer");

    await bot.command("!remove valid01", "viewer");

    expect(this.bookmarks).toEqual(["valid01"]);
  });

  it("won't let one viewer remove another viewer's level", async function() {
    const bot = await this.buildBotInstance();
    await bot.command("!add valid01", "viewer");
    await bot.command("!add valid02", "viewer");

    await bot.command("!remove valid02", "viewer2");

    await bot.command("!next", "streamer");
    expect(this.bookmarks).toEqual(["valid02"]);
  });

  it("allows the streamer to remove any level", async function() {
    const bot = await this.buildBotInstance();
    await bot.command("!add valid01", "viewer");
    await bot.command("!add valid02", "viewer");

    await bot.command("!remove valid02", "streamer");

    await bot.command("!next", "streamer");
    expect(this.bookmarks).toEqual([]);
  });
});
