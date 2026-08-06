"""
Financial Document Intelligence Agent — Flask Application
An agentic AI system for SMEs that autonomously analyzes financial documents.
"""

import os
import json
import shutil
import webbrowser
import threading
from flask import Flask, render_template, request, jsonify, send_from_directory

from engine.parser import parse_file
from engine.normalizer import normalize
from engine.analyzer import analyze
from engine.gap_detector import detect_gaps
from engine.forecaster import forecast

app = Flask(__name__,
            template_folder='templates',
            static_folder='static')

app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
SAMPLE_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sample-data')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {
    'csv', 'pdf', 'xlsx', 'xls',
    'jpg', 'jpeg', 'png', 'bmp', 'tiff', 'tif', 'webp',
    'txt', 'text', 'md',
}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/analyze', methods=['POST'])
def analyze_documents():
    """
    Accept uploaded files, parse them, normalize, analyze, detect gaps,
    and generate forward-looking flags — all autonomously from the upload.
    """
    files = request.files.getlist('files')
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': 'No files uploaded'}), 400

    # Save uploaded files
    saved_paths = []
    file_info = []
    for f in files:
        if f and f.filename and allowed_file(f.filename):
            filename = f.filename
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            f.save(filepath)
            saved_paths.append(filepath)
            file_info.append({
                'name': filename,
                'size': os.path.getsize(filepath),
                'type': filename.rsplit('.', 1)[1].lower(),
            })

    if not saved_paths:
        return jsonify({'error': 'No valid files uploaded. Supported formats: CSV, PDF, Excel, Images, Text'}), 400

    try:
        # ── Step 1: Parse all documents ──
        parsed_files = []
        parse_errors = []
        for path in saved_paths:
            result = parse_file(path)
            # Convert DataFrames to serializable format for storage
            for df_info in result.get('dataframes', []):
                if hasattr(df_info['df'], 'to_dict'):
                    df_info['df_records'] = df_info['df'].to_dict('records')
                    df_info['headers'] = list(df_info['df'].columns)
                else:
                    df_info['df_records'] = []
            parsed_files.append(result)
            if result.get('errors'):
                parse_errors.extend(result['errors'])

        # ── Step 2: Normalize into unified schema ──
        store = normalize(parsed_files)

        # ── Step 3: Current State Analysis ──
        analysis_result = analyze(store)

        # ── Step 4: Gap Detection ──
        gaps = detect_gaps(store)

        # ── Step 5: Forward-Looking Flags ──
        flags = forecast(store)

        # ── Build chart data ──
        chart_data = _build_chart_data(store)

        # ── Build response ──
        response = {
            'success': True,
            'files': file_info,
            'document_types': store.get('document_types', []),
            'summary': analysis_result.get('summary', {}),
            'insights': analysis_result.get('insights', []),
            'gaps': gaps,
            'flags': flags,
            'charts': chart_data,
            'parse_errors': parse_errors,
        }

        return jsonify(response)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Analysis failed: {str(e)}'}), 500
    finally:
        # Clean up uploaded files
        for path in saved_paths:
            try:
                os.remove(path)
            except OSError:
                pass


@app.route('/analyze-sample', methods=['POST'])
def analyze_sample():
    """Load and analyze the built-in sample data."""
    sample_files = ['sample-pnl.csv', 'sample-balance-sheet.csv', 'sample-invoices.csv']
    saved_paths = []

    for fname in sample_files:
        src = os.path.join(SAMPLE_FOLDER, fname)
        if os.path.exists(src):
            dst = os.path.join(UPLOAD_FOLDER, fname)
            shutil.copy2(src, dst)
            saved_paths.append(dst)

    if not saved_paths:
        return jsonify({'error': 'Sample data files not found'}), 404

    try:
        # Parse
        parsed_files = []
        for path in saved_paths:
            result = parse_file(path)
            for df_info in result.get('dataframes', []):
                if hasattr(df_info['df'], 'to_dict'):
                    df_info['df_records'] = df_info['df'].to_dict('records')
                    df_info['headers'] = list(df_info['df'].columns)
            parsed_files.append(result)

        # Normalize
        store = normalize(parsed_files)

        # Analyze
        analysis_result = analyze(store)
        gaps = detect_gaps(store)
        flags = forecast(store)
        chart_data = _build_chart_data(store)

        file_info = [
            {'name': f, 'size': os.path.getsize(os.path.join(SAMPLE_FOLDER, f)), 'type': 'csv'}
            for f in sample_files if os.path.exists(os.path.join(SAMPLE_FOLDER, f))
        ]

        response = {
            'success': True,
            'files': file_info,
            'document_types': store.get('document_types', []),
            'summary': analysis_result.get('summary', {}),
            'insights': analysis_result.get('insights', []),
            'gaps': gaps,
            'flags': flags,
            'charts': chart_data,
            'parse_errors': [],
        }

        return jsonify(response)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Analysis failed: {str(e)}'}), 500
    finally:
        for path in saved_paths:
            try:
                os.remove(path)
            except OSError:
                pass


