const itClosesTheQueue = require("../close.template-spec");

describe("the !close command", () => {
  itClosesTheQueue(async bot => await bot.command("!close", "streamer"));

  it("responds in chat", async function() {
    const bot = await this.buildBotInstance();

    const response = await bot.command("!close", "streamer");
    expect(typeof response).toBe("string");
    expect(response).toContain("closed");
  });

  it("only works for the streamer", async function() {
    const bot = await this.buildBotInstance();

    const response = await bot.command("!close", "viewer");
    expect(response).toBeFalsy();
    await bot.command("!add valid01", "viewer");
    expect(this.bookmarks).toEqual(["valid01"]);
  });
});
