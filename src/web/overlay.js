const httpServer = require("./server");

const statusUrl = '/overlay/status';
const levelsUrl = '/overlay/levels';
const countsUrl = '/overlay/counts';

const state = {
  prefix: "",
  acceptCreatorCode: false,
  status: "",

  levels: "",

  counts: ""
};

const setStatus = open => {
  state.status = (JSON.stringify({
    status: open ? "open" : "closed",
    command: `${state.prefix}add`,
    acceptCreatorCode: state.acceptCreatorCode
  }));
};

const setLevels = queue => {
  state.levels = JSON.stringify(queue.map(e => ({
    type: e.type,
    entry: e
  })));
};

const setCounts = counts => {
  state.counts = JSON.stringify(counts);
};

module.exports = {
  init: () => {
    const config = httpServer.getConfig();
    if (config.overlayPath) {
      httpServer.addStaticPath('/overlay/usr', config.overlayPath)
    }
    state.prefix = config.prefix;
    state.acceptCreatorCode = config.creatorCodeMode !== 'reject';
    setStatus(true);
    setLevels([]);
    setCounts({});

    console.log(`Go to http://localhost:${config.httpPort}/overlay/ for overlay setup instructions`);

    httpServer.register(levelsUrl, ws => {
      ws.send(state.levels);
    });
    httpServer.register(statusUrl, ws => {
      ws.send(state.status);
    });
    httpServer.register(countsUrl, ws => {
      ws.send(state.counts);
    });
  },

  sendStatus: open => {
    setStatus(open);
    httpServer.broadcast(statusUrl, state.status);
  },

  sendLevels: queue => {
    setLevels(queue);
    httpServer.broadcast(levelsUrl, state.levels);
  },

  sendCounts: counts => {
    setCounts(counts);
    httpServer.broadcast(countsUrl, state.counts);
  }
};
