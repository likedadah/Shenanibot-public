const Rumpus = require("@bscotch/rumpus-ce");
const clipboard = require("clipboardy");

const version = require('../../package.json').version;
const { ViewerLevel, Creator, Marker } = require("./lib/queueEntry");
const { ProfileCache } = require("./lib/profileCache");
const { rewardHelper } = require("../config/loader");
const creatorCodeUi = require("../web/creatorCodeUi");
const overlay = require("../web/overlay");
const httpServer = require("../web/server");

class ShenaniBot {
  constructor(botOptions, sendAsync = _ => {}, dm = (_u, _m) => {},
              canDm = _ => true) {
    console.log(`Shenanibot version ${version} ...`);
    this.sendAsync = sendAsync;
    this.dm = dm;
    this.canDm = canDm;
    this.rce = new Rumpus.RumpusCE(botOptions.auth.delegationToken);
    this.profileCache = new ProfileCache();
    this.options = botOptions.config;
    this.players = this.options.players;
    this.streamer = botOptions.auth.streamer;
    this.queue = [];
    this.queueOpen = true;
    this.users = {};
    this.levels = {};
    this.prevLevel = undefined;
    this.forcedAdvance = undefined;
    this.noSpoilUsers = new Set();
    this.nextNoSpoilUsers = null;
    this.counts = {
      played: 0,
      won: 0,
      lost: 0
    }
    this.defaultAdvanceCallCount = 0;
    this.onStatus = _ => {};
    this.onQueue = _ => {};
    this.onCounts = _ => {};

    if (this.options.priority === "rotation") {
      this.playingRound = 1;
      this.minOpenRound = 1;
    }
    if (this.options.httpPort) {
      httpServer.start(this.options);
      overlay.init();
      overlay.sendCounts(this.counts);
      this.onStatus = isOpen => overlay.sendStatus(isOpen);
      this.onQueue = () => overlay.sendLevels(this.queue);
      this.onCounts = () => {
        overlay.sendCounts(this.counts);
      }
      if (this.options.creatorCodeMode === "webui") {
        creatorCodeUi.init((c, l) => this._specifyLevelForCreator(c, l));
      }
    }
    this.twitch = {
      rewards: {
        urgent: "move a level to the front of the queue",
        priority: "move a level to the front of its group",
        expedite: "move a level up one place in the queue",
        add: "add a level to the queue",
        unlimit: "ignore limit when adding a level",
      },
      rewardBehaviors: botOptions.twitch.rewardBehaviors,
      usePointsToAdd: false,
    };

    const behaviors = botOptions.twitch.rewardBehaviors;
    if (Object.keys(behaviors).find(k => behaviors[k] === "add")) {
      this.twitch.usePointsToAdd = true;
    }
  }

  async command(message, username, rewardId) {
    const args = message.split(/\s+/);
    const command = args[0].startsWith(this.options.prefix)
                  ? args[0].substring(this.options.prefix.length).toLowerCase()
                  : undefined;
    if (! (command || rewardId)) {
      return "";
    }

    if (username === this.streamer) {
      switch (command) {
        case "open":
          return this.openQueue();
        case "close":
          return this.closeQueue();
        case "players":
          return this.setPlayers(args[1]);
        case "permit":
          return args[1] ? this.permitUser(args[1].toLowerCase()) : "";
        case "giveboost":
          return args[1] ? this.giveBoostToUser(args[1].toLowerCase()) : "";
        case "next":
          return this.nextLevel();
        case "play":
          return this.playSpecificLevel(args.slice(1).join(" ").toLowerCase());
        case "random":
          return this.randomLevel();
        case "skip":
          return this.skipLevel(args);
        case "advance":
          return this.advance();
        case "win":
          return this.winLevel(args);
        case "lose":
          return this.loseLevel(args);
        case "back":
          return this.goBack();
        case "mark":
          return this.makeMarker(args.slice(1).join(" "));
        case "reward":
          return args[1] ? this.setReward(args[1].toLowerCase(), rewardId) : "";
        case "noreward":
          return args[1] ? this.unsetReward(args[1].toLowerCase()) : "";
      }
    }

    if (rewardId) {
      return this.processReward(rewardId, args, username);
    }

    switch (command) {
      case "check":
        return args[1] ? this.checkId(args[1]) : "";
      case "add":
        return args[1] ? this.addLevelToQueue(args[1], username) : "";
      case "chadd":
        return args[1] ? this.checkAndAddLevel(args[1], username) : "";
      case "remove":
        return args[1] ? this.removeLevelFromQueue(args[1], username) : "";
      case "boost":
        return args[1] ? this.boostLevel(args[1], username) : "";
      case "queue":
        return this.showQueue();
      case "nospoil":
        return this.noSpoil(username);
      case "stats":
        return this.showStats();
      case "commands":
      case "help":
        return this.showBotCommands();
      case "bot":
        return this.showBotInfo();
    }

    return "";
  }

