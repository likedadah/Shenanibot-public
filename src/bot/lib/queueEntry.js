class QueueEntry {
  constructor(id, name, type, avatar) {
    this.id = id;
    this.name = name;
    this.type = type
    this.avatar = avatar;
  }
}

class ViewerLevel extends QueueEntry {
  constructor(levelId, levelName, avatar = undefined) {
    super(levelId, levelName, "level", avatar);
  }

  get display() {
    return `${this.name} (${this.id})`;
  }
}

class Creator extends QueueEntry {
  constructor(creatorId, creatorName, avatar = undefined) {
    super(creatorId, creatorName, "creator",
          `https://img.bscotch.net/fit-in/64x64/avatars/${avatar}.png`);
  }

  get display() {
    return `${this.name}'s Profile (@${this.id})`;
  }
}

class Marker extends QueueEntry {
  constructor(markerName) {
    super(undefined, markerName, "mark", undefined);
  }

  get display() {
    return `[== ${this.name || "BREAK"} ==]`;
  }
}

module.exports = { ViewerLevel, Creator, Marker };
