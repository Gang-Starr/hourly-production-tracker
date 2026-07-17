import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/ init\(\);\s*$/, '');
const elements = {};
const element = (id) => elements[id] || (elements[id] = { value: '' });
const sandbox = {
  console,
  structuredClone,
  crypto: { randomUUID: () => 'test-id' },
  localStorage: { getItem: () => null, setItem: () => {} },
  window: { addEventListener: () => {}, devicePixelRatio: 1 },
  document: { documentElement: {}, addEventListener: () => {}, querySelectorAll: () => [], getElementById: element },
  navigator: {},
};
vm.runInNewContext(`${source}\nthis.__api={calc,managementMetrics,mText,parseJsonBackup,defaultMaster,compareProductionEntries,productionTimeOrder,buildHandoverCopyText,buildHandoverCopyContent,actionList};this.__setLang=(value)=>{lang=value};this.__setEntries=(value)=>{entries=value};`, sandbox);
const { calc, managementMetrics, mText, parseJsonBackup, defaultMaster, compareProductionEntries, productionTimeOrder, buildHandoverCopyText, buildHandoverCopyContent, actionList } = sandbox.__api;

const row = (target, produced, scrap = 0, extra = {}) => ({ target, produced, scrap, downtime: 0, timeSlot: extra.timeSlot || '06:00–07:00', date: '2026-07-15', ...extra });
const handoverRow = (target, produced, scrap = 0, extra = {}) => row(target, produced, scrap, { date: '2026-07-16', shift: 'early_shift', ...extra });
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
  const restored = parseJsonBackup(JSON.stringify({
    master: defaultMaster,
    entries: [
      { date: '2026-07-14', shift: 'early_shift', team: 'team_1', timeSlot: '06:00–07:00', project: 'Project A', product: 'Product 100', machine: 'Line 1', target: 100, produced: 100, scrap: 0, downtime: 0 },
      { date: '2026-07-16', shift: 'early_shift', team: 'team_1', timeSlot: '07:00–08:00', project: 'Project A', product: 'Product 100', machine: 'Line 1', target: 100, produced: 100, scrap: 0, downtime: 0 },
      { date: '2026-07-17', shift: 'early_shift', team: 'team_1', timeSlot: '08:00–09:00', project: 'Project A', product: 'Product 100', machine: 'Line 1', target: 100, produced: 100, scrap: 0, downtime: 0 },
    ],
  }));
  assert.equal(restored.nextEntries.map((entry) => entry.date).join(','), '2026-07-14,2026-07-16,2026-07-17');
}

{
  sandbox.__setLang('en');
  assert.throws(() => parseJsonBackup(JSON.stringify({ master: defaultMaster, entries: [{ date: '2026-07-15', shift: 'early_shift', team: 'team_1', timeSlot: '06:00–07:00', project: 'Project A', product: 'Product 100', machine: 'Line 1', target: 100, produced: 10, scrap: 11, downtime: 0 }] })), /scrap is greater/);
  assert.throws(() => parseJsonBackup(JSON.stringify({ master: defaultMaster, entries: [{ date: '2026-02-31', shift: 'early_shift', team: 'team_1', timeSlot: '06:00–07:00', project: 'Project A', product: 'Product 100', machine: 'Line 1', target: 100, produced: 100, scrap: 0, downtime: 0 }] })), /date is missing or invalid/);
  assert.throws(() => parseJsonBackup(JSON.stringify({ master: defaultMaster, entries: { bad: true } })), /JSON restore failed/);
}


const configureHandover = (language, rows, manual = {}) => {
  sandbox.__setLang(language);
  sandbox.__setEntries(rows);
  element('filterDate').value = '2026-07-16';
  element('filterShift').value = 'early_shift';
  element('filterTeam').value = '';
  element('filterProject').value = '';
  element('filterProduct').value = '';
  element('filterMachine').value = '';
  element('handoverOpenPoints').value = manual.openPoints || '';
  element('handoverEquipmentStatus').value = manual.equipmentStatus || '';
  element('handoverPriority').value = manual.priority || '';
};