  openQueue() {
    this.queueOpen = true;
    this.onStatus(true);
    return "The queue has been opened, add some levels to it!";
  }

  closeQueue() {
    this.queueOpen = false;
    this.onStatus(false);
    return "The queue has been closed! No more levels :(";
  }

  setPlayers(arg) {
    const n = parseInt(arg, 10);
    if (n > 0 && n < 5) {
      this.players = n;
      return `The player count has been set to ${n}.`;
    }

    return `The player count is currently ${this.players}.`;
  }

  permitUser(username) {
    if (username[0] === "@") {
      username = username.slice(1);
    }

    const user = this._getUser(username);

    if (this.queueOpen && (user.levelsSubmitted < this.options.levelLimit || !this._hasLimit())) {
      return `${username} is able to submit levels.`;
    }

    user.permit = true;
    return `@${username}, you may submit one level to the queue now.`;
  }

  giveBoostToUser(username) {
    if (username[0] === "@") {
      username = username.slice(1);
    }

    const user = this._getUser(username);

    user.canBoost = true;
    return `@${username}, you may boost one level in the queue now.`;
  }

  skipLevel(args) {
    if (!this.queue[0] || this.queue[0].type === 'mark') {
      return "There is no current level to skip!";
    }
    this.queue[0].counted = false;
    this.profileCache.updateSessionInteractions(
                                 {id: this.queue[0].id, played: false});
    return this.advance(args);
  }

  winLevel(args) {
    if (!this.queue[0] || this.queue[0].type === 'mark') {
      return "There is no current level to win!";
    }
    this.queue[0].countedWon = true;
    this.counts.won += 1;
    this.profileCache.updateSessionInteractions(
                                         {id: this.queue[0].id, beaten: true});
    return this.advance(args);
  }

  loseLevel(args) {
    if (!this.queue[0] || this.queue[0].type === 'mark') {
      return "There is no current level to lose!";
    }
    this.queue[0].countedLost = true;
    this.counts.lost += 1;
    return this.advance(args);
  }

  advance(args = []) {
    if (args.slice(1, 3).join(" ").toLowerCase() === 'and play') {
      return this.playSpecificLevel(args.slice(3).join(" ").toLowerCase());
    }
    const advance = this.forcedAdvance || this.options.defaultAdvance
    this.forcedAdvance = undefined;
    switch (advance) {
      case "random":
        return this.randomLevel();
      case "alternate":
        return (this.defaultAdvanceCallCount++ % 2) ? this.randomLevel()
                                                    : this.nextLevel();
      default:
        return this.nextLevel();
    }
  }

  nextLevel() {
    let {empty, response} = this._dequeue();
    if (!empty) {
      response = this._playLevel();
    }

    this.onQueue();
    return response;
  }

  playSpecificLevel(args) {
    let index;

    let match;
    if (match = args.match(/^(next\s|last\s)?from\s@?([a-zA-Z0-9][a-zA-z0-9_]{3,24})\s*$/)) {
      const last = match[1] === "last ";
      const start = last ? this.queue.length - 1 : 1;
      const stop = i => last ? i > 0 : i < this.queue.length;
      const increment = last ? -1 : 1;
      for (let i = start; stop(i); i += increment) {
        if (this.queue[i].submittedBy === match[2]) {
          index = i;
          break;
        }
      }
      if (!index) {
        return `The queue contains no levels submitted by ${match[2]}`;
      }
    }
    if (args.match(/[1-9]/) && (match = args.match(/^\d+/))) {
      index = parseInt(args, 10) - 1;
    }
    if (typeof index != "number") {
      return "";
    }
    if (!this.queue[index] || this.queue[index].type === "mark") {
      return `There is no level at position ${index + 1} in the queue!`;
    }
    if (index === 0) {
      return `You're already playing ${this.queue[index].display}!`;
    }

    this._dequeue();
    index -= 1;
    if (index > 0) {
      const entry = this.queue[index];
      entry.priority = true;
      if (this.options.priority === "rotation") {
        entry.round = this.playingRound;
      }
      this.queue.splice(index, 1)
      this.queue.unshift(entry);
    }
    let response = `Pulled ${this.queue[0].display} to the front of the queue...`;
    response += this._playLevel();

    this.onQueue();
    return response;
  }

