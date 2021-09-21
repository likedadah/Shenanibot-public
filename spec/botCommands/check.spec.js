const itChecksALevel = require("../checkLevel.template-spec");

describe("the !check command", () => {
  itChecksALevel((bot, user, id) => bot.command(`!check ${id}`, user));
});
