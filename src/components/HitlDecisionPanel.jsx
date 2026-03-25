import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const sbUrl = import.meta.env.VITE_SUPABASE_URL;
const sbServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzdmpjcG14bmRnYXVqeGx2aWt3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTkzNiwiZXhwIjoyMDg3NjA1OTM2fQ.81sjVPgI5QzYLlwz1YwbkCNxK-07Rki98px_JUhK6To';
const supabase = createClient(sbUrl, sbServiceKey);

/* helper: promisified delay */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/* ── Process-specific HITL decision configs ── */
const PROCESS_DECISIONS = {
    /* Dispute Resolution — Uber Eats */
    'd629444d-b53f-4779-9884-65e3169cf30a': [
        { id: 'approve_reverse', label: 'Approve — Reverse Adjustment', desc: 'Merchant wins, refund returned', style: 'primary' },
        { id: 'override_uphold', label: 'Override — Uphold Adjustment', desc: 'Customer keeps refund', style: 'secondary' },
        { id: 'escalate_tier2', label: 'Escalate to Tier 2', desc: 'Send to senior analyst', style: 'warning' },
        { id: 'more_investigation', label: 'Request More Investigation', desc: 'Need additional data', style: 'ghost' },
    ],
    /* TMS Ops — Uber Freight (default/legacy) */
    '65dbe6b4-122f-458c-b7ff-6f99c951c109': [
        { id: 'approve_workload', label: 'Use Workload', desc: 'Alcohol Cans', style: 'primary' },
        { id: 'approve_bluejay', label: 'Use BlueJay', desc: 'Group', style: 'primary' },
        { id: 'correct', label: 'Correct value', desc: 'Enter commodity', style: 'secondary' },
        { id: 'reject', label: 'Reject load', desc: 'Escalate', style: 'warning' },
    ],
    /* DXC — Prepaid Expense Booking (P2) */
    'c9846f46-ff57-4cc8-9f71-addf4185aeb5': [
        { id: 'proceed', label: 'Proceed', desc: 'Approve and post expense booking to GL', style: 'primary' },
        { id: 'edit', label: 'Edit', desc: 'Amend GL mapping or invoice details before posting', style: 'secondary' },
        { id: 'void', label: 'Void', desc: 'Reject invoice — mark as void, no GL entry created', style: 'warning' },
    ],
    /* Lilly — Batch Record Review */
    '6f037763-bd41-410e-ba46-a74dc65dde61': [
        { id: 'proceed', label: 'Approve', desc: 'Accept Pace recommendation — release or hold confirmed', style: 'primary' },
        { id: 'override', label: 'Override', desc: 'Reject Pace recommendation — manual disposition required', style: 'secondary' },
        { id: 'escalate', label: 'Escalate', desc: 'Send to QA Lead for senior review', style: 'warning' },
    ],
};

/* Fallback for any process not in the map */
const DEFAULT_DECISIONS = [
    { id: 'approve', label: 'Approve', desc: 'Accept recommendation', style: 'primary' },
    { id: 'reject', label: 'Reject', desc: 'Reject recommendation', style: 'secondary' },
    { id: 'escalate', label: 'Escalate', desc: 'Send for review', style: 'warning' },
];

/* ── Button style map ── */
const BUTTON_STYLES = {
    primary: {
        base: 'bg-[#171717] text-white hover:bg-[#333]',
        active: 'bg-gray-400 text-white cursor-wait',
    },
    secondary: {
        base: 'bg-white text-[#171717] border border-[#D1D5DB] hover:bg-[#F3F4F6]',
        active: 'bg-gray-200 text-gray-500 cursor-wait',
    },
    warning: {
        base: 'bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB] hover:bg-[#E5E7EB]',
        active: 'bg-gray-200 text-gray-500 cursor-wait',
    },
    ghost: {
        base: 'bg-transparent text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB] hover:text-[#374151]',
        active: 'bg-gray-100 text-gray-400 cursor-wait',
    },
};

/* ── Processing status labels shown while steps post ── */
const P2_STEP_LABELS = [
    'Recording decision…',
    'Generating amortization schedule…',
    'Posting journal entry to Cadency…',
    'Finalising month-end reporting…',
];