  randomLevel() {
    let {empty, response} = this._dequeue();
    if (!empty) {
      const markerIndex = this.queue.findIndex(e => e.type === "mark");
      if (markerIndex !== 0) {
        let groupLength = (markerIndex > -1) ? markerIndex : this.queue.length;

        const noPriorityIndex = this.queue.findIndex(l => !l || !l.priority);
        if (noPriorityIndex > 0) {
          groupLength = noPriorityIndex;
        }

        if (this.queue[groupLength - 1].round > this.playingRound) {
          groupLength = this.queue.findIndex(l => l.round > this.playingRound);
        }

        const index = Math.floor(Math.random() * groupLength);
        let randomEntry = this.queue[index];
        this.queue.splice(index, 1)
        this.queue.unshift(randomEntry);

        response = `Random Level... `
      }
      response = (response || "") + this._playLevel();
    }

    this.onQueue();
    return response;
  }

  async goBack() {
    if (this.prevLevel === undefined) {
      return "There is no level to go back to!";
    }
    if (this.prevLevel === null) {
      return "You can't go back twice in a row.";
    }

    this.nextNoSpoilUsers = this.noSpoilUsers;
    this.noSpoilUsers = new Set();
    if (this.queue.length) {
      this._stopPlayingLevel();
      this.profileCache.updateSessionInteractions(
                                        {id: this.queue[0].id, played: false});
    }
    this.queue.unshift(this.prevLevel);
    if (this.prevLevel.counted) {
      this.counts.played -= 1;
    }
    if (this.prevLevel.countedWon) {
      this.counts.won -= 1;
      this.profileCache.updateSessionInteractions(
                                       {id: this.prevLevel.id, beaten: false});
    }
    if (this.prevLevel.countedLost) {
      this.counts.lost -= 1;
    }

    delete this.prevLevel.counted;
    delete this.prevLevel.countedWon;
    delete this.prevLevel.countedLost;
    this.prevLevel.wasPrev = true;
    this.levels[this.prevLevel.id] = "is already in the queue";
    this.prevLevel = null;

    this.forcedAdvance = "next";
    this.onCounts();
    this.onQueue();
    return `Restoring previous queue entry... ${this._playLevel()}}`;
  }

  async makeMarker(markerName) {
    if (this.queue.length > 0) {
      const lastEntry = this.queue[this.queue.length - 1];
      if (lastEntry.type === "mark" && !lastEntry.name && !markerName) {
        return "";
      }
    }

    this.queue.push(new Marker(markerName));
    this.onQueue();
    return "A marker has been added to the queue.";
  }

  async setReward(rewardType, rewardId) {
    const rewards = this.twitch.rewards;
    const behaviors = this.twitch.rewardBehaviors;
    if (!rewards[rewardType]) {
      return `Unknown reward type: ${rewardType}; `
           + "known types are: " + Object.keys(rewards).join(", ");
    }
    if (!rewardId) {
      return "To configure a custom channel points reward to "
           + rewards[rewardType]
           + `, redeem the reward with the message '!reward ${rewardType}'`;
    }
    if (behaviors[rewardId]) {
      if (behaviors[rewardId] === rewardType) {
        return `That reward is already set up to ${rewards[rewardType]}`;
      } else {
        return "That reward is currently set up to "
             + rewards[behaviors[rewardId]]
             + "; if you want to change its behavior, first use "
             + `'!noreward ${behaviors[rewardId]}'`;
      }
    }
    if (Object.keys(behaviors).some(k => behaviors[k] === rewardType)) {
      return `Another reward is already set up to ${rewards[rewardType]}; `
           + "if you want to switch rewards for this behavior, first use "
           + `'!noreward ${rewardType}'`;
    }

    behaviors[rewardId] = rewardType;
    if (rewardType === "add") {
      this.twitch.usePointsToAdd = true;
    }

    return "Registered reward to " + rewards[rewardType] + ". "
         + rewardHelper.updateRewardConfig(behaviors);
  }

