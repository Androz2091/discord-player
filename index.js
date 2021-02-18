process.env.YTDL_NO_UPDATE = true

module.exports = {
    Extractors: require('./src/Extractors/Extractor'),
    version: require('./package.json').version,
    Player: require('./src/Player')
}
