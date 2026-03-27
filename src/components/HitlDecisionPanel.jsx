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
    /* Ferring Pharma — PR-to-PO Procurement (decisions vary by scenario) */
    '299fead3-7d7c-460f-af50-3546c8f9f6be': 'FERRING_DYNAMIC',
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


/* ── Ferring scenario-specific decisions ── */
const FERRING_SCENARIO_DECISIONS = {
    'non_avl': [
        { id: 'dual_path', label: 'Qualify + Source Alternate', desc: 'Initiate supplier qualification AND source from approved alternate now', style: 'primary' },
        { id: 'qualify_only', label: 'Initiate Qualification Only', desc: 'Wait for New Biotech qualification (25 business days)', style: 'secondary' },
        { id: 'cancel_pr', label: 'Cancel PR', desc: 'Cancel the purchase requisition entirely', style: 'warning' },
    ],
    'duplicate': [
        { id: 'consolidate', label: 'Consolidate Orders', desc: 'Merge with existing order for volume discount', style: 'primary' },
        { id: 'proceed_separate', label: 'Proceed Separately', desc: 'Keep as separate order — different lab budgets', style: 'secondary' },
        { id: 'cancel_duplicate', label: 'Cancel Duplicate', desc: 'Cancel the new PR, existing order is sufficient', style: 'warning' },
    ],
};

function resolveFerringScenario(run) {
    const name = (run?.name || '').toLowerCase();
    if (name.includes('non-avl') || name.includes('avl')) return 'non_avl';
    if (name.includes('duplicate')) return 'duplicate';
    return null;
}