  async unsetReward(rewardType) {
    const rewards = this.twitch.rewards;
    const behaviors = this.twitch.rewardBehaviors;

    if (!rewards[rewardType]) {
      return `Unknown reward type: ${rewardType}; `
           + "known types are: " + Object.keys(rewards).join(", ");
    }

    const rewardId = Object.keys(behaviors)
                           .find(k => behaviors[k] === rewardType);
    if (!rewardId) {
      return `No reward is set up to ${rewards[rewardType]}`
    }

    behaviors[rewardId] = undefined;
    if (rewardType === "add") {
      this.twitch.usePointsToAdd = false;
    }

    return "Removed reward to " + rewards[rewardType] + ". "
         + rewardHelper.updateRewardConfig(behaviors);
  }

  async checkId(id) {
    const type = this._getIdType(id)
    const error = this._typeError(type);
    if (error) {
      return error;
    }

    if (type === "level")
    {
      return (await this._checkLevel(id)).message;
    } else {
      const {creator, error} = await this._getCreatorEntry(id);
      if (error) {
        return error;
      }

      let levels = [];
      this._getLevelsForCreator(id, l => levels = levels.concat(l), () => {
        if (!levels.length) {
          this.sendAsync(`Unable to find levels for ${creator.display}!`);
          return;
        }
        const unplayed = levels.find(l => !l.played);
        if (unplayed) {
          const levelEntry = new ViewerLevel(unplayed.id, unplayed.name);
          this.sendAsync(`The most recent unplayed level from ${creator.display} is ${levelEntry.display}`);
          return;
        }
        const unbeaten = levels.find(l => !l.beaten);
        if (unbeaten) {
          const levelEntry = new ViewerLevel(unbeaten.id, unbeaten.name);
          this.sendAsync(`All levels from ${creator.display} have been played; the most recent unbeaten level is ${levelEntry.display}`);
          return;
        }
        this.sendAsync(`All levels from ${creator.display} have been beaten`);
      });
      return "";
    }
  }

  async addLevelToQueue(id, username, rewardType) {
    const user = this._getUser(username);
    let response;

    if (!this.queueOpen && !user.permit) {
      return "Sorry, queue is closed!";
    }

    if (this.twitch.usePointsToAdd && !rewardType
                                   && username !== this.streamer) {
      return "Please use channel points to add levels.";
    }

    let type = this._getIdType(id)
    if (response = this._typeError(type)) {
      return response;
    }

    if (this._hasLimit() && user.levelsSubmitted >= this.options.levelLimit && !user.permit && rewardType !== "unlimit") {
      response = "You have submitted the maximum number of levels!";
      if (this.options.levelLimitType === "active") {
        response += " (You can add more when one of yours has been played.)";
      }
      return response;
    }

    let entry = null;
    if (type === "level") {
      const reason = this.levels[id];
      if (reason) {
        return `That level ${reason}!`;
      }

      const levelInfo = await this.rce.levelhead.levels.search({ levelIds: id }, { doNotUseKey: true });

      if (!levelInfo.length) {
        return "Oops! That level does not exist!";
      }

      if (levelInfo[0].requiredPlayers > this.players) {
        return `Sorry, ${this.streamer} is not accepting ${levelInfo[0].requiredPlayers}-player levels.`;
      }

      entry = new ViewerLevel(
        id,
        levelInfo[0].title,
        username,
        levelInfo[0].avatarUrl()
      );
    }

    if (type === "creator") {

      const {creator, error} = await this._getCreatorEntry(id, username);
      if (error) {
        return error;
      }
      entry = creator;
    }

    const pos = this._enqueue(entry, user);
    this.onQueue();

    user.levelsSubmitted++;
    user.permit = (username === this.streamer);

    response = `${entry.display} was added as #${pos} in the queue.`;
    response = this._hasLimit() ? `${response} Submission ${user.levelsSubmitted}/${this.options.levelLimit}` : response;

    if (this.queue.length === 1) {
      response = `${response}\n${this._playLevel()}`;
    }

    if (type === "level") {
      this.levels[id] = "is already in the queue";
    }
    return response;
  }

