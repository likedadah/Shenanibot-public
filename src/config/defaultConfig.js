module.exports = {
  config: {
    priority: 'fifo',
    levelLimitType: 'none',
    levelLimit: 0,
    creatorCodeMode: 'manual',
    players: 1,
    prefix: '!',
    chatThrottle: {
      limit: 20,
      delay: 1500
    }
  }
}
