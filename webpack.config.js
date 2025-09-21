const path = require("path");

module.exports = {
  entry: {
    main: [
      "./build/UI/simEvents.js",
      "./build/UI/simState.js",
      "./build/UI/render.js",
      "./build/UI/buttonEvents.js",
      "./build/UI/settings.js",
      "./build/Sim/Terminal/main.js",
    ],
  },
  output: {
    path: path.resolve(__dirname, "./build"),
    filename: "bundle.js",
  },
  watch: false,
  watchOptions: {
    ignored: "**/node_modules",
  },
};
