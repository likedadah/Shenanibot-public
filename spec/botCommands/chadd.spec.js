const itChecksALevel = require("../checkLevel.template-spec");
const itAddsALevel = require("../addLevel.template-spec");
const itPlaysALevel = require("../playLevel.template-spec");

describe("the !chadd command", () => {
  const cb = (bot, user, id) => bot.command(`!chadd ${id}`, user);

  itChecksALevel(cb);
  itAddsALevel(cb);
  itPlaysALevel(1, cb, false);

  it("should not add a level that has already been beaten", async function() {
    const bot = await this.buildBotInstance();

    const response = await bot.command("!chadd beaten1", "viewer");

    expect(this.bookmarks).toEqual([]);
  });

  it("should not add a level that has already been played", async function() {
    const bot = await this.buildBotInstance();

    const response = await bot.command("!chadd played1", "viewer");

    expect(this.bookmarks).toEqual([]);
  });

  it("should not warn twice for a level that requires too many players",
     async function() {
    const bot = await this.buildBotInstance();

    const response = await bot.command("!chadd 2plevel", "viewer");
    expect(response.split("2-player").length).toEqual(2);
  });
});
