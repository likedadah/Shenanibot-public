module.exports = {
  config: {
    priority: 'fifo',
    levelLimitType: 'none',
    levelLimit: 0,
    creatorCodeMode: 'manual',
    prefix: '!',
    chatThrottle: {
      limit: 20,
      delay: 1500
    }
  }
}
