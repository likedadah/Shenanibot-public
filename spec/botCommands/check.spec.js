const itChecksALevel = require("../checkLevel.template-spec");

describe("the !check command", () => {
  itChecksALevel((bot, user, id) => bot.command(`!check ${id}`, user));

  it("responds to unknown creator id", async function() {
    const bot = this.buildBotInstance();
    const response = await bot.command("!check unk001", "viewer");

    expect(response).toEqual("Oops! That creator does not exist!");
  });

  it("responds to creator id with no levels", async function() {
    const bot = this.buildBotInstance();
    await bot.command("!check emp000", "viewer");

    expect(this.getChat().join("\t")).toContain("Unable to find levels for EmployEE 000's Profile");
  });

  it("finds the most recent unplayed level for a creator", async function() {
    const checkChat = id => {
      const chat = this.getChat().join("\t");
      expect(chat).toContain("recent unplayed level");
      expect(chat).toContain(id);
    };

    jasmine.clock().install();
    const bot = this.buildBotInstance();

    await bot.command("!check emp010", "viewer");
    jasmine.clock().tick(0);
    checkChat("010l001");

    await bot.command("!add 010l001", "viewer1");
    await bot.command("!add 010l003", "viewer2");
    await bot.command("!next", "streamer");
    await bot.command("!next", "streamer");

    this.resetChat();
    await bot.command("!check emp010", "viewer");
    jasmine.clock().tick(0);
    checkChat("010l002");

    await bot.command("!add 010l002", "viewer3");
    await bot.command("!next", "streamer");

    this.resetChat();
    await bot.command("!check emp010", "viewer");
    jasmine.clock().tick(0);
    checkChat("010l004");

    jasmine.clock().uninstall();
  });

  it("finds the most recent unbeaten level if all have been played",
     async function() {
    const checkChat = id => {
      const chat = this.getChat().join("\t");
      expect(chat).toContain("recent unbeaten level");
      expect(chat).toContain(id);
    };

    jasmine.clock().install();
    const bot = this.buildBotInstance();

    for (let i = 9; i > 0; i--) {
      await bot.command(`!add 009l00${i}`, `viewer${i}`);
      await bot.command("!next", "streamer");
    }

    await bot.command("!check emp009", "viewer");
    jasmine.clock().tick(0);
    checkChat("009l001");

    await bot.command("!back", "streamer");
    await bot.command("!win", "streamer");

    this.resetChat();
    await bot.command("!check emp009", "viewer");
    jasmine.clock().tick(0);
    checkChat("009l002");

    jasmine.clock().uninstall();
  });

  it("responds if all levels have been beaten",
     async function() {
    jasmine.clock().install();
    const bot = this.buildBotInstance();

    for (let i = 1; i < 10; i++) {
      await bot.command(`!add 009l00${i}`, `viewer${i}`);
      await bot.command("!win", "streamer");
    }

    this.resetChat();
    await bot.command("!check emp009", "viewer");
    jasmine.clock().tick(0);
    expect(this.getChat().join('')).toEqual(
          "All levels from EmployEE 009's Profile (@emp009) have been beaten");

    jasmine.clock().uninstall();
  });
});