export default function HitlDecisionPanel({ run, logs, artifacts }) {
    const [submitting, setSubmitting] = useState(null);
    const [decided, setDecided] = useState(false);
    const [processingLabel, setProcessingLabel] = useState('');
    const name = 'Prabhu';

    const [error, setError] = useState(null);

    if (!run || (run.status !== 'needs_attention' && run.status !== 'needs_review')) return null;

    const alreadyDecided = logs?.some(l =>
        l.log_type === 'system' && l.metadata?.hitl_decision === true
    );
    if (alreadyDecided || decided) return null;

    /* Resolve decisions for this process */
    const decisions = PROCESS_DECISIONS[run.process_id] || DEFAULT_DECISIONS;

    const P2_PROCESS_ID = 'c9846f46-ff57-4cc8-9f71-addf4185aeb5';

    /* Helper: insert a log row */
    const insertLog = async (payload) => {
        const { error } = await supabase.from('activity_logs').insert(payload);
        if (error) throw new Error(error.message);
    };

    /* Helper: update run status */
    const updateRun = async (status, statusText) => {
        const { error } = await supabase.from('activity_runs')
            .update({ status, current_status_text: statusText })
            .eq('id', run.id);
        if (error) throw new Error(error.message);
    };

    /* Helper: find artifact ID by filename substring */
    const findArtifact = (substr) =>
        artifacts?.find(a => a.filename?.includes(substr));

    const submitDecision = async (decision) => {
        setError(null);
        setSubmitting(decision.id);
        const decLabel = `${decision.label} (${decision.desc})`;
        const baseStep = logs?.length || 0;

        try {
            const isP2 = run.process_id === P2_PROCESS_ID;

            if (isP2) {
                /* ── P2 DXC Prepaid: rich post-HITL steps with staged delays ── */
                const meta = logs?.find(l => l.step_number === 1)?.metadata || {};
                const usdAmt  = meta.invoice_value || 0;
                const months  = (meta.prepaid_year || 1) * 12;
                const monthly = months > 0 ? Math.round((usdAmt / months) * 100) / 100 : 0;
                const glCode  = meta.gl_code || '';
                const amort   = meta.amortization_schedule || `${months} equal monthly installments`;
                const jeRef   = `JE-2026-${Math.floor(10000 + Math.random() * 5000)}`;
                const vendor  = meta.vendor || run.name;

                if (decision.id === 'proceed') {

                    /* ── Step 14: Human Decision ── */
                    setProcessingLabel(P2_STEP_LABELS[0]);
                    await insertLog({
                        run_id: run.id, step_number: baseStep + 1, log_type: 'system',
                        message: 'Human decision: proceed',
                        metadata: {
                            step_name: 'Human Decision', hitl_decision: true,
                            decision: 'proceed',
                            decision_label: 'Proceed — Approve and post expense booking to GL',
                            decided_by: name.trim(),
                            reasoning_steps: [
                                `Reviewer ${name.trim()} selected: Proceed`,
                                'Amortization schedule generation authorised',
                            ],
                        },
                    });
                    await sleep(1800);

                    /* ── Step 15: Amortization schedule created ── */
                    setProcessingLabel(P2_STEP_LABELS[1]);
                    await insertLog({
                        run_id: run.id, step_number: baseStep + 2, log_type: 'system',
                        message: `Amortization schedule created — ${amort} over ${months} months`,
                        metadata: {
                            step_name: 'Amortization schedule created',
                            schedule: amort, total_months: months, method: 'Straight-line',
                            monthly_amount: monthly,
                            reasoning_steps: [
                                `Prepaid term: ${meta.prepaid_year || 1} year(s) — ${months} months`,
                                'Method: Straight-line (DXC policy ASC 350)',
                                `Schedule: ${amort}`,
                                `Monthly charge: USD ${monthly.toLocaleString()} from next period`,
                                'Schedule registered in Cadency amortization module',
                            ],
                        },
                    });

                    /* Artifact log: Amortization XLSX (step 15) */
                    const amortXlsx = findArtifact('.xlsx') && artifacts?.find(a => a.filename?.includes('Amortization') && a.filename?.endsWith('.xlsx'));
                    if (amortXlsx) {
                        await insertLog({
                            run_id: run.id, step_number: baseStep + 2, log_type: 'artifact',
                            message: 'Amortization Schedule exported to Excel',
                            metadata: {
                                artifact_name: amortXlsx.filename,
                                artifact_id: amortXlsx.id,
                                step_name: 'Amortization Excel',
                            },
                        });
                    }
                    await sleep(2000);

                    /* ── Step 16: Journal entry posted in Cadency ── */
                    setProcessingLabel(P2_STEP_LABELS[2]);
                    await insertLog({
                        run_id: run.id, step_number: baseStep + 3, log_type: 'system',
                        message: `Journal entry ${jeRef} posted in Cadency — GL ${glCode} updated`,
                        metadata: {
                            step_name: 'Journal entry posted in Cadency',
                            journal_entry_ref: jeRef, gl_code: glCode,
                            reasoning_steps: [
                                `Journal entry ${jeRef} posted to Cadency`,
                                `Debit confirmed: Prepaid Expenses (${glCode}) — USD ${usdAmt.toLocaleString()}`,
                                'Credit confirmed: Accounts Payable cleared',
                                'Posting timestamp: within accounting period Mar 2026',
                            ],
                        },
                    });

                    /* Artifact log: Cadency MJE XLSX (step 16) */
                    const cadencyXlsx = artifacts?.find(a => a.filename?.includes('Cadency') && a.filename?.endsWith('.xlsx'));
                    if (cadencyXlsx) {
                        await insertLog({
                            run_id: run.id, step_number: baseStep + 3, log_type: 'artifact',
                            message: 'Cadency MJE template exported',
                            metadata: {
                                artifact_name: cadencyXlsx.filename,
                                artifact_id: cadencyXlsx.id,
                                step_name: 'Cadency MJE Export',
                            },
                        });
                    }
                    await sleep(1800);

                    /* ── Step 17: Month-end reporting complete ── */
                    setProcessingLabel(P2_STEP_LABELS[3]);
                    await insertLog({
                        run_id: run.id, step_number: baseStep + 4, log_type: 'complete',
                        message: `Month-end reporting complete — ${jeRef} included in Mar 2026 close`,
                        metadata: {
                            step_name: 'Month-end journal entry reporting completed',
                            journal_entry_ref: jeRef, period: 'March 2026',
                            monthly_amort: monthly, current_status: 'Complete',
                            reasoning_steps: [
                                `Journal entry ${jeRef} included in March 2026 month-end close`,
                                `Recurring monthly amortization of USD ${monthly.toLocaleString()} scheduled`,
                                'Prepaid asset balance updated on balance sheet',
                                'Reporting complete — workflow closed',
                            ],
                        },
                    });
                    await sleep(800);

                    /* Update run to done */
                    await updateRun('done', `Month-end reporting complete — ${jeRef} posted in Cadency`);

                } else if (decision.id === 'void') {
                    setProcessingLabel('Voiding invoice…');
                    await insertLog({
                        run_id: run.id, step_number: baseStep + 1, log_type: 'complete',
                        message: `Journal entry voided — ${vendor} invoice rejected by reviewer`,
                        metadata: {
                            step_name: 'Voided — journal entry rejected',
                            hitl_decision: true, decision: 'void',
                            decided_by: name.trim(), current_status: 'Void',
                            reasoning_steps: [
                                `Reviewer ${name.trim()} selected: Void`,
                                'Journal entry rejected — no amortization schedule created',
                                'Invoice marked void in Cadency',
                                'Accounts Payable notified — invoice closed with void flag',
                            ],
                        },
                    });
                    await updateRun('void', `Voided by ${name.trim()} — no GL entry created`);

                } else {
                    /* Edit — return to in_progress */
                    setProcessingLabel('Returning for amendment…');
                    await insertLog({
                        run_id: run.id, step_number: baseStep + 1, log_type: 'system',
                        message: `Journal entry returned for amendment — ${vendor}`,
                        metadata: {
                            step_name: 'Returned for amendment',
                            hitl_decision: true, decision: 'edit',
                            decided_by: name.trim(),
                            reasoning_steps: [
                                `Reviewer ${name.trim()} selected: Edit`,
                                'Journal entry returned for amendment before posting',
                                'GL mapping or invoice details to be corrected',
                                'Workflow resumed — awaiting updated submission',
                            ],
                        },
                    });
                    await updateRun('in_progress', `Returned for amendment by ${name.trim()}`);
                }

            } else {
                /* ── Generic HITL for all other processes ── */
                await insertLog({
                    run_id: run.id, step_number: baseStep + 1, log_type: 'system',
                    message: `Human decision: ${decision.id}`,
                    metadata: {
                        step_name: 'Human Decision', hitl_decision: true,
                        decision: decision.id, decision_label: decLabel,
                        decided_by: name.trim(),
                    },
                });

                await insertLog({
                    run_id: run.id, step_number: baseStep + 2, log_type: 'decision',
                    message: `${decLabel} — approved by ${name.trim()}`,
                    metadata: {
                        step_name: 'Human Decision', decision: decision.id,
                        decision_label: decLabel, decided_by: name.trim(),
                        reasoning_steps: [
                            `Reviewer ${name.trim()} selected: ${decision.label}`,
                            `Action: ${decision.desc}`,
                        ],
                    },
                });

                const newStatus = decision.id === 'void' ? 'void'
                    : (decision.id === 'proceed' || decision.id === 'approve' || decision.id === 'approve_reverse') ? 'done'
                    : 'in_progress';
                await updateRun(newStatus, `Decision: ${decLabel} (by ${name.trim()})`);
            }

            setDecided(true);
        } catch (e) {
            console.error('HITL submit failed:', e);
            setError(e.message || 'Submit failed');
        } finally {
            setSubmitting(null);
            setProcessingLabel('');
        }
    };

    return (
        <div className="mt-4 pt-3 border-t border-dashed border-[#E5E7EB]">
            {error && (
                <div className="text-[11px] text-red-600 bg-red-50 rounded px-2 py-1 mb-2">
                    Error: {error}
                </div>
            )}

            {submitting && processingLabel && (
                <div className="flex items-center gap-1.5 mb-2">
                    <svg className="animate-spin h-3 w-3 text-[#6B7280]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <span className="text-[11px] text-[#6B7280]">{processingLabel}</span>
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                {decisions.map(d => {
                    const style = BUTTON_STYLES[d.style] || BUTTON_STYLES.primary;
                    const isActive = submitting === d.id;
                    const isDisabled = !!submitting && !isActive;
                    return (
                        <button
                            key={d.id}
                            disabled={!!submitting}
                            onClick={() => submitDecision(d)}
                            title={d.desc}
                            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all
                                ${isActive ? style.active : style.base}
                                ${isDisabled ? 'opacity-40' : ''}
                            `}
                        >
                            {isActive ? 'Processing…' : d.label}
                        </button>
                    );
                })}
            </div>

        </div>
    );
}
// Build trigger: 20260318T120000Z
