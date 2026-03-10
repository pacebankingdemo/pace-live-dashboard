import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
);

const DECISIONS = [
    { id: 'approve_workload', label: 'Use Workload' },
    { id: 'approve_bluejay', label: 'Use BlueJay' },
    { id: 'correct', label: 'Correct value' },
    { id: 'reject', label: 'Reject load' },
];

export default function HitlDecisionPanel({ run, logs }) {
    const [submitting, setSubmitting] = useState(null);
    const [decided, setDecided] = useState(false);

    if (!run || run.status !== 'needs_attention') return null;

    // Check if already decided
    const alreadyDecided = logs?.some(l => l.log_type === 'hitl_response');
    if (alreadyDecided || decided) return null;

    const submitDecision = async (decision) => {
        setSubmitting(decision);
        try {
            await supabase.from('activity_logs').insert({
                run_id: run.id,
                step_number: 5,
                log_type: 'hitl_response',
                message: `Human decision: ${decision}`,
                metadata: { step_name: 'Human Decision', decision },
            });
            await supabase
                .from('activity_runs')
                .update({ status: 'running', current_status_text: `Applying decision: ${decision}` })
                .eq('id', run.id);
            setDecided(true);
        } catch (e) {
            console.error('HITL submit failed:', e);
        } finally {
            setSubmitting(null);
        }
    };

    return (
        <div className="flex flex-wrap gap-2 mt-2.5">
            {DECISIONS.map(d => (
                <button
                    key={d.id}
                    disabled={!!submitting}
                    onClick={() => submitDecision(d.id)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors
                        ${submitting === d.id
                            ? 'bg-gray-400 text-white cursor-wait'
                            : 'bg-[#171717] text-white hover:bg-[#333] cursor-pointer'
                        }
                        ${submitting && submitting !== d.id ? 'opacity-40' : ''}
                    `}
                >
                    {submitting === d.id ? 'Submitting…' : d.label}
                </button>
            ))}
        </div>
    );
}
