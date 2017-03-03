var path = require('path')
var webpack = require('webpack')

module.exports = {

    entry: ['./src/main.js'],

    watch: true,

    output: {
        path: path.resolve(__dirname, './dist'),
        publicPath: '/dist/',
        filename: 'main.js'
    },

    module: {

        rules: [
            {
                test: /\.js$/,
                loader: 'babel-loader',
                exclude: /node_modules/
            },
        ]

    },

    // https://webpack.js.org/configuration/dev-server/
    devServer: {
        historyApiFallback: true,
        //hot: true, // must be set as a flag
        inline: true,
        quiet: false,
        //https: true,
        open: true,
        //host: '0.0.0.0', // for external testing
    },

    devtool: '#eval-source-map',

}


if (process.env.NODE_ENV === 'production') {
    module.exports.devtool = '#source-map';
    module.exports.output.publicPath = '/';
    // http://vue-loader.vuejs.org/en/workflow/production.html
    module.exports.plugins = (module.exports.plugins || []).concat([
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: '"production"',
            },
        }),
        new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: false,
            },
        }),
    ])
}
