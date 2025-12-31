// Scenario Dashboard Observable Module
// To use: paste individual cells below into your Observable notebook

// Cell 1: Title & Description
md`# Scenario Dashboard (Observable)

Select a scenario to view financial metrics over quarters.`

// Cell 2: Load & Parse Data
scenarioData = (async () => {
  const d3 = await require('d3@7');
  try {
    const text = await FileAttachment("QuarterlyPnL_data@4.csv").text();
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
})()

// Cell 3: Scenario Selector
viewof scenario = {
  const scenarios = Array.from(new Set(scenarioData.map(d => d.Scenario).filter(Boolean)));
  const opts = scenarios.length ? scenarios : ['Base','Optimistic','Pessimistic'];
  const defaultVal = opts.includes('Base') ? 'Base' : opts[0];
  return Inputs.select({label: 'Scenario', options: opts, value: defaultVal});
}

// Cell 4: Render Charts
{
  const vegaEmbed = await require('https://cdn.jsdelivr.net/npm/vega-embed@6');

  const container = html`<div style="display:flex;flex-direction:column;gap:18px;width:100%"></div>`;
  if (!scenarioData || scenarioData.length === 0) {
    container.append(html`<div style="color:#666">No data loaded — attach QuarterlyPnL_data@4.csv via FileAttachment.</div>`);
    return container;
  }

  const metrics = ['Gross Revenue', 'Net Margins', 'Net Revenue Retention', 'CAC Payback'];

  // Filter and sort by QuarterDate
  const filtered = scenarioData.filter(d => (d.Scenario === scenario)).slice().sort((a,b) => (a.QuarterDate || 0) - (b.QuarterDate || 0));

  if (filtered.length === 0) {
    container.append(html`<div style="color:#999">No rows for scenario ${scenario}. Showing nothing.</div>`);
    return container;
  }

  // Arrange charts in a 2x2 CSS grid (small multiples)
  const grid = html`<div style="display:grid;grid-template-columns: repeat(2, 1fr);gap:18px;width:100%"></div>`;

  for (const metric of metrics) {
    const div = html`<div style="width:100%;height:260px"></div>`;
    const values = filtered.map(d => ({Quarter: d.QuarterDate ? d.QuarterDate.toISOString() : (d.Quarter || d.Quarters), value: isNaN(d[metric]) ? null : d[metric]}));

    // Per-metric y-axis formatting
    let yAxis = { title: metric };
    if (metric === 'Gross Revenue') {
      yAxis.format = '$,.0f';
    } else if (metric === 'Net Margins' || metric === 'Net Revenue Retention') {
      // Show as percent with one decimal
      yAxis.labelExpr = "format(datum.value, '.1f') + '%'";
    } else if (metric === 'CAC Payback') {
      yAxis.format = '.1f';
    }

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: metric + ' — ' + scenario,
      data: { values },
      mark: { type: 'line', point: true },
      encoding: {
        x: { field: 'Quarter', type: 'temporal', axis: { title: 'Quarter' } },
        y: { field: 'value', type: 'quantitative', axis: yAxis }
      },
      width: 380,
      height: 260
    };

    try {
      await vegaEmbed(div, spec, { actions: false });
    } catch (err) {
      console.error('vega-embed error', err);
    }
    grid.append(div);
  }

  container.append(grid);

  return container;
}
