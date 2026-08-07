/* ============================================================
   KAN MKT — Traffic · โมดูลกราฟเทียบข้ามเดือน + Export CSV
   (แยกอิสระ ใช้ Chart.js · อ่านจาก window.TRAFFIC_DATA)
   ------------------------------------------------------------
   ต้องมีใน DOM: #tfCmpMonths (chips), #tfCmpChart (canvas), #tfExport (ปุ่ม)
   เลือกได้สูงสุด 3 เดือน · เส้นสีต่างกัน (Google Ads style) · toggle จาก legend
   ============================================================ */
(function () {
  "use strict";
  if (!window.TRAFFIC_DATA || !window.Chart) return;

  var TD = window.TRAFFIC_DATA;
  var HOURS = TD.hours;
  var TM = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  var COLORS = ["#0000ff", "#059669", "#d97706"]; // น้ำเงิน / เขียว / ส้ม
  var MAX = 3;

  var chart = null;
  var sel = [];

  function branchKey() {
    var s = document.getElementById("tfBranch");
    if (s && s.value) return s.value;
    return Object.keys(TD.branches)[0];
  }
  function rows() { return TD.branches[branchKey()].rows; }

  function months() {
    var seen = {}, out = [];
    rows().forEach(function (r) {
      var ym = r.d.slice(0, 7);
      if (!seen[ym]) { seen[ym] = 1; out.push(ym); }
    });
    out.sort();
    return out;
  }
  function daySum(v) {
    var s = 0, any = false;
    for (var i = 0; i < v.length; i++) { if (v[i] != null) { s += v[i]; any = true; } }
    return any ? s : null;
  }
  function dailyTotals(ym) {
    var arr = new Array(31).fill(null);
    rows().forEach(function (r) {
      if (r.d.slice(0, 7) === ym) { arr[(+r.d.slice(8, 10)) - 1] = daySum(r.v); }
    });
    return arr;
  }
  function mLabel(ym) {
    var p = ym.split("-");
    return TM[(+p[1]) - 1] + " " + ((+p[0]) + 543); // ปี พ.ศ.
  }

  function build() {
    var labels = [];
    for (var i = 1; i <= 31; i++) labels.push(i);
    var ds = sel.map(function (ym, i) {
      var c = COLORS[i % COLORS.length];
      return {
        label: mLabel(ym), data: dailyTotals(ym),
        borderColor: c, backgroundColor: c + "22",
        tension: 0.3, spanGaps: true, pointRadius: 2, pointHoverRadius: 5, borderWidth: 2, fill: false
      };
    });
    if (chart) { chart.data.datasets = ds; chart.update(); return; }
    var el = document.getElementById("tfCmpChart");
    if (!el) return;
    chart = new window.Chart(el, {
      type: "line",
      data: { labels: labels, datasets: ds },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "top", labels: { usePointStyle: true, boxWidth: 8, font: { family: "Inter, Kanit", size: 13 } } },
          tooltip: {
            callbacks: {
              title: function (it) { return "วันที่ " + it[0].label; },
              label: function (c) { return c.dataset.label + ": " + (c.parsed.y == null ? "—" : c.parsed.y.toLocaleString() + " คน"); }
            }
          }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: "#ececec" }, ticks: { font: { family: "Inter" } } },
          x: { grid: { display: false }, title: { display: true, text: "วันของเดือน", font: { family: "Inter, Kanit" } }, ticks: { font: { family: "Inter" } } }
        }
      }
    });
  }

  function renderChips() {
    var host = document.getElementById("tfCmpMonths");
    if (!host) return;
    host.innerHTML = months().map(function (ym) {
      var on = sel.indexOf(ym) >= 0;
      return '<button class="tf-chip' + (on ? " on" : "") + '" data-ym="' + ym + '">' + mLabel(ym) + "</button>";
    }).join("");
    Array.prototype.forEach.call(host.querySelectorAll("button"), function (b) {
      b.onclick = function () {
        var ym = b.getAttribute("data-ym");
        var i = sel.indexOf(ym);
        if (i >= 0) sel.splice(i, 1);
        else { if (sel.length >= MAX) return; sel.push(ym); }
        sel.sort();
        renderChips(); build();
      };
    });
  }

  function exportCSV() {
    var bk = branchKey(), rs = rows();
    var head = ["วันที่"].concat(HOURS).concat(["รวม/วัน"]);
    var lines = [head.join(",")];
    rs.forEach(function (r) {
      var tot = daySum(r.v);
      lines.push([r.d].concat(r.v.map(function (x) { return x == null ? "" : x; })).concat([tot == null ? "" : tot]).join(","));
    });
    var blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "traffic-" + bk + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
  }

  function boot() {
    sel = months().slice(-MAX); // เริ่มด้วย 3 เดือนล่าสุด
    renderChips(); build();
    var ex = document.getElementById("tfExport"); if (ex) ex.onclick = exportCSV;
    var bs = document.getElementById("tfBranch");
    if (bs) bs.addEventListener("change", function () { sel = months().slice(-MAX); renderChips(); build(); });
  }
  if (document.readyState !== "loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
