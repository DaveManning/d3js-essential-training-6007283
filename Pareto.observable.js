export default function define(runtime, observer) {
  const main = runtime.module();

  main.variable(observer()).define(["md"], function(md){
    return md`# Pareto Chart (Observable version)

Automatically loads \`generateImpactAnalysisData_data.csv\`. Requires columns: \`Pain Points\` and impact metrics.`;
  });

  main.variable(observer("data")).define("data", ["require","FileAttachment"], async function(require, FileAttachment){
    const d3 = await require('d3@7');
    try {
      const file = await FileAttachment("Pareto_data.csv").text();
      return d3.csvParse(file);
    } catch(e) {
      console.warn("CSV not found via FileAttachment:", e.message);
      return [];
    }
  });

  main.variable(observer()).define(["data","require","html"], async function(data, require, html){
    const Plotly = await require('https://cdn.plot.ly/plotly-2.20.0.min.js');

    const container = html`<div style="width:100%;height:600px"></div>`;
    if (!data || data.length === 0) {
      container.append("\n", html`<div style="color:#666">No data loaded — upload a CSV using the input above.</div>`);
      return container;
    }

    // Columns expected (from original notebook)
    const impactCols = [
      "Revenue impact",
      "Margin impact",
      "Cash impact",
      "Customer impact",
      "Strategic impact"
    ];

    // Aggregate by Pain Points (mean), then sort descending
    const byPain = {};
    data.forEach(d => {
      const key = d['Pain Points'];
      if (!byPain[key]) byPain[key] = {count:0};
      byPain[key].count++;
      impactCols.forEach(c => {
        const v = parseFloat(d[c]);
        byPain[key][c] = (byPain[key][c]||0) + (isNaN(v)?0:v);
      });
    });

    const agg = Object.keys(byPain).map(k => {
      const obj = { 'Pain Points': k };
      impactCols.forEach(c => { obj[c] = (byPain[k][c]||0) / byPain[k].count; });
      return obj;
    });

    function prepareTraces(col) {
      const sorted = agg.slice().sort((a,b) => (b[col]||0) - (a[col]||0));
      const vals = sorted.map(d=> +d[col] || 0);
      const y = sorted.map(d=> d['Pain Points']);
      const cum = vals.reduce((acc,v,i,arr)=>{ if (i===0) acc.push(v); else acc.push(acc[i-1]+v); return acc; }, []);
      const total = cum.length? cum[cum.length-1]: 0;
      const pct = total? cum.map(v=> v/total*100) : cum.map(()=>0);

      const bar = {
        type: 'bar',
        x: vals,
        y: y,
        orientation: 'h',
        name: col,
        marker: {color: 'steelblue'},
        xaxis: 'x1'
      };

      const line = {
        type: 'scatter',
        x: pct,
        y: y,
        mode: 'lines+markers',
        name: 'Cumulative % of ' + col,
        marker: {color: 'firebrick'},
        xaxis: 'x2'
      };

      const cutoff = {
        type: 'scatter',
        x: [80,80],
        y: [y[0], y[y.length-1]],
        mode: 'lines',
        line: {color: 'green', dash: 'dash'},
        name: '80% cutoff for ' + col,
        showlegend: false,
        xaxis: 'x2'
      };

      return [bar, line, cutoff];
    }

    // Build initial traces for default column
    const defaultCol = impactCols[0];
    const traces = [];
    impactCols.forEach((col, i) => {
      const t = prepareTraces(col);
      // set visibility only for default
      t.forEach(trace => trace.visible = (col === defaultCol));
      traces.push(...t);
    });

    const buttons = impactCols.map((col, i) => {
      const visibility = impactCols.map((_, j) => [j===i,j===i,j===i]).flat();
      return {
        label: col,
        method: 'update',
        args: [ { visible: visibility }, {
          xaxis: {title: col + ' (score)'},
          xaxis2: { title: 'Cumulative % of total ' + col, overlaying: 'x', side: 'top', range: [0,110]},
          title: 'Pareto Chart (Horizontal) – ' + col + ' by Pain Point'
        }]
      };
    });

    const layout = {
      updatemenus: [{ type: 'dropdown', direction: 'down', buttons: buttons, x:0.0, y:1.15, xanchor:'left', yanchor:'top' }],
      title: 'Pareto Chart (Horizontal) – ' + defaultCol + ' by Pain Point',
      yaxis: {title: 'Pain Points'},
      xaxis: {title: defaultCol + ' (score)', side: 'bottom'},
      xaxis2: { title: 'Cumulative % of total ' + defaultCol, overlaying: 'x', side: 'top', range: [0,110]},
      hovermode: 'y unified',
      legend: { orientation: 'h', yanchor: 'bottom', y: 1.02, xanchor: 'right', x: 1.0 }
    };

    Plotly.newPlot(container, traces, layout, {responsive: true});
    return container;
  });

  return main;
}
