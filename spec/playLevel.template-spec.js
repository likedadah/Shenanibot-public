// This template generates tests for behaviors to be applied when a level
// reaches the top of the queue (the "now playing" position).

// Params:
// - n : a position in the queue
// - cb(bot, username, newId, oldId) : a callback that accepts a bot instance
//   as its 1st parameter, a username as its 2nd parameter, and ids as its
//   3rd and 4th parameters.  The callback should trigger the bot command or
//   function being tested, whose expected behavior depends on the queue
//   position identified by n:
//   - if n === 1, then the bot passed to cb() will have an empty queue, and
//     the command/function triggered by cb() should add a level to fill
//     position 1 in the queue.  The level ID and submitter should match the
//     oldId and username passed to cb().  (oldId should be ignored)
//   - If n > 1, then the queue will be pre-populated; the "now playing"
//     level's id will match oldId, the level at position n will match newId,
//     and it will be the only level submitted by the username passed to
//     cb().  The command/function triggered by cb() should move the level
//     from the nth position in the queue to the "now playing" position.
//     (The now playing position itself is postiion 1.)
// - options : an object which may include the following values:
//   - botConfig : an ojbect that will be merged into the config for each
//     test's bot.  This allows for callbacks that only play a level with
//     those settings.  However, note that some test scenarios require
//     specific options; so if a callback needs to set any of the following,
//     it may be unable to use this template:
//     - creatorCodeMode
//     - httpPort (to anything other than 8080)
//     (default is {})
//   - supportsCreatorCode (default true) : a boolean indicating whether
//     the bot command or function being tested works to start playing a
//     creator code.  If false, omits any test that would pass a creator
//     code as newId

const fp = require("lodash/fp");

