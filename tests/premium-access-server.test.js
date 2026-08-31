const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { hasPremiumAccess, isPremiumActive } = require('../api/_lib/premium-access');
const geminiSource = fs.readFileSync(path.join(__dirname, '..', 'api', 'gemini.js'), 'utf8');
const originCacheSource = fs.readFileSync(path.join(__dirname, '..', 'api', 'name-origin-cache.js'), 'utf8');
const premiumSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', '14-admob.js'), 'utf8');
const marketingSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'marketing.html'), 'utf8');

test('server premium access accepts active paid users and active self trials', () => {
  const now = new Date('2026-08-31T00:00:00.000Z').getTime();
  assert.equal(isPremiumActive({ isPremium: true }, now), true);
  assert.equal(isPremiumActive({ trialStatus: 'active', trialEndsAt: '2026-09-01T00:00:00.000Z' }, now), true);
  assert.equal(isPremiumActive({ subscriptionStatus: 'expired', isPremium: true }, now), false);
});

test('partner trials are not shared but a paid partner remains eligible', () => {
  const now = new Date('2026-08-31T00:00:00.000Z').getTime();
  assert.equal(isPremiumActive({ trialStatus: 'active' }, now, { allowTrial: false }), false);
  assert.equal(isPremiumActive({ subscriptionStatus: 'active', premiumProductId: 'meimay_monthly' }, now, { allowTrial: false }), true);
});

test('server resolves a paid partner as premium without sharing partner trials', async () => {
  const createDb = (documents) => ({
    collection(collectionName) {
      return {
        doc(id) {
          return { key: `${collectionName}/${id}` };
        },
      };
    },
    documents,
  });
  const createTx = (db) => ({
    async get(ref) {
      const data = db.documents[ref.key];
      return {
        exists: data !== undefined,
        data: () => data,
      };
    },
  });
  const now = new Date('2026-08-31T00:00:00.000Z').getTime();
  const paidDb = createDb({
    'users/me': { roomCode: 'PAIR01' },
    'rooms/PAIR01': { memberAUid: 'me', memberBUid: 'partner' },
    'users/partner': { subscriptionStatus: 'active', premiumProductId: 'meimay_monthly' },
  });
  assert.deepEqual(await hasPremiumAccess(createTx(paidDb), paidDb, 'me', now), {
    active: true,
    source: 'partner',
  });

  const trialDb = createDb({
    'users/me': { roomCode: 'PAIR01' },
    'rooms/PAIR01': { memberAUid: 'me', memberBUid: 'partner' },
    'users/partner': { trialStatus: 'active', trialEndsAt: '2026-09-01T00:00:00.000Z' },
  });
  assert.deepEqual(await hasPremiumAccess(createTx(trialDb), trialDb, 'me', now), {
    active: false,
    source: '',
  });
});

test('Gemini and origin allowance use the same server-side premium resolver', () => {
  assert.match(geminiSource, /const \{ hasPremiumAccess \} = require\("\.\/_lib\/premium-access"\)/);
  assert.match(geminiSource, /\{ dailyUnlimited: premium\.active \}/);
  assert.match(originCacheSource, /const \{ hasPremiumAccess \} = require\('\.\/_lib\/premium-access'\)/);
});

test('premium origin generation is described as unlimited in app and store marketing', () => {
  assert.match(premiumSource, /名前の(?:\\n)?由来生成', free: '1日1回', premium: '無制限'/);
  assert.match(marketingSource, /<td>AIで由来案を作成<\/td>[\s\S]*?<td>1日1回<\/td>[\s\S]*?<td>無制限<\/td>/);
});