  async checkAndAddLevel(id, username) {
    const check = await this._checkLevel(id);

    if (check.canAutoAdd) {
      return `${check.message} ${await this.addLevelToQueue(id, username)}`;
    }
    return check.message;
  }

  removeLevelFromQueue(id, username) {
    let type = this._getIdType(id)
    let response;
    if (response = this._typeError(type)) {
      return response;
    }

    const i = this.queue.findIndex(l => l && l.id === id);
    if (i === -1) {
      return "The level you tried to remove is not in the queue";
    }

    const entry = this.queue[i];

    if (entry.submittedBy !== username && this.streamer !== username) {
      return "You can't remove a level from the queue that you didn't submit!";
    }
    if (i === 0) {
      return "You can't remove the current level from the queue!";
    }

    this._removeFromQueue(i);
    this.onQueue();
    if (entry.type === "level") {
      this.levels[id] = (username === this.streamer) ? `was removed by ${username}; it can't be re-added` : null;
    }

    return `${entry.display} was removed from the queue!`;
  }

  boostLevel(id, username) {
    const user = this._getUser(username);
    if (!user.canBoost && this.streamer !== username) {
      return `You can't boost levels without permission from ${this.streamer}!`;
    }

    return this._processUrgentReward(id, () => user.canBoost = false);
  }

  showQueue() {
    let response = `Total entries: ${this.queue.length}`;
    if (this.queue.length === 0) {
      return response;
    }

    response += `; Now Playing: ${this.queue[0].display}`;
    if (this.queue.length === 1) {
      return response;
    }

    let limit = Math.min(9, this.queue.length - 1);
    response += ` Next ${limit}:`;

    let nextRoundIndex = this.queue.findIndex((e, i) => i && e.round);
    for (let i = 1; i <= limit; i++) {
      const entry = this.queue[i];
      if (this.options.priority === "rotation" && i === nextRoundIndex) {
        nextRoundIndex = this.queue.findIndex(e => e.round > entry.round);
        if (nextRoundIndex < 0) {
          nextRoundIndex = this.queue.length;
        }

        const n = nextRoundIndex - i;
        const entries = `${n} ${n > 1 ? "entries" : "entry"}`;
        response += ` **Round ${entry.round} (${entries})** :`;
      }
      response += ` [${entry.display}]`;
    }
    return response;
  }

  noSpoil(username) {
    if (!this.queue[0] || this.queue[0].type === "mark") {
      return "There is no current level!";
    }
    if (!this.canDm(username, true)) {
      return `I won't be able to send you a direct message, @${username}.`;
    }
    this.noSpoilUsers.add(username);
    return `@${username}, I'll send a direct message when the current level `
         + `is done`;
  }

  showStats() {
    const stats = [];
    if (this.counts.won) {
      stats.push(`Wins: ${this.counts.won}`);
    }
    if (this.counts.lost) {
      stats.push(`Losses: ${this.counts.lost}`);
    }
    stats.push(`Total Played: ${this.counts.played}`);
    return stats.join(" ; ");
  }

  showBotCommands() {
    const prefix = this.options.prefix;
    return `${prefix}add [levelCode | creatorCode], ${prefix}boost [levelCode | creatorCode], ${prefix}bot, ${prefix}chadd [levelCode], ${prefix}check [levelCode], ${prefix}nospoil, ${prefix}queue, ${prefix}remove [levelCode | creatorCode], ${prefix}stats`;
  }

  showBotInfo() {
    return `ShenaniBot was created for the LevelHead Community by the LevelHead Community.
    Want to use it in your own stream? Learn about it here: https://github.com/madelsberger/Shenanibot-public`;
  }

  processReward(rewardId, message, username) {
    const behavior = this.twitch.rewardBehaviors[rewardId];
    switch (behavior) {
      case "urgent":
        return this._processUrgentReward(message[0]);
      case "priority":
        return this._processPriorityReward(message[0]);
      case "expedite":
        return this._processExpediteReward(message[0]);
      case "add":
      case "unlimit":
        const id = message[
          (message[0] === `${this.options.prefix}add`) ? 1 : 0
        ];
        return this.addLevelToQueue(id, username, behavior);
    }
    return "";
  }

