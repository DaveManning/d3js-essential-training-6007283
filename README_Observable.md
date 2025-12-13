# Observable Notebook Setup Guide

This guide explains how to use the Observable conversion files to visualize your data in Observable notebooks.

## Files Included

- `Pareto.observable.js` — Pareto chart with dropdown selector (uses `Pareto_data.csv`)
- `Scenario.observable.js` — Financial metrics dashboard (uses `QuarterlyPnL_data.csv`)
- `vega_specs/` — Reusable Vega-Lite chart specifications

## How to Set Up Each Notebook

### 1. Pareto Chart Notebook

**Step 1:** Create a new Observable notebook at [observablehq.com](https://observablehq.com).

**Step 2:** Attach the data file.
- Click the **"Files"** panel on the left.
- Upload `Pareto_data.csv`.

**Step 3:** Add three cells.
Open `Pareto.observable.js` in your editor and copy each section into a separate Observable cell:

**Cell 1 — Title:**
```javascript
md`# Pareto Chart (Observable version)

Automatically loads \`Pareto_data.csv\`. Requires columns: \`Pain Points\` and impact metrics.`
```

**Cell 2 — Load Data:**
```javascript
data = {
  const d3 = await require('d3@7');
  try {
    const file = await FileAttachment("Pareto_data.csv").text();
    return d3.csvParse(file);
  } catch(e) {
    console.warn("CSV not found via FileAttachment:", e.message);
    return [];
  }
}
```

**Cell 3 — Render Chart:**
Copy the entire rendering block from `Pareto.observable.js` (starting with `{` and ending with `}`). This includes the Plotly setup, data aggregation, and interactive dropdown.

---

### 2. Scenario Dashboard Notebook

**Step 1:** Create a new Observable notebook.

**Step 2:** Attach the data file.
- Click **"Files"** panel.
- Upload `QuarterlyPnL_data.csv`.

**Step 3:** Add cells.
Open `Scenario.observable.js` and copy the sections:

**Cell 1 — Title:**
```javascript
md`# Scenario Dashboard (Observable)

Select a scenario to view financial metrics over quarters.`
```

**Cell 2 — Load Data:**
```javascript
data = {
  const d3 = await require('d3@7');
  try {
    const text = await FileAttachment("QuarterlyPnL_data.csv").text();
    const rows = d3.csvParse(text);

    // helper to convert quarter strings like '2024-Q1' -> Date (start of quarter)
    function quarterToDate(q) {
      if (!q) return null;
      const s = q.replace(' ', '').replace('q', 'Q');
      const m = s.match(/(\d{4})[- ]?Q(\d)/i);
      if (!m) return new Date(q);
      const year = +m[1];
      const qnum = +m[2];
      const month = (qnum - 1) * 3;
      return new Date(Date.UTC(year, month, 1));
    }

    // Parse numeric metrics and Quarter dates
    const metrics = ['Gross Revenue', 'Net Margins', 'Net Revenue Retention', 'CAC Payback'];
    rows.forEach(r => {
      r.QuarterDate = quarterToDate(r.Quarter || r.Quarters || r['Quarter']);
      metrics.forEach(m => {
        const v = r[m];
        r[m] = v == null || v === '' ? NaN : +String(v).replace(/[,$%]/g, '');
      });
    });

    // Auto-detect and scale percentage-like metrics to percent (0-100)
    metrics.forEach(m => {
      const vals = rows.map(r => r[m]).filter(v => !isNaN(v));
      if (vals.length === 0) return;
      const max = Math.max(...vals);
      if ((m === 'Net Margins' || m === 'Net Revenue Retention') && max <= 5) {
        rows.forEach(r => { if (!isNaN(r[m])) r[m] = r[m] * 100; });
      }
    });

    return rows;
  } catch (e) {
    console.warn('CSV not found via FileAttachment:', e.message);
    return [];
  }
}
```

**Cell 3 — Scenario Selector:**
```javascript
viewof scenario = {
  const scenarios = Array.from(new Set(data.map(d => d.Scenario).filter(Boolean)));
  const opts = scenarios.length ? scenarios : ['Base','Optimistic','Pessimistic'];
  const defaultVal = opts.includes('Base') ? 'Base' : opts[0];
  return Inputs.select({label: 'Scenario', options: opts, value: defaultVal});
}
```

**Cell 4 — Render Charts:**
Copy the entire rendering block from `Scenario.observable.js` (the large async function that uses `vega-embed` and the `vega-lite` specs). This renders the 2x2 grid of Vega-Lite charts.

---

## Summary

Both notebooks follow the same pattern:
1. **Cell 1** — Markdown title
2. **Cell 2** — Data loading from `FileAttachment`
3. **Cell 3+** — Selector (if applicable) and rendering

Observable will automatically execute cells in dependency order, so attach files first, then paste cells from top to bottom.

---

## Troubleshooting

- **"No data loaded"** message? Ensure the CSV file is attached via the **Files** panel and matches the expected filename.
- **Syntax errors?** Check that you've pasted the full cell block and there are no missing braces `{}`.
- **Charts not showing?** Try refreshing the notebook or checking the browser console for errors (press F12).

---

For more help, see the [Observable documentation](https://observablehq.com/@observablehq/how-observable-works).