module.exports = itPlaysALevel = (n, cb, {
  botConfig = {},
  supportsCreatorCode = true
} = {}) => {
  let buildBot;

  beforeAll(function() {
    buildBot = async (opts = {}) =>
                    this.buildBotInstance(fp.merge(opts, {config: botConfig}));
  });

  describe("changes the 'now playing' entry, so", () => {
    describe("if the new 'now playing' entry is a level, it", () => {
      it("bookmarks the level", async function() {
        const bot = await buildBot();
        if (n > 1) {
          await this.addLevels(bot, n - 1);
          await bot.command("!add valid00", "viewer0");
          await this.addLevels(bot, 2, n);
        }

        await cb(bot, "viewer0", "valid00", "valid01");

        expect(this.bookmarks).toContain("valid00");
      });

      it("does not crash if bookmarking fails", async function() {
        this.MockRumpusCE.setAddBookmarkFailure(-1);

        const bot = await buildBot();
        if (n > 1) {
          await this.addLevels(bot, n - 1);
          await bot.command("!add valid00", "viewer0");
          await this.addLevels(bot, 2, n);
        }

        this.resetChat();
        await cb(bot, "viewer0", "valid00", "valid01");

        expect(this.getChat().join("")).toContain("Unable to create bookmark");
      });

      it("retries bookmarking (3 total attempts)", async function() {
        this.MockRumpusCE.setAddBookmarkFailure(2);

        const bot = await buildBot();
        if (n > 1) {
          await this.addLevels(bot, n - 1);
          await bot.command("!add valid00", "viewer0");
          await this.addLevels(bot, 2, n);
        }

        await cb(bot, "viewer0", "valid00", "valid01");

        expect(this.bookmarks).toContain("valid00");
      });

      it("updates the creator code cache", async function() {
        const bot = await buildBot({config: {
          httpPort: 8080,
          creatorCodeMode: "webui"
        }});
        await bot.command("!add emp001", "viewer");
        await bot.command("!next", "streamer");
        if (n > 1) {
          await this.addLevels(bot, n - 1);
          await bot.command("!add 001l001", "viewer0");
          await this.addLevels(bot, 2, n);
        }

        await cb(bot, "viewer0", "001l001", "valid01");

        await bot.command("!add emp001", "viewer");
        await bot.command("!play last from viewer", "streamer");
        const creatorInfo = await this.getCreatorInfo();
        expect(creatorInfo.levels[0].played).toBeTruthy();
      });
    });

    if (supportsCreatorCode) {
      describe("if the new 'now playing' entry is a creator code, it", () => {
        it("updates the clipboard if configured to do so", async function() {
          const bot = await buildBot({config: {
            creatorCodeMode: "clipboard"
          }});
          if (n > 1) {
            await this.addLevels(bot, n - 1);
            await bot.command("!add emp002", "viewer0");
            await bot.command("!add emp003", "viewer");
          }

          await cb(bot, "viewer0", "emp002", "valid01");

          expect(this.clipboard.content).toEqual("emp002");
        });

        describe("when configured to choose randomly", () => {
          it("picks a level", async function() {
            let bot;
            let queue;
            let lastUsed = 0;
            let oldId = undefined;
            const setup = async () => {
              bot = await buildBot({config: {
                creatorCodeMode: "auto",
                httpPort: 8080
              }});
              await bot.command("!clear", "streamer");
              if (n > 1) {
                await this.addLevels(bot, n - 1, lastUsed + 1);
                oldId = `valid${lastUsed < 9 ? "0" : ""}${lastUsed + 1}`;
                lastUsed += n;
                await bot.command("!add emp010", "viewer0");
                await bot.command("!add emp003", "viewer");
              }
            };

            await setup();
            this.setRandomizerToMax();
            await cb(bot, "viewer0", "emp010", oldId);

            queue = await this.getQueue();
            expect(queue[0].entry.id).toEqual("010l010");

            await setup();
            this.setRandomizerToMin();
            await cb(bot, "viewer0", "emp010", oldId);

            queue = await this.getQueue();
            expect(queue[0].entry.id).toEqual("010l001");
          });

          it("prefers unplayed levels", async function() {
            await this.withMockTime(async () => {
              let bot;
              let queue;
              let oldId = undefined;
              let lastUsed = 0;
              const setup = async () => {
                bot = await buildBot({config: {
                  creatorCodeMode: "auto",
                  httpPort: 8080
                }});
                await bot.command("!clear", "streamer");

                // not easy with the mocks to control which levels are played,
                // so we'll populate the cache and update played status there
                this.setRandomizerToMin();
                await bot.command("!add emp010", "viewer");  // will play 001
                await bot.command("!add 010l002", "viewer");
                await bot.command("!add 010l004", "viewer");
                await bot.command("!add 010l005", "viewer");
                await bot.command("!add 010l006", "viewer");
                await bot.command("!add 010l008", "viewer");
                await bot.command("!add 010l009", "viewer");
                await bot.command("!add 010l010", "viewer");
                for(let i = 0; i < 8; i++) {
                  await bot.command("!next", "streamer");
                }
                if (n > 1) {
                  await this.addLevels(bot, n - 1, lastUsed + 1);
                  oldId = `valid${lastUsed < 9 ? "0" : ""}${lastUsed + 1}`;
                  lastUsed += n;
                  await bot.command("!add emp010", "viewer0");
                  await bot.command("!add emp003", "viewer");
                }
              };

              await setup();
              this.setRandomizerToMax();
              await cb(bot, "viewer0", "emp010", oldId);
              jasmine.clock().tick(0);

              queue = await this.getQueue();
              expect(queue[0].entry.id).toEqual("010l007");

              await setup();
              this.setRandomizerToMin();
              await cb(bot, "viewer0", "emp010", oldId);
              jasmine.clock().tick(0);

              queue = await this.getQueue();
              expect(queue[0].entry.id).toEqual("010l003");
            });
          });

          it("will not choose a banned level", async function() {
            let bot;
            let queue;
            let oldId = undefined;
            let lastUsed = 0;
            const setup = async () => {
              bot = await buildBot({config: {
                persistence: {enabled: true},
                creatorCodeMode: "auto",
                httpPort: 8080
              }});
              await bot.command("!clear", "streamer");
              if (n > 1) {
                await this.addLevels(bot, n - 1, lastUsed + 1);
                oldId = `valid${lastUsed < 9 ? "0" : ""}${lastUsed + 1}`;
                lastUsed += n;
                await bot.command("!add emp001", "viewer0");
                await bot.command("!add emp003", "viewer");
              }
            };

            await setup();
            await bot.command("!nope 001l001", "streamer");
            await cb(bot, "viewer0", "emp001", oldId); // right after banning

            queue = await this.getQueue();
            expect(queue[0].entry.id).toEqual("emp001");

            await setup();
            await cb(bot, "viewer0", "emp001", oldId); // in a future session

            queue = await this.getQueue();
            expect(queue[0].entry.id).toEqual("emp001");
          });

          it(  "prints the 'picking a level' message before the 'now playing'"
             + "message, even if level info is cached",
             async function() {
            const bot = await buildBot({config: {
              creatorCodeMode: "auto",
              httpPort: 8080
            }});
            const ws = await this.openWebSocket('overlay/levels');

            await bot.command("!add emp010", "viewer0");
            await bot.command("!next", "streamer");
            await this.waitForWsMessages(ws, 3);

            if (n > 1) {
              await this.addLevels(bot, n - 1);
              await bot.command("!add emp010", "viewer0");
              await bot.command("!add emp003", "viewer");
              await this.waitForWsMessages(ws, n + 1);
            }

            this.resetChat();
            await cb(bot, "viewer0", "emp010", "valid01");
            await this.waitForWsMessages(ws, 2);

            const chat = this.getChat();
            const pickingIndex = chat.findIndex(m => m.includes(
                      "Picking a level from EmployEE 010's Profile"));
            const playingIndex = chat.findIndex(m => m.includes(
                      "Now playing Employee 010 Level"));

            if (pickingIndex === -1) {
              fail("Did not receive 'picking a level' message");
            }
            if (playingIndex === -1) {
              fail("Did not receive 'now playing' message");
            }
            expect(playingIndex).toBeGreaterThan(pickingIndex);

            this.closeWebSocket(ws);
          });

          it("warns if it can't load level data", async function() {
            let bot = await buildBot({config: {
              creatorCodeMode: "auto"
            }});
            await bot.command("!clear", "streamer");
            if (n > 1) {
              await this.addLevels(bot, n - 1);
              await bot.command("!add emp010", "viewer0");
            }

            this.MockRumpusCE.setSearchLevelsFailure(-1);
            this.resetChat();
            await cb(bot, "viewer0", "emp010", "valid01");

            expect(this.getChat().join('')).toContain(
                                                 "Unable to load level data");
          });

          it("retries loading level data (3 total tries)", async function() {
            let bot = await buildBot({config: {
              creatorCodeMode: "auto",
              httpPort: 8080
            }});
            await bot.command("!clear", "streamer");
            if (n > 1) {
              await this.addLevels(bot, n - 1);
              await bot.command("!add emp010", "viewer0");
            }

            this.MockRumpusCE.setSearchLevelsFailure(2);
            this.setRandomizerToMax();
            await cb(bot, "viewer0", "emp010", "valid01");

            queue = await this.getQueue();
            expect(queue[0].entry.id).toEqual("010l010");
          });
        });

        describe("when configured to use the web UI", () => {
          it("sends a websocket update", async function() {
            const bot = await buildBot({config: {
              httpPort: 8080,
              creatorCodeMode: "webui"
            }});
            if (n > 1) {
              await this.addLevels(bot, n - 1);
              await bot.command("!add emp002", "viewer0");
              await bot.command("!add emp003", "viewer");
            }

            await cb(bot, "viewer0", "emp002", "valid01");

            const creatorInfo = await this.getCreatorInfo();
            expect(creatorInfo.creatorId).toEqual("emp002");
            expect(creatorInfo.name).toEqual("EmployEE 002");
            expect(creatorInfo.levels.map(l => l.id))
                                              .toEqual(["002l001", "002l002"]);
          });

          it("takes time to load all the level data for a new creator code",
             async function() {
            await this.withMockTime(async () => {
              const bot = await buildBot({config: {
                httpPort: 8080,
                creatorCodeMode: "webui"
              }});
              if (n > 1) {
                await this.addLevels(bot, n - 1);
                await bot.command("!add emp200", "viewer0");
                await bot.command("!add emp003", "viewer");
              }

              await cb(bot, "viewer0", "emp200", "valid01");

              let creatorInfo = await this.getCreatorInfo();
              expect(creatorInfo.levels.length).toBe(128);

              jasmine.clock().tick(1000);

              creatorInfo = await this.getCreatorInfo();
              expect(creatorInfo.levels.length).toBe(200);
            });
          });

          it("caches the level data for a creator code", async function() {
            await this.withMockTime(async () => {
              let id = 1;
              const buildQueue = async () => {
                if (n > 1) {
                  await bot.command(`!add valid0${id}`, "viewer");
                  for (let i = 2; i < n; i++) {
                    await bot.command("!add emp001", "viewer");
                  }
                  await bot.command("!add emp200", "viewer0");
                  await bot.command("!add emp003", "viewer");
                }
              }

              const bot = await buildBot({config: {
                httpPort: 8080,
                creatorCodeMode: "webui"
              }});
              await buildQueue();
              await cb(bot, "viewer0", "emp200", `valid0${id}`);
              jasmine.clock().tick(1000);
              const queue = await this.getSimpleQueue();
              for (const entry of queue) {
                await bot.command("!next", "streamer");
              }

              id += 1;
              await buildQueue();
              await cb(bot, "viewer0", "emp200", `valid0${id}`);

              creatorInfo = await this.getCreatorInfo();
              expect(creatorInfo.levels.length).toBe(200);
            });
          });

          it("warns if it can't load level data", async function() {
            const bot = await buildBot({config: {
              creatorCodeMode: "webui",
              httpPort: 8080
            }});
            if (n > 1) {
              await this.addLevels(bot, n - 1);
              await bot.command("!add emp002", "viewer0");
              await bot.command("!add emp003", "viewer");
            }

            this.MockRumpusCE.setSearchLevelsFailure(-1);
            this.resetChat();
            await cb(bot, "viewer0", "emp002", "valid01");

            expect(this.getChat().join('')).toContain(
                                                 "Unable to load level data");
          });

          it("retries loading level data (3 total tries)", async function() {
            let bot = await buildBot({config: {
              creatorCodeMode: "auto",
              httpPort: 8080
            }});
            await bot.command("!clear", "streamer");
            if (n > 1) {
              await this.addLevels(bot, n - 1);
              await bot.command("!add emp010", "viewer0");
            }

            this.MockRumpusCE.setSearchLevelsFailure(2);
            this.setRandomizerToMax();
            await cb(bot, "viewer0", "emp010", "valid01");

            queue = await this.getQueue();
            expect(queue[0].entry.id).toEqual("010l010");
          });
        });
      });
    }
  });
};