  _processUrgentReward(id, onSuccess = () => null) {
    const { entry, index, response } = this._getQueueEntryForReward(id);
    if (!entry) {
      return response;
    }
    const actions = []
    if (!entry.priority) {
      actions.push("was marked as priority!");
      entry.priority = true;
    }
    if (this.options.priority === "rotation") {
      entry.round = this.playingRound;
    }
    let newIndex = this.queue.findIndex(
        (e, i) => i && (e.type === "mark" || !e.priority
                                          || e.round > this.playingRound)
    );
    if (newIndex === -1) {
      newIndex = this.queue.length;
    }
    if (newIndex >= index) {
      newIndex = index;
    } else {
      actions.push(`is now #${newIndex + 1} in the queue.`);
    }
    if (actions.length === 0) {
      actions.push("can't be given any higher priority!");
    }
    this.queue.splice(newIndex, 0, entry);
    this.onQueue();
    onSuccess();
    return `${entry.display} ${actions.join(" It ")}`;
  }

  _processPriorityReward(id) {
    const { entry, index, response } = this._getQueueEntryForReward(id);
    if (!entry) {
      return response;
    }
    entry.priority = true;
    let i;
    for (i = index - 1; i > 0; i--) {
      if (   this.queue[i].type === "mark"
          || this.queue[i].priority || this.queue[i].round < entry.round) {
        break;
      }
    }
    const newIndex = i + 1;
    this.queue.splice(newIndex, 0, entry);
    this.onQueue();
    return `${entry.display} was marked as priority! It is now #${newIndex + 1} in the queue.`;
  }

  _processExpediteReward(id) {
    let { entry, index, response } = this._getQueueEntryForReward(id);
    if (!entry) {
      return response;
    }

    if (index === 1) {
      response = "You can't expedite a level that's already next to be played.";
    } else if (this.queue[index - 1].type === "mark") {
      response = "You can't expedite a level that's right after a break in the queue.";
    } else if (this.queue[index - 1].round < entry.round) {
      response = "You can't expedite a level that's already the first to be played in its round.";
    } else if (this.queue[index - 1].priority && !entry.priority) {
      response = "You can't expedite a normal-priority level that's right after a high-priority level.";
    } else {
      response = `${entry.display} was expedited! It is now #${index} in the queue.`;
      index -= 1;
    }

    this.queue.splice(index, 0, entry);
    this.onQueue();
    return response;
  }

  _getQueueEntryForReward(id) {
    const type = this._getIdType(id);
    const i = this.queue.findIndex(l => l && l.id === id);
    let response;

    if (response = this._typeError(type)) {
      return { response };
    }

    if (i === 0) {
      response = "You can't change priority of the level being played!";
    } else if (i === -1) {
      response = "That level is not in the queue!";
    }

    return {
      entry: i > 0 ? this.queue.splice(i, 1)[0] : null,
      index: i,
      response
    };
  }

  _getUser(username) {
    if (!this.users[username]) {
      this.users[username] = {
        levelsSubmitted: 0,
        permit: username === this.streamer
      };
    }
    return this.users[username];
  }

  _setRoundTimer() {
    this.roundTimer = setTimeout(() => {
      this.minOpenRound += 1;
      if (this.queue.find(e => e && e.round >= this.minOpenRound)) {
        this._setRoundTimer();
      } else {
        this.roundTimer = null;
      }
    },
    this.options.roundDuration * 60000);
  }

  async _checkLevel(levelId) {
    if (this._getIdType(levelId) !== "level") {
      return {
        canAutoAdd: false,
        message: "Please enter a valid level code to check."
      };
    }

    let levelInfo = await this.rce.levelhead.levels.search({ levelIds: levelId, includeMyInteractions: true } );

    if (!levelInfo.length) {
      return {
        canAutoAdd: false,
        message: "Oops! That level does not exist!"
      };
    }

    const level = new ViewerLevel(levelInfo[0].levelId, levelInfo[0].title, "");
    const interactions = levelInfo[0].interactions;
    let verb = "not played";
    if (interactions) {
      if (interactions.played) {
        verb = "played";
      }
      if (interactions.completed) {
        verb = "beaten";
      }
    }

    let warning = "";
    if (verb !== "beaten" && levelInfo[0].requiredPlayers > this.players) {
      warning = `  But ${this.streamer} is not accepting ${levelInfo[0].requiredPlayers}-player levels.`;
    }

    return {
      canAutoAdd: verb === "not played" && !warning,
      message: `${this.streamer} has ${verb} ${level.display}.${warning}`
    };
  }

