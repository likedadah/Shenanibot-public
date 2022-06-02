const Rumpus = require("@bscotch/rumpus-ce");

const bookmarks = [];
let addBookmarkFailure = 0;

const makeLevel = (_id, levelId, title, userId, requiredPlayers = 1) => {
  return {
    _id, levelId, title, userId, requiredPlayers,
    avatarUrl: () => "http://localhost/avatar.png",
    stats: {}
  };
};

class MockRumpusCE {
  constructor(_) {
    this.levelhead = {
      levels: {
        search: ({levelIds, userIds, includeMyInteractions,
                  limit, tiebreakerItemId}) => {
          const levels = [];
          if (levelIds) {
            if (typeof levelIds === 'string') {
              levelIds = [levelIds];
            }
            for (const levelId of levelIds.slice(0,5)) {
              const validLevelMatch = levelId.match(/^valid(\d\d)$/);
              if (validLevelMatch) {
                levels.push({
                  levelId: `valid${validLevelMatch[1]}`,
                  title: `Valid Level ${validLevelMatch[1]}`,
                  avatarUrl: () => ''
                });
                continue;
              }

              const eLvlMatch = levelId.match(/^(\d\d\d)l(\d\d\d)$/);
              if (eLvlMatch && eLvlMatch[1] >= eLvlMatch[2]) {
                levels.push({
                  levelId: `${eLvlMatch[1]}l${eLvlMatch[2]}`,
                  title: `Employee ${eLvlMatch[1]} Level ${eLvlMatch[2]}`,
                  avatarUrl: () => ''
                });
                continue;
              }

              const playedMatch = levelId.match(/^played(\d)$/);
              if (playedMatch) {
                const playedLevel = {
                  levelId: `played${playedMatch[1]}`,
                  title: `Played Level ${playedMatch[1]}`,
                  avatarUrl: () => ''
                };
                if (includeMyInteractions) {
                  playedLevel.interactions = {played: true};
                }
                levels.push(playedLevel);
                continue;
              }

              const beatenMatch = levelId.match(/^beaten(\d)$/);
              if (beatenMatch) {
                const beatenLevel = {
                  levelId: `beaten${beatenMatch[1]}`,
                  title: `Cleared Level ${beatenMatch[1]}`,
                  avatarUrl: () => ''
                };
                if (includeMyInteractions) {
                  beatenLevel.interactions = {played: true, completed: true};
                }
                levels.push(beatenLevel);
                continue;
              }

              const coopMatch = levelId.match(/^([1-4])plevel$/);
              if (coopMatch) {
                levels.push({
                  levelId: `${coopMatch[1]}plevel`,
                  title: `Co-oper's ${coopMatch[1]} Player Level`,
                  avatarUrl: () => '',
                  requiredPlayers: coopMatch[1]
                });
                continue;
              }
            }
            return levels;
          }

          const empMatch = userIds && userIds.match(/^emp(\d\d\d)$/);
          if (empMatch) {
            const min = (tiebreakerItemId || 0) + 1
            const max = Math.min(empMatch[1], min + limit - 1);
            for (let i = min; i <= max; i++) {
              const n = (i < 100 ? "0" : "") + (i < 10 ? "0" : "") + i;
              levels.push(makeLevel(i, `${empMatch[1]}l${n}`,
                                    `Employee ${empMatch[1]} Level ${n}`,
                                    userIds));
            }
            return levels;
          }

          if (userIds && userIds === 'cooper') {
            const min = (tiebreakerItemId || 0) + 1
            const max = Math.min(4, min + limit - 1);
            for (let i = min; i <= max; i++) {
              levels.push(makeLevel(i, `${i}plevel`,
                                    `Co-oper's ${i} Player Level`,
                                    userIds, i));
            }
            return levels;
          }

          return [];
        }
      },
      players: {
        search: ({userIds, includeAliases}) => {
          const creators = [];
          if (typeof userIds === 'string') {
            userIds = [userIds];
          }
          for (const userId of userIds.slice(0,5)) {
            const validCreatorMatch = userId.match(/^emp(\d\d\d)$/);
            if (validCreatorMatch) {
              creators.push({
                alias: new Promise(r => r({
                  userId,
                  alias: `EmployEE ${validCreatorMatch[1]}`
                }))
              });
              continue;
            }
            if (userId === 'cooper') {
              creators.push({
                alias: new Promise(r => r({
                  userId,
                  alias: 'Co-op Level Maker'
                }))
              });
              continue;
            }
          }
          return creators;
        }
      },
      bookmarks: {
        add: id => {
          if (addBookmarkFailure) {
            addBookmarkFailure -= 1;
            throw new Error("What if the API fails?");
          }
          bookmarks.push(id);
          return true;
        },
        remove: id => {
          bookmarks.splice(bookmarks.indexOf(id), 1);
        }
      }
    }
  }

  static setAddBookmarkFailure(times) {
    addBookmarkFailure = times;
  }
};

Rumpus.RumpusCE = MockRumpusCE;

beforeAll(function () {
  this.MockRumpusCE = MockRumpusCE;
  this.bookmarks = bookmarks;
});

beforeEach(() => {
  bookmarks.length = 0;
  addBookmarkFailure = 0;
});

