/**
 * charts/svgCharts.js — Hand-rolled, dependency-free SVG chart renderers.
 * No chart library is used anywhere in the app (explicit product
 * requirement). Every function returns an SVG string; callers set
 * `container.innerHTML = SvgCharts.renderX(...)`.
 */
(function (global) {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)"];

  function colorFor(index) { return PALETTE[index % PALETTE.length]; }

  /**
   * renderLineChart(values, opts)
   * values: number[] (closing prices / portfolio values, chronological)
   * opts: { width, height, color, fillOpacity, showArea, benchmark: number[] }
   */
  function renderLineChart(values, opts) {
    opts = opts || {};
    const width = opts.width || 640;
    const height = opts.height || 220;
    const padding = 8;
    if (!values || values.length < 2) {
      return '<svg viewBox="0 0 ' + width + " " + height + '" class="chart-empty"><text x="50%" y="50%" text-anchor="middle" fill="var(--color-text-subtle)" font-size="13">Not enough data</text></svg>';
    }

    const allSeries = opts.benchmark ? values.concat(opts.benchmark) : values;
    const min = Math.min.apply(null, allSeries);
    const max = Math.max.apply(null, allSeries);
    const range = (max - min) || 1;

    function toPoints(series) {
      return series.map(function (v, i) {
        const x = padding + (i / (series.length - 1)) * (width - padding * 2);
        const y = height - padding - ((v - min) / range) * (height - padding * 2);
        return x.toFixed(2) + "," + y.toFixed(2);
      }).join(" ");
    }

    const points = toPoints(values);
    const color = opts.color || "var(--chart-1)";
    const isUp = values[values.length - 1] >= values[0];
    const lineColor = opts.color || (isUp ? "var(--color-success)" : "var(--color-danger)");

    let areaPath = "";
    if (opts.showArea !== false) {
      const firstX = padding;
      const lastX = width - padding;
      areaPath = '<polygon points="' + firstX + "," + (height - padding) + " " + points + " " + lastX + "," + (height - padding) +
        '" fill="' + lineColor + '" fill-opacity="' + (opts.fillOpacity != null ? opts.fillOpacity : 0.12) + '" stroke="none" />';
    }

    let benchmarkLine = "";
    if (opts.benchmark) {
      benchmarkLine = '<polyline points="' + toPoints(opts.benchmark) + '" fill="none" stroke="var(--color-text-subtle)" stroke-width="1.5" stroke-dasharray="4 4" />';
    }

    let overlayLines = "";
    if (opts.overlays) {
      overlayLines = opts.overlays.map(function (ov) {
        // Overlay series may be shorter (e.g. a moving average with no
        // value for the first N points) — right-align it against `values`.
        const offset = values.length - ov.values.length;
        const padded = new Array(Math.max(0, offset)).fill(null).concat(ov.values);
        const pts = padded.map(function (v, i) {
          if (v == null) return null;
          const x = padding + (i / (values.length - 1)) * (width - padding * 2);
          const y = height - padding - ((v - min) / range) * (height - padding * 2);
          return x.toFixed(2) + "," + y.toFixed(2);
        }).filter(Boolean).join(" ");
        return '<polyline points="' + pts + '" fill="none" stroke="' + (ov.color || "var(--chart-3)") + '" stroke-width="1.5"' +
          (ov.dashed ? ' stroke-dasharray="4 3"' : "") + ' />';
      }).join("");
    }

    return (
      '<svg viewBox="0 0 ' + width + " " + height + '" preserveAspectRatio="none" role="img" aria-label="Price chart">' +
      areaPath +
      benchmarkLine +
      overlayLines +
      '<polyline points="' + points + '" fill="none" stroke="' + lineColor + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />' +
      "</svg>"
    );
  }

  /**
   * renderDonutChart(segments)
   * segments: [{ label, value }]
   */
  function renderDonutChart(segments, opts) {
    opts = opts || {};
    const size = opts.size || 180;
    const thickness = opts.thickness || 26;
    const r = (size - thickness) / 2;
    const cx = size / 2, cy = size / 2;
    const total = segments.reduce(function (s, seg) { return s + seg.value; }, 0) || 1;

    let cumulative = 0;
    const circumference = 2 * Math.PI * r;
    const arcs = segments.map(function (seg, i) {
      const fraction = seg.value / total;
      const dash = fraction * circumference;
      const gap = circumference - dash;
      const offset = -cumulative * circumference;
      cumulative += fraction;
      return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + colorFor(i) +
        '" stroke-width="' + thickness + '" stroke-dasharray="' + dash.toFixed(2) + " " + gap.toFixed(2) +
        '" stroke-dashoffset="' + offset.toFixed(2) + '" transform="rotate(-90 ' + cx + " " + cy + ')" />';
    }).join("");

    return (
      '<svg viewBox="0 0 ' + size + " " + size + '" role="img" aria-label="Allocation breakdown">' + arcs + "</svg>"
    );
  }

  /**
   * renderBarRows(rows) -> HTML (not raw SVG) list of horizontal % bars,
   * used for sector exposure and health-score breakdowns.
   * rows: [{ label, pct, colorIndex, warn }]
   */
  function renderBarRows(rows) {
    return rows.map(function (row, i) {
      const color = row.warn ? "var(--color-danger)" : colorFor(row.colorIndex != null ? row.colorIndex : i);
      return (
        '<div class="bar-row">' +
        '<div class="bar-row-label"><span>' + UI.escapeHTML(row.label) + '</span><span>' + row.pct.toFixed(1) + '%</span></div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + Math.min(100, row.pct) + '%;background:' + color + ';"></div></div>' +
        "</div>"
      );
    }).join("");
  }

  /**
   * renderVolumeChart(volumes) — simple bar chart for daily volume.
   */
  function renderVolumeChart(volumes, opts) {
    opts = opts || {};
    const width = opts.width || 640;
    const height = opts.height || 60;
    if (!volumes || !volumes.length) return "";
    const max = Math.max.apply(null, volumes) || 1;
    const barWidth = width / volumes.length;
    const bars = volumes.map(function (v, i) {
      const barHeight = (v / max) * height;
      return '<rect x="' + (i * barWidth).toFixed(2) + '" y="' + (height - barHeight).toFixed(2) + '" width="' + Math.max(0.6, barWidth - 1).toFixed(2) + '" height="' + barHeight.toFixed(2) + '" fill="var(--color-border-strong)" />';
    }).join("");
    return '<svg viewBox="0 0 ' + width + " " + height + '" preserveAspectRatio="none" role="img" aria-label="Volume chart">' + bars + "</svg>";
  }

  /**
   * renderScoreRing(score, opts) — a circular 0-100 progress ring.
   * Returns raw SVG only; wrap it in `.score-ring` with a `.score-ring-value`
   * / `.score-ring-label` overlay (see css/components.css) for the full
   * component, e.g.:
   *   '<span class="score-ring">' + SvgCharts.renderScoreRing(82) +
   *   '<span class="score-ring-value">82</span></span>'
   */
  function renderScoreRing(score, opts) {
    opts = opts || {};
    const size = opts.size || 72;
    const thickness = opts.thickness || 7;
    const r = (size - thickness) / 2;
    const cx = size / 2, cy = size / 2;
    const circumference = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, score)) / 100;
    const dash = pct * circumference;

    let color = opts.color;
    if (!color) {
      color = score >= 70 ? "var(--color-success)" : score >= 45 ? "var(--color-warning)" : "var(--color-danger)";
    }

    return (
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '" role="img" aria-label="Score ' + Math.round(score) + ' out of 100">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--color-border)" stroke-width="' + thickness + '" />' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + thickness +
      '" stroke-linecap="round" stroke-dasharray="' + dash.toFixed(2) + " " + circumference.toFixed(2) + '" />' +
      "</svg>"
    );
  }

  function renderSparkline(values, opts) {
    opts = opts || {};
    return renderLineChart(values, Object.assign({ width: opts.width || 100, height: opts.height || 32, showArea: false }, opts));
  }

  global.SvgCharts = { renderLineChart, renderDonutChart, renderBarRows, renderSparkline, renderVolumeChart, renderScoreRing, colorFor };
})(window);
