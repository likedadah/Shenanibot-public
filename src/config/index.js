#!/usr/bin/env node

const inquirer = require("inquirer")
const fp = require("lodash/fp");
const os = require("os");
const Rx = require("rxjs");
const configLoader = require("./loader");

let initialConfig = configLoader.load();
const answers = { config: fp.cloneDeep(initialConfig) };

function buildMenuQuestion(menuName, q) {
  const aPath = `menu.${menuName}`;
  return {
    name: aPath,
    type: 'list',
    default: a => fp.get(aPath, a) || 0,
    when: () => {
      console.log('');
      return true;
    },
    pageSize: 11,
    ...q,
    choices: a => q.choices(a).map(o => ({
      ...o,
      value: JSON.stringify(o.value)
    }))
  };
}

function buildMenuOptionName(basename, required) {
  return basename + (required ? ' [Input Required]' : '');
}

function buildConfigQuestion(aPath, q, longPrompt) {
  return {
    name: `config.${aPath}`,
    default: a => fp.get(`config.${aPath}`, a),
    ...q,
    when: longPrompt ? a => {
      if (!q.when || q.when(a)) {
        console.log(`\n${longPrompt}\n`);
        return true;
      }
      return false;
    } : q.when
  };
}

function validateTwitchUsername(username) {
  if (username.length < 4) {
    return "Minimum length is 4 characters";
  }
  if (username.length > 25) {
    return "Maximum length is 25 characters";
  }
  if (!username.match(/^\w*$/)) {
    return "Valid characters are letters, numbers, and _";
  }
  if (username[0] === "_") {
    return "First character cannot be _";
  }
  return true;
}

function oauthTokenInstructions(username) {
  return '- Browse to https://twitchapps.com/tmi/ using a browser that is not logged\n'
       + '  in to twitch (such as an incognito browser window.)\n'
       + '- Click the "Connect" button.\n'
       + '- You will be prompted to log in to twitch; make sure to log in as\n'
       + `  ${username}\n`
       + '- Copy the oauth token and enter it here.'
}

