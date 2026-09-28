/**
 * script.js — Dashboard Penjualan 2024
 * ====================================================
 * Struktur:
 *  1. Konstanta & Palet Warna
 *  2. State (data & filter aktif)
 *  3. Utility / helper functions
 *  4. Inisialisasi filter (populate dropdown)
 *  5. Fungsi filter data
 *  6. KPI updater
 *  7. Inisialisasi semua chart
 *  8. Updater semua chart (dipanggil saat filter berubah)
 *  9. Event listeners
 * 10. Entry point: fetch JSON & bootstrap dashboard
 */

// ============================================================
// 1. KONSTANTA & PALET WARNA
// ============================================================

/** Palet warna konsisten untuk seluruh chart */
const COLORS = {
  blue:    '#3b5bdb',
  purple:  '#7950f2',
  green:   '#2f9e44',
  orange:  '#f08c00',
  red:     '#c92a2a',
  teal:    '#0c8599',
  pink:    '#d6336c',
  indigo:  '#4263eb',
  cyan:    '#1098ad',
  lime:    '#5c940d',
  amber:   '#e67700',
  grape:   '#862e9c',
};

/** Urutan warna untuk chart multi-series */
const COLOR_LIST = Object.values(COLORS);

/** Alpha helper: tambahkan transparansi ke warna hex */
function hexAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Nama bulan dalam Bahasa Indonesia */
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

// ============================================================
// 2. STATE
// ============================================================

let allData    = [];   // Seluruh data dari JSON
let charts     = {};   // Referensi ke instance Chart.js

// ============================================================
// 3. UTILITY / HELPER FUNCTIONS
// ============================================================

/** Format angka menjadi rupiah singkat: 1.2 M, 850 K, dst */
function formatRupiah(value) {
  if (value >= 1_000_000_000) return 'Rp ' + (value / 1_000_000_000).toFixed(1) + ' M';
  if (value >= 1_000_000)     return 'Rp ' + (value / 1_000_000).toFixed(1) + ' Jt';
  if (value >= 1_000)         return 'Rp ' + (value / 1_000).toFixed(0) + ' K';
  return 'Rp ' + value.toFixed(0);
}

/** Format angka rupiah penuh dengan titik pemisah */
function formatRupiahFull(value) {
  return 'Rp ' + Number(value).toLocaleString('id-ID');
}

/** Agregasi array of objects berdasarkan key, sum field tertentu */
function groupSum(data, keyField, valueField) {
  return data.reduce((acc, row) => {
    const key = row[keyField];
    acc[key] = (acc[key] || 0) + row[valueField];
    return acc;
  }, {});
}

/** Agregasi count berdasarkan key */
function groupCount(data, keyField) {
  return data.reduce((acc, row) => {
    const key = row[keyField];
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

/** Ambil nilai unik dari field tertentu, urutkan A-Z */
function uniqueValues(data, field) {
  return [...new Set(data.map(d => d[field]))].sort();
}

/** Opsi default Chart.js agar font & tooltip konsisten */
function baseChartOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { font: { size: 11, family: 'Inter, sans-serif' }, boxWidth: 12, padding: 10 }
      },
      tooltip: {
        bodyFont: { size: 11 },
        titleFont: { size: 12, weight: '600' },
        padding: 10,
        cornerRadius: 8,
      }
    },
    ...extra
  };
}

// ============================================================
// 4. INISIALISASI FILTER
// ============================================================

/**
 * Mengisi semua dropdown filter berdasarkan nilai unik dari allData.
 * Dipanggil sekali saat data pertama kali dimuat.
 */
function initFilters() {
  const fields = [
    { id: 'filter-region',   field: 'region'        },
    { id: 'filter-category', field: 'category'      },
    { id: 'filter-customer', field: 'customer_type' },
    { id: 'filter-channel',  field: 'channel'       },
  ];

  fields.forEach(({ id, field }) => {
    const select = document.getElementById(id);
    const current = select.value;             // pertahankan pilihan jika ada
    // Hapus option lama kecuali "Semua ..."
    while (select.options.length > 1) select.remove(1);
    uniqueValues(allData, field).forEach(val => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      if (val === current) opt.selected = true;
      select.appendChild(opt);
    });
  });
}

// ============================================================
// 5. FILTER DATA
// ============================================================

