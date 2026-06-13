import 'dotenv/config';
import { initializeBrowserProfile } from './scraper.js';

initializeBrowserProfile().catch((err) => {
  console.error('\n✗ Browser initialization failed:', err.message);
  process.exit(1);
});
