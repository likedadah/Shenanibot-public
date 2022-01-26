const os = require('os');

module.exports = {
  config: {
    priority: 'fifo',
    levelLimitType: 'none',
    levelLimit: 0,
    creatorCodeMode: 'manual',
    players: 1,
    prefix: '!',
    persistence: {
      enabled: false,
      path: os.homedir(),
      interactions: false
    },
    chatThrottle: {
      limit: 20,
      delay: 1500
    }
  }
}
