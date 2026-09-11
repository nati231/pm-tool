require('dotenv').config();

async function createDb() {
  await import('temporal-polyfill/global');

  const { default: postgres } = await import('@prisma/orm-postgres/runtime');

  const { default: contractJson } = await import('./contract.json', {
    with: { type: 'json' }
  });

  return postgres({
    contractJson,
    url: process.env.DATABASE_URL
  });
}

module.exports = createDb;