export default function HitlDecisionPanel({ run, logs, artifacts }) {
    const [submitting, setSubmitting] = useState(null);
    const [decided, setDecided] = useState(false);
    const [processingLabel, setProcessingLabel] = useState('');
    const [selected, setSelected] = useState(null);
    const name = 'Prabhu';

    const [error, setError] = useState(null);

    if (!run || (run.status !== 'needs_attention' && run.status !== 'needs_review')) return null;

    const alreadyDecided = logs?.some(l =>
        l.log_type === 'system' && l.metadata?.hitl_decision === true
    );
    if (alreadyDecided || decided) return null;

    /* Resolve decisions for this process */
    let decisions;
    const rawDecisions = PROCESS_DECISIONS[run.process_id];
    if (rawDecisions === 'FERRING_DYNAMIC') {
        const scenario = resolveFerringScenario(run);
        decisions = (scenario && FERRING_SCENARIO_DECISIONS[scenario]) || DEFAULT_DECISIONS;
    } else {
        decisions = rawDecisions || DEFAULT_DECISIONS;
    }

    const P2_PROCESS_ID = 'c9846f46-ff57-4cc8-9f71-addf4185aeb5';
    const FERRING_PROCESS_ID = '299fead3-7d7c-460f-af50-3546c8f9f6be';

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
        setDecided(true);

        /* Yield to let React flush the re-render (hides panel immediately) */
        await new Promise(r => setTimeout(r, 0));

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

            } else if (run.process_id === FERRING_PROCESS_ID) {
                /* ── Ferring Pharma: scenario-aware post-HITL steps ── */
                const scenario = resolveFerringScenario(run);

                /* Find pre-uploaded artifact IDs from the hidden log */
                const hitlArtLog = logs?.find(l => l.metadata?.hitl_artifacts);
                const preArtifacts = hitlArtLog?.metadata?.hitl_artifacts || {};

                if (scenario === 'non_avl') {
                    if (decision.id === 'dual_path') {
                        /* --- Non-AVL: Dual-path (qualify + alternate) --- */
                        setProcessingLabel('Recording decision…');
                        await insertLog({
                            run_id: run.id, step_number: baseStep + 1, log_type: 'decision',
                            message: 'HITL Decision - Dual-path: qualify supplier + source alternate',
                            metadata: {
                                step_name: 'HITL Decision', hitl_decision: true,
                                decision: 'dual_path',
                                decision_label: 'Qualify + Source Alternate',
                                decided_by: name.trim(),
                                reasoning_steps: [
                                    `Reviewer ${name.trim()} selected: Qualify + Source Alternate`,
                                    'Initiate supplier qualification for New Biotech (25 business days)',
                                    'Simultaneously source from approved alternate for immediate need',
                                    'Rationale: Q2 production timeline cannot wait for qualification',
                                ],
                            },
                        });
                        await sleep(1800);

                        setProcessingLabel('Initiating supplier qualification…');
                        await insertLog({
                            run_id: run.id, step_number: baseStep + 2, log_type: 'system',
                            message: 'Supplier Qualification SQ-2026-0088 initiated for New Biotech Supplier Ltd. Questionnaire sent. Estimated: 25 business days.',
                            metadata: { step_name: 'Supplier Qualification', vendor_name: 'New Biotech Supplier Ltd' },
                        });
                        await sleep(1500);

                        setProcessingLabel('Sourcing alternate supplier…');
                        await insertLog({
                            run_id: run.id, step_number: baseStep + 3, log_type: 'decision',
                            message: 'Sourcing alternate AVL-approved supplier for Lipid Nanoparticle Excipient',
                            metadata: {
                                step_name: 'Alternate Supplier Sourcing', reasoning_steps: [
                                    'Searched AVL for LNP excipient suppliers - 2 approved vendors found',
                                    'Lonza Group (V-10005): AVL Approved, GMP certified, quote EUR 510/L = EUR 102,000 (+8.5%)',
                                    'Evonik (V-10007): AVL Approved, GMP certified, quote EUR 525/L = EUR 105,000 (+11.7%), 5-week lead',
                                    'Recommendation: Lonza Group - lower cost, 3-week lead time fits Q2',
                                ], recommendation: 'Lonza Group - V-10005',
                            },
                        });
                        await insertLog({
                            run_id: run.id, step_number: baseStep + 3, log_type: 'artifact',
                            message: 'Supplier Comparison',
                            metadata: {
                                step_name: 'Supplier Comparison', data: {
                                    'Original': 'New Biotech (NOT AVL) - EUR 94,000',
                                    'Alt 1 Lonza': 'EUR 102,000 (+8.5%), 3 weeks, AVL/GMP',
                                    'Alt 2 Evonik': 'EUR 105,000 (+11.7%), 5 weeks, AVL/GMP',
                                    'Recommendation': 'Lonza Group',
                                },
                            },
                        });
                        await sleep(1500);

                        setProcessingLabel('Routing through approval chain…');
                        await insertLog({
                            run_id: run.id, step_number: baseStep + 4, log_type: 'decision',
                            message: 'Revised PR routed through approval chain - all approved within 1.5 business days',
                            metadata: {
                                step_name: 'Approval Chain', reasoning_steps: [
                                    'Dept Manager (Dr. Heinrich Vogel) - APPROVED in 3 hours',
                                    'QA Manager (Dr. Sophie Laurent) - APPROVED in 4 hours (Lonza already AVL)',
                                    'Finance Controller (Anna Bergstrom) - APPROVED in 5 hours',
                                    'Total approval cycle: 1.5 business days',
                                ], decision: 'ALL APPROVED',
                            },
                        });
                        await sleep(1500);

                        setProcessingLabel('Generating Purchase Order…');
                        const poArtId = preArtifacts['PO-2026-11510.pdf'];
                        await insertLog({
                            run_id: run.id, step_number: baseStep + 5, log_type: 'artifact',
                            message: 'Purchase Order generated for Lonza Group',
                            metadata: {
                                step_name: 'Purchase Order',
                                ...(poArtId ? { artifact_id: poArtId, artifact_name: 'PO-2026-11510.pdf' } : {}),
                                data: {
                                    'PO Number': 'PO-2026-11510', 'Supplier': 'Lonza Group - V-10005',
                                    'Material': 'Lipid Nanoparticle Excipient', 'Quantity': '200 L',
                                    'Total Value': 'EUR 102,000', 'Payment Terms': 'Net 30', 'Delivery': '3 weeks',
                                },
                            },
                        });
                        await sleep(1200);

                        setProcessingLabel('Completing compliance summary…');
                        await insertLog({
                            run_id: run.id, step_number: baseStep + 6, log_type: 'complete',
                            message: 'GxP compliance enforced. Non-AVL purchase blocked, qualified alternate sourced. New Biotech qualification in progress (SQ-2026-0088). Production timeline maintained. Zero GMP violations.',
                            metadata: { step_name: 'Compliance Summary', vendor_name: 'Lonza Group', po_number: 'PO-2026-11510' },
                        });
                        await sleep(800);
                        await updateRun('done', 'Non-AVL Supplier Block - resolved via dual-path approach');

                    } else if (decision.id === 'qualify_only') {
                        setProcessingLabel('Initiating qualification…');
                        await insertLog({
                            run_id: run.id, step_number: baseStep + 1, log_type: 'decision',
                            message: 'Decision: Wait for supplier qualification only - no alternate sourcing',
                            metadata: {
                                step_name: 'HITL Decision', hitl_decision: true, decision: 'qualify_only',
                                decided_by: name.trim(),
                                reasoning_steps: [
                                    `Reviewer ${name.trim()} selected: Qualification Only`,
                                    'Supplier Qualification SQ-2026-0088 initiated (25 business days)',
                                    'PR-2026-04955 placed on HOLD pending qualification',
                                    'Production timeline may be impacted',
                                ],
                            },
                        });
                        await updateRun('needs_review', `Qualification initiated - awaiting SQ-2026-0088 (by ${name.trim()})`);

                    } else {
                        setProcessingLabel('Cancelling PR…');
                        await insertLog({
                            run_id: run.id, step_number: baseStep + 1, log_type: 'complete',
                            message: 'PR-2026-04955 cancelled by reviewer - non-AVL supplier, no alternate sourcing',
                            metadata: {
                                step_name: 'PR Cancelled', hitl_decision: true, decision: 'cancel_pr',
                                decided_by: name.trim(),
                                reasoning_steps: [
                                    `Reviewer ${name.trim()} selected: Cancel PR`,
                                    'PR-2026-04955 cancelled - no further action',
                                ],
                            },
                        });
                        await updateRun('done', `PR cancelled by ${name.trim()}`);
                    }

                } else if (scenario === 'duplicate') {
                    if (decision.id === 'consolidate') {
                        /* --- Duplicate: Consolidate orders --- */
                        setProcessingLabel('Recording consolidation decision…');
                        await insertLog({
                            run_id: run.id, step_number: baseStep + 1, log_type: 'decision',
                            message: 'HITL - Consolidation confirmed: merge PR-2026-05389 into PR-2026-05301',
                            metadata: {
                                step_name: 'HITL - Consolidation Decision', hitl_decision: true,
                                decision: 'consolidate', decided_by: name.trim(),
                                reasoning_steps: [
                                    `Reviewer ${name.trim()} confirmed: CONSOLIDATE orders`,
                                    'Both labs need the reference standard, can share shipment',
                                    'Decision: Merge into single order - 18 vials',
                                ],
                            },
                        });
                        await sleep(1500);

                        setProcessingLabel('Amending order with volume discount…');
                        await insertLog({
                            run_id: run.id, step_number: baseStep + 2, log_type: 'decision',
                            message: 'PR amended, volume discount applied',
                            metadata: {
                                step_name: 'Order Amendment', reasoning_steps: [
                                    'PR-2026-05389 cancelled (duplicate)',
                                    'PR-2026-05301 amended: 10 -> 18 vials',
                                    'Volume discount: EUR 310/vial (from EUR 320) - saves EUR 180',
                                    'Single shipment saves EUR 45 in shipping',
                                    'Total savings: EUR 225',
                                ],
                            },
                        });
                        await insertLog({
                            run_id: run.id, step_number: baseStep + 2, log_type: 'artifact',
                            message: 'Amended Order',
                            metadata: {
                                step_name: 'Amended Order Details', data: {
                                    'Cancelled': 'PR-2026-05389', 'Amended': 'PR-2026-05301',
                                    'New Qty': '18 vials', 'Unit Price': 'EUR 310 (volume discount)',
                                    'New Total': 'EUR 5,580', 'Discount Saved': 'EUR 180',
                                    'Shipping Saved': 'EUR 45', 'Total Savings': 'EUR 225',
                                },
                            },
                        });
                        await sleep(1500);

                        setProcessingLabel('Processing receipt & cost allocation…');
                        await insertLog({
                            run_id: run.id, step_number: baseStep + 3, log_type: 'system',
                            message: '18 vials received March 28. Cost split: 10 vials (EUR 3,100) to Analytical Dev CC-4200-AD, 8 vials (EUR 2,480) to QC Lab CC-4300-QC.',
                            metadata: { step_name: 'Receipt & Cost Allocation', vendor_name: 'Sigma-Aldrich' },
                        });
                        await sleep(1500);

                        setProcessingLabel('Matching invoice & closing…');
                        const invArtId = preArtifacts['INV-SA-2026-8002.pdf'];
                        await insertLog({
                            run_id: run.id, step_number: baseStep + 4, log_type: 'complete',
                            message: 'Invoice EUR 5,580 matched and auto-cleared. Duplicate detection saved EUR 225. Resolution: 2 business days.',
                            metadata: {
                                step_name: 'Payment & Close', invoice_number: 'INV-SA-2026-8002',
                                match_verdict: 'AUTO-CLEARED', total: 'EUR 5,580', vendor_name: 'Sigma-Aldrich',
                                ...(invArtId ? { artifact_id: invArtId, artifact_name: 'INV-SA-2026-8002.pdf' } : {}),
                            },
                        });
                        await sleep(800);
                        await updateRun('done', 'Duplicate PR resolved - consolidated with EUR 225 savings');

                    } else if (decision.id === 'proceed_separate') {
                        setProcessingLabel('Processing as separate order…');
                        await insertLog({
                            run_id: run.id, step_number: baseStep + 1, log_type: 'decision',
                            message: 'Decision: Proceed with separate orders - different lab budgets',
                            metadata: {
                                step_name: 'HITL Decision', hitl_decision: true, decision: 'proceed_separate',
                                decided_by: name.trim(),
                                reasoning_steps: [
                                    `Reviewer ${name.trim()} selected: Proceed Separately`,
                                    'PR-2026-05389 released from hold - proceeding as separate order',
                                    'Duplicate flag acknowledged but separate budget allocation needed',
                                ],
                            },
                        });
                        await updateRun('in_progress', `Proceeding as separate order (by ${name.trim()})`);

                    } else {
                        setProcessingLabel('Cancelling duplicate…');
                        await insertLog({
                            run_id: run.id, step_number: baseStep + 1, log_type: 'complete',
                            message: 'PR-2026-05389 cancelled - existing order PR-2026-05301 is sufficient',
                            metadata: {
                                step_name: 'Duplicate Cancelled', hitl_decision: true, decision: 'cancel_duplicate',
                                decided_by: name.trim(),
                                reasoning_steps: [
                                    `Reviewer ${name.trim()} selected: Cancel Duplicate`,
                                    'PR-2026-05389 cancelled - existing order covers requirement',
                                ],
                            },
                        });
                        await updateRun('done', `Duplicate cancelled by ${name.trim()}`);
                    }
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

        } catch (e) {
            console.error('HITL submit failed:', e);
            setDecided(false);
            setError(e.message || 'Submit failed');
        } finally {
            setSubmitting(null);
            setProcessingLabel('');
        }
    };

    /* Once submitting, show ONLY the spinner — no radio buttons, no Confirm */
    if (submitting) {
        return (
            <div className="mt-4 pt-3 border-t border-dashed border-[#E5E7EB]">
                {processingLabel && (
                    <div className="flex items-center gap-1.5">
                        <svg className="animate-spin h-3 w-3 text-[#6B7280]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        <span className="text-[11px] text-[#6B7280]">{processingLabel}</span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="mt-4 pt-3 border-t border-dashed border-[#E5E7EB]">
            {error && (
                <div className="text-[11px] text-red-600 bg-red-50 rounded px-2 py-1 mb-2">
                    Error: {error}
                </div>
            )}

            <div className="flex flex-col gap-3">
                {decisions.map(d => (
                    <label
                        key={d.id}
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={() => setSelected(d)}
                    >
                        <span className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0
                            ${selected?.id === d.id ? 'border-[#6B7280]' : 'border-[#D1D5DB]'}
                        `}>
                            {selected?.id === d.id && (
                                <span className="w-[8px] h-[8px] rounded-full bg-[#6B7280]" />
                            )}
                        </span>
                        <span className="text-[13px] text-[#374151]">{d.label}</span>
                    </label>
                ))}
            </div>

            <button
                disabled={!selected}
                onClick={() => selected && submitDecision(selected)}
                className={`mt-4 px-5 py-2 rounded-md text-[13px] font-medium transition-all
                    ${!selected
                        ? 'bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'
                        : 'bg-[#171717] text-white hover:bg-[#333]'}
                `}
            >
                Confirm
            </button>

        </div>
    );
}
// Build trigger: 20260318T120000Z
