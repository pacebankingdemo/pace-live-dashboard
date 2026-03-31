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
    /* PwC — PO-Invoice Matching */
    '4f8a3d8d-a79f-40e0-914c-051bff68dd06': [
        { id: 'approve', label: 'Approve', desc: 'Accept invoice — post to GL at invoice amounts', style: 'primary' },
        { id: 'reject', label: 'Reject', desc: 'Reject invoice — generate vendor rejection email', style: 'secondary' },
        { id: 'ask_clarification', label: 'Ask for Clarification', desc: 'Request explanation from vendor — hold invoice', style: 'warning' },
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
    'duplicate_calibration': [
        { id: 'consolidate', label: 'Consolidate Orders', desc: 'Merge into single order of 27 vials (saves EUR 340)', style: 'primary' },
        { id: 'proceed_separate', label: 'Proceed Separately', desc: 'Independent order with business justification', style: 'secondary' },
        { id: 'cancel_duplicate', label: 'Cancel Duplicate', desc: 'Withdraw PR-2026-06142, existing order continues', style: 'warning' },
    ],
};

function resolveFerringScenario(run) {
    const name = (run?.name || '').toLowerCase();
    if (name.includes('non-avl') || name.includes('avl')) return 'non_avl';
    if (name.includes('calibration') && name.includes('duplicate')) return 'duplicate_calibration';
    if (name.includes('duplicate')) return 'duplicate';
    return null;
}

