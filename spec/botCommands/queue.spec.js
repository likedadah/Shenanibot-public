describe("the !queue command", () => {
  it("tells you when there are no entries", async function() {
    const bot = this.buildBotInstance();

    const response = await bot.command("!queue", "viewer");
    expect(response).toEqual("Total entries: 0");
  });

  it("tells you what is currently being played", async function() {
    const bot = this.buildBotInstance();
    await bot.command("!add valid01", "viewer");

    const response = await bot.command("!queue", "viewer");
    expect(response).toEqual("Total entries: 1; Now Playing: Valid Level 01 (valid01)");
  });

  it("lists additional entries in the queue", async function() {
    const bot = this.buildBotInstance();
    await bot.command("!add valid01", "viewer");
    await bot.command("!mark testing", "streamer");
    await bot.command("!add emp001", "viewer");

    const response = await bot.command("!queue", "viewer");
    expect(response).toEqual("Total entries: 3; Now Playing: Valid Level 01 (valid01) Next 2: [[== testing ==]] [EmployEE 001's Profile (@emp001)]");
  });

  it("lists up to 10 total entries", async function() {
    const bot = this.buildBotInstance();
    await bot.command("!add valid01", "viewer");
    await bot.command("!mark testing", "streamer");
    await bot.command("!add emp001", "viewer");
    await bot.command("!add valid02", "viewer");
    await bot.command("!add valid03", "viewer");
    await bot.command("!add valid04", "viewer");
    await bot.command("!add valid05", "viewer");
    await bot.command("!add valid06", "viewer");
    await bot.command("!add valid07", "viewer");
    await bot.command("!add valid08", "viewer");
    await bot.command("!add valid09", "viewer");

    const response = await bot.command("!queue", "viewer");
    expect(response).toEqual("Total entries: 11; Now Playing: Valid Level 01 (valid01) Next 9: [[== testing ==]] [EmployEE 001's Profile (@emp001)] [Valid Level 02 (valid02)] [Valid Level 03 (valid03)] [Valid Level 04 (valid04)] [Valid Level 05 (valid05)] [Valid Level 06 (valid06)] [Valid Level 07 (valid07)] [Valid Level 08 (valid08)]");
  });

  it("indicates the rounds of upcoming levels", async function() {
    const bot = this.buildBotInstance({config: {priority: "rotation"}});
    await bot.command("!add valid01", "viewer1");
    await bot.command("!add valid02", "viewer2");
    await bot.command("!add valid03", "viewer3");
    await bot.command("!add valid04", "viewer1");
    await bot.command("!add valid05", "viewer2");
    await bot.command("!add valid06", "viewer1");

    const response = await bot.command("!queue", "viewer");
    expect(response).toEqual("Total entries: 6; Now Playing: Valid Level 01 (valid01) Next 5: **Round 1 (2 entries)** : [Valid Level 02 (valid02)] [Valid Level 03 (valid03)] **Round 2 (2 entries)** : [Valid Level 04 (valid04)] [Valid Level 05 (valid05)] **Round 3 (1 entry)** : [Valid Level 06 (valid06)]");
  });
});
