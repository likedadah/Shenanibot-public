describe("the !nospoil command", () => {
  it("puts the user in the 'nospoil' list", async function() {
    const bot = this.buildBotInstance();

    await bot.command("!add valid01", "viewer2")
    const response = await bot.command("!nospoil", "viewer");
    expect(response).toEqual(
         "@viewer, I'll send a direct message when the current level is done");

    expect(this.getDmsFor("viewer")).toEqual([]);
    bot.command("!next", "streamer");
    expect(this.getDmsFor('viewer')).toEqual([
                    'streamer has finished playing Valid Level 01 (valid01)']);
  });

  it("gives an error if the queue is empty", async function() {
    const bot = this.buildBotInstance();

    const response = await bot.command("!nospoil", "viewer");
    expect(response).toEqual("There is no current level!");
  });

  it("gives an error if a marker is first in the queue", async function() {
    const bot = this.buildBotInstance();

    await bot.command("!mark", "streamer");
    const response = await bot.command("!nospoil", "viewer");
    expect(response).toEqual("There is no current level!");
  });

  it("gives an error if the whisper won't be sendable", async function() {
    const bot = this.buildBotInstance();

    await bot.command("!add valid01", "viewer2")
    const response = await bot.command("!nospoil", "nodm");
    expect(response).toEqual(
                      "I won't be able to send you a direct message, @nodm.");
  });
});