/** Kembalikan subset data sesuai filter yang aktif */
function getFilteredData() {
  const region   = document.getElementById('filter-region').value;
  const category = document.getElementById('filter-category').value;
  const customer = document.getElementById('filter-customer').value;
  const channel  = document.getElementById('filter-channel').value;

  return allData.filter(row => {
    if (region   !== 'all' && row.region        !== region)   return false;
    if (category !== 'all' && row.category      !== category) return false;
    if (customer !== 'all' && row.customer_type !== customer) return false;
    if (channel  !== 'all' && row.channel       !== channel)  return false;
    return true;
  });
}

// ============================================================
// 6. KPI UPDATER
// ============================================================

/** Hitung & tampilkan KPI cards berdasarkan filtered data */
function updateKPIs(data) {
  const totalRevenue      = data.reduce((s, r) => s + r.revenue, 0);
  const totalTransactions = data.length;
  const totalQuantity     = data.reduce((s, r) => s + r.quantity, 0);
  const avgDiscount       = data.length
    ? (data.reduce((s, r) => s + r.discount, 0) / data.length * 100).toFixed(1)
    : '0.0';

  document.getElementById('kpi-revenue').textContent      = formatRupiah(totalRevenue);
  document.getElementById('kpi-transactions').textContent = totalTransactions.toLocaleString('id-ID') + ' trx';
  document.getElementById('kpi-quantity').textContent     = totalQuantity.toLocaleString('id-ID') + ' unit';
  document.getElementById('kpi-discount').textContent     = avgDiscount + '%';

  // Sub-label informatif
  document.getElementById('kpi-revenue-sub').textContent      = formatRupiahFull(totalRevenue);
  document.getElementById('kpi-transactions-sub').textContent = 'Total order tercatat';
  document.getElementById('kpi-quantity-sub').textContent     = 'Rata-rata ' + (data.length ? (totalQuantity / data.length).toFixed(1) : 0) + ' unit/trx';
  document.getElementById('kpi-discount-sub').textContent     = 'Dari ' + totalTransactions + ' transaksi';

  // Tampilkan info filter
  const filterInfo = document.getElementById('filter-info');
  document.getElementById('filtered-count').textContent = data.length;
  document.getElementById('total-count').textContent    = allData.length;
  filterInfo.classList.toggle('hidden', data.length === allData.length);
}

// ============================================================
// 7. INISIALISASI CHART (PERTAMA KALI)
// ============================================================

/**
 * Buat semua instance Chart.js dengan data kosong.
 * Data diisi lewat updateCharts() agar pattern update seragam.
 */
