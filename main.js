/**
 * FinSight AI — Frontend Controller
 * Handles file upload, drag-and-drop, API calls, and dashboard rendering.
 */

(function () {
  'use strict';

  // ── DOM References ──
  const uploadView = document.getElementById('upload-view');
  const processingView = document.getElementById('processing-view');
  const dashboardView = document.getElementById('dashboard-view');
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const browseTrigger = document.getElementById('browse-trigger');
  const uploadedFilesList = document.getElementById('uploaded-files');
  const analyzeBtn = document.getElementById('analyze-btn');
  const sampleBtn = document.getElementById('sample-btn');
  const newAnalysisBtn = document.getElementById('new-analysis-btn');
  const processingText = document.getElementById('processing-text');

  let selectedFiles = [];
  let chartInstances = [];

  // ── File Type Icons ──
  const FILE_ICONS = {
    csv: '📊',
    pdf: '📄',
    xlsx: '📗',
    xls: '📗',
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    bmp: '🖼️',
    tiff: '🖼️',
    tif: '🖼️',
    webp: '🖼️',
    txt: '📝',
    text: '📝',
    md: '📝',
  };

  const FILE_TYPE_CLASS = {
    csv: 'csv', pdf: 'pdf', xlsx: 'xlsx', xls: 'xlsx',
    jpg: 'image', jpeg: 'image', png: 'image', bmp: 'image',
    tiff: 'image', tif: 'image', webp: 'image',
    txt: 'text', text: 'text', md: 'text',
  };

  // ── Drag & Drop ──
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  });

  dropzone.addEventListener('click', () => fileInput.click());
  browseTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    addFiles(Array.from(fileInput.files));
    fileInput.value = '';
  });

  // ── File Management ──
  function addFiles(files) {
    for (const file of files) {
      if (!selectedFiles.find((f) => f.name === file.name && f.size === file.size)) {
        selectedFiles.push(file);
      }
    }
    renderFileList();
    analyzeBtn.disabled = selectedFiles.length === 0;
  }

  function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderFileList();
    analyzeBtn.disabled = selectedFiles.length === 0;
  }

  function renderFileList() {
    uploadedFilesList.innerHTML = selectedFiles.map((file, i) => {
      const ext = file.name.split('.').pop().toLowerCase();
      const icon = FILE_ICONS[ext] || '📄';
      const typeClass = FILE_TYPE_CLASS[ext] || 'text';
      const size = formatFileSize(file.size);
      return `
        <div class="file-item">
          <div class="file-item-icon ${typeClass}">${icon}</div>
          <div class="file-item-info">
            <div class="file-item-name">${escapeHtml(file.name)}</div>
            <div class="file-item-meta">${size} · ${ext.toUpperCase()}</div>
          </div>
          <span class="file-item-status parsed">Ready</span>
          <button class="file-item-remove" onclick="window.__removeFile(${i})" title="Remove">✕</button>
        </div>
      `;
    }).join('');
  }

  window.__removeFile = removeFile;

  // ── Analyze Button ──
  analyzeBtn.addEventListener('click', () => {
    if (selectedFiles.length === 0) return;
    runAnalysis(false);
  });

  // ── Sample Data Button ──
  sampleBtn.addEventListener('click', () => {
    runAnalysis(true);
  });

  // ── New Analysis ──
  newAnalysisBtn.addEventListener('click', () => {
    selectedFiles = [];
    renderFileList();
    analyzeBtn.disabled = true;
    destroyCharts();
    showView('upload');
  });

  // ── Run Analysis ──
  async function runAnalysis(useSample) {
    showView('processing');
    animateProcessingSteps();

    try {
      let response;
      if (useSample) {
        response = await fetch('/analyze-sample', { method: 'POST' });
      } else {
        const formData = new FormData();
        for (const file of selectedFiles) {
          formData.append('files', file);
        }
        response = await fetch('/analyze', { method: 'POST', body: formData });
      }

      const data = await response.json();

      if (!response.ok || data.error) {
        alert('Analysis Error: ' + (data.error || 'Unknown error'));
        showView('upload');
        return;
      }

      // Complete all steps
      await completeAllSteps();

      // Short delay for visual effect
      await sleep(400);

      // Render dashboard
      renderDashboard(data);
      showView('dashboard');

    } catch (err) {
      console.error('Analysis failed:', err);
      alert('Network error. Please ensure the Flask server is running.');
      showView('upload');
    }
  }

  // ── View Switching ──
  function showView(view) {
    uploadView.style.display = view === 'upload' ? '' : 'none';
    uploadView.classList.toggle('active', view === 'upload');
    processingView.style.display = view === 'processing' ? 'flex' : 'none';
    processingView.classList.toggle('active', view === 'processing');
    dashboardView.style.display = view === 'dashboard' ? '' : 'none';
    dashboardView.classList.toggle('active', view === 'dashboard');
  }

  // ── Processing Steps Animation ──
  async function animateProcessingSteps() {
    const steps = document.querySelectorAll('.step-item');
    const messages = [
      'Parsing uploaded documents...',
      'Normalizing financial data...',
      'Running current state analysis...',
      'Detecting data gaps...',
      'Generating forward-looking flags...',
    ];

    steps.forEach((s) => {
      s.classList.remove('active', 'done');
    });

    for (let i = 0; i < steps.length; i++) {
      steps[i].classList.add('active');
      processingText.textContent = messages[i];
      await sleep(600);
    }
  }

  async function completeAllSteps() {
    const steps = document.querySelectorAll('.step-item');
    for (const step of steps) {
      step.classList.remove('active');
      step.classList.add('done');
      await sleep(150);
    }
    processingText.textContent = 'Analysis complete!';
  }

  // ── Dashboard Rendering ──
  function renderDashboard(data) {
    renderSummaryCards(data.summary);
    renderCharts(data.charts);
    renderInsights(data.insights);
    renderGaps(data.gaps);
    renderFlags(data.flags);
    renderSources(data.files, data.document_types);

    // Update counts
    document.getElementById('count-insights').textContent = data.insights.length;
    document.getElementById('count-gaps').textContent = data.gaps.length;
    document.getElementById('count-flags').textContent = data.flags.length;

    // Update subtitle
    document.getElementById('dashboard-subtitle').textContent =
      `Analysis complete — ${data.files.length} document${data.files.length !== 1 ? 's' : ''} processed`;

    // Set up tabs
    setupTabs();
  }

  // ── Summary Cards ──
  function renderSummaryCards(summary) {
    const container = document.getElementById('summary-cards');
    const cards = [
      {
        label: 'Total Revenue',
        key: 'total_revenue',
        colorClass: 'neutral',
      },
      {
        label: 'Net Margin',
        key: 'net_margin',
        colorClass: 'positive',
      },
      {
        label: 'Current Ratio',
        key: 'current_ratio',
        colorClass: 'neutral',
      },
      {
        label: 'Overdue Receivables',
        key: 'overdue_receivables',
        colorClass: 'warning',
      },
      {
        label: 'Documents Analyzed',
        key: 'documents_analyzed',
        colorClass: 'neutral',
      },
    ];

    container.innerHTML = cards.map((card) => {
      const data = summary[card.key] || {};
      const value = data.value || 'N/A';
      const direction = data.direction;
      const change = data.change;
      const colorClass = direction === 'up' ? 'positive' : direction === 'down' ? 'negative' : card.colorClass;

      return `
        <div class="summary-card">
          <div class="summary-card-label">${card.label}</div>
          <div class="summary-card-value ${colorClass}">${value}</div>
          ${change ? `<div class="summary-card-change ${direction}">${direction === 'up' ? '↑' : '↓'} ${change}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  // ── Charts ──
  function renderCharts(charts) {
    const container = document.getElementById('charts-section');
    destroyCharts();
    container.innerHTML = '';

    if (!charts || Object.keys(charts).length === 0) return;

    // Revenue Trend
    if (charts.revenue_trend) {
      container.innerHTML += `
        <div class="chart-card">
          <h3>Revenue, Expenses & Net Income Trend</h3>
          <div class="chart-container"><canvas id="chart-revenue"></canvas></div>
        </div>
      `;
    }

    // Margin Trend
    if (charts.margin_trend) {
      container.innerHTML += `
        <div class="chart-card">
          <h3>Margin Trends (%)</h3>
          <div class="chart-container"><canvas id="chart-margins"></canvas></div>
        </div>
      `;
    }

    // Expense Breakdown
    if (charts.expense_breakdown) {
      container.innerHTML += `
        <div class="chart-card">
          <h3>Expense Category Breakdown</h3>
          <div class="chart-container"><canvas id="chart-expenses"></canvas></div>
        </div>
      `;
    }

    // Invoice Aging
    if (charts.invoice_aging) {
      container.innerHTML += `
        <div class="chart-card">
          <h3>Receivables Aging</h3>
          <div class="chart-container"><canvas id="chart-aging"></canvas></div>
        </div>
      `;
    }

    // Render charts after DOM update
    requestAnimationFrame(() => {
      const chartDefaults = {
        color: '#94a3b8',
        borderColor: 'rgba(255,255,255,0.06)',
        font: { family: "'Inter', sans-serif" },
      };

      Chart.defaults.color = chartDefaults.color;
      Chart.defaults.borderColor = chartDefaults.borderColor;
      Chart.defaults.font.family = chartDefaults.font.family;

      if (charts.revenue_trend) {
        const ctx = document.getElementById('chart-revenue');
        if (ctx) {
          chartInstances.push(new Chart(ctx, {
            type: 'line',
            data: {
              labels: charts.revenue_trend.labels,
              datasets: charts.revenue_trend.datasets.map((ds) => ({
                ...ds,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 6,
              })),
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, padding: 16 } },
              },
              scales: {
                y: {
                  grid: { color: 'rgba(255,255,255,0.04)' },
                  ticks: { callback: (v) => '₹' + (v / 1000) + 'K' },
                },
                x: { grid: { display: false } },
              },
            },
          }));
        }
      }

      if (charts.margin_trend) {
        const ctx = document.getElementById('chart-margins');
        if (ctx) {
          chartInstances.push(new Chart(ctx, {
            type: 'line',
            data: {
              labels: charts.margin_trend.labels,
              datasets: charts.margin_trend.datasets.map((ds) => ({
                ...ds,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 6,
              })),
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, padding: 16 } },
              },
              scales: {
                y: {
                  grid: { color: 'rgba(255,255,255,0.04)' },
                  ticks: { callback: (v) => v + '%' },
                },
                x: { grid: { display: false } },
              },
            },
          }));
        }
      }

      if (charts.expense_breakdown) {
        const ctx = document.getElementById('chart-expenses');
        if (ctx) {
          chartInstances.push(new Chart(ctx, {
            type: 'doughnut',
            data: {
              labels: charts.expense_breakdown.labels,
              datasets: [{
                data: charts.expense_breakdown.data,
                backgroundColor: charts.expense_breakdown.colors,
                borderWidth: 0,
                hoverOffset: 8,
              }],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'right', labels: { usePointStyle: true, padding: 12 } },
              },
              cutout: '65%',
            },
          }));
        }
      }

      if (charts.invoice_aging) {
        const ctx = document.getElementById('chart-aging');
        if (ctx) {
          chartInstances.push(new Chart(ctx, {
            type: 'bar',
            data: {
              labels: charts.invoice_aging.labels,
              datasets: [{
                label: 'Amount (₹)',
                data: charts.invoice_aging.data,
                backgroundColor: charts.invoice_aging.colors,
                borderRadius: 6,
                borderSkipped: false,
              }],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
              },
              scales: {
                y: {
                  grid: { color: 'rgba(255,255,255,0.04)' },
                  ticks: { callback: (v) => '₹' + (v / 1000) + 'K' },
                },
                x: { grid: { display: false } },
              },
            },
          }));
        }
      }
    });
  }

  function destroyCharts() {
    chartInstances.forEach((c) => c.destroy());
    chartInstances = [];
  }

  // ── Insights (Current State) ──
  function renderInsights(insights) {
    const container = document.getElementById('insights-container');
    if (!insights || insights.length === 0) {
      container.innerHTML = '<div class="insight-card severity-info"><div class="insight-card-body">No insights could be generated. Upload more financial documents for analysis.</div></div>';
      return;
    }

    container.innerHTML = insights.map((insight) => `
      <div class="insight-card severity-${insight.severity}">
        <div class="insight-card-header">
          <div class="insight-card-title">
            <span class="icon">${insight.icon}</span>
            <h4>${insight.title}</h4>
          </div>
          <span class="insight-badge ${insight.severity}">${insight.badge}</span>
        </div>
        <div class="insight-card-body">${insight.body}</div>
        ${insight.metrics ? `<div>${insight.metrics.map((m) =>
          `<span class="insight-metric"><span class="insight-metric-value">${m.value}</span><span class="insight-metric-label">${m.label}</span></span>`
        ).join('')}</div>` : ''}
        <div class="insight-card-footer">
          ${insight.sources.map((s) => `<span class="source-tag"><span class="source-icon">📎</span>${escapeHtml(s)}</span>`).join('')}
        </div>
      </div>
    `).join('');
  }

  // ── Gaps ──
  function renderGaps(gaps) {
    const container = document.getElementById('gaps-container');
    if (!gaps || gaps.length === 0) {
      container.innerHTML = '<div class="gap-card"><div class="gap-card-body">✅ No significant gaps detected in the uploaded data. The document set is comprehensive enough for meaningful analysis.</div></div>';
      return;
    }

    container.innerHTML = gaps.map((gap) => `
      <div class="gap-card">
        <div class="gap-card-header">
          <span>${gap.icon}</span>
          <h4>${gap.title}</h4>
        </div>
        <div class="gap-card-body">${gap.body}</div>
        <div class="gap-card-impact">
          ${gap.impact}
        </div>
      </div>
    `).join('');
  }

  // ── Flags ──
  function renderFlags(flags) {
    const container = document.getElementById('flags-container');
    if (!flags || flags.length === 0) {
      container.innerHTML = '<div class="flag-card risk-low"><div class="flag-body">✅ No significant forward-looking risks identified based on the current data trajectory.</div></div>';
      return;
    }

    container.innerHTML = flags.map((flag) => `
      <div class="flag-card risk-${flag.risk}">
        <div class="flag-header">
          <span>${flag.icon}</span>
          <h4>${flag.title}</h4>
          <span class="insight-badge ${flag.risk === 'high' ? 'critical' : flag.risk === 'medium' ? 'warning' : 'positive'}">${flag.risk.toUpperCase()} RISK</span>
        </div>
        <div class="flag-body">${flag.body}</div>
        <div class="flag-evidence">
          <div class="flag-evidence-title">📊 Supporting Evidence</div>
          ${flag.evidence}
        </div>
        <div class="insight-card-footer" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06);">
          ${flag.sources.map((s) => `<span class="source-tag"><span class="source-icon">📎</span>${escapeHtml(s)}</span>`).join('')}
        </div>
      </div>
    `).join('');
  }

  // ── Sources Panel ──
  function renderSources(files, docTypes) {
    const container = document.getElementById('source-list');
    const typeLabels = {
      profit_and_loss: '📈 P&L',
      balance_sheet: '📋 Balance Sheet',
      invoice: '🧾 Invoice',
      transaction: '💳 Transaction',
      cash_flow: '💰 Cash Flow',
      unknown: '📄 Document',
    };

    container.innerHTML = files.map((f, i) => {
      const docType = docTypes && docTypes[i] ? docTypes[i] : 'unknown';
      const ext = f.type || f.name.split('.').pop().toLowerCase();
      const icon = FILE_ICONS[ext] || '📄';
      return `
        <div class="source-item">
          <span class="source-item-icon">${icon}</span>
          <span>${escapeHtml(f.name)}</span>
          <span class="insight-badge info">${typeLabels[docType] || docType}</span>
        </div>
      `;
    }).join('');
  }

  // ── Tabs ──
  function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
        document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
      });
    });
  }

  // ── Utilities ──
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

})();
