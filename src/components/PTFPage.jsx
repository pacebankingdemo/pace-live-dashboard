import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield, RefreshCw, ChevronDown, ChevronUp, X, CheckCircle,
  AlertTriangle, XCircle, Clock, FileText, Brain, ThumbsUp,
  ThumbsDown, ChevronRight, Loader, Search, Filter, Eye
} from 'lucide-react';

const API = 'https://ptf-dashboard-api-production.up.railway.app';

// ── Decision badge colours ────────────────────────────────────────────────────
const BADGE = {
  CLEAR:       'bg-green-900/50 text-green-300 border border-green-700',
  PEND_L1:     'bg-yellow-900/50 text-yellow-300 border border-yellow-700',
  PEND_L2:     'bg-orange-900/50 text-orange-300 border border-orange-700',
  BLOCK:       'bg-red-900/50 text-red-300 border border-red-700',
  ERROR:       'bg-gray-700 text-gray-300 border border-gray-600',
  ESCALATE:    'bg-purple-900/50 text-purple-300 border border-purple-700',
};

const BADGE_ICON = {
  CLEAR:    <CheckCircle size={11} />,
  PEND_L1:  <Clock size={11} />,
  PEND_L2:  <Clock size={11} />,
  BLOCK:    <XCircle size={11} />,
  ERROR:    <AlertTriangle size={11} />,
  ESCALATE: <AlertTriangle size={11} />,
};

const STATUS_BADGE = {
  pending_approval: 'bg-yellow-900/40 text-yellow-300 border border-yellow-700',
  approved:         'bg-green-900/40 text-green-300 border border-green-700',
  rejected:         'bg-red-900/40 text-red-300 border border-red-700',
  applied:          'bg-blue-900/40 text-blue-300 border border-blue-700',
};

