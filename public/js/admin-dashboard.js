document.addEventListener('DOMContentLoaded', () => {
  if (!window.Chart) return;
  Chart.defaults.font.family = 'Inter, sans-serif';
  Chart.defaults.color = '#64748b';
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  const trendData = document.getElementById('trend-data');
  const trendCanvas = document.getElementById('complaint-trend');
  if (trendData && trendCanvas) {
    const labels = JSON.parse(trendData.dataset.labels);
    const submitted = JSON.parse(trendData.dataset.submitted);
    const resolved = JSON.parse(trendData.dataset.resolved);
    new Chart(trendCanvas, {
      type: 'line',
      data: {
        labels: labels.map(day => new Date(`${day}T00:00:00`).toLocaleDateString(document.documentElement.lang, { month: 'short', day: 'numeric' })),
        datasets: [
          { label: trendData.dataset.receivedLabel || 'Received', data: submitted, borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,.08)', fill: true, tension: .3, pointRadius: 2, pointHoverRadius: 5 },
          { label: trendData.dataset.resolvedLabel || 'Resolved', data: resolved, borderColor: '#16A34A', backgroundColor: 'rgba(22,163,74,.06)', fill: true, tension: .3, pointRadius: 2, pointHoverRadius: 5 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' }, plugins: { legend: { position: 'bottom', align: 'start' } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#edf1f5' } } } }
    });
  }
  const categoryData = document.getElementById('category-data');
  const categoryCanvas = document.getElementById('category-chart');
  if (categoryData && categoryCanvas) {
    const labels = JSON.parse(categoryData.dataset.labels);
    const values = JSON.parse(categoryData.dataset.values);
    if (labels.length) new Chart(categoryCanvas, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Complaints', data: values, backgroundColor: '#2563EB', borderRadius: 5, maxBarThickness: 22 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#edf1f5' } }, y: { grid: { display: false } } } }
    });
  }
});
