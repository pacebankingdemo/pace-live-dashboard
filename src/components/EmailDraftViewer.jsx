import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const sbUrl = import.meta.env.VITE_SUPABASE_URL;
const sbServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzdmpjcG14bmRnYXVqeGx2aWt3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTkzNiwiZXhwIjoyMDg3NjA1OTM2fQ.81sjVPgI5QzYLlwz1YwbkCNxK-07Rki98px_JUhK6To';
const supabase = createClient(sbUrl, sbServiceKey);

/* ── Gmail "M" logo ── */
const GmailIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
        <path d="M1 5.5V18.5C1 19.6 1.9 20.5 3 20.5H5V9.5L12 14.5L19 9.5V20.5H21C22.1 20.5 23 19.6 23 18.5V5.5C23 4.1 21.4 3.2 20.2 4L12 9.5L3.8 4C2.6 3.2 1 4.1 1 5.5Z" fill="#EA4335"/>
        <path d="M5 20.5V9.5L12 14.5" fill="#4285F4"/>
        <path d="M19 20.5V9.5L12 14.5" fill="#34A853"/>
        <path d="M1 5.5L12 12.5" fill="none" stroke="#C5221F" strokeWidth="0"/>
        <path d="M5 9.5L1 5.5V18.5C1 19.6 1.9 20.5 3 20.5H5V9.5Z" fill="#C5221F"/>
        <path d="M19 9.5L23 5.5V18.5C23 19.6 22.1 20.5 21 20.5H19V9.5Z" fill="#0B8043"/>
        <path d="M19 5.5V9.5L23 5.5C23 4.1 21.4 3.2 20.2 4L19 5.5Z" fill="#F8BD00"/>
        <path d="M5 5.5V9.5L1 5.5C1 4.1 2.6 3.2 3.8 4L5 5.5Z" fill="#1E88E5"/>
    </svg>
);

/* ── Send paper-plane icon ── */
const SendIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
);

/* ── Hamburger / list icon matching the reference ── */
const ListIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
);

/**
 * EmailDraftViewer — renders in the right drawer.
 *
 * Two modes (driven by artifact._emailDraft.mode):
 *   "draft"    → editable fields + Send button (HITL gate)
 *   "received" → read-only display (default)
 */
