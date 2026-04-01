import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../services/supabase';
import {
    Lightbulb,
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    XCircle,
    Clock,
    Shield,
    AlertTriangle,
    Sparkles,
    ListOrdered,
    Layers,
    User,
    FileSearch,
    Activity,
    TrendingUp,
    Target,
    Database,
    Zap
} from 'lucide-react';

const INSIGHTS_PROCESS_MAP = {
    '215e20a2-ea74-46bd-b520-2eba961b50e8': '795b85bb-ef67-4e56-aaec-2a07d5ed8c90', // NatWest
    'd488c0b3-46ed-46ca-b516-83bdb20466de': 'fa91e289-044b-4fc9-a626-ebdb6c0ee64b', // PwC
    '0649e502-b1ff-490f-8d31-cd8e4fb2d1ab': '2a7911d1-2e2c-40fc-a78d-a663d5415eab', // Banking Demo
};

// ─── Banking Demo cross-process intelligence renderer ───────────────────────

function RiskBadge({ level }) {
    const map = {
        HIGH: 'bg-red-50 text-red-700 border-red-200',
        MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
        LOW: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        CRITICAL: 'bg-red-100 text-red-800 border-red-300',
    };
    const cls = map[level?.toUpperCase()] || 'bg-[#f5f5f5] text-[#525252] border-[#e8e8e8]';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-[600] border ${cls}`}>
            {level || 'UNKNOWN'}
        </span>
    );
}

function SectionHeader({ icon, label, color }) {
    return (
        <div className="flex items-center gap-1.5 mb-3">
            <span className={color}>{icon}</span>
            <span className="text-[12px] font-[600] text-[#171717] uppercase tracking-wide">{label}</span>
        </div>
    );
}

function DataGrid({ data }) {
    if (!data || Object.keys(data).length === 0) return null;
    return (
        <div className="grid grid-cols-1 gap-y-2">
            {Object.entries(data).map(([k, v]) => (
                <div key={k} className="flex items-start justify-between py-1 border-b border-[#fafafa] gap-4">
                    <span className="text-[12px] text-[#8f8f8f] shrink-0">{k}</span>
                    <span className="text-[12px] text-[#171717] font-[500] text-right">{String(v)}</span>
                </div>
            ))}
        </div>
    );
}

function BankingInsightCard({ run }) {
    const [expanded, setExpanded] = useState(false);
    const logs = run.logs || [];

    const dataCollectionLog = logs.find(l => l.metadata?.step_name === 'Data Collection');
    const entityProfileLog = logs.find(l => l.log_type === 'decision' && l.metadata?.step_name === 'Entity Profiling');
    const entityArtifact = logs.find(l => l.log_type === 'artifact' && l.metadata?.step_name === 'Entity Profiling');
    const patternLog = logs.find(l => l.metadata?.step_name === 'Pattern Detection');
    const recommendationLog = logs.find(l => l.log_type === 'decision' && l.metadata?.step_name === 'Recommendations');
    const actionArtifact = logs.find(l => l.log_type === 'artifact' && l.metadata?.step_name === 'Action Plan');
    const summaryLog = logs.find(l => l.metadata?.step_name === 'Insights Summary');

    const summary = summaryLog?.metadata || {};
    const dcData = dataCollectionLog?.metadata?.data || {};
    const entityData = entityArtifact?.metadata?.data || {};
    const actionData = actionArtifact?.metadata?.data || {};
    const patternSteps = patternLog?.metadata?.reasoning_steps || [];
    const recSteps = recommendationLog?.metadata?.reasoning_steps || [];

    const riskLevel = summary.risk_level || 'UNKNOWN';
    const runDate = new Date(run.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
        <div className="border border-[#e8e8e8] rounded-xl bg-white overflow-hidden transition-shadow hover:shadow-sm">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-5 py-4 flex items-start justify-between text-left"
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[11px] font-mono text-[#8f8f8f]">{run.name}</span>
                        <RiskBadge level={riskLevel} />
                    </div>
                    <h3 className="text-[14px] font-[550] text-[#171717] mb-1">
                        Cross-Process Risk Intelligence
                    </h3>
                    <p className={`text-[13px] text-[#8f8f8f] ${!expanded ? 'line-clamp-2' : ''}`}>
                        {summary.entities_flagged ?? '?'} multi-process {summary.entities_flagged === 1 ? 'entity' : 'entities'} · {summary.patterns_found ?? '?'} systemic {summary.patterns_found === 1 ? 'pattern' : 'patterns'} · {summary.disposition || 'N/A'} · {summary.processes_scanned ?? '?'} processes scanned
                    </p>
                    <p className="text-[11px] text-[#cacaca] mt-1">{runDate}</p>
                </div>
                <div className="ml-3 mt-1 text-[#cacaca]">
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
            </button>

            {expanded && (
                <div className="border-t border-[#f0f0f0]">

                    {/* Data Collection */}
                    {Object.keys(dcData).length > 0 && (
                        <div className="px-5 py-4 border-b border-[#f5f5f5]">
                            <SectionHeader icon={<Database className="w-3.5 h-3.5" />} label="Data Collection" color="text-indigo-500" />
                            <DataGrid data={dcData} />
                        </div>
                    )}

                    {/* Top Risk Entities */}
                    {Object.keys(entityData).length > 0 && (
                        <div className="px-5 py-4 border-b border-[#f5f5f5]">
                            <SectionHeader icon={<User className="w-3.5 h-3.5" />} label="Top Risk Entities" color="text-red-500" />
                            <DataGrid data={entityData} />
                        </div>
                    )}

                    {/* Patterns Detected */}
                    {patternSteps.length > 0 && (
                        <div className="px-5 py-4 border-b border-[#f5f5f5]">
                            <SectionHeader icon={<TrendingUp className="w-3.5 h-3.5" />} label="Patterns Detected" color="text-violet-500" />
                            <div className="space-y-2">
                                {patternSteps.map((step, i) => (
                                    <div key={i} className="flex gap-2">
                                        <span className="text-[11px] text-[#cacaca] mt-0.5 shrink-0">{i + 1}.</span>
                                        <span className="text-[12px] text-[#525252] leading-relaxed">{step}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Action Plan */}
                    {Object.keys(actionData).length > 0 && (
                        <div className="px-5 py-4 border-b border-[#f5f5f5]">
                            <SectionHeader icon={<Target className="w-3.5 h-3.5" />} label="Action Plan" color="text-amber-500" />
                            <DataGrid data={actionData} />
                        </div>
                    )}

                    {/* Recommendations reasoning */}
                    {recSteps.length > 0 && (
                        <div className="px-5 py-4 border-b border-[#f5f5f5] bg-[#fefdfb]">
                            <SectionHeader icon={<Lightbulb className="w-3.5 h-3.5" />} label="Recommendations" color="text-amber-500" />
                            <div className="space-y-2">
                                {recSteps.map((step, i) => (
                                    <div key={i} className="flex gap-2">
                                        <span className="text-[11px] text-[#cacaca] mt-0.5 shrink-0">{i + 1}.</span>
                                        <span className="text-[12px] text-[#525252] leading-relaxed">{step}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="px-5 py-3 bg-[#fafafa]">
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-[500] text-[#8f8f8f]">
                            <Activity className="w-3.5 h-3.5" />
                            {summary.processes_scanned ?? '?'} processes · Top signal: {summary.top_signal || 'N/A'}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Standard KB-update insight card (NatWest / PwC) ────────────────────────

function KBInsightCard({ insight, onAction, actionInProgress, copy }) {
    const [expanded, setExpanded] = useState(false);
    const logs = insight.logs || [];

    const summaryLog = logs.find(l => l.log_type === 'artifact' && l.metadata?.step_name === 'Summary');
    const filtersLog = logs.find(l => l.log_type === 'artifact' && l.metadata?.step_name === 'Filters');
    const kbChangeLog = logs.find(l => l.log_type === 'artifact' && l.metadata?.step_name === 'Knowledge Base Change');
    const impactLog = logs.find(l => l.log_type === 'artifact' && l.metadata?.step_name === 'Impact');
    const evidenceLog = logs.find(l => l.log_type === 'artifact' && l.metadata?.step_name === 'Evidence');
    const recommendationLog = logs.find(l => l.log_type === 'decision' && l.metadata?.step_name === 'Recommendation');

    const summary = summaryLog?.metadata?.data || {};
    const filters = filtersLog?.metadata?.data || {};
    const kbChange = kbChangeLog?.metadata?.data || {};
    const impact = impactLog?.metadata?.data || {};
    const evidence = evidenceLog?.metadata?.data || {};
    const reasoningSteps = recommendationLog?.metadata?.reasoning_steps || [];
    const recommendationMsg = recommendationLog?.message || '';

    const text = (insight.current_status_text || '').toLowerCase();
    let statusInfo;
    if (text.includes('approved')) statusInfo = { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    else if (text.includes('rejected')) statusInfo = { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle className="w-3.5 h-3.5" /> };
    else statusInfo = { label: 'Pending Approval', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Clock className="w-3.5 h-3.5" /> };

    const isPending = statusInfo.label === 'Pending Approval';

    function renderDataGrid(data) {
        if (!data || Object.keys(data).length === 0) return null;
        return (
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                {Object.entries(data).map(([k, v]) => (
                    <div key={k} className="flex justify-between py-1 border-b border-[#fafafa]">
                        <span className="text-[12px] text-[#8f8f8f]">{k}</span>
                        <span className="text-[12px] text-[#171717] font-[500] text-right max-w-[60%]">{v}</span>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="border border-[#e8e8e8] rounded-xl bg-white overflow-hidden transition-shadow hover:shadow-sm">
            <button onClick={() => setExpanded(!expanded)} className="w-full px-5 py-4 flex items-start justify-between text-left">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[11px] font-mono text-[#8f8f8f]">{insight.name}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-[500] border ${statusInfo.color}`}>
                            {statusInfo.icon}{statusInfo.label}
                        </span>
                    </div>
                    <h3 className="text-[14px] font-[550] text-[#171717] mb-1">{summary.insight_title || 'Pattern Detected'}</h3>
                    <p className={`text-[13px] text-[#8f8f8f] ${!expanded ? 'line-clamp-2' : ''}`}>{summary.Description || 'Pattern detected from historical screening data'}</p>
                </div>
                <div className="ml-3 mt-1 text-[#cacaca]">
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
            </button>

            {expanded && (
                <div className="border-t border-[#f0f0f0]">
                    {reasoningSteps.length > 0 && (
                        <div className="px-5 py-4 border-b border-[#f5f5f5]">
                            <div className="flex items-center gap-1.5 mb-3"><ListOrdered className="w-3.5 h-3.5 text-blue-500" /><span className="text-[12px] font-[600] text-[#171717] uppercase tracking-wide">Steps</span></div>
                            <div className="space-y-2">{reasoningSteps.map((step, i) => (<div key={i} className="flex gap-2"><span className="text-[11px] text-[#cacaca] mt-0.5 shrink-0">{i + 1}.</span><span className="text-[12px] text-[#525252] leading-relaxed">{step}</span></div>))}</div>
                        </div>
                    )}
                    {Object.keys(kbChange).length > 0 && (
                        <div className="px-5 py-4 border-b border-[#f5f5f5]">
                            <div className="flex items-center gap-1.5 mb-3"><Layers className="w-3.5 h-3.5 text-violet-500" /><span className="text-[12px] font-[600] text-[#171717] uppercase tracking-wide">Pattern</span></div>
                            {renderDataGrid(kbChange)}
                        </div>
                    )}
                    {Object.keys(filters).length > 0 && (
                        <div className="px-5 py-4 border-b border-[#f5f5f5]">
                            <div className="flex items-center gap-1.5 mb-3"><User className="w-3.5 h-3.5 text-cyan-500" /><span className="text-[12px] font-[600] text-[#171717] uppercase tracking-wide">Profile</span></div>
                            {renderDataGrid(filters)}
                        </div>
                    )}
                    {(Object.keys(evidence).length > 0 || Object.keys(impact).length > 0) && (
                        <div className="px-5 py-4 border-b border-[#f5f5f5]">
                            <div className="flex items-center gap-1.5 mb-3"><FileSearch className="w-3.5 h-3.5 text-amber-500" /><span className="text-[12px] font-[600] text-[#171717] uppercase tracking-wide">Evidence</span></div>
                            {renderDataGrid(evidence)}
                            {Object.keys(impact).length > 0 && Object.keys(evidence).length > 0 && (<div className="mt-3 pt-3 border-t border-[#fafafa]"><span className="text-[11px] font-[550] text-[#8f8f8f] uppercase tracking-wide mb-2 block">Impact</span>{renderDataGrid(impact)}</div>)}
                            {Object.keys(impact).length > 0 && Object.keys(evidence).length === 0 && renderDataGrid(impact)}
                        </div>
                    )}
                    {recommendationMsg && (
                        <div className="px-5 py-4 border-b border-[#f5f5f5] bg-[#fefdfb]">
                            <div className="flex items-center gap-1.5 mb-2"><Lightbulb className="w-3.5 h-3.5 text-amber-500" /><span className="text-[12px] font-[600] text-[#171717] uppercase tracking-wide">Recommendation</span></div>
                            <p className="text-[13px] text-[#353535] leading-relaxed">{recommendationMsg}</p>
                        </div>
                    )}
                    {isPending && (
                        <div className="px-5 py-4 bg-[#fafafa] flex items-center justify-between">
                            <p className="text-[12px] text-[#8f8f8f]">{copy.ctaLabel}</p>
                            <div className="flex gap-2">
                                <button onClick={(e) => { e.stopPropagation(); onAction(insight.id, 'reject'); }} disabled={actionInProgress === insight.id} className="px-4 py-1.5 rounded-lg border border-[#e8e8e8] text-[12px] font-[500] text-[#525252] hover:bg-white hover:border-[#d0d0d0] transition-colors disabled:opacity-50">Reject</button>
                                <button onClick={(e) => { e.stopPropagation(); onAction(insight.id, 'approve'); }} disabled={actionInProgress === insight.id} className="px-4 py-1.5 rounded-lg bg-[#171717] text-[12px] font-[500] text-white hover:bg-[#303030] transition-colors disabled:opacity-50">{actionInProgress === insight.id ? 'Processing...' : 'Approve & Update KB'}</button>
                            </div>
                        </div>
                    )}
                    {!isPending && (
                        <div className="px-5 py-3 bg-[#fafafa]">
                            <span className={`inline-flex items-center gap-1.5 text-[12px] font-[500] ${statusInfo.label === 'Approved' ? 'text-emerald-600' : 'text-red-600'}`}>
                                {statusInfo.icon}{statusInfo.label === 'Approved' ? copy.approvedFooter : copy.rejectedFooter}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function InsightsPanel() {
    const { currentOrg } = useOutletContext();
    const [insights, setInsights] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionInProgress, setActionInProgress] = useState(null);

    const INSIGHTS_PROCESS_ID = currentOrg?.id ? INSIGHTS_PROCESS_MAP[currentOrg.id] : null;
    const isBankingDemo = currentOrg?.id === '0649e502-b1ff-490f-8d31-cd8e4fb2d1ab';
    const isPwC = currentOrg?.id === 'd488c0b3-46ed-46ca-b516-83bdb20466de';

    const COPY = isPwC ? {
        approveLog: 'Insight approved by AP team. Pace knowledge base updated — pattern will be applied to future invoice processing with full audit trail.',
        rejectLog: 'Insight rejected by AP team. Current manual review process will be maintained for affected invoices.',
        approveStep1: (date) => `AP reviewer approved insight on ${date}`,
        approveStep2: 'Pace will apply this pattern to future invoice processing automatically',
        approveStep3: 'Every automated action will reference this insight in the audit trail',
        rejectStep1: (date) => `AP reviewer rejected insight on ${date}`,
        rejectStep2: 'Manual processing unchanged — all affected invoices require analyst review',
        rejectStep3: 'Pattern remains logged for future reconsideration',
        ctaLabel: 'Approve to let Pace apply this pattern to future invoice processing',
        approvedFooter: 'Knowledge base updated — Pace will apply this pattern automatically',
        rejectedFooter: 'Insight rejected — manual review maintained',
        subtitle: 'Patterns Pace discovered from historical invoice processing data. Review and approve to update the knowledge base.',
    } : {
        approveLog: 'Insight approved by compliance team. Pace knowledge base updated — matching alerts will be auto-cleared at L1 with documented reasoning.',
        rejectLog: 'Insight rejected by compliance team. Current manual review process will be maintained for all matching alerts.',
        approveStep1: (date) => `Compliance reviewer approved insight on ${date}`,
        approveStep2: 'Pace will now auto-clear alerts matching this pattern profile at L1',
        approveStep3: 'Every auto-clearance will reference this insight for audit purposes',
        rejectStep1: (date) => `Compliance reviewer rejected insight on ${date}`,
        rejectStep2: 'Manual review process unchanged — all alerts require analyst triage',
        rejectStep3: 'Pattern remains logged for future reconsideration',
        ctaLabel: 'Approve to let Pace auto-clear matching alerts at L1',
        approvedFooter: 'Knowledge base updated — Pace will auto-clear matching alerts',
        rejectedFooter: 'Insight rejected — manual review maintained',
        subtitle: 'Patterns Pace discovered from historical screening data. Review and approve to update the knowledge base.',
    };

    useEffect(() => {
        if (INSIGHTS_PROCESS_ID) loadInsights();
    }, [INSIGHTS_PROCESS_ID]);

    async function loadInsights() {
        setLoading(true);
        try {
            const { data: runs, error: runErr } = await supabase
                .from('activity_runs')
                .select('*')
                .eq('process_id', INSIGHTS_PROCESS_ID)
                .neq('status', 'void')
                .order('created_at', { ascending: false });
            if (runErr) throw runErr;

            const enriched = await Promise.all((runs || []).map(async (run) => {
                const { data: logs } = await supabase
                    .from('activity_logs')
                    .select('*')
                    .eq('run_id', run.id)
                    .order('step_number', { ascending: true })
                    .order('created_at', { ascending: true });
                return { ...run, logs: logs || [] };
            }));
            setInsights(enriched);
        } catch (err) {
            console.error('Failed to load insights:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleAction(insightId, action) {
        setActionInProgress(insightId);
        try {
            const statusText = action === 'approve' ? 'Approved — KB Updated' : 'Rejected — No Action';
            const logMessage = action === 'approve' ? COPY.approveLog : COPY.rejectLog;
            const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            await supabase.from('activity_logs').insert({
                run_id: insightId, step_number: 7, log_type: 'decision',
                message: logMessage,
                metadata: {
                    step_name: action === 'approve' ? 'Approved' : 'Rejected',
                    reasoning_steps: [
                        action === 'approve' ? COPY.approveStep1(dateStr) : COPY.rejectStep1(dateStr),
                        action === 'approve' ? COPY.approveStep2 : COPY.rejectStep2,
                        action === 'approve' ? COPY.approveStep3 : COPY.rejectStep3,
                    ]
                }
            });
            await supabase.from('activity_runs').update({ current_status_text: statusText, status: 'done' }).eq('id', insightId);
            await loadInsights();
        } catch (err) {
            console.error(`Failed to ${action} insight:`, err);
        } finally {
            setActionInProgress(null);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-pulse flex items-center gap-2 text-[#8f8f8f]">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm">Loading insights...</span>
                </div>
            </div>
        );
    }

    if (insights.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <div className="w-12 h-12 rounded-xl bg-[#fafafa] border border-[#f0f0f0] flex items-center justify-center mb-4">
                    <Lightbulb className="w-5 h-5 text-[#cacaca]" />
                </div>
                <h3 className="text-[14px] font-[550] text-[#171717] mb-1">No insights yet</h3>
                <p className="text-[13px] text-[#8f8f8f] max-w-sm">
                    {isBankingDemo
                        ? 'Pace will surface cross-process risk intelligence as it scans your portfolio. Run the insights engine to get started.'
                        : 'Pace will surface patterns as it processes more screening alerts. Insights appear here for your review.'}
                </p>
            </div>
        );
    }

    const subtitle = isBankingDemo
        ? 'Cross-process risk intelligence synthesised from Sanctions, KYC, Transaction Monitoring, Delinquency, and Covenant data.'
        : COPY.subtitle;

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-8">
                <div className="mb-8">
                    <div className="flex items-center gap-2.5 mb-1">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <h1 className="text-[18px] font-[600] text-[#171717]">Insights</h1>
                    </div>
                    <p className="text-[13px] text-[#8f8f8f] ml-[26px]">{subtitle}</p>
                </div>

                <div className="space-y-4">
                    {insights.map((insight) =>
                        isBankingDemo
                            ? <BankingInsightCard key={insight.id} run={insight} />
                            : <KBInsightCard key={insight.id} insight={insight} onAction={handleAction} actionInProgress={actionInProgress} copy={COPY} />
                    )}
                </div>
            </div>
        </div>
    );
}
