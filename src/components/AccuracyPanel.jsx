import React, { useEffect, useState, useCallback } from 'react';
import { fetchDatasets, fetchAllDatasetRows, subscribeToTable } from '../services/supabase';
import { CheckCircle, XCircle, AlertTriangle, TrendingUp, Target, Shield, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────
const BATCH_REVIEW_PROCESS_ID = '6f037763-bd41-410e-ba46-a74dc65dde61';
const FINDING_TYPE_LABELS = {
  data_integrity:       'Data Integrity',
  equipment_calibration:'Equipment Calibration',
  label_reconciliation: 'Label Reconciliation',
  oos_uninvestigated:   'OOS Uninvestigated',
  signature_missing:    'Signature Missing',
  hold_time_violation:  'Hold Time Violation',
  transcription_error:  'Transcription Error',
  clean_batch:          'Clean Batch',
};

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
    ? <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400"><CheckCircle className="w-3 h-3" />{label}</span>
    : <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400"><XCircle className="w-3 h-3" />{label}</span>;
}

function KpiCard({ icon, label, value, sub, color }) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 flex flex-col gap-1 min-w-[160px]">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-1 ${color}`}>{icon}</div>
      <div className="text-2xl font-bold text-[#111] tabular-nums">{value}</div>
      <div className="text-[12px] font-semibold text-[#374151]">{label}</div>
      {sub && <div className="text-[11px] text-[#9CA3AF]">{sub}</div>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AccuracyPanel() {
  const [goldenRows,  setGoldenRows]  = useState([]);
  const [paceRows,    setPaceRows]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [expandedPair,setExpandedPair]= useState(null);
  const [dsIds,       setDsIds]       = useState({ golden: null, pace: null });

  const load = useCallback(async () => {
    try {
      const datasets = await fetchDatasets(BATCH_REVIEW_PROCESS_ID);
      const golden = datasets.find(d => d.name === 'Golden Dataset — Ground Truth');
      const pace   = datasets.find(d => d.name === 'Batch Review Results');
      if (!golden || !pace) return;
      setDsIds({ golden: golden.id, pace: pace.id });
      const [gr, pr] = await Promise.all([
        fetchAllDatasetRows(golden.id),
        fetchAllDatasetRows(pace.id),
      ]);
      setGoldenRows(gr.map(r => r.data));
      setPaceRows(pr.map(r => ({ ...r.data, _run_id: r.run_id, _created_at: r.created_at })));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime: re-fetch when a new dataset_rows row lands
  useEffect(() => {
    if (!dsIds.pace) return;
    const unsub = subscribeToTable('dataset_rows', `dataset_id=eq.${dsIds.pace}`, load);
    return unsub;
  }, [dsIds.pace, load]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-[#555] text-sm">Loading accuracy data…</div>
  );
  if (!goldenRows.length) return (
    <div className="flex items-center justify-center h-64 text-[#555] text-sm">No golden dataset found.</div>
  );

  // ── Build per-pair results ─────────────────────────────────────────────────
  // For each golden pair, find the LATEST pace run by batch_number
  const pairResults = goldenRows.map(g => {
    const matches = paceRows
      .filter(p => p.batch_number === g.batch_number || p.pair_id === g.pair_id)
      .sort((a, b) => new Date(b._created_at) - new Date(a._created_at));
    const latest = matches[0] || null;
    const { scores, score } = latest ? scoreRow(latest, g) : { scores: {}, score: null };
    return { golden: g, latest, scores, score, runCount: matches.length };
  });

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const evaluated    = pairResults.filter(p => p.latest);
  const passing      = evaluated.filter(p => p.score >= 80);
  const overallAcc   = pct(passing.length, evaluated.length);
  const misdirectionPairs = pairResults.filter(p => p.golden.has_misdirection && p.latest);
  const misdirResist = pct(
    misdirectionPairs.filter(p => p.scores.no_misdirection).length,
    misdirectionPairs.length
  );
  const avgScore = evaluated.length
    ? Math.round(evaluated.reduce((s, p) => s + p.score, 0) / evaluated.length)
    : 0;

  // ── Error type breakdown ───────────────────────────────────────────────────
  const byType = {};
  pairResults.forEach(p => {
    const t = p.golden.primary_finding_type;
    if (!byType[t]) byType[t] = { total: 0, pass: 0 };
    byType[t].total++;
    if (p.latest && p.score >= 80) byType[t].pass++;
  });

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Accuracy — Batch Record Review</h1>
        <p className="text-[13px] text-[#555] mt-1">Lilly · Golden Eval Dataset · {goldenRows.length} pairs · live via Supabase Realtime</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<Target className="w-4 h-4 text-emerald-400" />} color="bg-emerald-400/10"
          label="Overall Accuracy" value={evaluated.length ? `${overallAcc}%` : '—'}
          sub={`${passing.length} / ${evaluated.length} pairs passed`} />
        <KpiCard icon={<BarChart2 className="w-4 h-4 text-blue-400" />} color="bg-blue-400/10"
          label="Avg Score" value={evaluated.length ? `${avgScore}/100` : '—'}
          sub={`${evaluated.length} of ${goldenRows.length} pairs run`} />
        <KpiCard icon={<Shield className="w-4 h-4 text-purple-400" />} color="bg-purple-400/10"
          label="Misdirection Resistance" value={misdirectionPairs.length ? `${misdirResist}%` : '—'}
          sub={`${misdirectionPairs.filter(p => p.scores.no_misdirection).length} / ${misdirectionPairs.length} traps avoided`} />
        <KpiCard icon={<TrendingUp className="w-4 h-4 text-amber-400" />} color="bg-amber-400/10"
          label="Pairs Evaluated" value={`${evaluated.length} / ${goldenRows.length}`}
          sub={evaluated.length < goldenRows.length ? `${goldenRows.length - evaluated.length} pairs not yet run` : 'All pairs evaluated'} />
      </div>

      {/* Main table */}
      <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#222]">
          <span className="text-[13px] font-semibold text-[#ccc]">Per-Pair Results</span>
          <span className="text-[11px] text-[#555] ml-2">click any row to see full breakdown</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#1a1a1a] text-[#555] text-[11px]">
                {['Pair','Drug','Error Type','Difficulty','Runs','Disposition','Severity','Misdirection','Score'].map(h => (
                  <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pairResults.map(({ golden: g, latest, scores, score, runCount }) => {
                const isExpanded = expandedPair === g.pair_id;
                const scoreColor = score === null ? 'text-[#444]'
                  : score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400';
                return (
                  <React.Fragment key={g.pair_id}>
                    <tr
                      onClick={() => setExpandedPair(isExpanded ? null : g.pair_id)}
                      className="border-b border-[#1a1a1a] hover:bg-[#161616] cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-2.5 text-[#888] font-mono">{g.pair_id?.split('-').slice(0,2).join('-')}</td>
                      <td className="px-3 py-2.5 text-white font-medium whitespace-nowrap">{g.product_name?.split(' ')[0]}</td>
                      <td className="px-3 py-2.5 text-[#aaa]">{FINDING_TYPE_LABELS[g.primary_finding_type] || g.primary_finding_type}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          g.difficulty === 'Hard' ? 'bg-red-500/10 text-red-400'
                          : g.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-emerald-500/10 text-emerald-400'}`}>{g.difficulty}</span>
                      </td>
                      <td className="px-3 py-2.5 text-[#666] tabular-nums">{runCount}</td>
                      <td className="px-3 py-2.5">{latest ? <Chip ok={scores.disposition} label={latest.disposition} /> : <span className="text-[#444]">—</span>}</td>
                      <td className="px-3 py-2.5">{latest ? <Chip ok={scores.severity} label={latest.primary_finding_severity || '—'} /> : <span className="text-[#444]">—</span>}</td>
                      <td className="px-3 py-2.5">{g.has_misdirection
                        ? (latest ? <Chip ok={scores.no_misdirection} label={scores.no_misdirection ? 'Resisted' : 'Fooled'} /> : <span className="text-[#444]">—</span>)
                        : <span className="text-[#444] text-[10px]">n/a</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold tabular-nums ${scoreColor}`}>{score !== null ? score : '—'}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3 text-[#444]" /> : <ChevronDown className="w-3 h-3 text-[#444]" />}
                        </div>
                      </td>
                    </tr>

                    {/* Drill-down row */}
                    {isExpanded && (
                      <tr className="border-b border-[#1a1a1a] bg-[#0d0d0d]">
                        <td colSpan={9} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12px]">
                            {/* Golden Answer Key */}
                            <div>
                              <div className="text-[11px] font-semibold text-[#555] uppercase tracking-wider mb-2">Golden Answer Key</div>
                              <div className="space-y-1">
                                {[
                                  ['Correct Disposition', g.correct_disposition],
                                  ['Finding Type', FINDING_TYPE_LABELS[g.primary_finding_type]],
                                  ['Severity', g.primary_finding_severity],
                                  ['Critical / Major / Total', `${g.correct_critical_findings} / ${g.correct_major_findings} / ${g.correct_total_findings}`],
                                  ['Min Confidence', `${g.min_confidence_pct}%`],
                                  ['Routing', g.correct_routing],
                                  ['Evidence Location', g.key_evidence_location],
                                ].map(([k, v]) => (
                                  <div key={k} className="flex gap-2">
                                    <span className="text-[#555] w-36 flex-shrink-0">{k}</span>
                                    <span className="text-[#ccc]">{v}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            {/* Pace Output */}
                            <div>
                              <div className="text-[11px] font-semibold text-[#555] uppercase tracking-wider mb-2">
                                {latest ? 'Pace Output (Latest Run)' : 'No Run Yet'}
                              </div>
                              {latest ? (
                                <div className="space-y-1">
                                  {[
                                    ['Disposition',    latest.disposition,              scores.disposition],
                                    ['Finding Type',   FINDING_TYPE_LABELS[latest.primary_finding_type] || latest.primary_finding_type, scores.finding_type],
                                    ['Severity',       latest.primary_finding_severity, scores.severity],
                                    ['Critical / Major / Total', `${latest.critical_findings} / ${latest.major_findings} / ${latest.total_findings}`, scores.critical_count && scores.major_count && scores.total_count],
                                    ['Confidence',     `${latest.confidence_pct}%`,     scores.confidence_ok],
                                    ['Routing',        latest.routing,                  null],
                                  ].map(([k, v, ok]) => (
                                    <div key={k} className="flex gap-2 items-start">
                                      <span className="text-[#555] w-36 flex-shrink-0">{k}</span>
                                      <span className={ok === true ? 'text-emerald-400' : ok === false ? 'text-red-400' : 'text-[#ccc]'}>{v || '—'}</span>
                                      {ok === true  && <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />}
                                      {ok === false && <XCircle    className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-[#444] italic">Run this pair through Pace to see results here.</div>
                              )}
                            </div>
                          </div>
                          {/* Pass criteria */}
                          <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
                            <span className="text-[11px] text-[#555] font-semibold uppercase tracking-wider">Pass Criteria: </span>
                            <span className="text-[11px] text-[#777]">{g.scoring_pass_criteria}</span>
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

      {/* Error type breakdown */}
      <div className="bg-[#111] border border-[#222] rounded-xl p-4">
        <div className="text-[13px] font-semibold text-[#ccc] mb-3">Accuracy by Error Type</div>
        <div className="space-y-2">
          {Object.entries(byType).map(([type, { total, pass }]) => {
            const acc = pct(pass, total);
            return (
              <div key={type} className="flex items-center gap-3">
                <span className="text-[12px] text-[#888] w-44 flex-shrink-0">{FINDING_TYPE_LABELS[type] || type}</span>
                <div className="flex-1 h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${acc >= 80 ? 'bg-emerald-500' : acc >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: total > 0 && pass > 0 ? `${acc}%` : total > 0 ? '2px' : '0%' }} />
                </div>
                <span className="text-[12px] text-[#555] tabular-nums w-16 text-right">
                  {pass}/{total} {total > 0 ? `(${acc}%)` : ''}
                </span>
              </div>
            );
          })}
        </div>
        {evaluated.length === 0 && (
          <div className="text-[12px] text-[#444] italic mt-2">No Pace runs yet — bars will fill as evaluations complete.</div>
        )}
      </div>
    </div>
  );
}
