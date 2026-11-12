import { createBot } from './bot.ts';
import { loadConfig } from './config.ts';

const bot = createBot(loadConfig());

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
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
