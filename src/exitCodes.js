// How Mochi exits tells keep-running.bat whether starting it again would help.
module.exports = {
  // Something went wrong that a restart might fix, like the internet not being connected yet.
  RESTART: 1,
  // A setup problem (bad token, a typo in config.json...) that needs fixing first.
  NEEDS_FIXING: 2,
  // Another copy of Mochi is already running.
  ALREADY_RUNNING: 3,
};
