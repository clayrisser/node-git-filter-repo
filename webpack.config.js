const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/index.ts',
  target: 'node',
  resolve: {
    extensions: ['.mjs', '.tsx', '.ts', '.js', '.jsx']
  },
  output: {
    filename: 'bundle.js',
    library: 'captainHook',
    libraryExport: 'default',
    libraryTarget: 'assign',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.(m?js)|([jt]sx?)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            babelrc: true,
            envName: 'umd'
          }
        }
      }
    ]
  }
};
