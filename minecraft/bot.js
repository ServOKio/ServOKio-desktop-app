const mineflayer = require('mineflayer');
let bot = null;

function createBot(nick, host, version){
  bot = mineflayer.createBot({
    host: host,
    port: 25565,
    username: nick,
    version: version
  });
  return bot;
}

module.exports.da = () => {
  return 'lol';
}