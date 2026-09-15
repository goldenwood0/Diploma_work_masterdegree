import { createApp } from './app.js';
import { getConfig } from './config.js';
import { ReminderService } from './reminder.service.js';

const app = await createApp();
await app.listen(getConfig().API_PORT, '127.0.0.1');
app.get(ReminderService).start();
console.log(`ZhPath API listening on port ${getConfig().API_PORT}`);