function initCharts() {

  /* --- 7.1 Sales Trend (Line) --- */
  charts.trend = new Chart(document.getElementById('chart-trend'), {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: baseChartOptions({
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: {
          ticks: {
            font: { size: 10 },
            callback: v => formatRupiah(v)
          },
          grid: { color: '#f3f4f6' }
        }
      },
      plugins: {
        ...baseChartOptions().plugins,
        tooltip: {
          ...baseChartOptions().plugins.tooltip,
          callbacks: { label: ctx => ' ' + formatRupiahFull(ctx.parsed.y) }
        }
      }
    })
  });

  /* --- 7.2 Revenue per Region (Doughnut) --- */
  charts.region = new Chart(document.getElementById('chart-region'), {
    type: 'doughnut',
    data: { labels: [], datasets: [{ data: [], backgroundColor: COLOR_LIST }] },
    options: baseChartOptions({
      cutout: '60%',
      plugins: {
        ...baseChartOptions().plugins,
        tooltip: {
          callbacks: { label: ctx => ' ' + formatRupiahFull(ctx.parsed) }
        }
      }
    })
  });

  /* --- 7.3 Revenue per Category (Bar horizontal) --- */
  charts.category = new Chart(document.getElementById('chart-category'), {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: baseChartOptions({
      indexAxis: 'y',
      scales: {
        x: {
          ticks: { font: { size: 10 }, callback: v => formatRupiah(v) },
          grid: { color: '#f3f4f6' }
        },
        y: { ticks: { font: { size: 10 } }, grid: { display: false } }
      },
      plugins: {
        ...baseChartOptions().plugins,
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + formatRupiahFull(ctx.parsed.x) } }
      }
    })
  });

  /* --- 7.4 Sales per Rep (Bar vertikal) --- */
  charts.salesrep = new Chart(document.getElementById('chart-salesrep'), {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: baseChartOptions({
      scales: {
        x: { ticks: { font: { size: 9 } }, grid: { display: false } },
        y: {
          ticks: { font: { size: 10 }, callback: v => formatRupiah(v) },
          grid: { color: '#f3f4f6' }
        }
      },
      plugins: {
        ...baseChartOptions().plugins,
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + formatRupiahFull(ctx.parsed.y) } }
      }
    })
  });

  /* --- 7.5 Customer Type (Pie) --- */
  charts.customerType = new Chart(document.getElementById('chart-customer-type'), {
    type: 'pie',
    data: { labels: [], datasets: [{ data: [], backgroundColor: [COLORS.blue, COLORS.purple, COLORS.green] }] },
    options: baseChartOptions({
      plugins: {
        ...baseChartOptions().plugins,
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a,b) => a+b, 0);
              const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${ctx.parsed} trx (${pct}%)`;
            }
          }
        }
      }
    })
  });

  /* --- 7.6 Payment Method (Doughnut) --- */
  charts.payment = new Chart(document.getElementById('chart-payment'), {
    type: 'doughnut',
    data: { labels: [], datasets: [{ data: [], backgroundColor: [COLORS.teal, COLORS.amber, COLORS.pink, COLORS.indigo] }] },
    options: baseChartOptions({
      cutout: '55%',
      plugins: {
        ...baseChartOptions().plugins,
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a,b) => a+b, 0);
              const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${ctx.parsed} trx (${pct}%)`;
            }
          }
        }
      }
    })
  });

  /* --- 7.7 Sales Channel (Doughnut) --- */
  charts.channel = new Chart(document.getElementById('chart-channel'), {
    type: 'doughnut',
    data: { labels: [], datasets: [{ data: [], backgroundColor: [COLORS.blue, COLORS.orange] }] },
    options: baseChartOptions({
      cutout: '55%',
      plugins: {
        ...baseChartOptions().plugins,
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a,b) => a+b, 0);
              const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${ctx.parsed} trx (${pct}%)`;
            }
          }
        }
      }
    })
  });

  /* --- 7.8 Discount vs Revenue (Scatter) --- */
  charts.scatter = new Chart(document.getElementById('chart-scatter'), {
    type: 'scatter',
    data: { datasets: [] },
    options: baseChartOptions({
      scales: {
        x: {
          title: { display: true, text: 'Diskon (%)', font: { size: 10 } },
          ticks: { font: { size: 10 }, callback: v => v * 100 + '%' }
        },
        y: {
          title: { display: true, text: 'Revenue', font: { size: 10 } },
          ticks: { font: { size: 10 }, callback: v => formatRupiah(v) },
          grid: { color: '#f3f4f6' }
        }
      },
      plugins: {
        ...baseChartOptions().plugins,
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` Diskon: ${(ctx.parsed.x * 100).toFixed(0)}% | Rev: ${formatRupiahFull(ctx.parsed.y)}`
          }
        }
      }
    })
  });

  /* --- 7.9 Top 10 Highest Sales (Bar horizontal) --- */
  charts.top10 = new Chart(document.getElementById('chart-top10'), {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: baseChartOptions({
      indexAxis: 'y',
      scales: {
        x: {
          ticks: { font: { size: 9 }, callback: v => formatRupiah(v) },
          grid: { color: '#f3f4f6' }
        },
        y: { ticks: { font: { size: 9 } }, grid: { display: false } }
      },
      plugins: {
        ...baseChartOptions().plugins,
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + formatRupiahFull(ctx.parsed.x) } }
      }
    })
  });

  /* --- 7.10 Qty per Category (Bar) --- */
  charts.qtyCat = new Chart(document.getElementById('chart-qty-category'), {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: baseChartOptions({
      scales: {
        x: { ticks: { font: { size: 9 } }, grid: { display: false } },
        y: {
          ticks: { font: { size: 10 } },
          grid: { color: '#f3f4f6' }
        }
      },
      plugins: {
        ...baseChartOptions().plugins,
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y.toLocaleString('id-ID')} unit` } }
      }
    })
  });
}

// ============================================================
// 8. UPDATE SEMUA CHART
// ============================================================

