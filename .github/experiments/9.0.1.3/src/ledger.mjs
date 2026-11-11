export function buildLedger(entries) {
  return entries.reduce((ledger, entry) => {
    ledger.reservedMinutes += entry.minutesReserved;
    ledger.dispositions[entry.disposition] = (ledger.dispositions[entry.disposition] ?? 0) + 1;
    return ledger;
  }, { reservedMinutes: 0, dispositions: {} });
}
