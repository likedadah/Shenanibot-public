const { patchFs } = require("fs-monkey");
const { createFsFromVolume, Volume } = require("memfs");
const os = require('os');

beforeEach(() => {
  const vol = new Volume();
  vol.mkdirSync(os.homedir(), {recursive: true});
  patchFs(vol);
});
