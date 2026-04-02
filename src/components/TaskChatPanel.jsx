import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Check, Loader2, AlertCircle, Globe, Monitor, FileText, Database, Search, Cpu } from 'lucide-react';
import { fetchLogs, subscribeToTable } from '../services/supabase';

// ── Tool call icon by keyword matching ──
const TOOL_ICONS = [
    { match: /search|web|tav/i,    icon: Globe },
    { match: /computer|browser|click/i, icon: Monitor },
    { match: /file|open|read/i,    icon: FileText },
    { match: /db|database|sql|query/i, icon: Database },
    { match: /thought|think|reason/i,  icon: Cpu },
];

const ToolIcon = ({ label, size = 13 }) => {
    const hit = TOOL_ICONS.find(t => t.match.test(label || ''));
    const Icon = hit ? hit.icon : Search;
    return <Icon size={size} className="flex-shrink-0" />;
};

// ── Status badge ──
const STATUS_CONFIG = {
    done:            { color: 'text-[#038408]', bg: 'bg-[#E2F1EB]', label: 'Completed' },
    in_progress:     { color: 'text-[#2546F5]', bg: 'bg-[#EAF3FF]', label: 'In progress' },
    ready:           { color: 'text-[#2546F5]', bg: 'bg-[#EAF3FF]', label: 'In progress' },
    needs_attention: { color: 'text-[#ff5050]', bg: 'bg-[#FFDADA]', label: 'Needs input' },
    needs_review:    { color: 'text-[#ED6704]', bg: 'bg-[#FCEDB9]', label: 'Needs review' },
    failed:          { color: 'text-[#ff5050]', bg: 'bg-[#FFDADA]', label: 'Failed' },
    void:            { color: 'text-[#8f8f8f]', bg: 'bg-[#EBEBEB]', label: 'Cancelled' },
};

// ── Map log_type / metadata to a chat "role" ──
// system logs with step 0 = run trigger/start (treat as user message)
// agent/complete/tool logs = assistant steps
// error = error message
function classifyLog(log) {
    if (log.log_type === 'system' && log.step_number === 0) return 'trigger';
    if (log.log_type === 'system' && log.step_number === 1 && !log.metadata?.reasoning) return 'trigger';
    if (log.log_type === 'error') return 'error';
    if (log.log_type === 'artifact') return 'artifact';
    if (log.log_type === 'complete') return 'complete';
    return 'step'; // everything else is an agent step
}

// ── Label for a step log ──
function stepLabel(log) {
    const m = log.metadata || {};
    if (m.step_name) return m.step_name;
    if (m.tool_name) return m.tool_name;
    const msg = log.message || '';
    // Try to extract a short label from the message
    const first = msg.split(/[\n.]/)[0].trim();
    return first.length <= 60 ? first : first.slice(0, 57) + '…';
}

// ── Truncate long text for summary lines ──
function truncate(text, n = 120) {
    if (!text || text.length <= n) return text;
    const cut = text.lastIndexOf(' ', n);
    return text.slice(0, cut > 40 ? cut : n) + '…';
}