{
  const rows = [
    handoverRow(150, 120, 5, { team: 'team_1', machine: 'Machine A', timeSlot: '06:00–07:00', lossCategory: 'Machine', lossReason: 'Machine breakdown', action: 'Schieber eingestellt' }),
    handoverRow(150, 130, 10, { team: 'team_1', machine: 'Machine A', timeSlot: '07:00–08:00', lossCategory: 'Machine', lossReason: 'Machine breakdown', action: 'Schieber eingestellt' }),
  ];
  configureHandover('de', rows, { openPoints: 'Maschine A beobachten', equipmentStatus: 'Anlage läuft', priority: 'Team informieren' });
  const text = buildHandoverCopyText();
  assert.match(text, /^SCHICHTÜBERGABE\n\nDatum: 16\.07\.2026\nSchicht: Frühschicht\nTeam: Team 1\nAnlage: Maschine A/m);
  assert.match(text, /PRODUKTIONSERGEBNIS\nZielmenge: 300 Stück\nProduzierte Menge: 250 Stück\nGutmenge: 235 Stück\nZielerreichung: 78,3 %/);
  assert.match(text, /ABWEICHUNGEN\nZeitfenster unter Ziel: 2\nSchwächstes Zeitfenster: 06:00–07:00 Uhr\nHauptursache: Maschine \/ Maschinenausfall/);
  assert.equal((text.match(/Schieber eingestellt/g) || []).length, 1);
  assert.match(text, /OFFENE PUNKTE FÜR DIE NÄCHSTE SCHICHT\nMaschine A beobachten/);
  assert.match(text, /AKTUELLER ANLAGENSTATUS\nAnlage läuft/);
  assert.match(text, /PRIORITÄT FÜR DIE NÄCHSTE SCHICHT\nTeam informieren/);

  const content = buildHandoverCopyContent();
  assert.equal(content.text, text);
  assert.match(content.html, /font-family:Arial,sans-serif;font-size:11px;font-weight:400;line-height:1\.45;color:#000/);
  assert.match(content.html, /font-size:16px;font-weight:700;margin:0 0 20px 0;">SCHICHTÜBERGABE/);
  assert.match(content.html, /font-size:12px;font-weight:700;margin:22px 0 7px 0;">PRODUKTIONSERGEBNIS/);
  assert.match(content.html, /<div style="font-size:11px;font-weight:400;line-height:1\.45;">Zielmenge: 300 Stück<\/div><div style="font-size:11px;font-weight:400;line-height:1\.45;">Produzierte Menge: 250 Stück<\/div><div style="font-size:11px;font-weight:400;line-height:1\.45;">Gutmenge: 235 Stück/);
  assert.doesNotMatch(content.html, /<br>/);
}


{
  const rows = [handoverRow(100, 100, 0, { team: 'team_1', machine: 'Machine A', action: 'n/a' })];
  configureHandover('de', rows, { openPoints: '  ', equipmentStatus: 'keine', priority: '-' });
  const text = buildHandoverCopyText();
  assert.doesNotMatch(text, /BEREITS DURCHGEFÜHRTE MASSNAHMEN/);
  assert.doesNotMatch(text, /OFFENE PUNKTE FÜR DIE NÄCHSTE SCHICHT|AKTUELLER ANLAGENSTATUS|PRIORITÄT FÜR DIE NÄCHSTE SCHICHT/);
}

{
  const rows = [
    handoverRow(100, 90, 0, { team: 'team_1', machine: 'Line 1' }),
    handoverRow(100, 90, 0, { team: 'team_2', machine: 'Line 2' }),
  ];
  configureHandover('de', rows, { priority: 'Nur Priorität übernehmen' });
  const text = buildHandoverCopyText();
  assert.match(text, /Team: nicht eindeutig/);
  assert.match(text, /Anlage: nicht eindeutig/);
  assert.match(text, /PRIORITÄT FÜR DIE NÄCHSTE SCHICHT\nNur Priorität übernehmen/);
}

{
  const rows = [handoverRow(100, 90, 0, { team: 'team_1', machine: 'Machine A', action: 'Reset done' })];
  configureHandover('en', rows);
  assert.match(buildHandoverCopyText(), /SHIFT HANDOVER[\s\S]*PRODUCTION RESULT[\s\S]*DEVIATIONS[\s\S]*ACTIONS ALREADY TAKEN/);
  configureHandover('it', rows);
  assert.match(buildHandoverCopyText(), /PASSAGGIO DI TURNO[\s\S]*RISULTATO DELLA PRODUZIONE[\s\S]*SCOSTAMENTI[\s\S]*MISURE GIÀ ESEGUITE/);
}

{
  sandbox.__setLang('de');
  assert.equal(JSON.stringify(actionList([{ action: 'n/a' }, { action: 'Schieber eingestellt' }, { action: 'schieber eingestellt' }, { action: 'none' }])), JSON.stringify(['Schieber eingestellt']));
}