/**
 * Mengisi ulang data ke setiap chart berdasarkan filtered data.
 * Memanggil chart.update() untuk re-render.
 */
function updateCharts(data) {

  /* ---- 8.1 Sales Trend ---- */
  {
    // Kelompokkan revenue per bulan (format YYYY-MM)
    const monthly = {};
    MONTH_NAMES.forEach((_, i) => {
      monthly[String(i + 1).padStart(2,'0')] = 0;
    });
    data.forEach(row => {
      const month = row.date.slice(5, 7); // "01" .. "12"
      if (monthly[month] !== undefined) monthly[month] += row.revenue;
    });

    const labels  = MONTH_NAMES;
    const values  = Object.values(monthly);

    charts.trend.data.labels = labels;
    charts.trend.data.datasets = [{
      label: 'Revenue',
      data: values,
      borderColor: COLORS.blue,
      backgroundColor: hexAlpha(COLORS.blue, 0.08),
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 6,
      borderWidth: 2.5,
      pointBackgroundColor: COLORS.blue,
    }];
    charts.trend.update();
  }

  /* ---- 8.2 Revenue per Region ---- */
  {
    const grouped = groupSum(data, 'region', 'revenue');
    const labels  = Object.keys(grouped);
    const values  = Object.values(grouped);

    charts.region.data.labels = labels;
    charts.region.data.datasets[0].data = values;
    charts.region.data.datasets[0].backgroundColor = COLOR_LIST.slice(0, labels.length);
    charts.region.update();
  }

  /* ---- 8.3 Revenue per Category ---- */
  {
    const grouped = groupSum(data, 'category', 'revenue');
    const sorted  = Object.entries(grouped).sort((a,b) => b[1] - a[1]);
    const labels  = sorted.map(e => e[0]);
    const values  = sorted.map(e => e[1]);

    charts.category.data.labels = labels;
    charts.category.data.datasets = [{
      label: 'Revenue',
      data: values,
      backgroundColor: labels.map((_, i) => hexAlpha(COLOR_LIST[i % COLOR_LIST.length], 0.85)),
      borderColor:     labels.map((_, i) => COLOR_LIST[i % COLOR_LIST.length]),
      borderWidth: 1.5,
      borderRadius: 6,
    }];
    charts.category.update();
  }

  /* ---- 8.4 Sales per Rep ---- */
  {
    const grouped = groupSum(data, 'sales_rep', 'revenue');
    const sorted  = Object.entries(grouped).sort((a,b) => b[1] - a[1]);
    const labels  = sorted.map(e => e[0].split(' ')[0]); // First name only
    const values  = sorted.map(e => e[1]);

    charts.salesrep.data.labels = labels;
    charts.salesrep.data.datasets = [{
      label: 'Revenue',
      data: values,
      backgroundColor: labels.map((_, i) => hexAlpha(COLOR_LIST[i % COLOR_LIST.length], 0.8)),
      borderColor:     labels.map((_, i) => COLOR_LIST[i % COLOR_LIST.length]),
      borderWidth: 1.5,
      borderRadius: 6,
    }];
    charts.salesrep.update();
  }

  /* ---- 8.5 Customer Type ---- */
  {
    const grouped = groupCount(data, 'customer_type');
    const labels  = Object.keys(grouped);
    const values  = Object.values(grouped);

    charts.customerType.data.labels = labels;
    charts.customerType.data.datasets[0].data = values;
    charts.customerType.data.datasets[0].backgroundColor = [COLORS.blue, COLORS.purple, COLORS.green].slice(0, labels.length);
    charts.customerType.update();
  }

  /* ---- 8.6 Payment Method ---- */
  {
    const grouped = groupCount(data, 'payment_method');
    const labels  = Object.keys(grouped);
    const values  = Object.values(grouped);

    charts.payment.data.labels = labels;
    charts.payment.data.datasets[0].data = values;
    charts.payment.data.datasets[0].backgroundColor = [COLORS.teal, COLORS.amber, COLORS.pink, COLORS.indigo].slice(0, labels.length);
    charts.payment.update();
  }

  /* ---- 8.7 Sales Channel ---- */
  {
    const grouped = groupCount(data, 'channel');
    const labels  = Object.keys(grouped);
    const values  = Object.values(grouped);

    charts.channel.data.labels = labels;
    charts.channel.data.datasets[0].data = values;
    charts.channel.data.datasets[0].backgroundColor = [COLORS.blue, COLORS.orange].slice(0, labels.length);
    charts.channel.update();
  }

  /* ---- 8.8 Scatter: Discount vs Revenue ---- */
  {
    const points = data.map(row => ({ x: row.discount, y: row.revenue }));

    charts.scatter.data.datasets = [{
      label: 'Transaksi',
      data: points,
      backgroundColor: hexAlpha(COLORS.purple, 0.5),
      borderColor: COLORS.purple,
      borderWidth: 1,
      pointRadius: 5,
      pointHoverRadius: 7,
    }];
    charts.scatter.update();
  }

  /* ---- 8.9 Top 10 Highest Sales ---- */
  {
    const top10 = [...data]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const labels = top10.map(r => `#${r.id} ${r.product.slice(0,12)}`);
    const values = top10.map(r => r.revenue);

    charts.top10.data.labels = labels;
    charts.top10.data.datasets = [{
      label: 'Revenue',
      data: values,
      backgroundColor: hexAlpha(COLORS.green, 0.8),
      borderColor: COLORS.green,
      borderWidth: 1.5,
      borderRadius: 5,
    }];
    charts.top10.update();
  }

  /* ---- 8.10 Qty per Category ---- */
  {
    const grouped = groupSum(data, 'category', 'quantity');
    const sorted  = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
    const labels  = sorted.map(e => e[0]);
    const values  = sorted.map(e => e[1]);

    charts.qtyCat.data.labels = labels;
    charts.qtyCat.data.datasets = [{
      label: 'Quantity',
      data: values,
      backgroundColor: labels.map((_, i) => hexAlpha(COLOR_LIST[i % COLOR_LIST.length], 0.75)),
      borderColor:     labels.map((_, i) => COLOR_LIST[i % COLOR_LIST.length]),
      borderWidth: 1.5,
      borderRadius: 6,
    }];
    charts.qtyCat.update();
  }
}

