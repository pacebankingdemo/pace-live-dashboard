import React, { useState, useEffect } from 'react';
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
    FileSearch
} from 'lucide-react';

const INSIGHTS_PROCESS_ID = '795b85bb-ef67-4e56-aaec-2a07d5ed8c90';

export default function InsightsPanel() {
    const [insights, setInsights] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedInsight, setExpandedInsight] = useState(null);
    const [actionInProgress, setActionInProgress] = useState(null);

    useEffect(() => {
        loadInsights();
    }, []);

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

    function parseInsight(insight) {
        const logs = insight.logs || [];
        const summaryLog = logs.find(l => l.log_type === 'artifact' && l.metadata?.step_name === 'Summary');
        const filtersLog = logs.find(l => l.log_type === 'artifact' && l.metadata?.step_name === 'Filters');
        const kbChangeLog = logs.find(l => l.log_type === 'artifact' && l.metadata?.step_name === 'Knowledge Base Change');
        const impactLog = logs.find(l => l.log_type === 'artifact' && l.metadata?.step_name === 'Impact');
        const evidenceLog = logs.find(l => l.log_type === 'artifact' && l.metadata?.step_name === 'Evidence');
        const recommendationLog = logs.find(l => l.log_type === 'decision' && l.metadata?.step_name === 'Recommendation');
        return { summaryLog, filtersLog, kbChangeLog, impactLog, evidenceLog, recommendationLog };
    }

    function getStatusInfo(insight) {
        const text = (insight.current_status_text || '').toLowerCase();
        if (text.includes('approved')) return { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
        if (text.includes('rejected')) return { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle className="w-3.5 h-3.5" /> };
        return { label: 'Pending Approval', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Clock className="w-3.5 h-3.5" /> };
    }

    async function handleAction(insightId, action) {
        setActionInProgress(insightId);
        try {
            const statusText = action === 'approve' ? 'Approved — KB Updated' : 'Rejected — No Action';
            const logMessage = action === 'approve'
                ? 'Insight approved by compliance team. Pace knowledge base updated — matching alerts will be auto-cleared at L1 with documented reasoning.'
                : 'Insight rejected by compliance team. Current manual review process will be maintained for all matching alerts.';
            await supabase.from('activity_logs').insert({
                run_id: insightId,
                step_number: 5,
                log_type: 'decision',
                message: logMessage,
                metadata: {
                    step_name: action === 'approve' ? 'Approved' : 'Rejected',
                    reasoning_steps: [
                        `Compliance reviewer ${action === 'approve' ? 'approved' : 'rejected'} insight on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
                        action === 'approve' ? 'Pace will now auto-clear alerts matching this pattern profile at L1' : 'Manual review process unchanged — all alerts require analyst triage',
                        action === 'approve' ? 'Every auto-clearance will reference this insight for audit purposes' : 'Pattern remains logged for future reconsideration'
                    ]
                }
            });
            await supabase.from('activity_runs').update({ current_status_text: statusText }).eq('id', insightId);
            await loadInsights();
        } catch (err) {
            console.error(`Failed to ${action} insight:`, err);
        } finally {
            setActionInProgress(null);
        }
    }

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
                <p className="text-[13px] text-[#8f8f8f] max-w-sm">Pace will surface patterns as it processes more screening alerts. Insights appear here for your review.</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-8">
                <div className="mb-8">
                    <div className="flex items-center gap-2.5 mb-1">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <h1 className="text-[18px] font-[600] text-[#171717]">Insights</h1>
                    </div>
                    <p className="text-[13px] text-[#8f8f8f] ml-[26px]">Patterns Pace discovered from historical screening data. Review and approve to update the knowledge base.</p>
                </div>

                <div className="space-y-4">
                    {insights.map((insight) => {
                        const parsed = parseInsight(insight);
                        const status = getStatusInfo(insight);
                        const isExpanded = expandedInsight === insight.id;
                        const summary = parsed.summaryLog?.metadata?.data || {};
                        const filters = parsed.filtersLog?.metadata?.data || {};
                        const kbChange = parsed.kbChangeLog?.metadata?.data || {};
                        const impact = parsed.impactLog?.metadata?.data || {};
                        const evidence = parsed.evidenceLog?.metadata?.data || {};
                        const reasoningSteps = parsed.recommendationLog?.metadata?.reasoning_steps || [];
                        const recommendationMsg = parsed.recommendationLog?.message || '';
                        const isPending = status.label === 'Pending Approval';

                        return (
                            <div key={insight.id} className="border border-[#e8e8e8] rounded-xl bg-white overflow-hidden transition-shadow hover:shadow-sm">
                                {/* Header */}
                                <button
                                    onClick={() => setExpandedInsight(isExpanded ? null : insight.id)}
                                    className="w-full px-5 py-4 flex items-start justify-between text-left"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="text-[11px] font-mono text-[#8f8f8f]">{insight.name}</span>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-[500] border ${status.color}`}>
                                                {status.icon}
                                                {status.label}
                                            </span>
                                        </div>
                                        <h3 className="text-[14px] font-[550] text-[#171717] mb-1">{summary.insight_title || 'Pattern Detected'}</h3>
                                        <p className={`text-[13px] text-[#8f8f8f] ${!isExpanded ? "line-clamp-2" : ""}`}>{summary.Description || 'Pattern detected from historical screening data'}</p>
                                    </div>
                                    <div className="ml-3 mt-1 text-[#cacaca]">
                                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="border-t border-[#f0f0f0]">
                                        {/* Section 1: Steps — reasoning from the insight process */}
                                        {reasoningSteps.length > 0 && (
                                            <div className="px-5 py-4 border-b border-[#f5f5f5]">
                                                <div className="flex items-center gap-1.5 mb-3">
                                                    <ListOrdered className="w-3.5 h-3.5 text-blue-500" />
                                                    <span className="text-[12px] font-[600] text-[#171717] uppercase tracking-wide">Steps</span>
                                                </div>
                                                <div className="space-y-2">
                                                    {reasoningSteps.map((step, i) => (
                                                        <div key={i} className="flex gap-2">
                                                            <span className="text-[11px] text-[#cacaca] mt-0.5 shrink-0">{i + 1}.</span>
                                                            <span className="text-[12px] text-[#525252] leading-relaxed">{step}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Section 2: Pattern — knowledge base change */}
                                        {Object.keys(kbChange).length > 0 && (
                                            <div className="px-5 py-4 border-b border-[#f5f5f5]">
                                                <div className="flex items-center gap-1.5 mb-3">
                                                    <Layers className="w-3.5 h-3.5 text-violet-500" />
                                                    <span className="text-[12px] font-[600] text-[#171717] uppercase tracking-wide">Pattern</span>
                                                </div>
                                                {renderDataGrid(kbChange)}
                                            </div>
                                        )}

                                        {/* Section 3: Profile — filters */}
                                        {Object.keys(filters).length > 0 && (
                                            <div className="px-5 py-4 border-b border-[#f5f5f5]">
                                                <div className="flex items-center gap-1.5 mb-3">
                                                    <User className="w-3.5 h-3.5 text-cyan-500" />
                                                    <span className="text-[12px] font-[600] text-[#171717] uppercase tracking-wide">Profile</span>
                                                </div>
                                                {renderDataGrid(filters)}
                                            </div>
                                        )}

                                        {/* Section 4: Evidence — evidence + impact */}
                                        {(Object.keys(evidence).length > 0 || Object.keys(impact).length > 0) && (
                                            <div className="px-5 py-4 border-b border-[#f5f5f5]">
                                                <div className="flex items-center gap-1.5 mb-3">
                                                    <FileSearch className="w-3.5 h-3.5 text-amber-500" />
                                                    <span className="text-[12px] font-[600] text-[#171717] uppercase tracking-wide">Evidence</span>
                                                </div>
                                                {renderDataGrid(evidence)}
                                                {Object.keys(impact).length > 0 && Object.keys(evidence).length > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-[#fafafa]">
                                                        <span className="text-[11px] font-[550] text-[#8f8f8f] uppercase tracking-wide mb-2 block">Impact</span>
                                                        {renderDataGrid(impact)}
                                                    </div>
                                                )}
                                                {Object.keys(impact).length > 0 && Object.keys(evidence).length === 0 && renderDataGrid(impact)}
                                            </div>
                                        )}

                                        {/* Section 5: Recommendation */}
                                        {recommendationMsg && (
                                            <div className="px-5 py-4 border-b border-[#f5f5f5] bg-[#fefdfb]">
                                                <div className="flex items-center gap-1.5 mb-2">
                                                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                                                    <span className="text-[12px] font-[600] text-[#171717] uppercase tracking-wide">Recommendation</span>
                                                </div>
                                                <p className="text-[13px] text-[#353535] leading-relaxed">{recommendationMsg}</p>
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        {isPending && (
                                            <div className="px-5 py-4 bg-[#fafafa] flex items-center justify-between">
                                                <p className="text-[12px] text-[#8f8f8f]">Approve to let Pace auto-clear matching alerts at L1</p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleAction(insight.id, 'reject'); }}
                                                        disabled={actionInProgress === insight.id}
                                                        className="px-4 py-1.5 rounded-lg border border-[#e8e8e8] text-[12px] font-[500] text-[#525252] hover:bg-white hover:border-[#d0d0d0] transition-colors disabled:opacity-50"
                                                    >
                                                        Reject
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleAction(insight.id, 'approve'); }}
                                                        disabled={actionInProgress === insight.id}
                                                        className="px-4 py-1.5 rounded-lg bg-[#171717] text-[12px] font-[500] text-white hover:bg-[#303030] transition-colors disabled:opacity-50"
                                                    >
                                                        {actionInProgress === insight.id ? 'Processing...' : 'Approve & Update KB'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {!isPending && (
                                            <div className="px-5 py-3 bg-[#fafafa]">
                                                <span className={`inline-flex items-center gap-1.5 text-[12px] font-[500] ${status.label === 'Approved' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {status.icon}
                                                    {status.label === 'Approved' ? 'Knowledge base updated — Pace will auto-clear matching alerts' : 'Insight rejected — manual review maintained'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
