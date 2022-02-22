// This template generates tests for the behaviors associated with closing
// the queue

// Params:
// - cb(bot) : a callback which accepts a bot instance.  The callback should
//   trigger the bot command or function being tested in such a way that it
//   will close the queue.
// - options : an object that may include the following values:
//   - botConfig : an object that will be merged into the config for each
//     test's bot.  This allows for callbacks that only close the queue with
//     those settings.  However, some test cases require specific settings;
//     if the callback needs to set any of the following, it may be unable to
//     use this tempalte:
//     - httpPort (to anything other than 8080)

const fp = require("lodash/fp");

module.exports = itClosesTheQueue = (cb, {botConfig = {}} = {}) => {
  describe("closes the queue; so it", () => {
    let buildBot;
    beforeAll(function() {
      buildBot = async (opts = {}) =>
                  this.buildBotInstance( fp.merge(opts, {config: botConfig}) );
    });

    it("prevents !add commands", async function() {
      const bot = await buildBot();

      await cb(bot);

      await bot.command("!add valid01", "viewer");
      expect(this.bookmarks).toEqual([]);
    });

    it("sends status to the overlay module", async function() {
      const bot = await buildBot({config: {httpPort: 8080}});
      const statusToken = await this.openWebSocket("overlay/status");

      const statusMsg = (await Promise.all([
        cb(bot),
        this.waitForNextWsMessage(statusToken)
      ]))[1];

      expect(statusMsg.status).toEqual("closed");
    });
  });
};
