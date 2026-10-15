import 'dotenv/config';
import { closeDb } from '../db.js';
import { seedMobileDemo } from '../lib/demo-data.js';

try {
  const fixture = await seedMobileDemo();
  console.table(
    fixture.accounts.map(({ role, phoneNumber }) => ({ role, phoneNumber })),
  );
  console.log(
    'Mobile demo accounts and menu are ready. Password: MOBILE_DEMO_PASSWORD or the documented demo password.',
  );
} finally {
  await closeDb();
}