  _updatePlayingRound(round) {
    this.playingRound = round;
    if (round > this.minOpenRound) {
      this.minOpenRound = round;
      clearTimeout(this.roundTimer);
      this._setRoundTimer();
    }
  }

  _enqueue(entry, user) {
    let laterEntries = [];
    if (this.options.priority === "rotation") {
      entry.round = Math.max((user.lastRound || 0) + 1, this.minOpenRound);
      user.lastRound = entry.round;
      const n = this.queue.findIndex(e => e.type !== "mark"
                                       && e.round > entry.round);
      if (n > -1) {
        laterEntries = this.queue.splice(n);
      }
      if (this.options.roundDuration && !this.roundTimer) {
        this._setRoundTimer();
      }
    }

    this.queue.push(entry);
    const pos = this.queue.length;
    if (pos === 1 && this.options.priority === "rotation") {
      this._updatePlayingRound(entry.round);
    }

    while (laterEntries.length) {
      const laterEntry = laterEntries.shift();
      if (laterEntries[0] && laterEntries[0].type === "mark") {
        this.queue.push(laterEntries[0]);
      }
      if (laterEntry.type !== "mark") {
        this.queue.push(laterEntry);
      }
    }

    return pos;
  }

  _dequeue() {
    if (this.queue.length === 0) {
      return {
        empty: true,
        response: "There aren't any levels in the queue!"
      };
    }

    this._stopPlayingLevel();
    if (this.queue[0].type === "level") {
      this.levels[this.queue[0].id] = "was already played";
    }
    if (this.queue[0].type !== "mark") {
      if (this.queue[0].counted === undefined) {
        this.queue[0].counted = true;
        this.counts.played += 1;
      }
      this.onCounts();
    }
    for (const user of this.noSpoilUsers) {
      this.dm(user,
          `${this.streamer} has finished playing ${this.queue[0].display}`);
    }
    if (this.nextNoSpoilUsers) {
      this.noSpoilUsers = this.nextNoSpoilUsers;
      this.nextNoSpoilUsers = null;
    } else {
      this.noSpoilUsers.clear();
    }

    this.prevLevel = this.queue[0];
    this._removeFromQueue(0);

    if (   this.options.priority === "rotation"
        && this.queue[0] && this.queue[0].type !== "mark") {
      this._updatePlayingRound(this.queue[0].round);
    }

    return {
      empty: !this.queue.length,
      response: (!this.queue.length) ? "The queue is now empty." : null
    };
  }

  _playLevel() {
    if (this.queue[0].type === "level") {
      this.rce.levelhead.bookmarks.add(this.queue[0].id);
      this.profileCache.updateSessionInteractions(
                                         {id: this.queue[0].id, played: true});
      return `Now playing ${this.queue[0].display} submitted by ${this.queue[0].submittedBy}`;
    }
    if (this.queue[0].type === "creator") {
      switch (this.options.creatorCodeMode) {
        case "clipboard":
          clipboard.writeSync(this.queue[0].id);
          break;
        case "auto":
          const creatorId = this.queue[0].id;
          let levels = [];
          this._getLevelsForCreator(this.queue[0].id,
                                    l => levels = levels.concat(l), () => {
            if (!levels.length) {
              this.sendAsync(`Unable to find levels for ${this.queue[0].display}!`);
              return;
            }
            if (levels.find(l => !l.played)) {
              levels = levels.filter(l => !l.played);
            }
            const i = Math.floor(Math.random() * levels.length);
            this._specifyLevelForCreator(creatorId, levels[i]);
          });
          break;
        case "webui":
          creatorCodeUi.setCreatorInfo({
            creatorId: this.queue[0].id,
            name: this.queue[0].name
          });
          this._getLevelsForCreator(this.queue[0].id,
                                    creatorCodeUi.addLevelsToCreatorInfo)
          break;
      }
      return `Picking a level from ${this.queue[0].display} (submitted by ${this.queue[0].submittedBy})...`;
    }
    return "Not currently playing a queued level.";
  }

  _stopPlayingLevel() {
    if (this.queue[0].type === "level") {
      this.rce.levelhead.bookmarks.remove(this.queue[0].id);
    }
    if (this.options.creatorCodeMode === "webui") {
      creatorCodeUi.clearCreatorInfo();
    }
  }

