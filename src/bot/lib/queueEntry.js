class QueueEntry {
  constructor(id, name, type, submittedBy, avatar) {
    this.id = id;
    this.name = name;
    this.type = type
    this.submittedBy = submittedBy;
    this.avatar = avatar;
  }
}

class ViewerLevel extends QueueEntry {
  constructor(levelId, levelName, submittedBy, avatar = undefined) {
    super(levelId, levelName, "level", submittedBy, avatar);
  }

  get display() {
    return `${this.name} (${this.id})`;
  }
}

class Creator extends QueueEntry {
  constructor(creatorId, creatorName, submittedBy, avatar = undefined) {
    super(creatorId, creatorName, "creator", submittedBy, 
          `https://img.bscotch.net/fit-in/64x64/avatars/${avatar}.png`);
  }

  get display() {
    return `${this.name}'s Profile (@${this.id})`;
  }
}

class Marker extends QueueEntry {
  constructor(markerName) {
    super(undefined, markerName, "mark", undefined, undefined);
  }

  get display() {
    return `[== ${this.name || "BREAK"} ==]`;
  }
}

module.exports = { ViewerLevel, Creator, Marker };