// ============================================================
// 9. MASTER REFRESH — dipanggil setiap kali filter berubah
// ============================================================

function refreshDashboard() {
  const filtered = getFilteredData();
  updateKPIs(filtered);
  updateCharts(filtered);
}

// ============================================================
// 10. EVENT LISTENERS
// ============================================================

/** Pasang listener ke semua select filter */
function attachFilterListeners() {
  ['filter-region', 'filter-category', 'filter-customer', 'filter-channel'].forEach(id => {
    document.getElementById(id).addEventListener('change', refreshDashboard);
  });

  // Tombol reset: kembalikan semua filter ke "all"
  document.getElementById('btn-reset').addEventListener('click', () => {
    ['filter-region', 'filter-category', 'filter-customer', 'filter-channel'].forEach(id => {
      document.getElementById(id).value = 'all';
    });
    refreshDashboard();
  });
}

// ============================================================
// 11. ENTRY POINT — Fetch JSON & Bootstrap Dashboard
// ============================================================

(async function bootstrap() {
  try {
    // Muat data dari file JSON lokal
    const response = await fetch('sales_data.json');
    if (!response.ok) throw new Error(`Gagal memuat data: ${response.status} ${response.statusText}`);
    allData = await response.json();

    // Tampilkan timestamp data terakhir
    const lastDate = allData.reduce((max, r) => r.date > max ? r.date : max, '');
    document.getElementById('last-updated').textContent = lastDate || '-';

    // Inisialisasi komponen
    initFilters();
    initCharts();
    attachFilterListeners();

    // Render pertama kali dengan data lengkap
    refreshDashboard();

  } catch (err) {
    // Tampilkan pesan error yang ramah
    console.error('[Dashboard]', err);
    document.querySelector('main').insertAdjacentHTML('afterbegin', `
      <div class="rounded-xl bg-red-50 border border-red-200 text-red-700 px-5 py-4 text-sm font-medium">
        ⚠️ Gagal memuat data. Pastikan file <code class="bg-red-100 px-1 rounded">sales_data.json</code>
        berada dalam folder yang sama dan dashboard diakses melalui server lokal (bukan file://).
        <br/><span class="text-xs text-red-500 mt-1 block">Error: ${err.message}</span>
      </div>
    `);
  }
})();