export default function EmailDraftViewer({ artifact, run, logs, onClose, onSent }) {
    const email = artifact?._emailDraft || {};
    const isDraft = email.mode === 'draft';
    const isSent = email.mode === 'sent';

    const [to, setTo]           = useState(email.to || '');
    const [cc, setCc]           = useState(email.cc || '');
    const [subject, setSubject] = useState(email.subject || '');
    const [body, setBody]       = useState(email.body || '');
    const [sending, setSending] = useState(false);
    const [sent, setSent]       = useState(false);
    const [error, setError]     = useState(null);

    const title    = email.display_name || (isSent ? 'Email Sent' : isDraft ? 'Email Draft' : 'Email Received');
    const fromAddr = email.from || 'pace@ferring.com';

    /* ── Send handler (draft mode only) ── */
    const handleSend = async () => {
        if (sending || sent) return;
        setSending(true);
        setError(null);
        try {
            const runId = run?.id || artifact?.run_id;
            if (!runId) throw new Error('No run ID available');

            // Compute next step_number from the max existing step
            const maxStep = Array.isArray(logs) && logs.length > 0
                ? Math.max(...logs.map(l => l.step_number || 0))
                : 0;

            const { error: insertErr } = await supabase.from('activity_logs').insert({
                run_id: runId,
                step_number: maxStep + 1,
                log_type: 'decision',
                message: `Escalation email sent to ${to} — "${subject}"`,
                metadata: {
                    step_name: 'Email Sent',
                    email_sent: true,
                    to, cc, subject,
                    sent_by: 'Pace',
                    reasoning_steps: [
                        `Escalation email dispatched to ${to}`,
                        `Subject: ${subject}`,
                        cc ? `CC: ${cc}` : null,
                        'Email sent successfully — awaiting stakeholder response',
                    ].filter(Boolean),
                },
            });

            if (insertErr) throw insertErr;

            setSent(true);
            if (onSent) onSent();
        } catch (e) {
            console.error('Email send failed:', e);
            setError(e.message || 'Failed to send');
        } finally {
            setSending(false);
        }
    };

    if (!artifact) return null;

    return (
        <div className="flex flex-col h-full bg-white flex-1 min-w-[400px] overflow-hidden">

            {/* ─── Header ─── */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F0F0F0] bg-white">
                <div className="flex items-center gap-2.5">
                    <ListIcon />
                    <span className="text-[14px] font-semibold text-[#171717]">{title}</span>
                    {sent && (
                        <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Sent</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onClose}
                        className="text-[#9CA3AF] hover:text-[#374151] w-6 h-6 flex items-center justify-center">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            </div>

            {/* ─── Email metadata fields ─── */}
            <div className="px-5 pt-4 pb-2 space-y-3 border-b border-[#F0F0F0]">
                {/* From */}
                <div className="flex items-start gap-4">
                    <span className="text-[13px] text-[#9CA3AF] w-[52px] flex-shrink-0 pt-px">From</span>
                    <span className="text-[13px] text-[#374151]">{fromAddr}</span>
                </div>
                {/* To */}
                <div className="flex items-start gap-4">
                    <span className="text-[13px] text-[#9CA3AF] w-[52px] flex-shrink-0 pt-px">To</span>
                    {isDraft && !sent ? (
                        <input value={to} onChange={e => setTo(e.target.value)}
                            className="flex-1 text-[13px] text-[#171717] bg-transparent border-0 border-b border-[#E5E7EB] focus:border-[#9CA3AF] focus:outline-none py-0 px-0 -mb-px" />
                    ) : (
                        <span className="text-[13px] text-[#374151]">{to}</span>
                    )}
                </div>
                {/* Cc */}
                <div className="flex items-start gap-4">
                    <span className="text-[13px] text-[#9CA3AF] w-[52px] flex-shrink-0 pt-px">Cc</span>
                    {isDraft && !sent ? (
                        <input value={cc} onChange={e => setCc(e.target.value)}
                            className="flex-1 text-[13px] text-[#171717] bg-transparent border-0 border-b border-[#E5E7EB] focus:border-[#9CA3AF] focus:outline-none py-0 px-0 -mb-px" />
                    ) : (
                        <span className="text-[13px] text-[#374151]">{cc || '\u00A0'}</span>
                    )}
                </div>
                {/* Subject */}
                <div className="flex items-start gap-4 pb-1">
                    <span className="text-[13px] text-[#9CA3AF] w-[52px] flex-shrink-0 pt-px">Subject</span>
                    {isDraft && !sent ? (
                        <input value={subject} onChange={e => setSubject(e.target.value)}
                            className="flex-1 text-[13px] text-[#171717] font-semibold bg-transparent border-0 border-b border-[#E5E7EB] focus:border-[#9CA3AF] focus:outline-none py-0 px-0 -mb-px" />
                    ) : (
                        <span className="text-[13px] text-[#171717] font-medium">{subject}</span>
                    )}
                </div>
            </div>

            {/* ─── Body ─── */}
            <div className="flex-1 px-5 py-4 overflow-y-auto custom-scrollbar">
                {isDraft && !sent ? (
                    <textarea
                        value={body} onChange={e => setBody(e.target.value)}
                        className="w-full h-full min-h-[200px] text-[13px] text-[#374151] leading-[1.7] font-sans resize-none border-0 focus:outline-none bg-transparent"
                        placeholder="Email body..." />
                ) : (
                    <div className="text-[13px] text-[#374151] leading-[1.7] whitespace-pre-wrap">{body}</div>
                )}
            </div>

            {/* ─── Footer ─── */}
            {isSent && (
                <div className="px-5 py-3 border-t border-[#F0F0F0] bg-white">
                    <div className="flex items-center gap-2">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><polyline points="20 6 9 17 4 12"/></svg>
                        <span className="text-[11px] text-green-600 font-medium">Sent by Pace</span>
                    </div>
                </div>
            )}
            {isDraft && (
                <div className="px-5 py-3 border-t border-[#F0F0F0] bg-white">
                    {error && (
                        <div className="text-[11px] text-red-600 bg-red-50 rounded px-2 py-1 mb-2">{error}</div>
                    )}
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#9CA3AF]">
                            {sent ? 'Email sent successfully' : 'Review and send when ready'}
                        </span>
                        <button onClick={handleSend}
                            disabled={sending || sent || !to.trim()}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[12px] font-medium transition-all
                                ${sent
                                    ? 'bg-green-50 text-green-600 cursor-default'
                                    : sending
                                        ? 'bg-[#E5E7EB] text-[#9CA3AF] cursor-wait'
                                        : !to.trim()
                                            ? 'bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'
                                            : 'bg-[#171717] text-white hover:bg-[#333]'
                                }`}>
                            {sent ? (
                                <>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    Sent
                                </>
                            ) : sending ? 'Sending...' : (
                                <>
                                    <SendIcon />
                                    Send
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
