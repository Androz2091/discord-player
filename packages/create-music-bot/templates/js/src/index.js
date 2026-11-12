import { createBot } from './bot.js';
import { loadConfig } from './config.js';

const bot = createBot(loadConfig());

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    console.log(`${signal} received. Shutting down...`);
    void bot.stop();
  });
}

try {
  await bot.start();
} catch (error) {
  console.error('Could not log in to Discord. Check DISCORD_TOKEN in .env:', error);

  process.exitCode = 1;
  await bot.stop();
}