def _build_chart_data(store):
    """Build chart-ready data from the normalized store."""
    charts = {}

    pnl = store.get('pnl')
    if pnl:
        data = pnl.get('data', {})
        periods = pnl.get('periods', [])

        # Revenue & Expense Trend
        if 'revenue' in data:
            charts['revenue_trend'] = {
                'labels': periods,
                'datasets': []
            }
            charts['revenue_trend']['datasets'].append({
                'label': 'Revenue',
                'data': data['revenue'],
                'borderColor': '#3b82f6',
                'backgroundColor': 'rgba(59, 130, 246, 0.1)',
                'fill': True,
            })
            if 'operating_expenses' in data:
                charts['revenue_trend']['datasets'].append({
                    'label': 'Operating Expenses',
                    'data': data['operating_expenses'],
                    'borderColor': '#f59e0b',
                    'backgroundColor': 'rgba(245, 158, 11, 0.1)',
                    'fill': True,
                })
            if 'net_income' in data:
                charts['revenue_trend']['datasets'].append({
                    'label': 'Net Income',
                    'data': data['net_income'],
                    'borderColor': '#10b981',
                    'backgroundColor': 'rgba(16, 185, 129, 0.1)',
                    'fill': True,
                })

        # Expense Breakdown (pie/donut)
        expense_keys = ['salaries', 'rent', 'utilities', 'marketing', 'depreciation', 'other_expenses']
        expense_data = {}
        for k in expense_keys:
            if k in data:
                expense_data[k.replace('_', ' ').title()] = sum(data[k])

        if expense_data:
            charts['expense_breakdown'] = {
                'labels': list(expense_data.keys()),
                'data': list(expense_data.values()),
                'colors': ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#64748b', '#ef4444'],
            }

        # Margin Trend
        if 'gross_profit' in data and 'revenue' in data:
            n = len(periods)
            gross_margins = [data['gross_profit'][i] / data['revenue'][i] * 100
                            if data['revenue'][i] != 0 else 0 for i in range(n)]
            charts['margin_trend'] = {
                'labels': periods,
                'datasets': [{
                    'label': 'Gross Margin %',
                    'data': [round(m, 1) for m in gross_margins],
                    'borderColor': '#10b981',
                    'backgroundColor': 'rgba(16, 185, 129, 0.1)',
                    'fill': True,
                }]
            }

            if 'net_income' in data:
                net_margins = [data['net_income'][i] / data['revenue'][i] * 100
                              if data['revenue'][i] != 0 else 0 for i in range(n)]
                charts['margin_trend']['datasets'].append({
                    'label': 'Net Margin %',
                    'data': [round(m, 1) for m in net_margins],
                    'borderColor': '#8b5cf6',
                    'backgroundColor': 'rgba(139, 92, 246, 0.1)',
                    'fill': True,
                })

    # Invoice aging chart
    inv = store.get('invoices')
    if inv:
        invoices = inv.get('invoices', [])
        aging_buckets = {'Current': 0, '1-15 days': 0, '16-30 days': 0, '31-45 days': 0, '45+ days': 0}
        for i in invoices:
            status = str(i.get('status', '')).lower()
            days = i.get('days_overdue', 0) or 0
            amount = i.get('amount', 0) or 0
            if 'paid' in status:
                continue
            if days <= 0:
                aging_buckets['Current'] += amount
            elif days <= 15:
                aging_buckets['1-15 days'] += amount
            elif days <= 30:
                aging_buckets['16-30 days'] += amount
            elif days <= 45:
                aging_buckets['31-45 days'] += amount
            else:
                aging_buckets['45+ days'] += amount

        charts['invoice_aging'] = {
            'labels': list(aging_buckets.keys()),
            'data': list(aging_buckets.values()),
            'colors': ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#dc2626'],
        }

    return charts


def _open_browser():
    """Open the app in the default browser shortly after the server starts."""
    webbrowser.open_new('http://127.0.0.1:5050')


if __name__ == '__main__':
    # Only open the browser in the actual running process (not the Flask
    # debug-mode reloader's watcher process, which would open it twice).
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        threading.Timer(1.5, _open_browser).start()
    app.run(debug=True, port=5050)