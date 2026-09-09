import { createApp } from './app.js';
import { getConfig } from './config.js';

const app = await createApp();
await app.listen(getConfig().API_PORT, '127.0.0.1');
console.log(`ZhPath API listening on port ${getConfig().API_PORT}`);
