#!/usr/bin/env node

const pb = require('@madelsberger/pausebuffer');
const TMI = require('tmi.js');

const ShenaniBot = require('../../bot/index');
const configLoader = require('../../config/loader');

const params = configLoader.load();

process.on('SIGINT', function() {
  process.exit(1);
});

function connectAs(username, password) {
  const options = {
    connection: {
      reconnect: true
    },
    identity: {username, password},
    channels: [params.auth.channel]
  };

  const client = pb.wrap(TMI.Client(options));
  client.setMessageCountLimit(params.config.chatThrottle.limit);
  client.setThrottle({
    high: params.config.chatThrottle.delay,
    low: params.config.chatThrottle.delay
  });

  client.connect();
  return client;
}

(async function main() {
  const botClient = connectAs(params.auth.botUsername, params.auth.oauthToken);
  const dmClient = params.auth.streamerToken
                 ? connectAs(params.auth.streamer, params.auth.streamerToken)
                 : botClient;
  const shenanibot = new ShenaniBot(params,
                                    m => botClient.say(params.auth.channel, m),
                                    (u, m) => dmClient.whisper(u, m),
                                    u => dmClient.canWhisperTo(u));
  console.log('Don\'t worry if it says \'Error: No response from twitch\', it should still work!');
  
  botClient.on('connected', (address, port) => {
    botClient.action(params.auth.channel, 'ShenaniBot Connected!');
  });

  botClient.on('chat', async (channel, context, message, self) => {
    if (self) return;

    (async function command() {
      let response = await shenanibot.command(message,
              context.username, context['custom-reward-id']);
      for (const message of response.split('\n')) {
        botClient.say(params.auth.channel, message);
      }
    })();
  });
})();
