import React, { useState } from 'react';
import { CheckCircle, XCircle, TrendingUp, Target, Shield, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';
import goldenData from '../../dataset_golden_ground_truth.json';
import resultsData from '../../dataset_batch_review_results.json';

// ── Constants ────────────────────────────────────────────────────────────────
const FINDING_TYPE_LABELS = {
  data_integrity:       'Data Integrity',
  equipment_calibration:'Equipment Calibration',
  label_reconciliation: 'Label Reconciliation',
  oos_uninvestigated:   'OOS Uninvestigated',
  signature_missing:    'Signature Missing',
  hold_time_violation:  'Hold Time Violation',
  transcription_error:  'Transcription Error',
  clean_batch:          'Clean Batch',
  bom_formulation_discrepancy: 'BOM Discrepancy',
  oos_without_investigation:   'OOS Uninvestigated',
  api_mass_balance_transcription_error: 'Mass Balance Error',
};

// Short labels for the bar chart x-axis
const SHORT_LABELS = {
  data_integrity:       'Data\nIntegrity',
  equipment_calibration:'Equip.\nCalibration',
  label_reconciliation: 'Label\nRecon.',
  oos_uninvestigated:   'OOS\nUninvest.',
  signature_missing:    'Signature\nMissing',
  hold_time_violation:  'Hold Time\nViolation',
  transcription_error:  'Transcription\nError',
  clean_batch:          'Clean\nBatch',
};

// Scoring weights for the legend card
const SCORING_WEIGHTS = [
  { label: 'Correct Disposition',   key: 'disposition',   weight: 30 },
  { label: 'Finding Type Match',    key: 'finding_type',  weight: 20 },
  { label: 'Severity Match',        key: 'severity',      weight: 15 },
  { label: 'Finding Count Match',   key: 'finding_count', weight: 10 },
  { label: 'Critical Count Match',  key: 'critical_count',weight: 10 },
  { label: 'Major Count Match',     key: 'major_count',   weight: 5  },
  { label: 'Total Count Match',     key: 'total_count',   weight: 5  },
  { label: 'Confidence Threshold',  key: 'confidence_ok', weight: 5  },
];

// ── 3 extra pairs from BRR_001–003 (first three demo scripts) ────────────────
const EXTRA_GOLDEN = [
  {
    pair_id: 'pair-brr001-atorvastatin-2026',
    batch_number: 'AT-2026-0142',
    product_name: 'Atorvastatin Calcium 40mg Film-Coated Tablets',
    mbr_reference: 'MBR-ATV-040-003 v2.1',
    correct_disposition: 'RELEASE',
    primary_finding_type: 'clean_batch',
    primary_finding_severity: 'N/A',
    difficulty: 'Easy',
    has_misdirection: false,
    min_confidence_pct: 90,
    correct_critical_findings: 0,
    correct_major_findings: 0,
    correct_minor_findings: 0,
    correct_total_findings: 0,
    correct_observation_findings: 0,
    finding_count: 0,
    correct_routing: 'Auto-approve eligible — confidence ≥ 90%, zero critical/major findings. Forward to QA for final release sign-off.',
    key_evidence_location: 'All MBR/EBR sections verified. No deviations detected.',
    scoring_pass_criteria: 'Correctly identify as RELEASE with zero findings and confidence ≥ 90%.',
    misdirection_summary: 'No misdirection.',
  },
  {
    pair_id: 'pair-brr002-metformin-2026',
    batch_number: 'MF-2026-0089',
    product_name: 'Metformin HCl 500mg Extended-Release Tablets',
    mbr_reference: 'MBR-MFH-500-001 v3.0',
    correct_disposition: 'HOLD',
    primary_finding_type: 'data_integrity',
    primary_finding_severity: 'CRITICAL',
    difficulty: 'Hard',
    has_misdirection: true,
    min_confidence_pct: 75,
    correct_critical_findings: 3,
    correct_major_findings: 0,
    correct_minor_findings: 0,
    correct_total_findings: 3,
    correct_observation_findings: 0,
    finding_count: 3,
    correct_routing: 'QA HOLD — 3 Critical data integrity findings. ALCOA+ violations require investigation before any release consideration.',
    key_evidence_location: 'EBR Section 6 LIMS timestamps; Section 9 analyst sign-off gaps; 72-pt checklist Items 41, 44, 58.',
    scoring_pass_criteria: 'Identify 3 Critical data integrity findings; recommend HOLD; confidence ≥ 75%.',
    misdirection_summary: 'Dissolution results pass — misleads reviewer toward RELEASE.',
  },
  {
    pair_id: 'pair-brr003-lisinopril-2026',
    batch_number: 'LS-2026-0031',
    product_name: 'Lisinopril 10mg Tablets',
    mbr_reference: 'MBR-LIS-010-002 v1.4',
    correct_disposition: 'HOLD',
    primary_finding_type: 'oos_uninvestigated',
    primary_finding_severity: 'CRITICAL',
    difficulty: 'Hard',
    has_misdirection: true,
    min_confidence_pct: 80,
    correct_critical_findings: 1,
    correct_major_findings: 0,
    correct_minor_findings: 0,
    correct_total_findings: 1,
    correct_observation_findings: 0,
    finding_count: 1,
    correct_routing: 'QA Hold — Uninvestigated OOS for dissolution. Phase I OOS investigation per SOP-QA-005 required before release.',
    key_evidence_location: 'EBR Section 10.3 dissolution Vessel 2 @ 71.2% (NLT 80%); Section 13.2 OOS investigation: blank; QA checklist Item 52.',
    scoring_pass_criteria: 'Vessel 2 dissolution 71.2% fails NLT 80% spec; OOS investigation section blank; recommend HOLD.',
    misdirection_summary: 'Assay 100.3% passes — creates false impression of batch acceptability.',
  },
];

const EXTRA_RESULTS = [
  {
    pair_id: 'pair-brr001-atorvastatin-2026',
    batch_number: 'AT-2026-0142',
    product_name: 'Atorvastatin Calcium 40mg Film-Coated Tablets',
    mbr_reference: 'MBR-ATV-040-003 v2.1',
    disposition: 'RELEASE',
    primary_finding_type: 'clean_batch',
    primary_finding_severity: 'N/A',
    confidence_pct: 97,
    finding_count: 0,
    critical_findings: 0,
    major_findings: 0,
    minor_findings: 0,
    total_findings: 0,
    observation_findings: 0,
    routing: 'Forward to QA for spot-check review and final release sign-off.',
    review_timestamp: '2026-03-15T02:14:00.000000+00:00',
  },
  {
    pair_id: 'pair-brr002-metformin-2026',
    batch_number: 'MF-2026-0089',
    product_name: 'Metformin HCl 500mg Extended-Release Tablets',
    mbr_reference: 'MBR-MFH-500-001 v3.0',
    disposition: 'HOLD',
    primary_finding_type: 'data_integrity',
    primary_finding_severity: 'CRITICAL',
    confidence_pct: 74,
    finding_count: 3,
    critical_findings: 3,
    major_findings: 0,
    minor_findings: 0,
    total_findings: 3,
    observation_findings: 0,
    routing: 'QA HOLD — initiate ALCOA+ data integrity investigation; do not release.',
    review_timestamp: '2026-03-15T02:21:00.000000+00:00',
  },
  {
    pair_id: 'pair-brr003-lisinopril-2026',
    batch_number: 'LS-2026-0031',
    product_name: 'Lisinopril 10mg Tablets',
    mbr_reference: 'MBR-LIS-010-002 v1.4',
    disposition: 'HOLD',
    primary_finding_type: 'oos_uninvestigated',
    primary_finding_severity: 'CRITICAL',
    confidence_pct: 88,
    finding_count: 1,
    critical_findings: 1,
    major_findings: 0,
    minor_findings: 0,
    total_findings: 1,
    observation_findings: 0,
    routing: 'QA Hold — Phase I OOS investigation required. Batch cannot be released until investigation closed.',
    review_timestamp: '2026-03-15T02:38:00.000000+00:00',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function pct(n, d) { return d === 0 ? 0 : Math.round((n / d) * 100); }

function scoreRow(pace, golden) {
  const scores = {
    disposition:      pace.disposition === golden.correct_disposition,
    finding_type:     pace.primary_finding_type === golden.primary_finding_type,
    severity:         pace.primary_finding_severity === golden.primary_finding_severity,
    finding_count:    pace.finding_count === golden.finding_count,
    critical_count:   pace.critical_findings === golden.correct_critical_findings,
    major_count:      pace.major_findings === golden.correct_major_findings,
    total_count:      pace.total_findings === golden.correct_total_findings,
    confidence_ok:    (pace.confidence_pct || 0) >= (golden.min_confidence_pct || 80),
    no_misdirection:  golden.has_misdirection
      ? pace.primary_finding_type !== 'human_reviewer_error'
      : true,
  };
  const weights = { disposition: 30, finding_type: 20, severity: 15, finding_count: 10,
                    critical_count: 10, major_count: 5, total_count: 5, confidence_ok: 5 };
  const score = Object.entries(weights).reduce((s, [k, w]) => s + (scores[k] ? w : 0), 0);
  return { scores, score };
}

function Chip({ ok, label }) {
  return ok
    ? <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600"><CheckCircle className="w-3 h-3" />{label}</span>
    : <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-500"><XCircle className="w-3 h-3" />{label}</span>;
}

function KpiCard({ icon, label, value, sub, color }) {
  return (
    <div className="bg-white border border-[#f0f0f0] rounded-xl p-4 flex flex-col gap-1">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-1 ${color}`}>{icon}</div>
      <div className="text-2xl font-bold text-[#171717] tabular-nums">{value}</div>
      <div className="text-[12px] font-[550] text-[#383838]">{label}</div>
      {sub && <div className="text-[11px] text-[#8f8f8f]">{sub}</div>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Accuracy() {
  const [expandedPair, setExpandedPair] = useState(null);

  // Combine JSON data with the 3 extra BRR_001-003 pairs
  const goldenRows = [...goldenData.rows, ...EXTRA_GOLDEN];
  const paceRows = [
    ...resultsData.rows.map(r => ({ ...r, _run_id: r.pair_id, _created_at: r.review_timestamp })),
    ...EXTRA_RESULTS.map(r => ({ ...r, _run_id: r.pair_id, _created_at: r.review_timestamp })),
  ];

  // ── Build per-pair results ─────────────────────────────────────────────────
  const pairResults = goldenRows.map(g => {
    const matches = paceRows
      .filter(p => p.batch_number === g.batch_number || p.pair_id === g.pair_id)
      .sort((a, b) => new Date(b._created_at) - new Date(a._created_at));
    const latest = matches[0] || null;
    const { scores, score } = latest ? scoreRow(latest, g) : { scores: {}, score: null };
    return { golden: g, latest, scores, score, runCount: matches.length };
  });

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const evaluated         = pairResults.filter(p => p.latest);
  const passing           = evaluated.filter(p => p.score >= 80);
  const overallAcc        = pct(passing.length, evaluated.length);
  const misdirectionPairs = pairResults.filter(p => p.golden.has_misdirection && p.latest);
  const trapsAvoided      = misdirectionPairs.filter(p => p.scores.no_misdirection).length;
  const misdirResist      = pct(trapsAvoided, misdirectionPairs.length);
  const avgScore          = evaluated.length
    ? Math.round(evaluated.reduce((s, p) => s + p.score, 0) / evaluated.length)
    : 0;

  // ── Error type counts (for vertical bar chart) ────────────────────────────
  const typeCounts = {};
  goldenRows.forEach(g => {
    const t = g.primary_finding_type;
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });
  const typeEntries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(...typeEntries.map(([, c]) => c));
  const CHART_BAR_HEIGHT = 140; // px

  const BAR_COLORS = [
    'bg-blue-500', 'bg-blue-400', 'bg-blue-400',
    'bg-blue-300', 'bg-blue-300', 'bg-blue-300',
    'bg-blue-200', 'bg-blue-200',
  ];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-[15px] font-[600] text-[#171717]">Accuracy — Batch Record Review</h1>
        <p className="text-[12px] text-[#8f8f8f] mt-0.5">
          Lilly · Eval Dataset · {goldenRows.length} pairs · {evaluated.length} evaluated
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Target className="w-4 h-4 text-emerald-600" />}
          color="bg-emerald-50"
          label="Overall Accuracy"
          value={evaluated.length ? `${overallAcc}%` : '—'}
          sub={`${passing.length} pairs passed`}
        />
        <KpiCard
          icon={<BarChart2 className="w-4 h-4 text-blue-600" />}
          color="bg-blue-50"
          label="Avg Score"
          value={evaluated.length ? `${avgScore}/100` : '—'}
          sub={`${evaluated.length} pairs run`}
        />
        <KpiCard
          icon={<Shield className="w-4 h-4 text-purple-600" />}
          color="bg-purple-50"
          label="Misdirection Resistance"
          value={misdirectionPairs.length ? `${misdirResist}%` : '—'}
          sub={`${trapsAvoided} traps avoided`}
        />
        <KpiCard
          icon={<TrendingUp className="w-4 h-4 text-amber-600" />}
          color="bg-amber-50"
          label="Pairs Evaluated"
          value={`${evaluated.length}`}
          sub={evaluated.length < goldenRows.length
            ? `${goldenRows.length - evaluated.length} pairs not yet run`
            : 'All pairs evaluated'}
        />
      </div>

      {/* Per-Pair Results table */}
      <div className="bg-white border border-[#f0f0f0] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#f0f0f0]">
          <span className="text-[13px] font-[550] text-[#383838]">Per-Pair Results</span>
          <span className="text-[11px] text-[#8f8f8f] ml-2">click any row to see full breakdown</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#f0f0f0] text-[#8f8f8f] text-[11px]">
                {['Pair','Drug','Error Type','Difficulty','Runs','Disposition','Severity','Misdirection','Score'].map(h => (
                  <th key={h} className="px-3 py-2 font-[550] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pairResults.map(({ golden: g, latest, scores, score, runCount }) => {
                const isExpanded = expandedPair === g.pair_id;
                const scoreColor = score === null ? 'text-[#cacaca]'
                  : score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-500' : 'text-red-500';
                return (
                  <React.Fragment key={g.pair_id}>
                    <tr
                      onClick={() => setExpandedPair(isExpanded ? null : g.pair_id)}
                      className="border-b border-[#f0f0f0] hover:bg-[#fafafa] cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-2.5 text-[#8f8f8f] font-mono text-[11px]">
                        {g.pair_id?.split('-').slice(0, 2).join('-')}
                      </td>
                      <td className="px-3 py-2.5 text-[#171717] font-[500] whitespace-nowrap">
                        {g.product_name?.split(' ')[0]}
                      </td>
                      <td className="px-3 py-2.5 text-[#383838]">
                        {FINDING_TYPE_LABELS[g.primary_finding_type] || g.primary_finding_type}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-[550] ${
                          g.difficulty === 'Hard'   ? 'bg-red-50 text-red-600'
                        : g.difficulty === 'Medium' ? 'bg-amber-50 text-amber-600'
                        :                             'bg-emerald-50 text-emerald-600'}`}>
                          {g.difficulty}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[#8f8f8f] tabular-nums">{runCount}</td>
                      <td className="px-3 py-2.5">
                        {latest ? <Chip ok={scores.disposition} label={latest.disposition} /> : <span className="text-[#cacaca]">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {latest ? <Chip ok={scores.severity} label={latest.primary_finding_severity || '—'} /> : <span className="text-[#cacaca]">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {g.has_misdirection
                          ? (latest ? <Chip ok={scores.no_misdirection} label={scores.no_misdirection ? 'Resisted' : 'Fooled'} /> : <span className="text-[#cacaca]">—</span>)
                          : <span className="text-[#cacaca] text-[10px]">n/a</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold tabular-nums ${scoreColor}`}>{score !== null ? score : '—'}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3 text-[#cacaca]" /> : <ChevronDown className="w-3 h-3 text-[#cacaca]" />}
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                        <td colSpan={9} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12px]">
                            <div>
                              <div className="text-[10px] font-[550] text-[#8f8f8f] uppercase tracking-wider mb-2">Answer Key</div>
                              <div className="space-y-1.5">
                                {[
                                  ['Correct Disposition',       g.correct_disposition],
                                  ['Finding Type',              FINDING_TYPE_LABELS[g.primary_finding_type]],
                                  ['Severity',                  g.primary_finding_severity],
                                  ['Critical / Major / Total',  `${g.correct_critical_findings} / ${g.correct_major_findings} / ${g.correct_total_findings}`],
                                  ['Min Confidence',            `${g.min_confidence_pct}%`],
                                  ['Routing',                   g.correct_routing],
                                  ['Evidence Location',         g.key_evidence_location],
                                ].map(([k, v]) => (
                                  <div key={k} className="flex gap-2">
                                    <span className="text-[#8f8f8f] w-36 flex-shrink-0">{k}</span>
                                    <span className="text-[#383838] text-[11px] leading-relaxed">{v}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-[550] text-[#8f8f8f] uppercase tracking-wider mb-2">
                                {latest ? 'Pace Output (Latest Run)' : 'No Run Yet'}
                              </div>
                              {latest ? (
                                <div className="space-y-1.5">
                                  {[
                                    ['Disposition',                 latest.disposition,              scores.disposition],
                                    ['Finding Type',                FINDING_TYPE_LABELS[latest.primary_finding_type] || latest.primary_finding_type, scores.finding_type],
                                    ['Severity',                    latest.primary_finding_severity, scores.severity],
                                    ['Critical / Major / Total',    `${latest.critical_findings} / ${latest.major_findings} / ${latest.total_findings}`, scores.critical_count && scores.major_count && scores.total_count],
                                    ['Confidence',                  `${latest.confidence_pct}%`,    scores.confidence_ok],
                                  ].map(([k, v, ok]) => (
                                    <div key={k} className="flex gap-2 items-start">
                                      <span className="text-[#8f8f8f] w-36 flex-shrink-0">{k}</span>
                                      <span className={ok === true ? 'text-emerald-600' : ok === false ? 'text-red-500' : 'text-[#383838]'}>{v || '—'}</span>
                                      {ok === true  && <CheckCircle className="w-3 h-3 text-emerald-600 flex-shrink-0 mt-0.5" />}
                                      {ok === false && <XCircle    className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-[#8f8f8f] italic text-[12px]">Run this pair through Pace to see results here.</div>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-[#f0f0f0]">
                            <span className="text-[10px] text-[#8f8f8f] font-[550] uppercase tracking-wider">Pass Criteria: </span>
                            <span className="text-[11px] text-[#8f8f8f]">{g.scoring_pass_criteria}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Error Types Detected — vertical bar chart */}
      <div className="bg-white border border-[#f0f0f0] rounded-xl p-5">
        <div className="text-[13px] font-[550] text-[#383838] mb-5">Error Types Detected</div>
        <div className="flex items-end gap-3" style={{ height: `${CHART_BAR_HEIGHT + 56}px` }}>
          {/* Y-axis labels */}
          <div className="flex flex-col justify-between text-right pr-2 flex-shrink-0" style={{ height: `${CHART_BAR_HEIGHT}px` }}>
            {Array.from({ length: maxCount + 1 }, (_, i) => maxCount - i).map(n => (
              <span key={n} className="text-[10px] text-[#cacaca] tabular-nums leading-none">{n}</span>
            ))}
          </div>
          {/* Bars */}
          {typeEntries.map(([type, count], i) => {
            const barH = Math.round((count / maxCount) * CHART_BAR_HEIGHT);
            const colorClass = count === maxCount ? 'bg-blue-500'
              : count >= maxCount - 1 ? 'bg-blue-400'
              : 'bg-blue-300';
            return (
              <div key={type} className="flex-1 flex flex-col items-center justify-end" style={{ height: `${CHART_BAR_HEIGHT + 40}px` }}>
                <span className="text-[11px] font-[600] text-[#383838] mb-1 tabular-nums">{count}</span>
                <div
                  className={`w-full rounded-t-md ${colorClass} transition-all`}
                  style={{ height: `${barH}px` }}
                />
                <div
                  className="text-[10px] text-[#8f8f8f] text-center mt-2 leading-tight"
                  style={{ whiteSpace: 'pre-line', maxWidth: '72px' }}
                >
                  {SHORT_LABELS[type] || FINDING_TYPE_LABELS[type] || type}
                </div>
              </div>
            );
          })}
        </div>
        {/* X-axis label */}
        <div className="text-center text-[10px] text-[#cacaca] mt-1">Error Type</div>
      </div>

      {/* Accuracy Calculation Method legend */}
      <div className="bg-white border border-[#f0f0f0] rounded-xl p-5">
        <div className="text-[13px] font-[550] text-[#383838] mb-4">Accuracy Calculation Method</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          {SCORING_WEIGHTS.map(({ label, weight }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-[12px] text-[#383838] w-44 flex-shrink-0">{label}</span>
              <div className="flex-1 h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full"
                  style={{ width: `${weight * 3.2}%` }}
                />
              </div>
              <span className="text-[11px] font-[600] text-[#383838] tabular-nums w-12 text-right flex-shrink-0">
                {weight} pts
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-[#f0f0f0] flex items-center justify-between">
          <div className="flex items-center gap-4 text-[11px] text-[#8f8f8f]">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
              Pass: score ≥ 80
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />
              Marginal: score 60–79
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />
              Fail: score &lt; 60
            </span>
          </div>
          <span className="text-[11px] text-[#8f8f8f]">Max score: 100 pts</span>
        </div>
      </div>
    </div>
  );
}
