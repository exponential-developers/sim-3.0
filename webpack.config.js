const path = require("path");

module.exports = {
  entry: {
    main: [
      "./build/Sim/main.js",
      "./build/Sim/write.js",
      "./build/UI/buttonEvents.js",
      "./build/UI/render.js",
      "./build/UI/settings.js",
      "./build/UI/simState.js"
    ],
  },
  output: {
    path: path.resolve(__dirname, "./build"),
    filename: "bundle.js",
  }
};
