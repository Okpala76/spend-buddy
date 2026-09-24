import { constants } from 'node:fs';
import { copyFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const copies = [
  ['apps/web/.env.example', 'apps/web/.env.local'],
  ['apps/api/.env.example', 'apps/api/.env'],
];

for (const [source, destination] of copies) {
  try {
    await copyFile(new URL(source, root), new URL(destination, root), constants.COPYFILE_EXCL);
    console.log('Created ' + destination + ' (public configuration only).');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log('Preserved existing ' + destination + '.');
  }
}
console.log('Next: npm run dev — open http://localhost:3000');
