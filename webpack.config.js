const path = require("path");

module.exports = {
  entry: {
    main: [
      "./src/Sim/main.ts",
      "./src/Sim/write.ts",
      "./src/UI/buttonEvents.ts",
      "./src/UI/render.ts",
      "./src/UI/settings.ts",
      "./src/UI/simState.ts"
    ],
  },
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, 'build'),
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
      }
    ]
  }
};