function DecisionBadge({ decision }) {
  const d = (decision || 'ERROR').toUpperCase();
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${BADGE[d] || BADGE.ERROR}`}>
      {BADGE_ICON[d]} {d}
    </span>
  );
}

// ── Tiny stat card ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-[#1a1f2e] rounded-lg px-4 py-3 border border-white/5">
      <div className={`text-2xl font-bold ${color}`}>{value ?? '—'}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Audit Trail Drawer ────────────────────────────────────────────────────────
function AuditDrawer({ row, onClose, onReview }) {
  const [submitting, setSubmitting] = useState(false);
  const [reviewer, setReviewer] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(null);

  const inv = row.investigator_output || {};
  const ver = row.verifier_output || {};
  const hits = inv.hit_table_summary || [];
  const narratives = inv.narratives || [];

  const needsReview = ['PEND_L1', 'PEND_L2'].includes(row.final_decision?.toUpperCase());

  async function submitReview(decision) {
    if (!reviewer.trim()) { alert('Enter your name first'); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/api/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: row.scenario_id, decision, reviewer, notes }),
      });
      const d = await r.json();
      setSubmitted(d);
      onReview && onReview(row.scenario_id, decision);
    } catch(e) { alert('Review submission failed: ' + e.message); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#0f1420] border-l border-white/10 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#141926]">
          <div>
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-blue-400" />
              <span className="font-semibold text-white text-sm">{row.scenario_id}</span>
              <DecisionBadge decision={row.final_decision} />
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              Batch: {row.batch_id} · {row.created_at ? new Date(row.created_at).toLocaleString() : ''}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Payment summary */}
          <Section title="Payment Details">
            <KV label="Remitter"   value={row.remitter_name} />
            <KV label="Beneficiary" value={row.beneficiary_name} />
            <KV label="Amount"     value={row.amount != null ? `${row.currency || ''} ${Number(row.amount).toLocaleString()}` : '—'} />
            <KV label="Payment Ref" value={row.payment_ref} />
          </Section>

          {/* Hit Table */}
          {hits.length > 0 && (
            <Section title={`Watchlist Hits (${hits.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-white/5">
                      <th className="text-left py-1.5 pr-3">Hit ID</th>
                      <th className="text-left py-1.5 pr-3">Field</th>
                      <th className="text-left py-1.5 pr-3">Entity</th>
                      <th className="text-left py-1.5 pr-3">Match</th>
                      <th className="text-left py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hits.map((h, i) => (
                      <tr key={i} className="border-b border-white/5 text-gray-300">
                        <td className="py-1.5 pr-3 font-mono text-[10px] text-gray-500">{h.hit_id?.slice(-8)}</td>
                        <td className="py-1.5 pr-3">{h.triggered_field}</td>
                        <td className="py-1.5 pr-3">{h.entity_name}</td>
                        <td className="py-1.5 pr-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${h.match_type === 'exact_match' ? 'bg-red-900/50 text-red-300' : 'bg-yellow-900/50 text-yellow-300'}`}>
                            {h.match_type}
                          </span>
                        </td>
                        <td className="py-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${h.colour === 'red' ? 'bg-red-900/40 text-red-300' : h.colour === 'grey' ? 'bg-gray-700 text-gray-300' : 'bg-green-900/40 text-green-300'}`}>
                            {h.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Narratives */}
          {narratives.length > 0 && (
            <Section title="Investigator Narratives">
              <div className="space-y-2">
                {narratives.map((n, i) => (
                  <div key={i} className="bg-[#1a1f2e] rounded p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-gray-500">{n.hit_id?.slice(-8)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${n.hit_is_grey ? 'bg-gray-700 text-gray-400' : 'bg-orange-900/50 text-orange-300'}`}>
                        {n.template_key}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">{n.narrative_text}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Verifier Output */}
          {ver.review_notes && (
            <Section title="Verifier Review">
              <div className="bg-[#1a1f2e] rounded p-3 border border-white/5">
                <p className="text-xs text-gray-300 leading-relaxed">{ver.review_notes}</p>
                {ver.alias_check_performed && (
                  <div className="mt-2 text-xs text-gray-400">
                    Alias check: <span className="text-gray-300">{ver.alias_check_result || '—'}</span>
                  </div>
                )}
                {ver.final_decision && (
                  <div className="mt-2">
                    <DecisionBadge decision={ver.final_decision} />
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* HITL Review Form */}
          {needsReview && !submitted && (
            <Section title="Human Review">
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Reviewer name"
                  value={reviewer}
                  onChange={e => setReviewer(e.target.value)}
                  className="w-full bg-[#1a1f2e] border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <textarea
                  placeholder="Review notes (optional)"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-[#1a1f2e] border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                />
                <div className="flex gap-2">
                  {['CLOSE_CLEAR', 'CLOSE_ESCALATE', 'CLOSE_BLOCK'].map(d => (
                    <button
                      key={d}
                      disabled={submitting}
                      onClick={() => submitReview(d)}
                      className={`flex-1 py-2 rounded text-xs font-semibold transition-colors disabled:opacity-50 ${
                        d === 'CLOSE_CLEAR'    ? 'bg-green-700 hover:bg-green-600 text-white' :
                        d === 'CLOSE_BLOCK'    ? 'bg-red-700 hover:bg-red-600 text-white' :
                                                  'bg-orange-700 hover:bg-orange-600 text-white'
                      }`}
                    >
                      {submitting ? <Loader size={12} className="animate-spin mx-auto" /> : d.replace('CLOSE_', '')}
                    </button>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {submitted && (
            <div className="bg-green-900/30 border border-green-700 rounded p-3 text-sm text-green-300">
              ✓ Review submitted — {submitted.decision} by {submitted.scenario_id}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</div>
      {children}
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div className="flex gap-2 text-xs py-0.5">
      <span className="text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-gray-200 truncate">{value || '—'}</span>
    </div>
  );
}


// ── Intelligence Layer Panel ──────────────────────────────────────────────────────
function StatusLabel({ status }) {
  const MAP = {
    pending:          { label: 'Awaiting Review', cls: 'bg-yellow-900/40 text-yellow-300 border border-yellow-700' },
    pending_approval: { label: 'Awaiting Review', cls: 'bg-yellow-900/40 text-yellow-300 border border-yellow-700' },
    approved:         { label: 'Approved',         cls: 'bg-green-900/40 text-green-300 border border-green-700'  },
    rejected:         { label: 'Rejected',         cls: 'bg-red-900/40 text-red-300 border border-red-700'        },
    applied:          { label: 'Applied to KB',    cls: 'bg-blue-900/40 text-blue-300 border border-blue-700'     },
  };
  const s = MAP[status] || { label: status, cls: 'bg-gray-700 text-gray-300' };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${s.cls}`}>{s.label}</span>
  );
}

function ProposalCard({ proposal, idx }) {
  // Primary format: {pattern, before, after, section, evidence[], expected_impact}
  const evidence = Array.isArray(proposal.evidence) ? proposal.evidence : [];
  const hasBeforeAfter = proposal.before || proposal.after;

  return (
    <div className="border border-white/8 rounded-lg overflow-hidden">
      {/* Headline */}
      <div className="p-3 bg-[#12172a] flex items-start gap-2.5">
        <span className="mt-0.5 text-[10px] font-bold text-purple-400 bg-purple-900/30 border border-purple-700/50 px-1.5 py-0.5 rounded shrink-0">
          #{idx + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white font-medium leading-snug">
            {proposal.pattern || proposal.description || `Proposal ${idx + 1}`}
          </div>
          {proposal.section && (
            <div className="text-[10px] text-purple-300 mt-0.5">Section: {proposal.section}</div>
          )}
        </div>
      </div>

      {/* Detail body */}
      <div className="bg-[#0d1220] p-3 space-y-3 border-t border-white/5">

        {/* Why this matters */}
        {proposal.expected_impact && (
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Why this matters</div>
            <div className="text-xs text-gray-200 leading-relaxed">{proposal.expected_impact}</div>
          </div>
        )}

        {/* Cases this addresses */}
        {evidence.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Cases addressed</div>
            <div className="flex flex-wrap gap-1">
              {evidence.map(e => (
                <span key={e} className="text-[10px] font-mono bg-orange-900/30 text-orange-300 border border-orange-700/40 px-1.5 py-0.5 rounded">{e}</span>
              ))}
            </div>
          </div>
        )}

        {/* Before → After rule change */}
        {hasBeforeAfter && (
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Rule change</div>
            {proposal.before && (
              <div className="mb-2">
                <div className="text-[9px] text-red-400 font-semibold mb-1">CURRENT RULE</div>
                <div className="bg-red-950/30 border border-red-800/30 rounded p-2 text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">{proposal.before}</div>
              </div>
            )}
            {proposal.after && (
              <div>
                <div className="text-[9px] text-green-400 font-semibold mb-1">{proposal.before ? 'UPDATED RULE' : 'NEW RULE'}</div>
                <div className="bg-green-950/20 border border-green-800/30 rounded p-2 text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">{proposal.after}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InsightsPanel({ onClose }) {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [reviewer, setReviewer] = useState('');

  useEffect(() => {
    fetch(`${API}/api/insights?limit=30`)
      .then(r => r.json())
      .then(d => { setInsights(d.insights || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleAction(id, action) {
    const name = reviewer.trim() || prompt('Your name (for audit trail):');
    if (!name) return;
    setActing(id);
    try {
      const r = await fetch(`${API}/api/insights/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id: id, action, reviewer: name }),
      });
      const d = await r.json();
      setInsights(prev => prev.map(i =>
        i.id === id ? { ...i, status: d.status, approved_by: d.approved_by } : i
      ));
    } catch(e) { alert('Submission failed: ' + e.message); }
    finally { setActing(null); }
  }

  const pending  = insights.filter(i => ['pending', 'pending_approval'].includes(i.status));
  const resolved = insights.filter(i => !['pending', 'pending_approval'].includes(i.status));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#0f1420] border-l border-white/10 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#141926] shrink-0">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-purple-400" />
            <div>
              <div className="font-semibold text-white text-sm">Platform Learning</div>
              <div className="text-[10px] text-gray-400">Proposed improvements to screening rules</div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded"><X size={18} /></button>
        </div>

        {/* Reviewer name bar */}
        <div className="px-5 py-2.5 bg-[#111827] border-b border-white/5 shrink-0 flex items-center gap-2">
          <span className="text-xs text-gray-400 shrink-0">Reviewing as:</span>
          <input
            value={reviewer}
            onChange={e => setReviewer(e.target.value)}
            placeholder="Enter your name"
            className="text-xs bg-[#1a1f2e] border border-white/10 rounded px-2 py-1 text-white placeholder-gray-600 focus:outline-none focus:border-purple-600 w-48"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading && <div className="text-gray-400 text-sm">Loading proposals…</div>}
          {!loading && insights.length === 0 && (
            <div className="text-gray-500 text-sm text-center py-16">
              <Brain size={32} className="mx-auto mb-3 text-gray-700" />
              <div>No proposals yet.</div>
              <div className="text-xs mt-1">The platform will analyse the next completed batch automatically.</div>
            </div>
          )}

          {/* Pending proposals */}
          {pending.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>
                Awaiting your decision ({pending.length})
              </div>
              <div className="space-y-4">
                {pending.map(ins => {
                  const pc = ins.proposed_changes || {};
                  const isOpen = !!expanded[ins.id];
                  return (
                    <div key={ins.id} className="bg-[#1a1f2e] rounded-xl border border-purple-700/30 overflow-hidden">
                      {/* Batch summary header */}
                      <button
                        onClick={() => toggleExpand(ins.id)}
                        className="w-full flex items-start justify-between gap-3 p-4 hover:bg-white/3 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <StatusLabel status={ins.status} />
                            <span className="text-[10px] text-gray-500">
                              Batch: <span className="text-gray-400">{ins.batch_id}</span>
                            </span>
                            <span className="text-[10px] text-gray-600">
                              {ins.created_at ? new Date(ins.created_at).toLocaleDateString() : ''}
                            </span>
                          </div>
                          <div className="text-sm text-white font-medium leading-snug">
                            {pc.summary || pc.change_summary || pc.description || 'Screening rule improvement proposed'}
                          </div>
                          {!isOpen && (pc.proposals || pc.change_summary || pc.summary) && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {Array.isArray(pc.proposals) && pc.proposals.slice(0, 3).map((p, i) => (
                                <span key={i} className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">
                                  {(p.pattern || p.description || `Change ${i+1}`).slice(0, 60)}…
                                </span>
                              ))}
                              {!Array.isArray(pc.proposals) && (pc.change_summary || pc.summary) && (
                                <span className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">
                                  {(pc.change_summary || pc.summary).slice(0, 80)}…
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <span className="text-gray-500 shrink-0 mt-0.5">
                          {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </span>
                      </button>

                      {/* Expanded proposals */}
                      {isOpen && (
                        <div className="border-t border-white/5">
                          {/* Individual proposals */}
                          <div className="p-4 space-y-2">
                            {(() => {
                              const proposals = Array.isArray(ins.proposed_changes?.proposals) ? ins.proposed_changes.proposals : [];
                              return proposals.length > 0
                                ? proposals.map((p, i) => <ProposalCard key={p.id || i} proposal={p} idx={i} />)
                                : (
                                  <div className="text-xs text-gray-400 italic">
                                    {ins.proposed_changes?.description || ins.evidence || 'No detailed proposals available.'}
                                  </div>
                                );
                            })()}
                          </div>

                          {/* Approve / Reject */}
                          <div className="px-4 pb-4 flex items-center gap-2">
                            <button
                              disabled={acting === ins.id}
                              onClick={() => handleAction(ins.id, 'approve')}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700/70 hover:bg-green-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
                            >
                              {acting === ins.id ? <Loader size={11} className="animate-spin" /> : <ThumbsUp size={11} />}
                              Apply to screening rules
                            </button>
                            <button
                              disabled={acting === ins.id}
                              onClick={() => handleAction(ins.id, 'reject')}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1f2535] hover:bg-[#252d40] border border-white/10 text-gray-300 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
                            >
                              <ThumbsDown size={11} /> Decline
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resolved proposals */}
          {resolved.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-600 inline-block"></span>
                History ({resolved.length})
              </div>
              <div className="space-y-2">
                {resolved.map(ins => {
                  const pc = ins.proposed_changes || {};
                  const isOpen = !!expanded[ins.id];
                  return (
                    <div key={ins.id} className="bg-[#161b28] rounded-lg border border-white/5 overflow-hidden">
                      <button
                        onClick={() => toggleExpand(ins.id)}
                        className="w-full flex items-start justify-between gap-3 p-3 hover:bg-white/3 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <StatusLabel status={ins.status} />
                            <span className="text-[10px] text-gray-500">Batch: {ins.batch_id}</span>
                            {ins.approved_by && (
                              <span className="text-[10px] text-gray-600">by {ins.approved_by}</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 leading-snug truncate">
                            {pc.summary || `${proposals.length} proposal${proposals.length !== 1 ? 's' : ''}`}
                          </div>
                        </div>
                        <span className="text-gray-600 shrink-0">
                          {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="border-t border-white/5 p-3 space-y-2">
                          {(() => {
                            const proposals = Array.isArray(ins.proposed_changes?.proposals) ? ins.proposed_changes.proposals : [];
                            return proposals.length > 0
                              ? proposals.map((p, i) => <ProposalCard key={p.id || i} proposal={p} idx={i} />)
                              : <div className="text-xs text-gray-400 italic">{ins.proposed_changes?.description || ins.evidence || 'No details.'}</div>;
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ── Screening Results Table ───────────────────────────────────────────────────
function ResultsTable({ rows, onSelectRow }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b border-white/5 text-left">
            <th className="py-2 pr-3">Scenario</th>
            <th className="py-2 pr-3">Batch</th>
            <th className="py-2 pr-3">Remitter</th>
            <th className="py-2 pr-3">Beneficiary</th>
            <th className="py-2 pr-3">Amount</th>
            <th className="py-2 pr-3">Decision</th>
            <th className="py-2 pr-3">Hits</th>
            <th className="py-2 pr-3">Time (s)</th>
            <th className="py-2">Audit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
              <td className="py-2 pr-3 font-mono text-[10px] text-gray-400">{r.scenario_id}</td>
              <td className="py-2 pr-3 text-gray-400">{r.batch_id}</td>
              <td className="py-2 pr-3 max-w-[140px] truncate text-gray-200" title={r.remitter_name}>{r.remitter_name || '—'}</td>
              <td className="py-2 pr-3 max-w-[140px] truncate text-gray-200" title={r.beneficiary_name}>{r.beneficiary_name || '—'}</td>
              <td className="py-2 pr-3 text-gray-300 whitespace-nowrap">
                {r.amount != null ? `${r.currency || ''} ${Number(r.amount).toLocaleString()}` : '—'}
              </td>
              <td className="py-2 pr-3"><DecisionBadge decision={r.final_decision} /></td>
              <td className="py-2 pr-3 text-gray-400">{r.num_hits ?? '—'}</td>
              <td className="py-2 pr-3 text-gray-400">{r.processing_time_seconds != null ? r.processing_time_seconds.toFixed(1) : '—'}</td>
              <td className="py-2">
                <button
                  onClick={() => onSelectRow(r)}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-800/40 hover:bg-blue-700/60 text-blue-300 rounded text-[10px] transition-colors"
                >
                  <Eye size={11} /> View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main PTFPage ──────────────────────────────────────────────────────────────
export default function PTFPage() {
  const [tab, setTab] = useState('results'); // 'results' | 'accuracy'
  const [rows, setRows] = useState([]);
  const [accuracy, setAccuracy] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [showInsights, setShowInsights] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDecision, setFilterDecision] = useState('ALL');
  const [page, setPage] = useState(1);
  const PER_PAGE = 50;

  const fetchData = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [rRes, aRes] = await Promise.all([
        fetch(`${API}/api/screening-results?limit=500`),
        fetch(`${API}/api/accuracy`),
      ]);
      const rData = await rRes.json();
      const aData = await aRes.json();
      setRows(rData.results || []);
      setAccuracy(aData.accuracy || []);
    } catch(e) { console.error('PTF fetch error', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derived stats
  const total = rows.length;
  const clears  = rows.filter(r => r.final_decision?.toUpperCase() === 'CLEAR').length;
  const pending = rows.filter(r => ['PEND_L1','PEND_L2'].includes(r.final_decision?.toUpperCase())).length;
  const blocks  = rows.filter(r => r.final_decision?.toUpperCase() === 'BLOCK').length;
  const latestBatch = rows[0]?.batch_id || '—';
  const avgTime = rows.length
    ? (rows.reduce((s, r) => s + (r.processing_time_seconds || 0), 0) / rows.length).toFixed(2)
    : '—';

  // Filtered + searched rows
  const filtered = rows.filter(r => {
    const d = (r.final_decision || '').toUpperCase();
    if (filterDecision !== 'ALL' && d !== filterDecision) return false;
    if (search) {
      const s = search.toLowerCase();
      return (r.scenario_id || '').toLowerCase().includes(s)
          || (r.remitter_name || '').toLowerCase().includes(s)
          || (r.beneficiary_name || '').toLowerCase().includes(s)
          || (r.batch_id || '').toLowerCase().includes(s);
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageRows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Reset to page 1 on filter change
  useEffect(() => { setPage(1); }, [search, filterDecision]);

  return (
    <div className="h-full flex flex-col bg-[#0b0f1a] text-white overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#0f1420] shrink-0">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-blue-400" />
          <span className="font-semibold text-sm">PTF L1 Screening</span>
          {latestBatch !== '—' && (
            <span className="text-[10px] bg-blue-900/40 text-blue-300 border border-blue-700 px-2 py-0.5 rounded">
              {latestBatch}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInsights(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-900/40 hover:bg-purple-800/60 text-purple-300 border border-purple-700 rounded text-xs font-medium transition-colors"
          >
            <Brain size={13} /> Intelligence Layer
          </button>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded text-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader size={24} className="animate-spin text-blue-400" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Stat cards */}
          <div className="px-6 pt-5 pb-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Total Screened" value={total} />
            <StatCard label="Clear" value={clears} color="text-green-400" sub={total ? `${((clears/total)*100).toFixed(1)}%` : ''} />
            <StatCard label="Pending Review" value={pending} color="text-yellow-400" />
            <StatCard label="Blocked" value={blocks} color="text-red-400" />
            <StatCard label="Avg Time (s)" value={avgTime} color="text-blue-300" />
            <StatCard label="Latest Batch" value={latestBatch} />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-6 pb-3 border-b border-white/5">
            {[['results','Screening Results'],['accuracy','Accuracy']]
              .map(([t,label]) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-1.5 rounded text-xs font-medium transition-colors ${tab === t ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                  {label}
                </button>
              ))}
          </div>

          {tab === 'results' && (
            <div className="px-6 pt-4">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text" placeholder="Search scenario, remitter, beneficiary…"
                    value={search} onChange={e => setSearch(e.target.value)}
                    className="bg-[#1a1f2e] border border-white/10 rounded pl-7 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-72"
                  />
                </div>
                <div className="flex items-center gap-1">
                  {['ALL','CLEAR','PEND_L1','PEND_L2','BLOCK'].map(d => (
                    <button key={d} onClick={() => setFilterDecision(d)}
                      className={`px-2.5 py-1.5 rounded text-[10px] font-semibold transition-colors ${filterDecision === d ? 'bg-blue-700 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-gray-500 ml-auto">{filtered.length} results</span>
              </div>

              <ResultsTable rows={pageRows} onSelectRow={setSelectedRow} />

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <button disabled={page === 1} onClick={() => setPage(p => p-1)}
                    className="px-3 py-1 bg-white/5 rounded text-xs text-gray-300 disabled:opacity-30 hover:bg-white/10">
                    ← Prev
                  </button>
                  <span className="text-xs text-gray-400">{page} / {totalPages}</span>
                  <button disabled={page === totalPages} onClick={() => setPage(p => p+1)}
                    className="px-3 py-1 bg-white/5 rounded text-xs text-gray-300 disabled:opacity-30 hover:bg-white/10">
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'accuracy' && (
            <div className="px-6 pt-4">
              {accuracy.length === 0 ? (
                <div className="text-gray-500 text-sm text-center py-10">No accuracy records yet. Run a batch to see results.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-white/5 text-left">
                        <th className="py-2 pr-3">Batch</th>
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 pr-3">Total</th>
                        <th className="py-2 pr-3">Correct</th>
                        <th className="py-2 pr-3">Accuracy</th>
                        <th className="py-2 pr-3">FP</th>
                        <th className="py-2 pr-3">FN</th>
                        <th className="py-2">TP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accuracy.map((a, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/3">
                          <td className="py-2 pr-3 font-mono text-gray-300">{a.batch_id}</td>
                          <td className="py-2 pr-3 text-gray-400">{a.run_date ? new Date(a.run_date).toLocaleDateString() : '—'}</td>
                          <td className="py-2 pr-3 text-gray-200">{a.total_alerts}</td>
                          <td className="py-2 pr-3 text-gray-200">{a.correct_decisions}</td>
                          <td className="py-2 pr-3">
                            <span className={`font-semibold ${a.accuracy_pct >= 90 ? 'text-green-400' : a.accuracy_pct >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {a.accuracy_pct != null ? `${a.accuracy_pct}%` : '—'}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-red-400">{a.false_positives}</td>
                          <td className="py-2 pr-3 text-orange-400">{a.false_negatives}</td>
                          <td className="py-2 text-green-400">{a.true_positives}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Audit Drawer */}
      {selectedRow && (
        <AuditDrawer
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
          onReview={(id, decision) => {
            setRows(prev => prev.map(r => r.scenario_id === id ? { ...r, human_review: decision } : r));
            setSelectedRow(null);
          }}
        />
      )}

      {/* Intelligence Layer Drawer */}
      {showInsights && <InsightsPanel onClose={() => setShowInsights(false)} />}
    </div>
  );
}