// ── Collapsible step row (tool call) ──
const StepRow = ({ log }) => {
    const [open, setOpen] = useState(false);
    const label = stepLabel(log);
    const m = log.metadata || {};
    const narrative = m.reasoning || m.error || null;
    const detail = log.message && log.message.length > 80 ? log.message : null;
    const hasDetail = narrative || detail || Object.keys(m).length > 0;

    return (
        <div className="ml-1">
            <button
                onClick={() => hasDetail && setOpen(o => !o)}
                className={`flex items-center gap-2 w-full text-left py-1 px-2 rounded-md transition-colors ${
                    hasDetail ? 'hover:bg-[#f5f5f5] cursor-pointer' : 'cursor-default'
                }`}
            >
                {/* Step icon */}
                <span className="text-[#9CA3AF]">
                    <ToolIcon label={label} size={12} />
                </span>

                {/* Label */}
                <span className="flex-1 text-[12px] text-[#555] truncate">{label}</span>

                {/* Expand chevron */}
                {hasDetail && (
                    <span className="text-[#cacaca] flex-shrink-0">
                        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    </span>
                )}
            </button>

            {/* Expanded detail */}
            {open && (
                <div className="ml-6 mr-2 mb-1 px-3 py-2 bg-[#f9f9f9] rounded-md border border-[#efefef]">
                    {narrative && (
                        <p className="text-[12px] text-[#555] leading-relaxed whitespace-pre-wrap mb-1">
                            {narrative}
                        </p>
                    )}
                    {detail && !narrative && (
                        <p className="text-[12px] text-[#555] leading-relaxed whitespace-pre-wrap">
                            {log.message}
                        </p>
                    )}
                    {/* Key-value metadata (skip noisy keys) */}
                    {Object.entries(m)
                        .filter(([k]) => !['step_name','tool_name','reasoning','error','dataset_name','artifact_url','artifact_name','artifact_id','email_draft'].includes(k))
                        .slice(0, 8)
                        .map(([k, v]) => {
                            if (typeof v === 'object') return null;
                            const displayKey = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                            return (
                                <div key={k} className="flex items-baseline gap-2 mt-0.5">
                                    <span className="text-[11px] text-[#9CA3AF] flex-shrink-0">{displayKey}:</span>
                                    <span className="text-[11px] text-[#383838] font-[450] break-all">{String(v)}</span>
                                </div>
                            );
                        })}
                </div>
            )}
        </div>
    );
};