const questions = {
  mainMenu: buildMenuQuestion('main', {
    message: "Main Menu:",
    choices: a => {
      const dirty = !fp.isEqual(a.config, initialConfig);
      const twitchInfoRequired = !(a.config && a.config.auth && a.config.auth.channel && a.config.auth.streamer);
      const twitchAuthRequired = !(a.config && a.config.auth && a.config.auth.botUsername && a.config.auth.oauthToken);
      const rumpusAuthRequired = !(a.config && a.config.auth && a.config.auth.delegationToken);
      const configRequired = twitchInfoRequired || twitchAuthRequired || rumpusAuthRequired;

      return [{
        name: buildMenuOptionName('Twitch Streamer Info', twitchInfoRequired),
        value: {q: 'twitchInfo'}
      }, {
        name: buildMenuOptionName('Twitch Bot Authentication', twitchAuthRequired),
        value: {q: 'twitchAuth'}
      }, {
        name: buildMenuOptionName('Rumpus Authentication', rumpusAuthRequired),
        value: {q: 'rumpusAuth'}
      },
      new inquirer.Separator(), {
        name: 'Queue Management Options',
        value: {q: 'queueConfig'}
      }, {
        name: 'Chat Options',
        value: {q: 'chatConfig'}
      }, {
        name: 'Persistence Options',
        value: {q: 'persistenceConfig'}
      }, {
        name: 'Web Server Options',
        value: {q: 'webServerConfig'}
      },
      new inquirer.Separator(), {
        name: 'Save',
        value: {save: true},
        disabled: dirty ? false : 'no changes'
      }, {
        name: 'Exit',
        value: {
          exit: true,
          confirmExit: dirty ? 'Your unsaved changes will be discarded'
                     : configRequired ? 'Required information is missing'
                     : null
        }
      }];
    }
  }),

  twitchInfo: [
    buildConfigQuestion(
      'auth.channel', {
        message: "Twitch Channel Name:",
        validate: validateTwitchUsername,
        filter: i => i.toLowerCase()
      },
        'The bot needs to know your channel name so it can communicate with your\n'
      + 'chat. (This is the part of your twitch strema URL after the final /.).'
    ),
    buildConfigQuestion(
      'auth.streamer', {
        message: "Streamer Username:",
        validate: validateTwitchUsername,
        filter: i => i.toLowerCase(),
        default: a =>    fp.get('config.auth.streamer', a)
                      || fp.get('config.auth.channel', a)
      },
        'To make sure that only you can run streamer commands, the bot needs to know\n'
      + 'your twitch username. Normally this should be the same as your channel name.\n'
      + '(Twitch allows you to change the case of your username, but these values are\n'
      + 'case-insensitive to the bot.)\n'
      + '\n'
      + 'If in doubt, send a message in chat and copy the username that appears\n'
      + 'before your message.'
    ),
    buildConfigQuestion(
      'auth.streamerToken', {
        message: "Streamer Account OAuth Token:",
        filter: a => ((!a || a.slice(0,6) === 'oauth:') ? '' : 'oauth:') + a
      },
        'If you want the bot to send whispers from your account instaed of the bot\n'
      + `account, enter an OAuth token for ${answers.config.auth.streamer}.\n`
      + '\n'
      + '(You can leave this blank, in which case all messages will be sent using\n'
      + 'the bot account.  Due to safeguards twitch uses to prevent DM spam, whispers\n'
      + 'may be received more reliably if sent from your account, which viewers are\n'
      + 'watching and may be following.)\n'
      + '\n'
      + 'To create an OAuth token:\n'
      + '\n'
      + oauthTokenInstructions(answers.config.auth.streamer)
    )
  ],

  twitchAuth: [
    buildConfigQuestion(
      'auth.botUsername', {
        message: "Twitch Bot Username:",
        validate: validateTwitchUsername,
        filter: i => i.toLowerCase()
      },
        'The bot needs a twitch account to log into so that it can send and receive\n'
      + 'chat messages. If you have not already, you should create a second account\n'
      + 'specifically for bot use.'
    ),
    buildConfigQuestion(
      'auth.oauthToken', {
        message: "Twitch Bot OAuth Token:",
        filter: a => (a.slice(0,6) === 'oauth:' ? '' : 'oauth:') + a
      },
        'An OAuth token works like a password for the bot account.  To create an OAuth\n'
      + 'token:\n'
      + '\n'
      + oauthTokenInstructions(answers.config.auth.botUsername)
    )
  ],

  rumpusAuth: [
    buildConfigQuestion(
      'auth.delegationToken', {
        message: "Rumpus Delegation Token:"
      },
        'The bot needs a delegation key to interact with LevelHead online services\n'
      + 'through the Rumpus API (e.g. to bookmark queued levels so you won\'t have\n'
      + 'to type in level codes).\n'
      + '\n'
      + 'You can go to https://www.bscotch.net/account to create a delegation key;\n'
      + 'the key must have the following permissions:\n'
      + '\n'
      + '- View own and others\' Levelhead data (levels, profiles, aliases, etc)\n'
      + '- View, add, and delete own Levelhead level bookmarks'
    )
  ],

  queueConfig: [
    buildConfigQuestion(
      'config.players', {
        message: "Max Number of Players:",
        default: a => fp.get('config.config.players', a) || 1,
        // type: 'number' acts up when validation fails, so use this instead
        filter: i => typeof i === 'string' && i.match(/^\s*[1-4]\s*$/) ? parseInt(i, 10) : i,
        validate: i => (typeof i !== 'number') ? 'Please enter a valid number of players (1 - 4)' : true
      },
        'How many players can a level require and still be accepted into the queue?\n'
      + '(You can use the !players command to change this value during a session;\n'
      + 'it will revert to this default each time you restart the bot.)'
    ),
    buildConfigQuestion(
      'config.priority', {
        type: 'list',
        message: "Priority Mode:",
        choices: [{
          name: 'First In, First Out',
          value: 'fifo'
        }, {
          name: 'Player Rotation',
          value: 'rotation'
        }]
      },
        'The queue can operate in either of two priority modes: fifo or rotation.\n'
      + '\n'
      + '- In fifo (first in, first out) mode, levels enter the queue in the order\n'
      + '  received.\n'
      + '\n'
      + '- In rotation mode, levels are organized into "rounds", and a viewer\n'
      + '  generally gets one level per round. All levels from one round are played\n'
      + '  before any levels from a later round; so you can make sure all viewers get\n'
      + '  a turn without limiting how many levels a viewer can have in the queue.'
    ),
    buildConfigQuestion(
      'limitRoundDuration', {
        type: 'confirm',
        name: 'limitRoundDuration', // this is not stored in the config file
        message: 'Limit round duration?',
        default: a => fp.get('config.config.roundDuration', a) ? true : false,
        askAnswered: true,
        when: a => fp.get('config.config.priority', a) === 'rotation'
      },
        'Rotation mode can have the unintended consequence of making a viewer who\n'
      + 'arrives early wait indefinitely to see their 2nd submitted level, in the\n'
      + 'event that many viewers "trickle in" and submit levels.\n'
      + '\n'
      + 'To prevent such delays going on forever, you can limit how long a round will\n'
      + 'accept new levels.  For example, if you set a round duration of 30 minutes\n'
      + 'then once a level has been added to round 1, new viewers\' levels will only\n'
      + 'be added to round 1 for at most the next 30 minutes; after that, they will\n'
      + 'be added to round 2.\n'
      + '\n'
      + 'The timer for round R begins when two conditions are met:\n'
      + '\n'
      + '1) No level prior to R is accepting new levels\n'
      + '2) At least one level has been added to R\n'
      + '\n'
      + 'Note that regardless of this setting, a round is closed when the queue has\n'
      + 'advanced to a level from a subsequent round (but not if a level is pulled\n'
      + 'forward into the current round).'
    ),
    buildConfigQuestion(
      'config.roundDuration', {
        when: a => {
          if (a.config.config.priority === 'rotation') {
            if (a.limitRoundDuration) {
              return true;
            }
            a.config.config.roundDuration = 0;
          }
          return false;
        },
        message: 'Round Duration (in minutes):',
        default: a => fp.get('config.config.roundDuration', a) || 30,
        // type: 'number' acts up when validation fails, so use this instead
        filter: i => typeof i === 'string' && i.match(/^\s*[1-9]\d*\s*$/) ? parseInt(i, 10) : i,
        validate: i => (typeof i !== 'number') ? 'Please enter a number of minutes' : true
      }
    ),
    buildConfigQuestion(
      'config.levelLimitType', {
        type: 'list',
        message: "Level Submission Limit Type:",
        choices: [{
          name: 'Limit number of levels in the queue per player',
          value: 'active'
        }, {
          name: 'Limit total number of submissions per player',
          value: 'session'
        }, {
          name: 'Do not limit number of levels',
          value: 'none'
        }]
      },
        'You can limit the number of levels each viewer is allowed to submit. This\n'
      + 'limit can apply to the number of levels they have in the queue at one time,\n'
      + 'or it can apply to their total nubmer of submissions until you reset the\n'
      + 'bot.'
    ),
    buildConfigQuestion(
      'config.levelLimit', {
        when: a => {
          if (a.config.config.levelLimitType === 'none') {
            a.config.config.levelLimit = 0;
            return false;
          }
          return true;
        },
        message: 'Level Submission Limit:',
        default: a => fp.get('config.config.levelLimit', a) || 1,
        // type: 'number' acts up when validation fails, so use this instead
        filter: i => typeof i === 'string' && i.match(/^\s*[1-9]\d*\s*$/) ? parseInt(i, 10) : i,
        validate: i => (typeof i !== 'number') ? 'Please enter a number of levels' : true
      }
    ),
    buildConfigQuestion(
      'config.creatorCodeMode', {
        type: 'list',
        message: 'Creator Code Mode:',
        choices: a => [{
          name: 'Present a level selection UI',
          disabled: a.config.config.httpPort
                        ? false : 'Web Server must be enabled',
          value: 'webui'
        }, {
          name: 'Copy the creator code to the clipboard',
          value: 'clipboard'
        }, {
          name: 'Pick randomly; chooses an unplayed level if possible',
          value: 'auto'
        }, {
          name: 'Show the creator code in chat but take no further action',
          value: 'manual'
        }, {
          name: 'Do not allow creator codes to be submitted',
          value: 'reject'
        }]
      },
        'You can allow viewers to submit creator codes if they don\'t have a specific\n'
      + 'level they want to submit. The Creator Code Mode determines whether or not\n'
      + 'creator codes are accepted into the queue and, if so, how the bot behaves\n'
      + 'when a creator code reaches the top of the queue (since unlike level codes\n'
      + 'they cannot simply be bookmarked).'
    ),
    buildConfigQuestion(
      'config.defaultAdvance', {
        type: 'list',
        message: 'Default Advance Mode:',
        choices: [{
          name: 'Move to the next level in the queue (like !next)',
          value: 'next'
        }, {
          name: 'Choose randomly (subject to the same rules as !random)',
          value: 'random'
        }, {
          name: 'Alternate between working like !next and !random',
          value: 'alternate'
        }]
      },
       'Some commands (like !skip) advance the queue, but they do not specify how the\n'
     + 'new "now playing" level is to be chosen.  By default, they work like !next;\n'
     + 'but you can change the "default advance mode" to change this behavior.\n'
     + '\n'
     + 'Note that commands like !next and !random are not affected by the deafult\n'
     + 'advance mode, since they are defined to specify how the "now playing" level\n'
     + 'is chosen.  By contrast, commands like !skip are defined to modify how the\n'
     + 'level counts are updated; so rather than require more verbose syntax that\n'
     + 'specifies both the advance mode and the "now playing" selection method each\n'
     + 'time you advance the qeuue, commands like !skip rely on this setting.'
    ),
  ],

  chatConfig: [
    buildConfigQuestion(
      'config.prefix', {
        message: "Command Prefix:",
        validate: i => i.match(/\s/) ? 'The prefix cannot contain whitespace' : true
      },
        'A prefix is required on all bot commands - e.g. by default viewers type\n'
      + '"!add" to use the add command. This allows the bot to ignore any message\n'
      + 'that doesn\'t start with the prefix.\n'
      + '\n'
      + 'If possible, you are encouraged to use the default prefix of "!". (This will\n'
      + 'minimize confusion for viewers, who have to remember which prefix to use on\n'
      + 'which streams.)\n'
      + '\n'
      + 'However, you can change it to avoid conflicts with commands from other bots.\n'
      + 'Any string of non-whitespace characters will work, but typically a single\n'
      + 'punctuation character is used (such as $).'
    ),
    buildConfigQuestion(
      'config.chatThrottle.limit', {
        message: 'Chat Message Limit:',
        default: a => fp.get('config.config.chatThrottle.limit', a) || 20,
        // type: 'number' acts up when validation fails, so use this instead
        filter: i => typeof i === 'string' && i.match(/^\s*[1-9]\d*\s*$/) ? parseInt(i, 10) : i,
        validate: i => (typeof i !== 'number') ? 'Please enter a number of messages' : true
      },
        'Message throttling limits the rate at which the bot sends chat messages and\n'
      + 'direct messages.  This helps prevent the bot from accidentally triggering\n'
      + 'anti-spam measures.  For reference, Twitch message-rate limits may be found\n'
      + 'at https://dev.twitch.tv/docs/irc/guide#rate-limits\n'
      + '\n'
      + 'The throttle settings used by the bot may delay chat messages, but will not\n'
      + 'drop them entirely. Direct messages may be rejected (e.g. if the bot has\n'
      + 'messaged too many users) or may be delayed due to rate limits.\n'
      + '\n'
      + 'Note that ShenaniBot may be sharing your bot account with other scripts, in\n'
      + 'which case platform-imposed anti-spam measures apply to the total traffic\n'
      + 'from the bot account.  You may want to set conservative limits to allow for\n'
      + 'this.\n'
      + '\n'
      + 'The chat message limit controls how many messages may be sent in any\n'
      + '30-second period.'
    ),
    buildConfigQuestion(
      'config.chatThrottle.delay', {
        message: 'Chat Message Delay (ms):',
        default: a => {
          const oldVal = fp.get('config.config.chatThrottle.delay', a);
          return (typeof oldVal === 'number')? oldVal : 1500;
        },
        // type: 'number' acts up when validation fails, so use this instead
        filter: i => typeof i === 'string' && i.match(/^\s*\d+\s*$/) ? parseInt(i, 10) : i,
        validate: i => (typeof i !== 'number') ? 'Please enter a number of milliseconds' : true
      },
        'If two messages are sent too close together, the second message may not\n'
      + 'go through.  The chat message delay value sets a minimum time between the\n'
      + "bot's chat messages.  If the bot account is a moderator, this may not be\n"
      + 'necessary.'
    ),
  ],

  persistenceConfig: [
    buildConfigQuestion(
      'config.persistence.enabled', {
        type: 'confirm',
        message: 'Enable persistence?',
        askAnswered: true
      },
        'If you enable persistence, then you can configure certain types of data to\n'
      + 'be preserved between ShenaniBot sessions.  If you disable persistence, then\n'
      + 'data is not preserved between sessions; so e.g. all stats are reset to 0\n'
      + 'whenever you restart the bot.'
    ),
    buildConfigQuestion(
      'config.persistence.path', {
        message: 'Data Path:',
        when: a => {
          return a.config.config.persistence.enabled;
        },
        default: a =>    fp.get('config.config.persistence.path', a)
                      || os.homedir(),
        filter: p => p || os.homedir()
      },
        'The data you choose to preserve between sessions will be stored in a file\n'
      + '(named shenanibot-data.json); you can choose where this file will be stored.\n'
      + 'If you leave this blank, your home directory will be used.'
    ),
    buildConfigQuestion(
      'config.persistence.interactions', {
        type: 'confirm',
        message: 'Persist Interactions?',
        askAnswered: true
      },
        'Your "interactions" with a level (whether you have played and/or beaten it)\n'
      + 'may be used when a viewer submits a level or uses the !check command.  This\n'
      + 'data is usually provided by the API, but since the data from the API can be\n'
      + 'incomplete in some situations, ShenaniBot also infers interactions for\n'
      + 'levels as they move through the queue.  (As soon as a level reaches the\n'
      + '"now playing" position, it is treated as "played" unless/until you either\n'
      + '!skip it or !back it out of "now playing"; if you !win a level, it is then\n'
      + 'treated as "beaten".)\n'
      + '\n'
      + 'If you persist interactions, then for example ShenaniBot will remember that\n'
      + 'you have beaten a level even in the situation where the API stops reporting\n'
      + 'it as "cleared" (which it eventually can do unless you have a top-3 time or\n'
      + 'score on the level).'
    ),
  ],

  webServerConfig: [
    buildConfigQuestion(
      'useWebServer', {
        type: 'confirm',
        name: 'useWebServer', // this is not stored in the config file
        message: 'Enable web server?',
        default: a => fp.get('config.config.httpPort', a) ? true : false,
        askAnswered: true
      },
        'Enabling the web server allows you to serve overlays. Overlays allow you to\n'
      + 'display info about the queue on-screen in your stream (e.g. by loading them\n'
      + 'in OBS browser sources and applying custom CSS to adjust their appearance\n'
      + 'for your stream layout).\n'
      + 'The web server can also provide a UI for choosing a level when a viewer\n'
      + 'submits a creator code.'
    ),
    buildConfigQuestion(
      'config.httpPort', {
        when: a => {
          if (!a.useWebServer) {
            delete a.config.config.httpPort;
            if (a.config.config.creatorCodeMode === 'webui') {
              a.config.config.creatorCodeMode = 'manual';
              console.log( '\n\t!!! WARNING !!!\n'
                         + '\tCreator Code Mode was changed to \'Show the creator code in\n'
                         + '\tchat but take no further action\' because the UI is not\n'
                         + '\tsupported when the web server is disabled.');
            }
            return false;
          }
          return true;
        },
        message: 'Web Server Port:',
        default: a => fp.get('config.config.httpPort', a) || 8080,
        // type: 'number' acts up when validation fails, so use this instead
        filter: i => {
          if (typeof i === 'string' && i.match(/^\s*[1-9]\d*\s*$/)) {
            const n = parseInt(i, 10);
            if (n < 65536) {
              return n;
            }
          }
          return i;
        },
        validate: i => (typeof i !== 'number') ? 'Please enter a valid port number (1 - 65535)' : true
      }, 'The web server requires an unused TCP port.'
    ),
    buildConfigQuestion(
      'config.overlayPath', {
        when: a => {
          if (!a.useWebServer) {
            delete a.config.config.overlayPath;
            return false;
          }
          return true;
        },
        message: 'Overlay Path:'
      },
        "If you want to supply custom overlay views, then you need to specify the\n"
      + "directory where they will be found.  When the web server is running, a file\n"
      + "placed in this directory can be accessed at the URL\n\n"
      + `\thttp://localhost:${answers.config.config.httpPort}/overlay/usr/<filename>\n\n`
      + "If you aren't using custom overlay views, you can leave this blank."
    )
  ]
};

const prompts = new Rx.Subject();
inquirer.prompt(prompts, answers).ui.process.subscribe(
  result => {
    if (result.name.slice(0,5) === 'menu.') {
      const answer = JSON.parse(result.answer);
      if (answer.q) {
        const next = fp.get(answer.q, questions);
        for (const q of next) {
          prompts.next(q);
        }
      }
      if (answer.save) {
        configLoader.save(answers.config);
        initialConfig = fp.cloneDeep(answers.config);
        console.log('\n  Configuration saved');
      }
      if (answer.confirmExit) {
        prompts.next({
          name: 'confirmExit',
          type: 'confirm',
          message: `${answer.confirmExit}; are you sure?`,
          default: false,
          askAnswered: true
        });
      } else if (answer.exit) {
        prompts.complete();
      } else {
        prompts.next(questions.mainMenu);
      }
    }
    if (result.name === 'confirmExit') {
      if (result.answer) {
        prompts.complete();
      } else {
        prompts.next(questions.mainMenu);
      }
    }
  },
  error => {
    console.log(`ERROR: ${error}`);
  }
);

console.log('ShenaniBot Configuration');
prompts.next(questions.mainMenu);
