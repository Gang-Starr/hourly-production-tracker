import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/ init\(\);\s*$/, '');
const sandbox = {
  console,
  structuredClone,
  crypto: { randomUUID: () => 'test-id' },
  localStorage: { getItem: () => null, setItem: () => {} },
  window: { addEventListener: () => {}, devicePixelRatio: 1 },
  document: { documentElement: {}, addEventListener: () => {}, querySelectorAll: () => [], getElementById: () => ({}) },
  navigator: {},
};
vm.runInNewContext(`${source}\nthis.__api={calc,managementMetrics,mText,parseJsonBackup,defaultMaster,compareProductionEntries,productionTimeOrder};this.__setLang=(value)=>{lang=value};`, sandbox);
const { calc, managementMetrics, mText, parseJsonBackup, defaultMaster, compareProductionEntries, productionTimeOrder } = sandbox.__api;

const row = (target, produced, scrap = 0, extra = {}) => ({ target, produced, scrap, downtime: 0, timeSlot: extra.timeSlot || '06:00–07:00', date: '2026-07-15', ...extra });
const summary = (language, rows) => {
  sandbox.__setLang(language);
  return mText('main', managementMetrics(rows));
};

{
  const rows = [row(250, 214), row(250, 200), row(250, 264)];
  const metrics = managementMetrics(rows);
  assert.equal(metrics.totals.target, 750);
  assert.equal(metrics.totals.good, 678);
  assert.equal(metrics.totals.lost, 86);
  assert.equal(metrics.totals.netBacklog, 72);
  assert.equal(summary('de', rows), 'Für die ausgewählte Ansicht wurden 678 Gutteile bei einem Ziel von 750 Stück erreicht. Die Zielerreichung beträgt 90,4 %. Die Summe der stündlichen Unterdeckungen liegt bei 86 Stück. Gegenüber dem Gesamtziel besteht ein Nettorückstand von 72 Stück.');
}

{
  const rows = [row(100, 100), row(100, 100)];
  const metrics = managementMetrics(rows);
  assert.equal(metrics.totals.lost, 0);
  assert.equal(metrics.totals.netBacklog, 0);
  assert.match(summary('de', rows), /Unterdeckungen liegt bei 0 Stück/);
  assert.match(summary('de', rows), /Nettorückstand von 0 Stück/);
}

{
  const rows = [row(100, 110), row(100, 90)];
  const metrics = managementMetrics(rows);
  assert.equal(metrics.totals.target, metrics.totals.good);
  assert.equal(metrics.totals.lost, 10);
  assert.equal(metrics.totals.netBacklog, 0);
}

{
  const rows = [row(100, 130), row(100, 95)];
  const metrics = managementMetrics(rows);
  assert.equal(metrics.totals.lost, 5);
  assert.equal(metrics.totals.netBacklog, 0);
  assert.equal(metrics.totals.overproduction, 25);
  assert.match(summary('de', rows), /Mehrproduktion von 25 Stück/);
}

{
  const overproductionWithScrap = calc(row(100, 130, 20));
  assert.equal(overproductionWithScrap.good, 110);
  assert.equal(overproductionWithScrap.dev, 10);
  assert.equal(overproductionWithScrap.lost, 0);
  assert.equal(Math.round(overproductionWithScrap.ach), 110);
  const underproductionWithScrap = calc(row(100, 90, 20));
  assert.equal(underproductionWithScrap.good, 70);
  assert.equal(underproductionWithScrap.dev, -30);
  assert.equal(underproductionWithScrap.lost, 30);
  assert.equal(underproductionWithScrap.ach, 70);
}

{
  const allRows = [row(100, 80, 0, { project: 'A' }), row(100, 100, 0, { project: 'B' })];
  const filteredRows = allRows.filter((entry) => entry.project === 'B');
  assert.equal(managementMetrics(allRows).totals.lost, 20);
  assert.equal(managementMetrics(filteredRows).totals.lost, 0);
}

{
  const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /copyText:text/);
}

