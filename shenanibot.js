#!/usr/bin/env node

if (['-c', '--config'].includes(process.argv[2]) ) {
  require('./src/config')
} else {
  require('./src/platforms/twitch')
}
