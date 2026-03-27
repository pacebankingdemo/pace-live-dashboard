import React from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, Filter, Table2, Download, Clock, Settings2 } from 'lucide-react';
import goldenData from '../../dataset_golden_ground_truth.json';
import resultsData from '../../dataset_batch_review_results.json';

const FINDING_TYPE_LABELS = {
  data_integrity: 'Data Integrity',
  equipment_calibration: 'Equipment Calibration',
  label_reconciliation: 'Label Reconciliation',
  oos_uninvestigated: 'OOS Uninvestigated',
  signature_missing: 'Signature Missing',
  hold_time_violation: 'Hold Time Violation',
  transcription_error: 'Transcription Error',
  clean_batch: 'Clean Batch',
  bom_formulation_discrepancy: 'BOM Discrepancy',
  oos_without_investigation: 'OOS Uninvestigated',
  api_mass_balance_transcription_error: 'Mass Balance Error',
};

const DATASET_CONFIG = {
  'golden-ground-truth': {
    name: 'Golden Dataset — Ground Truth',
    rows: goldenData.rows,
    columns: [
      { key: 'pair_id', label: 'Pair ID', width: 'w-36' },
      { key: 'product_name', label: 'Product Name', width: 'w-64', truncate: true },
      { key: 'batch_number', label: 'Batch Number', width: 'w-36' },
      { key: 'correct_disposition', label: 'Disposition', width: 'w-28' },
      { key: 'primary_finding_type', label: 'Finding Type', width: 'w-44', format: (v) => FINDING_TYPE_LABELS[v] || v },
      { key: 'primary_finding_severity', label: 'Severity', width: 'w-24' },
      { key: 'difficulty', label: 'Difficulty', width: 'w-24' },
      { key: 'has_misdirection', label: 'Misdirection', width: 'w-28', format: (v) => (v ? 'Yes' : 'No') },
      { key: 'min_confidence_pct', label: 'Min Confidence', width: 'w-32', format: (v) => `${v}%` },
      { key: 'correct_critical_findings', label: 'Critical', width: 'w-20' },
      { key: 'correct_major_findings', label: 'Major', width: 'w-20' },
      { key: 'correct_total_findings', label: 'Total', width: 'w-20' },
    ],
  },
  'batch-review-results': {
    name: 'Batch Review Results',
    rows: resultsData.rows,
    columns: [
      { key: 'pair_id', label: 'Pair ID', width: 'w-36' },
      { key: 'product_name', label: 'Product Name', width: 'w-64', truncate: true },
      { key: 'batch_number', label: 'Batch Number', width: 'w-36' },
      { key: 'mbr_reference', label: 'MBR Reference', width: 'w-36' },
      { key: 'disposition', label: 'Disposition', width: 'w-28' },
      { key: 'primary_finding_type', label: 'Finding Type', width: 'w-44', format: (v) => FINDING_TYPE_LABELS[v] || v },
      { key: 'primary_finding_severity', label: 'Severity', width: 'w-24' },
      { key: 'confidence_pct', label: 'Confidence', width: 'w-24', format: (v) => `${v}%` },
      { key: 'critical_findings', label: 'Critical', width: 'w-20' },
      { key: 'major_findings', label: 'Major', width: 'w-20' },
      { key: 'total_findings', label: 'Total', width: 'w-20' },
      { key: 'review_timestamp', label: 'Review Date', width: 'w-40', format: (v) => new Date(v).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) },
    ],
  },
};

function DispositionBadge({ value }) {
  if (!value) return <span className="text-[#8f8f8f]">—</span>;
  const color =
    value === 'RELEASE'
      ? 'text-emerald-700 bg-emerald-50'
      : value === 'HOLD'
      ? 'text-red-700 bg-red-50'
      : 'text-amber-700 bg-amber-50';
  return (
    <span className={`inline-block text-[11px] font-[550] px-2 py-0.5 rounded ${color}`}>
      {value}
    </span>
  );
}

function SeverityBadge({ value }) {
  if (!value || value === 'N/A') return <span className="text-[#8f8f8f] text-[12px]">N/A</span>;
  const color =
    value === 'CRITICAL'
      ? 'text-red-600 bg-red-50'
      : value === 'MAJOR'
      ? 'text-amber-600 bg-amber-50'
      : 'text-blue-600 bg-blue-50';
  return (
    <span className={`inline-block text-[11px] font-[550] px-2 py-0.5 rounded ${color}`}>
      {value}
    </span>
  );
}

function DifficultyBadge({ value }) {
  if (!value) return null;
  const color =
    value === 'Hard'
      ? 'text-red-600'
      : value === 'Medium'
      ? 'text-amber-600'
      : 'text-emerald-600';
  return <span className={`text-[12px] font-[500] ${color}`}>{value}</span>;
}

function CellValue({ col, value }) {
  if (col.key === 'disposition' || col.key === 'correct_disposition') return <DispositionBadge value={value} />;
  if (col.key === 'primary_finding_severity') return <SeverityBadge value={value} />;
  if (col.key === 'difficulty') return <DifficultyBadge value={value} />;
  const display = col.format ? col.format(value) : (value ?? '—');
  return (
    <span className={`text-[12px] text-[#383838] ${col.truncate ? 'block max-w-[240px] truncate' : ''}`}>
      {String(display)}
    </span>
  );
}

export default function DatasetDetail() {
  const { id } = useParams();
  const config = DATASET_CONFIG[id];

  if (!config) {
    return (
      <div className="flex items-center justify-center h-64 text-[#8f8f8f] text-sm">
        Dataset not found.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#f0f0f0]">
        <button className="flex items-center gap-1.5 text-[12px] text-[#383838] border border-[#e8e8e8] px-2.5 py-1 rounded-md hover:bg-[#f5f5f5] transition-colors">
          <Filter className="w-3.5 h-3.5 text-[#8f8f8f]" />
          Filter
        </button>
        <div className="flex items-center gap-1">
          <button className="p-1.5 hover:bg-[#f5f5f5] rounded-md transition-colors text-[#8f8f8f] hover:text-[#383838]">
            <Table2 className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:bg-[#f5f5f5] rounded-md transition-colors text-[#8f8f8f] hover:text-[#383838]">
            <Download className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:bg-[#f5f5f5] rounded-md transition-colors text-[#8f8f8f] hover:text-[#383838]">
            <Clock className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:bg-[#f5f5f5] rounded-md transition-colors text-[#8f8f8f] hover:text-[#383838]">
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full border-collapse">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-[#f0f0f0]">
              {config.columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 text-left text-[11px] font-[550] text-[#8f8f8f] whitespace-nowrap ${col.width}`}
                >
                  <div className="flex items-center gap-1 group cursor-pointer hover:text-[#383838] transition-colors">
                    {col.label}
                    <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {config.rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-[#f0f0f0] hover:bg-[#fafafa] transition-colors"
              >
                {config.columns.map((col) => (
                  <td key={col.key} className="px-4 py-2.5 whitespace-nowrap">
                    <CellValue col={col} value={row[col.key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end px-6 py-2 border-t border-[#f0f0f0]">
        <span className="text-[11px] text-[#8f8f8f]">Total Rows: {config.rows.length}</span>
      </div>
    </div>
  );
}