export default function HitlDecisionPanel({ run, logs, artifacts }) {
    const [submitting, setSubmitting] = useState(null);
    const [decided, setDecided] = useState(false);
    const [processingLabel, setProcessingLabel] = useState('');
    const [selected, setSelected] = useState(null);
    const name = 'Shubham';

    const [error, setError] = useState(null);

    if (!run || (run.status !== 'needs_attention' && run.status !== 'needs_review')) return null;

    const alreadyDecided = logs?.some(l =>
        l.metadata?.hitl_decision === true
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
    const PWC_PO_INVOICE_PROCESS_ID = '4f8a3d8d-a79f-40e0-914c-051bff68dd06';

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

                } else if (scenario === 'duplicate_calibration') {
                    if (decision.id === 'consolidate') {
                        /* --- S7 Calibration Standard: Consolidate (13-step lifecycle) --- */
                        setProcessingLabel('Recording consolidation decision…');
                        await insertLog({
                            run_id: run.id, step_number: 7, log_type: 'decision',
                            message: 'HITL - Consolidation confirmed. Desktop Agent merging PR-2026-06142 into PR-2026-06078 in SAP Ariba',
                            metadata: {
                                step_name: 'Desktop Agent - PR Merge (SAP Ariba)', hitl_decision: true,
                                decision: 'consolidate', decided_by: name.trim(),
                                decision_by: `Dr. Elena Kowalski (confirmed by ${name.trim()})`,
                                reasoning_steps: [
                                    `Dr. Kowalski confirmed: CONSOLIDATE - merge into single order of 27 vials`,
                                    'Launching Desktop Agent to execute PR merge in SAP Ariba',
                                    'Action 1: Open PR-2026-06078 -> Edit line item -> Update quantity from 15 to 27 vials',
                                    'Action 2: Update unit price to EUR 272/vial (volume discount applied - was EUR 285)',
                                    'Action 3: Recalculate line total: 27 x EUR 272 = EUR 7,344',
                                    "Action 4: Add comment: 'Consolidated with PR-2026-06142 per Dr. Kowalski (Bioassay Lab)'",
                                    "Action 5: Move PR-2026-06078 status from 'Open' to 'Approved'",
                                    "Action 6: Open PR-2026-06142 -> Change status to 'Cancelled'",
                                    'All SAP Ariba changes committed successfully',
                                    'PR-2026-06078: Approved | PR-2026-06142: Cancelled | Savings: EUR 340 (net)',
                                ],
                            },
                        });
                        await insertLog({
                            run_id: run.id, step_number: 7, log_type: 'artifact',
                            message: 'PR Merge Complete - Approved for PO Conversion',
                            metadata: {
                                step_name: 'PR Merge Summary', data: {
                                    'Merged PR': 'PR-2026-06078', 'PR Status': 'Approved',
                                    'Updated Quantity': '27 vials (was 15)',
                                    'Unit Price': 'EUR 272/vial (volume discount applied)',
                                    'New Total': 'EUR 7,344',
                                    'Cancelled PR': 'PR-2026-06142 - Status: Cancelled',
                                    'Volume Discount Saved': 'EUR 351', 'Shipping Saved': 'EUR 55',
                                    'Total Savings': 'EUR 340 (net)',
                                    'Next Step': 'PR Conversion to Purchase Order',
                                },
                            },
                        });
                        await sleep(2000);

                        /* Step 8: PO Generation */
                        setProcessingLabel('Generating Purchase Order in SAP Ariba…');
                        await insertLog({
                            run_id: run.id, step_number: 8, log_type: 'decision',
                            message: 'Desktop Agent converting approved PR-2026-06078 to Purchase Order PO-2026-11780 in SAP Ariba',
                            metadata: {
                                step_name: 'Desktop Agent - PO Generation (SAP Ariba)', reasoning_steps: [
                                    'Launching Desktop Agent to convert PR to PO in SAP Ariba',
                                    "Action 1: Open approved PR-2026-06078 -> Click 'Convert to Purchase Order'",
                                    'Action 2: Gate 2 Validation V11 - All required approvals obtained - PASS',
                                    'Action 3: Gate 2 Validation V12 - Supplier MilliporeSigma (V-10023) still active - PASS',
                                    'Action 4: Gate 2 Validation V13 - Contract FA-2025-0142 found, pricing EUR 272/vial - PASS',
                                    'Action 5: Gate 2 Validation V14 - Payment terms Net 30 match - PASS',
                                    'Action 6: Gate 2 Validation V15 - Tax code DK-VAT-25 assigned - PASS',
                                    'Action 7: All 5 Gate 2 validations passed - system generates PO-2026-11780',
                                    'Action 8: Verify PO line item: 27 vials x EUR 272 = EUR 7,344',
                                    'Action 9: Set delivery date 2026-04-28, ship-to Kastrup Warehouse',
                                    "Action 10: Submit PO -> PO-2026-11780 status set to 'Ordered'",
                                    "Action 11: Update PR-2026-06078 status to 'Converted to Purchase Order'",
                                    'PO-2026-11780 created successfully in SAP Ariba',
                                ],
                            },
                        });
                        await insertLog({
                            run_id: run.id, step_number: 8, log_type: 'artifact',
                            message: 'Purchase Order PO-2026-11780',
                            metadata: {
                                step_name: 'Purchase Order', data: {
                                    'PO Number': 'PO-2026-11780',
                                    'PR Reference': 'PR-2026-06078 (consolidated with PR-2026-06142)',
                                    'PR Status': 'Converted to Purchase Order',
                                    'Supplier': 'MilliporeSigma (V-10023)',
                                    'Material': 'EP Follitropin Alpha CRS (Calibration Standard)',
                                    'Quantity': '27 vials', 'Unit Price': 'EUR 272/vial (contract price)',
                                    'Total': 'EUR 7,344', 'Payment Terms': 'Net 30',
                                    'Delivery': '2026-04-28 to Kastrup, Denmark',
                                    'PO Status': 'Ordered',
                                },
                            },
                        });
                        await sleep(2000);

                        /* Step 9: PO Dispatch */
                        setProcessingLabel('Dispatching PO to supplier via SAP Ariba Network…');
                        await insertLog({
                            run_id: run.id, step_number: 9, log_type: 'decision',
                            message: 'Desktop Agent dispatching PO-2026-11780 to MilliporeSigma via SAP Ariba Network',
                            metadata: {
                                step_name: 'Desktop Agent - PO Dispatch (SAP Ariba)', reasoning_steps: [
                                    'Launching Desktop Agent to dispatch PO via Ariba Network',
                                    "Action 1: Open PO-2026-11780 -> Click 'Dispatch to Supplier'",
                                    'Action 2: Select delivery channel: SAP Ariba Network (MilliporeSigma is Ariba-enabled)',
                                    'Action 3: Attach PO document package: PO PDF, GxP transport requirements, CoA requirement notice',
                                    'Action 4: Confirm dispatch -> PO transmitted to MilliporeSigma',
                                    "Action 5: Update PO status to 'Dispatched - Awaiting Supplier Acknowledgment'",
                                    'PO dispatched successfully via Ariba Network',
                                    'Supplier acknowledgment expected within 2 business days',
                                ],
                            },
                        });
                        await sleep(2000);

                        /* Step 10: Goods Receipt + CoA Email */
                        setProcessingLabel('Processing goods receipt & CoA review…');
                        await insertLog({
                            run_id: run.id, step_number: 10, log_type: 'decision',
                            message: 'Goods received at Kastrup warehouse - 27 vials EP Follitropin Alpha CRS. CoA from MilliporeSigma forwarded to QA for review',
                            metadata: {
                                step_name: 'Goods Receipt & CoA QA Review Request', reasoning_steps: [
                                    'Delivery DN-MS-2026-6142 received at Kastrup Warehouse by Lars Henriksen',
                                    'Quantity check: 27 vials received vs 27 vials ordered - MATCH',
                                    'Visual inspection: Packaging intact, temperature indicator within range (2-8\u00b0C) - PASS',
                                    'Batch/Lot: LOT-FACRS-2026-0422 recorded',
                                    'Certificate of Analysis received from MilliporeSigma with shipment',
                                    'Per V20: GxP-Critical material - CoA must be QA-approved before GR can be posted',
                                    'Material placed in Quarantine status pending QA review',
                                    'Forwarding CoA to Dr. Henrik Madsen (QA Manager, Kastrup) for review',
                                ],
                            },
                        });
                        await insertLog({
                            run_id: run.id, step_number: 10, log_type: 'artifact',
                            message: 'Goods Receipt GR-2026-09210',
                            metadata: {
                                step_name: 'Goods Receipt', data: {
                                    'GR Number': 'GR-2026-09210', 'PO Reference': 'PO-2026-11780',
                                    'Supplier': 'MilliporeSigma', 'Batch/Lot': 'LOT-FACRS-2026-0422',
                                    'Ordered': '27 vials', 'Received': '27 vials',
                                    'Visual Inspection': 'PASS', 'Quantity Check': 'PASS',
                                    'CoA Received': 'Yes', 'Material Status': 'Quarantine - Pending QA Review',
                                },
                            },
                        });
                        await sleep(2000);

                        /* Step 11: CoA QA Approval */
                        setProcessingLabel('QA Manager reviewing Certificate of Analysis…');
                        await insertLog({
                            run_id: run.id, step_number: 11, log_type: 'decision',
                            message: 'QA Manager CoA approval received - Dr. Henrik Madsen has approved LOT-FACRS-2026-0422 for release. GR posted.',
                            metadata: {
                                step_name: 'CoA QA Approval Received', reasoning_steps: [
                                    'Incoming email detected from henrik.madsen@ferring.com (QA Manager, Kastrup)',
                                    'Subject: RE: COA REVIEW REQUIRED: PO-2026-11780 - EP Follitropin Alpha CRS',
                                    'Parsing email content for approval decision',
                                    "Email body: 'CoA reviewed and approved. All test results within specification. Batch LOT-FACRS-2026-0422 cleared for release.'",
                                    'Decision extracted: APPROVED',
                                    'CoA approval logged against PO-2026-11780 in SAP Ariba quality record',
                                    'Material status updated: Quarantine -> Released',
                                    'GR-2026-09210 posted in SAP Ariba - goods formally received',
                                ],
                            },
                        });
                        await sleep(2000);

                        /* Step 12: Invoice 3-Way Match */
                        setProcessingLabel('Executing 3-way match (PO \u2194 GR \u2194 Invoice)…');
                        await insertLog({
                            run_id: run.id, step_number: 12, log_type: 'decision',
                            message: 'Supplier invoice INV-MS-2026-3384 received - executing 3-way match (PO \u2194 GR \u2194 Invoice)',
                            metadata: {
                                step_name: 'Invoice 3-Way Match', reasoning_steps: [
                                    'Invoice INV-MS-2026-3384 received from MilliporeSigma via Ariba Network',
                                    'Invoice amount: EUR 7,344 for 27 vials at EUR 272/vial',
                                    'Executing 3-way match:',
                                    'Match 1 - Invoice \u2194 PO: Unit price EUR 272 matches PO - PASS (0% variance)',
                                    'Match 2 - Invoice \u2194 GR: Invoice qty 27 = GR qty 27 - PASS (0% variance)',
                                    'Match 3 - Invoice total \u2194 PO total: EUR 7,344 = EUR 7,344 - PASS (0% variance)',
                                    'All tolerances met - invoice auto-cleared for payment',
                                    'Payment due: 2026-05-29 (Net 30)',
                                ],
                            },
                        });
                        await insertLog({
                            run_id: run.id, step_number: 12, log_type: 'artifact',
                            message: '3-Way Match Result - Auto-Cleared',
                            metadata: {
                                step_name: 'Invoice Match Report', data: {
                                    'Invoice': 'INV-MS-2026-3384', 'PO Reference': 'PO-2026-11780',
                                    'GR Reference': 'GR-2026-09210', 'Supplier': 'MilliporeSigma',
                                    'Invoice Amount': 'EUR 7,344', 'PO Amount': 'EUR 7,344',
                                    'GR Quantity': '27 vials', 'Price Variance': '0%',
                                    'Quantity Variance': '0%', 'Match Result': 'PASS - All within tolerance',
                                    'Payment Status': 'Auto-cleared for payment',
                                    'Payment Due': '2026-05-29 (Net 30)',
                                },
                            },
                        });
                        await sleep(2000);

                        /* Step 13: PO Closure */
                        setProcessingLabel('Closing Purchase Order in SAP Ariba…');
                        await insertLog({
                            run_id: run.id, step_number: 13, log_type: 'decision',
                            message: 'Desktop Agent closing PO-2026-11780 in SAP Ariba - all line items received, invoiced, and matched',
                            metadata: {
                                step_name: 'Desktop Agent - PO Closure (SAP Ariba)', reasoning_steps: [
                                    'Launching Desktop Agent to close PO in SAP Ariba',
                                    'Action 1: Open PO-2026-11780 in SAP Ariba',
                                    'Action 2: Verify all line items: 27/27 vials received (GR-2026-09210)',
                                    'Action 3: Verify invoice match: INV-MS-2026-3384 matched and cleared',
                                    'Action 4: Verify CoA approved: LOT-FACRS-2026-0422 released by QA',
                                    "Action 5: Update PO status from 'Ordered' to 'Closed'",
                                    'Action 6: Close PO-2026-11780',
                                    'PO lifecycle complete',
                                ],
                            },
                        });
                        await insertLog({
                            run_id: run.id, step_number: 13, log_type: 'complete',
                            message: 'PR-to-PO lifecycle complete. Consolidated order of 27 vials delivered, QA-approved, invoiced, and cleared for payment. EUR 340 saved via consolidation.',
                            metadata: {
                                step_name: 'PO Closed - Lifecycle Complete', vendor_name: 'MilliporeSigma',
                                total: 'EUR 7,344', resolution: 'CONSOLIDATE',
                                reasoning_steps: [
                                    "PO-2026-11780 closed in SAP Ariba with status 'Closed'",
                                    'Full lifecycle summary:',
                                    '1. PR-2026-06142 (duplicate) detected and consolidated into PR-2026-06078',
                                    '2. QA Manager approved GxP-Critical procurement',
                                    '3. Desktop Agent merged PRs in SAP Ariba',
                                    '4. Desktop Agent converted approved PR to PO-2026-11780',
                                    '5. PO dispatched to MilliporeSigma via Ariba Network',
                                    '6. 27 vials received at Kastrup, CoA approved by QA, GR posted',
                                    '7. Invoice 3-way matched - auto-cleared',
                                    '8. Desktop Agent closed PO-2026-11780',
                                    'Payment due 2026-05-29 (Net 30)',
                                    'Total value: EUR 7,344 | Savings: EUR 340 from consolidation',
                                ],
                            },
                        });
                        await sleep(800);
                        await updateRun('done', 'PR-to-PO lifecycle complete - consolidated with EUR 340 savings');

                    } else if (decision.id === 'proceed_separate') {
                        /* --- S7 Calibration: Proceed separately --- */
                        setProcessingLabel('Processing as separate order…');
                        await insertLog({
                            run_id: run.id, step_number: 7, log_type: 'decision',
                            message: 'Dr. Kowalski selected PROCEED SEPARATELY - processing PR-2026-06142 as independent order',
                            metadata: {
                                step_name: 'Resolution - Proceed Separately', hitl_decision: true,
                                decision: 'proceed_separate', decided_by: name.trim(),
                                reasoning_steps: [
                                    `Dr. Kowalski confirmed: Bioassay Lab requires dedicated stock`,
                                    'Decision: PROCEED SEPARATELY - PR-2026-06142 continues as independent order',
                                    'Business justification: Bioassay Lab requires dedicated calibration standard vials for potency assay validation',
                                    'PR will be routed through standard approval chain',
                                ],
                            },
                        });
                        await insertLog({
                            run_id: run.id, step_number: 8, log_type: 'decision',
                            message: 'Desktop Agent updating SAP Ariba - approving PR-2026-06142 with justification',
                            metadata: {
                                step_name: 'Desktop Agent - SAP Ariba Update', reasoning_steps: [
                                    'Launching Desktop Agent to execute SAP Ariba changes',
                                    'Action 1: Open PR-2026-06142 -> Add business justification',
                                    'Action 2: Update duplicate flag -> Acknowledged (Justified)',
                                    'Action 3: Route PR-2026-06142 to approval workflow',
                                    'All SAP Ariba changes committed successfully',
                                ],
                            },
                        });
                        await insertLog({
                            run_id: run.id, step_number: 8, log_type: 'complete',
                            message: 'PR-2026-06142 approved as separate order with justification. Routed for PO creation in SAP Ariba.',
                            metadata: { step_name: 'Complete', vendor_name: 'MilliporeSigma', total: 'EUR 3,420', resolution: 'PROCEED SEPARATELY' },
                        });
                        await updateRun('done', `Separate order approved by ${name.trim()}`);

                    } else {
                        /* --- S7 Calibration: Cancel duplicate --- */
                        setProcessingLabel('Cancelling duplicate PR…');
                        await insertLog({
                            run_id: run.id, step_number: 7, log_type: 'decision',
                            message: 'Dr. Kowalski selected CANCEL - withdrawing PR-2026-06142 entirely',
                            metadata: {
                                step_name: 'Resolution - Cancel Duplicate', hitl_decision: true,
                                decision: 'cancel_duplicate', decided_by: name.trim(),
                                reasoning_steps: [
                                    'Dr. Kowalski confirmed: the existing order PR-2026-06078 covers the requirement',
                                    'Decision: CANCEL PR-2026-06142',
                                    'Dr. Reiner\'s order of 15 vials is sufficient for both labs',
                                ],
                            },
                        });
                        await insertLog({
                            run_id: run.id, step_number: 8, log_type: 'decision',
                            message: 'Desktop Agent updating SAP Ariba - cancelling PR-2026-06142',
                            metadata: {
                                step_name: 'Desktop Agent - SAP Ariba Update', reasoning_steps: [
                                    'Launching Desktop Agent to execute SAP Ariba changes',
                                    "Action 1: Open PR-2026-06142 -> Change status to Cancelled",
                                    "Action 2: Add comment: 'Cancelled by requestor - duplicate of PR-2026-06078'",
                                    'Action 3: Update duplicate flag -> Resolved (Cancelled)',
                                    'All SAP Ariba changes committed successfully',
                                ],
                            },
                        });
                        await insertLog({
                            run_id: run.id, step_number: 8, log_type: 'complete',
                            message: 'PR-2026-06142 cancelled in SAP Ariba. Duplicate order of EUR 3,420 prevented. Existing PR-2026-06078 continues as planned.',
                            metadata: { step_name: 'Complete', vendor_name: 'MilliporeSigma', total: 'EUR 0 (cancelled)', resolution: 'CANCEL' },
                        });
                        await updateRun('done', `Duplicate cancelled by ${name.trim()}`);
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

            } else if (run.process_id === PWC_PO_INVOICE_PROCESS_ID) {
                /* ── PwC PO-Invoice Matching: full post-HITL flows ── */
                const step1Meta = logs?.find(l => l.step_number === 1)?.metadata || {};
                const invoiceNum = step1Meta.invoice_number || '—';
                const vendorName = step1Meta.vendor_name || 'Vendor';
                const poNum = step1Meta.po_number || '—';
                const totalAmt = step1Meta.total_amount || '—';

                /* Helper: patch step 1 metadata with final match_verdict */
                const patchStep1Verdict = async (verdict) => {
                    const step1Log = logs?.find(l => l.step_number === 1);
                    if (!step1Log) return;
                    const updatedMeta = { ...step1Log.metadata, match_verdict: verdict };
                    await supabase.from('activity_logs')
                        .update({ metadata: updatedMeta })
                        .eq('id', step1Log.id);
                };

                /* ── Step N+1: Human Decision log ── */
                await insertLog({
                    run_id: run.id, step_number: baseStep + 1, log_type: 'system',
                    message: `Human decision: ${decision.id}`,
                    metadata: {
                        step_name: 'Human Decision', hitl_decision: true,
                        decision: decision.id, decided_by: name.trim(),
                        decision_label: decLabel,
                        reasoning_steps: [
                            `Reviewer ${name.trim()} selected: ${decision.label}`,
                            `Invoice ${invoiceNum} — ${decision.desc}`,
                        ],
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

                if (decision.id === 'approve') {
                    /* ── APPROVE: match confirmed + payment initiated ── */
                    setProcessingLabel('Confirming match…');
                    await insertLog({
                        run_id: run.id, step_number: baseStep + 3, log_type: 'system',
                        message: 'Match confirmed — invoice approved following manual review.',
                        metadata: {
                            step_name: 'Match Confirmed',
                            reasoning_steps: [
                                `Invoice ${invoiceNum} approved after human review`,
                                `Reviewer ${name.trim()} accepted all line items at invoice amounts`,
                                `Total ${totalAmt} confirmed for payment`,
                            ],
                        },
                    });
                    await new Promise(r => setTimeout(r, 800));
                    setProcessingLabel('Initiating payment…');
                    await insertLog({
                        run_id: run.id, step_number: baseStep + 4, log_type: 'complete',
                        message: `Payment initiated — invoice ${invoiceNum} approved for processing.`,
                        metadata: {
                            step_name: 'Payment Initiated',
                            reasoning_steps: [
                                `Invoice ${invoiceNum} from ${vendorName} approved for payment`,
                                `Payment amount: ${totalAmt}`,
                                `Approved by ${name.trim()} after manual review`,
                                'Invoice posted to GL at invoice amounts',
                                'Run complete — moving to Done',
                            ],
                        },
                    });
                    await patchStep1Verdict('Approved — Payment Initiated');
                    await updateRun('done', 'Approved — Payment Initiated');

                } else if (decision.id === 'reject') {
                    /* ── REJECT: generate rejection email artifact + close run ── */
                    setProcessingLabel('Generating rejection email…');

                    /* Build discrepancy list from HITL context in logs */
                    const hitlLog = logs?.find(l => l.metadata?.hitl_decision?.deviations || l.metadata?.hitl_decision?.type);
                    const hitlCtx = hitlLog?.metadata?.hitl_decision || {};
                    const deviations = hitlCtx.deviations || [];
                    const financialImpact = hitlCtx.total_financial_impact || '';

                    let discrepancyLines = '';
                    if (deviations.length > 0) {
                        discrepancyLines = deviations.map(d =>
                            `• Line ${d.line_no} (${d.sku}): ${d.description}\n  PO Price: ${d.po_price} | Invoice Price: ${d.invoice_price} | Deviation: +${d.deviation_pct}%`
                        ).join('\n');
                    } else {
                        /* Structural discrepancy — pull from context_summary */
                        discrepancyLines = hitlCtx.context_summary || 'Please refer to the discrepancies identified during matching.';
                    }

                    const emailSubject = `Invoice ${invoiceNum} — Rejected (Discrepancy Notification)`;
                    const emailBody = `Dear ${vendorName} Billing Team,

We are writing regarding Invoice ${invoiceNum} submitted against Purchase Order ${poNum}.

Following our three-way match review, this invoice has been REJECTED. The reason is as follows:

${discrepancyLines}
${financialImpact ? `\nTotal discrepancy: ${financialImpact}` : ''}

We are unable to process this invoice at the submitted amounts. Please either:
1. Resubmit a corrected invoice addressing the discrepancies above, or
2. Provide supporting documentation (e.g. delivery receipts, updated pricing agreements) justifying the differences.

Please reference PO ${poNum} and Invoice ${invoiceNum} in your response. We require a reply within 5 business days.

Regards,
Accounts Payable Team`;

                    await insertLog({
                        run_id: run.id, step_number: baseStep + 3, log_type: 'artifact',
                        message: `Rejection email sent to ${vendorName}.`,
                        metadata: {
                            step_name: 'Rejection Email — Sent',
                            email_draft: {
                                mode: 'sent',
                                pill_label: `Invoice ${invoiceNum} — Rejection Notice`,
                                from: 'ap-team@client.com',
                                to: `ap@${vendorName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
                                subject: emailSubject,
                                body: emailBody,
                            },
                            reasoning_steps: [
                                `Rejection email generated for invoice ${invoiceNum} from ${vendorName}`,
                                `References PO ${poNum} and all identified discrepancies`,
                                'Requesting vendor resubmit corrected invoice or provide justification',
                                'Email ready for reviewer to review and send',
                                'Run closing — moving to Done',
                            ],
                        },
                    });
                    await new Promise(r => setTimeout(r, 600));
                    setProcessingLabel('Closing run…');
                    await insertLog({
                        run_id: run.id, step_number: baseStep + 4, log_type: 'complete',
                        message: `Invoice ${invoiceNum} rejected — vendor notified, case closed.`,
                        metadata: {
                            step_name: 'Rejection Email Sent',
                            reasoning_steps: [
                                `Rejection notification prepared for ${vendorName} regarding invoice ${invoiceNum}`,
                                'Discrepancy details included in email for vendor reference',
                                'Invoice will not be posted — awaiting vendor resubmission',
                                'Run complete — moving to Done',
                            ],
                        },
                    });
                    await patchStep1Verdict('Rejected — Sent to Vendor');
                    await updateRun('done', 'Rejected Invoice — Explanation Sent to Vendor');

                } else if (decision.id === 'ask_clarification') {
                    /* ── CLARIFY: generate clarification email artifact + stay in progress ── */
                    setProcessingLabel('Generating clarification email…');

                    const hitlLog = logs?.find(l => l.metadata?.hitl_decision?.deviations || l.metadata?.hitl_decision?.type);
                    const hitlCtx = hitlLog?.metadata?.hitl_decision || {};
                    const deviations = hitlCtx.deviations || [];

                    let deviationLines = '';
                    if (deviations.length > 0) {
                        deviationLines = deviations.map(d =>
                            `• Line ${d.line_no} (${d.sku}): ${d.description}\n  PO Estimated Price: ${d.po_price} | Invoice Price: ${d.invoice_price} | Difference: +${d.deviation_pct}%`
                        ).join('\n');
                    } else {
                        deviationLines = hitlCtx.context_summary || 'Please refer to the discrepancies identified during matching.';
                    }

                    const clarSubject = `Invoice ${invoiceNum} — Pricing Clarification Request`;
                    const clarBody = `Dear ${vendorName} Billing Team,

We are reviewing Invoice ${invoiceNum} submitted against Purchase Order ${poNum}.

We noticed the following discrepancies compared to the Purchase Order:

${deviationLines}

Could you please help us understand the reason for these differences? For example:
- Were there changes in pricing since the PO was issued?
- Is there updated documentation we should have on file?
- Were there any scope or specification changes that affected the amounts?

We would appreciate a response at your earliest convenience so we can proceed with processing.

Please reference PO ${poNum} and Invoice ${invoiceNum} in your response.

Regards,
Accounts Payable Team`;

                    await insertLog({
                        run_id: run.id, step_number: baseStep + 3, log_type: 'artifact',
                        message: `Clarification email sent to ${vendorName}.`,
                        metadata: {
                            step_name: 'Clarification Email — Sent',
                            email_draft: {
                                mode: 'sent',
                                pill_label: `Invoice ${invoiceNum} — Clarification Request`,
                                from: 'ap-team@client.com',
                                to: `ap@${vendorName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
                                subject: clarSubject,
                                body: clarBody,
                            },
                            reasoning_steps: [
                                `Clarification email generated for invoice ${invoiceNum} from ${vendorName}`,
                                'Professional, non-confrontational tone — requesting explanation not accusation',
                                `References PO ${poNum} and all flagged discrepancies`,
                                'Email ready for reviewer to review and send',
                                'Run stays In Progress awaiting vendor response',
                            ],
                        },
                    });
                    await new Promise(r => setTimeout(r, 600));
                    await insertLog({
                        run_id: run.id, step_number: baseStep + 4, log_type: 'complete',
                        message: `Clarification request sent — awaiting ${vendorName} response.`,
                        metadata: {
                            step_name: 'Awaiting Vendor Clarification',
                            reasoning_steps: [
                                `Clarification request prepared for ${vendorName} regarding invoice ${invoiceNum}`,
                                'Invoice held — not posted, not rejected',
                                'Run stays In Progress until vendor responds',
                            ],
                        },
                    });
                    await patchStep1Verdict('Awaiting Clarification');
                    await updateRun('in_progress', 'Awaiting Vendor Clarification');
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
