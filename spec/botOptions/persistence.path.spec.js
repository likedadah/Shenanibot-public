const fs = require("fs");

describe("the persistence.path configuration option", () => {
  it("controls the location of shenanbot-data.txt", async function() {
    fs.mkdirSync("/myDir");

    const bot = await this.buildBotInstance({config: {persistence: {
      enabled: true,
      path: "/myDir",
      interactions: true
    }}});
    await bot.command("!add valid01", "viewer");

    expect(fs.existsSync("/myDir/shenanibot-data.txt")).toBeTruthy();
  });
});