{
  const rows = [row(100, 80), row(100, 130)];
  assert.match(summary('en', rows), /sum of hourly shortfalls is 20 pcs/);
  assert.match(summary('it', rows), /sottocoperture orarie è di 20 pezzi/);
}


{
  const rows = [
    row(100, 100, 0, { id: 'c', shift: 'night_shift', timeSlot: '00:00–01:00' }),
    row(100, 100, 0, { id: 'd', shift: 'night_shift', timeSlot: '01:00–02:00' }),
    row(100, 100, 0, { id: 'a', shift: 'night_shift', timeSlot: '22:00–23:00' }),
    row(100, 100, 0, { id: 'b', shift: 'night_shift', timeSlot: '23:00–00:00' }),
  ];
  assert.deepEqual(rows.sort(compareProductionEntries).map((entry) => entry.timeSlot), ['22:00–23:00', '23:00–00:00', '00:00–01:00', '01:00–02:00']);
}

{
  const rows = [
    row(100, 100, 0, { id: 'c', shift: 'night_shift', timeSlot: '00:30–01:30' }),
    row(100, 100, 0, { id: 'a', shift: 'night_shift', timeSlot: '22:15–23:15' }),
    row(100, 100, 0, { id: 'b', shift: 'night_shift', timeSlot: '23:45–00:45' }),
  ];
  assert.deepEqual(rows.sort(compareProductionEntries).map((entry) => entry.timeSlot), ['22:15–23:15', '23:45–00:45', '00:30–01:30']);
  assert.equal(productionTimeOrder({ timeSlot: 'bad value' }), Number.POSITIVE_INFINITY);
}



{
  const rows = [
    row(100, 100, 0, { id: 'other', shift: 'other', timeSlot: '06:00–07:00' }),
    row(100, 100, 0, { id: 'late', shift: 'late_shift', timeSlot: '14:00–15:00' }),
    row(100, 100, 0, { id: 'night', shift: 'night_shift', timeSlot: '22:00–23:00' }),
    row(100, 100, 0, { id: 'early', shift: 'early_shift', timeSlot: '13:00–14:00' }),
  ];
  assert.deepEqual(rows.sort(compareProductionEntries).map((entry) => entry.shift), ['early_shift', 'late_shift', 'night_shift', 'other']);
}

{
  sandbox.__setLang('en');
  const restored = parseJsonBackup(JSON.stringify({
    master: defaultMaster,
    entries: [{ date: '2026-07-15', shift: 'Early shift', team: 'Team 1', timeSlot: '06:00–07:00', project: 'Project A', product: 'Product 100', machine: 'Line 1', target: '850', produced: '900', scrap: '53', downtime: null, lossCategory: 'Quality', lossReason: 'High scrap' }],
  }));
  assert.equal(typeof restored.nextEntries[0].target, 'number');
  assert.equal(restored.nextEntries[0].target, 850);
  assert.equal(restored.nextEntries[0].scrap, 53);
  assert.equal(restored.nextEntries[0].downtime, 0);
  assert.equal(restored.nextEntries[0].shift, 'early_shift');
  assert.equal(restored.nextEntries[0].team, 'team_1');
}

{
  sandbox.__setLang('en');
  assert.throws(() => parseJsonBackup(JSON.stringify({ master: defaultMaster, entries: [{ date: '2026-07-15', shift: 'early_shift', team: 'team_1', timeSlot: '06:00–07:00', project: 'Project A', product: 'Product 100', machine: 'Line 1', target: 100, produced: 10, scrap: 11, downtime: 0 }] })), /scrap is greater/);
  assert.throws(() => parseJsonBackup(JSON.stringify({ master: defaultMaster, entries: [{ date: '2026-02-31', shift: 'early_shift', team: 'team_1', timeSlot: '06:00–07:00', project: 'Project A', product: 'Product 100', machine: 'Line 1', target: 100, produced: 100, scrap: 0, downtime: 0 }] })), /date is missing or invalid/);
  assert.throws(() => parseJsonBackup(JSON.stringify({ master: defaultMaster, entries: { bad: true } })), /JSON restore failed/);
}
