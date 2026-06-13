import 'dotenv/config';
import { initializeBrowserProfile } from './scraper.js';

initializeBrowserProfile({ waitForClose: true })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n✗ Browser initialization failed:', err.message);
    process.exit(1);
  });
