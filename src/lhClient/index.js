const Rumpus = require("@bscotch/rumpus-ce");

const wrap = (fn, log) => async (...args) => {
  let retry = 0;

  while( retry < 3 ) {
    try {
      return await fn(...args);
    } catch(e) {
      retry++;
      const severity = (retry < 3) ? 'WARNING' : 'ERROR';
      log(`${severity}: Rumpus call failed (attempt ${retry}) - ${e}`);
      if (retry < 3) {
        await new Promise(r => setTimeout(r, LHClient.baseDelay * retry));
      }
    }
  }
};

class LHClient {
  constructor(token, log) {
    const rce = new Rumpus.RumpusCE(token);

    this.addBookmark = wrap(rce.levelhead.bookmarks.add, log);
  }

  static baseDelay = 500;
}

module.exports = { LHClient };
