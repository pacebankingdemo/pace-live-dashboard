import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const sbUrl = import.meta.env.VITE_SUPABASE_URL;
const sbServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzdmpjcG14bmRnYXVqeGx2aWt3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTkzNiwiZXhwIjoyMDg3NjA1OTM2fQ.81sjVPgI5QzYLlwz1YwbkCNxK-07Rki98px_JUhK6To';
const supabase = createClient(sbUrl, sbServiceKey);

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

export default function HitlDecisionPanel({ run, logs }) {
    const [submitting, setSubmitting] = useState(null);
    const [decided, setDecided] = useState(false);
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

    const submitDecision = async (decision) => {
        setError(null);
        setSubmitting(decision.id);
        const decLabel = `${decision.label} (${decision.desc})`;
        const baseStep = logs?.length || 0;

        try {
            const isP2 = run.process_id === P2_PROCESS_ID;

            if (isP2) {
                /* ── P2 DXC Prepaid: rich post-HITL steps ── */
                const meta = logs?.find(l => l.step_number === 1)?.metadata || {};
                const usdAmt   = meta.invoice_value || 0;
                const months   = (meta.prepaid_year || 1) * 12;
                const monthly  = months > 0 ? Math.round((usdAmt / months) * 100) / 100 : 0;
                const catchup  = Math.round(monthly * 0.5 * 100) / 100;
                const glCode   = meta.gl_code || '';
                const amort    = meta.amortization_schedule || `${months} equal monthly installments`;
                const jeRef    = `JE-2026-${Math.floor(10000 + Math.random() * 5000)}`;
                const vendor   = meta.vendor || run.name;

                if (decision.id === 'proceed') {
                    /* Step 14 — Human Decision */
                    const { error: e1 } = await supabase.from('activity_logs').insert({
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
                    if (e1) throw new Error(e1.message);

                    /* Step 15 — Amortization schedule created */
                    const { error: e2 } = await supabase.from('activity_logs').insert({
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
                    if (e2) throw new Error(e2.message);

                    /* Step 16 — Journal entry posted in Cadency */
                    const { error: e3 } = await supabase.from('activity_logs').insert({
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
                    if (e3) throw new Error(e3.message);

                    /* Step 17 — Month-end reporting */
                    const { error: e4 } = await supabase.from('activity_logs').insert({
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
                    if (e4) throw new Error(e4.message);

                    /* Update run to done */
                    const { error: e5 } = await supabase.from('activity_runs')
                        .update({ status: 'done', current_status_text: `Month-end reporting complete — ${jeRef} posted in Cadency` })
                        .eq('id', run.id);
                    if (e5) throw new Error(e5.message);

                } else if (decision.id === 'void') {
                    /* Step 14 — Voided */
                    const { error: e1 } = await supabase.from('activity_logs').insert({
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
                    if (e1) throw new Error(e1.message);
                    const { error: e2 } = await supabase.from('activity_runs')
                        .update({ status: 'void', current_status_text: `Voided by ${name.trim()} — no GL entry created` })
                        .eq('id', run.id);
                    if (e2) throw new Error(e2.message);

                } else {
                    /* Edit — return to in_progress */
                    const { error: e1 } = await supabase.from('activity_logs').insert({
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
                    if (e1) throw new Error(e1.message);
                    const { error: e2 } = await supabase.from('activity_runs')
                        .update({ status: 'in_progress', current_status_text: `Returned for amendment by ${name.trim()}` })
                        .eq('id', run.id);
                    if (e2) throw new Error(e2.message);
                }

            } else {
                /* ── Generic HITL for all other processes ── */
                const { error: e1 } = await supabase.from('activity_logs').insert({
                    run_id: run.id, step_number: baseStep + 1, log_type: 'system',
                    message: `Human decision: ${decision.id}`,
                    metadata: {
                        step_name: 'Human Decision', hitl_decision: true,
                        decision: decision.id, decision_label: decLabel,
                        decided_by: name.trim(),
                    },
                });
                if (e1) throw new Error(e1.message);

                const { error: e2 } = await supabase.from('activity_logs').insert({
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
                if (e2) throw new Error(e2.message);

                const newStatus = decision.id === 'void' ? 'void'
                    : decision.id === 'proceed' ? 'done' : 'in_progress';
                const { error: e3 } = await supabase.from('activity_runs')
                    .update({ status: newStatus, current_status_text: `Decision: ${decLabel} (by ${name.trim()})` })
                    .eq('id', run.id);
                if (e3) throw new Error(e3.message);
            }

            setDecided(true);
        } catch (e) {
            console.error('HITL submit failed:', e);
            setError(e.message || 'Submit failed');
        } finally {
            setSubmitting(null);
        }
    };

    return (
        <div className="mt-4 pt-3 border-t border-dashed border-[#E5E7EB]">
            {error && (
                <div className="text-[11px] text-red-600 bg-red-50 rounded px-2 py-1 mb-2">
                    Error: {error}
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
                            {isActive ? 'Submitting...' : d.label}
                        </button>
                    );
                })}
            </div>

        </div>
    );
}
// Build trigger: 20260310T182500Z
