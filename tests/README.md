Medication workflow checks use synthetic daily and FAST data and never write to Google Sheets.

Run with Playwright installed:

```sh
node tests/medication-workflow.cjs
```

Optional environment variables:

- `PLAYWRIGHT_MODULE`: installed Playwright module path.
- `CHROME_PATH`: Chrome executable (otherwise Playwright's Chromium).
- `MEDICATION_FIXTURE`: local JSON containing `tn`, `bp`, and `fast` arrays, for read-only checks against a downloaded data snapshot. Keep snapshots out of Git.

The checks cover cascading filters, original P/Q text, dates, separate lot/branch identities, full-flock comparisons, user-approved name mappings, incompatible units, CSV output, and partial source failures. The browser clock is fixed for reproducible source-date checks.

Rebuild the standalone reporting HTML after changing the medication workflow:

```sh
python3 ui/build-medication.py
```

Area performance and temperature scope checks:

```sh
node tests/performance-temperature.cjs
```

These use synthetic data by default. Optional `ZONE_FIXTURE` and `TEMP_FIXTURE` point to read-only, local snapshots for checking against live source values. The checks cover source loading, the seven whole-flock measures, weighted area totals, missing data, historical cutoffs, CSV export, and temperature range/day/latest-date behavior.

Rebuild these two modules with `python3 ui/build-performance.py`.