  _getIdType(id) {
    if (id.match(/^[a-z0-9]{7}$/)) {
      return "level";
    }
    if (id.match(/^[a-z0-9]{6}$/)) {
      return "creator";
    }
    return null;
  }

  _typeError(type) {
    if (this.options.creatorCodeMode === "reject" && type !== "level") {
      return "Please enter a valid level code.";
    }
    if (!type) {
      return "Please enter eithe a valid 7-digit level code, or a valid 6-digit creator code.";
    }
    return null;
  }

  _removeFromQueue(index) {
    if (this.queue[index]) {
      const entry = this.queue[index];
      const username = entry.submittedBy;
      const user = this._getUser(username);

      if (    (this.options.levelLimitType === "active" || index)
           && !entry.wasPrev ) {
        user.levelsSubmitted--;
      }

      if (this.options.priority === "rotation" && index) {
        let destRound = entry.round;
        user.lastRound = 0;
        for (let i = index + 1; i < this.queue.length; i++) {
          const laterEntry = this.queue[i];
          if (laterEntry.submittedBy === username) {
            this.queue[index] = laterEntry;
            index = i;
            const nextDestRound = laterEntry.round;
            laterEntry.round = destRound;
            user.lastRound = destRound;
            destRound = nextDestRound;
          }
        }
      }
    }
    this.queue.splice(index, 1);
  }

  async _getCreatorEntry(id, username) {
    const creatorInfo = await this.rce.levelhead.players.search({ userIds: id, includeAliases: true }, { doNotUseKey: true });

    if (!creatorInfo.length) {
      return {
        error: "Oops! That creator does not exist!"
      };
    }
    const aliasInfo = await creatorInfo[0].alias;
    return {creator: new Creator(
      id,
      aliasInfo.alias,
      username,
      aliasInfo.avatarId
    )};
  }

  async _getLevelsForCreator(creatorId, levelsCb, doneCb = () => {}) {
    const cachedLevels = this.profileCache.getLevelsForCreator(creatorId);
    const _levelsCb = levels => 
                   levelsCb(levels.filter(l => ! (l.players > this.players)));
    if (cachedLevels) {
      _levelsCb(cachedLevels);
      setTimeout(doneCb, 0);
      return;
    }

    const maxLevels = 128;
    let gotMaxLevels;
    let query = {
      userIds: creatorId,
      limit: maxLevels,
      sort: "createdAt",
      includeMyInteractions: true,
      includeStats: true,
    };

    do {
      const levelInfo = await this.rce.levelhead.levels.search(query);
      const loadedLevels = levelInfo.map(li => ({
        ...new ViewerLevel(li.levelId, li.title, "", li.avatarUrl()),
        date: li.createdAt,
        players: li.requiredPlayers,
        tags: li.tagNames,
        difficulty: li.stats.Players > 10 ? li.stats.Diamonds : null,
        played: !!(li.interactions && li.interactions.played),
        beaten: !!(li.interactions && li.interactions.completed),
      }));
      _levelsCb(this.profileCache.addLevelsForCreator(creatorId, loadedLevels));

      gotMaxLevels = levelInfo.length === maxLevels;
      if (gotMaxLevels) {
        query.maxCreatedAt = levelInfo[maxLevels - 1].createdAt;
        query.tiebreakerItemId = levelInfo[maxLevels - 1]._id;
        await new Promise(r => setTimeout(r, 1000));
      }
    } while( gotMaxLevels );

    doneCb();
  }

  _specifyLevelForCreator(creatorId, level) {
    const oldEntry = this.queue[0];
    if (!oldEntry || oldEntry.type !== "creator"
                  || oldEntry.id !== creatorId) {
      return false;
    }
    const entry = new ViewerLevel(
                    level.id, level.name, oldEntry.submittedBy, level.avatar);
    for (const key of Object.keys(oldEntry).filter(k => !(k in entry))) {
      entry[key] = oldEntry[key];
    }
    this.queue[0] = entry;
    this.sendAsync( this._playLevel() );

    this.onQueue();
    return true;
  }

  _hasLimit() {
    return this.options.levelLimitType !== "none"
        && this.options.levelLimit > 0;
  }
}

module.exports = ShenaniBot;