// ── Assistant bubble: groups consecutive step logs under a single "All done" header ──
const AssistantBubble = ({ steps, completionLog }) => {
    const [stepsOpen, setStepsOpen] = useState(true);
    const completionMsg = completionLog?.message || completionLog?.metadata?.reasoning || null;

    return (
        <div className="flex flex-col gap-1">
            {/* Steps group header */}
            {steps.length > 0 && (
                <div>
                    <button
                        onClick={() => setStepsOpen(o => !o)}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] text-[#8f8f8f] hover:bg-[#f5f5f5] transition-colors"
                    >
                        <span className="w-3.5 h-3.5 rounded-full bg-[#E2F1EB] flex items-center justify-center flex-shrink-0">
                            <Check size={8} className="text-[#038408]" />
                        </span>
                        <span>All done</span>
                        {stepsOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    </button>
                    {stepsOpen && (
                        <div className="mt-1 ml-1 border-l-2 border-[#f0f0f0] pl-2 space-y-0.5">
                            {steps.map(log => <StepRow key={log.id} log={log} />)}
                        </div>
                    )}
                </div>
            )}

            {/* Completion message (the final agent response text) */}
            {completionMsg && (
                <div className="mt-1 ml-1 text-[13px] text-[#171717] leading-relaxed whitespace-pre-wrap">
                    {completionMsg}
                </div>
            )}
        </div>
    );
};

// ── Trigger / user bubble ──
const TriggerBubble = ({ log }) => {
    const text = log.message || log.metadata?.trigger_message || log.metadata?.instructions || '';
    if (!text) return null;
    return (
        <div className="flex justify-end">
            <div className="max-w-[85%] px-3 py-2 bg-[#f0f0f0] rounded-2xl rounded-br-md text-[13px] text-[#171717] leading-relaxed">
                {text}
            </div>
        </div>
    );
};

// ── Error bubble ──
const ErrorBubble = ({ log }) => (
    <div className="flex items-start gap-2 ml-1">
        <AlertCircle size={13} className="text-[#ff5050] flex-shrink-0 mt-0.5" />
        <p className="text-[12px] text-[#ff5050] leading-relaxed">{log.message || 'An error occurred.'}</p>
    </div>
);

// ── In-progress indicator ──
const TypingIndicator = () => (
    <div className="flex items-center gap-1.5 px-2 py-1 ml-1">
        <Loader2 size={12} className="text-[#8f8f8f] animate-spin" />
        <span className="text-[12px] text-[#8f8f8f]">Working…</span>
    </div>
);


// ── Main TaskChatPanel ──
const TaskChatPanel = ({ run }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);

    useEffect(() => {
        if (!run) { setLogs([]); return; }
        setLoading(true);
        const load = async () => {
            try {
                const data = await fetchLogs(run.id);
                setLogs(data);
            } catch (e) {
                console.error('TaskChatPanel: error loading logs', e);
            } finally {
                setLoading(false);
            }
        };
        load();
        const unsub = subscribeToTable('activity_logs', `run_id=eq.${run.id}`, load);
        return unsub;
    }, [run?.id]);

    // Auto-scroll to bottom when logs update
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs.length]);

    // ── Group logs into chat messages ──
    // Strategy: trigger logs = user bubbles, then batch consecutive step logs
    // into a single AssistantBubble, complete log = final assistant message
    const messages = [];
    let stepBuffer = [];

    const flushSteps = (completionLog = null) => {
        if (stepBuffer.length > 0 || completionLog) {
            messages.push({ type: 'assistant', steps: [...stepBuffer], completionLog });
            stepBuffer = [];
        }
    };

    logs.forEach(log => {
        const role = classifyLog(log);
        if (role === 'trigger') {
            flushSteps();
            messages.push({ type: 'trigger', log });
        } else if (role === 'complete') {
            flushSteps(log);
        } else if (role === 'error') {
            flushSteps();
            messages.push({ type: 'error', log });
        } else if (role === 'artifact') {
            // artifact logs fold into the step buffer as a step
            stepBuffer.push(log);
        } else {
            // step log
            stepBuffer.push(log);
        }
    });
    // Flush any remaining steps
    flushSteps();

    const statusCfg = STATUS_CONFIG[run?.status] || STATUS_CONFIG['in_progress'];
    const isLive = run?.status === 'in_progress' || run?.status === 'ready';

    // ── Empty / no run state ──
    if (!run) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-center px-6">
                <div className="text-[13px] font-[500] text-[#171717] mb-1">No task selected</div>
                <div className="text-[12px] text-[#8f8f8f]">Click a task to see its activity here.</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">

            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-[#f0f0f0] flex-shrink-0">
                <div className="flex items-start justify-between gap-2">
                    <h2 className="text-[13px] font-[600] text-[#171717] leading-snug line-clamp-2 flex-1">
                        {run.name || 'Untitled task'}
                    </h2>
                    <span className={`flex-shrink-0 text-[10px] font-[550] px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
                        {statusCfg.label}
                    </span>
                </div>
            </div>

            {/* Chat log */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center h-16">
                        <Loader2 size={14} className="animate-spin text-[#cacaca]" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-[12px] text-[#cacaca] text-center mt-8">No activity yet.</div>
                ) : (
                    messages.map((msg, i) => (
                        <div key={i}>
                            {msg.type === 'trigger'   && <TriggerBubble log={msg.log} />}
                            {msg.type === 'assistant' && <AssistantBubble steps={msg.steps} completionLog={msg.completionLog} />}
                            {msg.type === 'error'     && <ErrorBubble log={msg.log} />}
                        </div>
                    ))
                )}
                {isLive && <TypingIndicator />}
                <div ref={bottomRef} />
            </div>

            {/* Read-only footer */}
            <div className="flex-shrink-0 border-t border-[#f0f0f0] px-4 py-2.5">
                <div className="flex items-center gap-2 px-3 py-2 bg-[#f9f9f9] rounded-lg border border-[#efefef]">
                    <span className="text-[12px] text-[#cacaca] flex-1">Reply coming soon…</span>
                </div>
            </div>
        </div>
    );
};

export default TaskChatPanel;
