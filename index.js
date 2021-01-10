process.env.YTDL_NO_UPDATE = true;

module.exports = {
    version: require('./package.json').version,
    Player: require('./src/Player')
}
