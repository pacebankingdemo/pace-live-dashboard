import React, { useState, useMemo } from 'react';
import { Check, X, Pencil, AlertTriangle, ArrowUpRight, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';

export default function HitlDecisionPanel({ run, logs }) {
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showCorrection, setShowCorrection] = useState(false);
    const [correctionValue, setCorrectionValue] = useState('');
    const [submittedLabel, setSubmittedLabel] = useState('');

    // Extract mismatch data from artifact logs
    const mismatchData = useMemo(() => {
        if (!logs?.length) return null;
        const artifactLog = logs.find(l =>
            l.log_type === 'artifact' &&
            l.metadata?.data?.['BlueJay Commodity']
        );
        return artifactLog?.metadata?.data || null;
    }, [logs]);

    // Check if already decided
    const alreadyDecided = useMemo(() => {
        if (!logs?.length) return null;
        return logs.find(l => l.log_type === 'hitl_response');
    }, [logs]);

    if (!run || run.status !== 'needs_attention') return null;
    if (!mismatchData && !alreadyDecided) return null;

    if (alreadyDecided || submitted) {
        return (
            <div className="mx-6 mb-4 p-4 bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg">
                <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#038408]" />
                    <span className="text-sm font-medium text-[#038408]">
                        Decision submitted
                    </span>
                </div>
                <p className="text-xs text-[#666] mt-1">
                    {submittedLabel || alreadyDecided?.message || 'Pace is resuming the workflow...'}
                </p>
            </div>
        );
    }

    async function submitDecision(decision, label) {
        setSubmitting(true);
        try {
            await supabase.from('activity_logs').insert({
                run_id: run.id,
                step_number: 5,
                log_type: 'hitl_response',
                message: label,
                metadata: {
                    step_name: 'Human Decision',
                    decision,
                    decided_by: 'Account Manager',
                    decided_at: new Date().toISOString()
                }
            });
            await supabase.from('activity_runs')
                .update({
                    status: 'running',
                    current_status_text: `Human approved: ${label}. Pace resuming workflow...`
                })
                .eq('id', run.id);
            setSubmittedLabel(label);
            setSubmitted(true);
        } catch (e) {
            console.error('HITL submit error:', e);
            alert('Failed to submit decision. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    function handleCorrection() {
        const val = correctionValue.trim();
        if (!val) return;
        submitDecision(`correct:${val}`, `Correct commodity to "${val}"`);
    }

    const bjVal = mismatchData?.['BlueJay Commodity'] || '—';
    const wlVal = mismatchData?.['Workload Commodity'] || '—';

    return (
        <div className="mx-6 mb-4">
            {/* Alert banner */}
            <div className="p-4 bg-[#fffbeb] border border-[#fde68a] rounded-lg mb-3">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-[#d97706] mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#92400e]">
                            Data discrepancy — human review required
                        </p>
                        <p className="text-xs text-[#a16207] mt-1">
                            Commodity mismatch between BlueJay TMS (<strong>{bjVal}</strong>) and
                            Workload Board (<strong>{wlVal}</strong>).
                            Per SOP, this requires Account Manager approval.
                        </p>
                    </div>
                </div>
            </div>

            {/* Decision buttons */}
            {!showCorrection ? (
                <div className="grid grid-cols-2 gap-2">
                    <button
                        disabled={submitting}
                        onClick={() => submitDecision('approve_workload', `Approve as "${wlVal}" (Workload)`)}
                        className="flex items-center gap-2 px-3 py-2.5 text-left rounded-lg border border-[#d1fae5] bg-[#f0fdf4] hover:bg-[#dcfce7] hover:border-[#86efac] transition-colors disabled:opacity-50"
                    >
                        <Check className="w-4 h-4 text-[#038408] flex-shrink-0" />
                        <div className="min-w-0">
                            <div className="text-xs font-medium text-[#171717] truncate">Use Workload value</div>
                            <div className="text-[11px] text-[#666] truncate">{wlVal}</div>
                        </div>
                    </button>

                    <button
                        disabled={submitting}
                        onClick={() => submitDecision('approve_bluejay', `Approve as "${bjVal}" (BlueJay)`)}
                        className="flex items-center gap-2 px-3 py-2.5 text-left rounded-lg border border-[#d1fae5] bg-[#f0fdf4] hover:bg-[#dcfce7] hover:border-[#86efac] transition-colors disabled:opacity-50"
                    >
                        <Check className="w-4 h-4 text-[#038408] flex-shrink-0" />
                        <div className="min-w-0">
                            <div className="text-xs font-medium text-[#171717] truncate">Use BlueJay value</div>
                            <div className="text-[11px] text-[#666] truncate">{bjVal}</div>
                        </div>
                    </button>

                    <button
                        disabled={submitting}
                        onClick={() => setShowCorrection(true)}
                        className="flex items-center gap-2 px-3 py-2.5 text-left rounded-lg border border-[#e0e7ff] bg-[#eef2ff] hover:bg-[#e0e7ff] hover:border-[#a5b4fc] transition-colors disabled:opacity-50"
                    >
                        <Pencil className="w-4 h-4 text-[#4338ca] flex-shrink-0" />
                        <div className="min-w-0">
                            <div className="text-xs font-medium text-[#171717]">Correct value</div>
                            <div className="text-[11px] text-[#666]">Enter the right commodity</div>
                        </div>
                    </button>

                    <button
                        disabled={submitting}
                        onClick={() => submitDecision('reject', 'Reject and escalate further')}
                        className="flex items-center gap-2 px-3 py-2.5 text-left rounded-lg border border-[#fecaca] bg-[#fef2f2] hover:bg-[#fee2e2] hover:border-[#fca5a5] transition-colors disabled:opacity-50"
                    >
                        <X className="w-4 h-4 text-[#A40000] flex-shrink-0" />
                        <div className="min-w-0">
                            <div className="text-xs font-medium text-[#171717]">Reject & escalate</div>
                            <div className="text-[11px] text-[#666]">Do not award this load</div>
                        </div>
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={correctionValue}
                        onChange={e => setCorrectionValue(e.target.value)}
                        placeholder="Enter correct commodity..."
                        autoFocus
                        className="flex-1 px-3 py-2 text-sm border border-[#e0e7ff] rounded-lg bg-white text-[#171717] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]"
                        onKeyDown={e => e.key === 'Enter' && handleCorrection()}
                    />
                    <button
                        onClick={handleCorrection}
                        disabled={!correctionValue.trim() || submitting}
                        className="px-3 py-2 text-xs font-medium bg-[#4338ca] text-white rounded-lg hover:bg-[#3730a3] disabled:opacity-50 transition-colors"
                    >
                        {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Submit'}
                    </button>
                    <button
                        onClick={() => { setShowCorrection(false); setCorrectionValue(''); }}
                        className="px-3 py-2 text-xs text-[#666] border border-[#f0f0f0] rounded-lg hover:bg-[#f9fafb] transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            )}

            {submitting && (
                <div className="flex items-center gap-2 mt-2">
                    <Loader2 className="w-3 h-3 animate-spin text-[#6366f1]" />
                    <span className="text-xs text-[#666]">Submitting decision...</span>
                </div>
            )}
        </div>
    );
}
