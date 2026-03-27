import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const sbUrl = import.meta.env.VITE_SUPABASE_URL;
const sbServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzdmpjcG14bmRnYXVqeGx2aWt3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTkzNiwiZXhwIjoyMDg3NjA1OTM2fQ.81sjVPgI5QzYLlwz1YwbkCNxK-07Rki98px_JUhK6To';
const supabase = createClient(sbUrl, sbServiceKey);

/* Gmail icon */
const GmailIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
        <path d="M2 6.5C2 5.4 2.9 4.5 4 4.5H20C21.1 4.5 22 5.4 22 6.5V17.5C22 18.6 21.1 19.5 20 19.5H4C2.9 19.5 2 18.6 2 17.5V6.5Z" fill="white"/>
        <path d="M2 6.5L12 13.5L22 6.5" fill="none" stroke="#EA4335" strokeWidth="1.5"/>
        <path d="M2 6.5L8 12" fill="none" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M22 6.5L16 12" fill="none" stroke="#34A853" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M2 17.5L8 12" fill="none" stroke="#FBBC05" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M22 17.5L16 12" fill="none" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round"/>
        <rect x="2" y="4.5" width="20" height="15" rx="2" fill="none" stroke="#DADCE0" strokeWidth="1"/>
    </svg>
);

/* Send icon */
const SendIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
);

export default function EmailDraftViewer({ artifact, run, logs, onClose, onSent }) {
    const email = artifact?._emailDraft || {};

    const [to, setTo] = useState(email.to || '');
    const [cc, setCc] = useState(email.cc || '');
    const [subject, setSubject] = useState(email.subject || '');
    const [body, setBody] = useState(email.body || '');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState(null);

    const displayName = email.display_name || 'Email Draft';
    const fromAddr = email.from || 'pace@ferring.com';

    const handleSend = async () => {
        if (sending || sent) return;
        setSending(true);
        setError(null);

        try {
            const baseStep = logs?.length || 0;

            /* Log the email send as a step */
            await supabase.from('activity_logs').insert({
                run_id: run.id,
                step_number: baseStep + 1,
                log_type: 'system',
                message: `Email sent to ${to} — "${subject}"`,
                metadata: {
                    step_name: 'Email Sent',
                    email_sent: true,
                    to, cc, subject,
                    sent_by: 'Pace',
                    reasoning_steps: [
                        `Auto-drafted approval request email sent to ${to}`,
                        `Subject: ${subject}`,
                        cc ? `CC: ${cc}` : null,
                        'Email dispatched — awaiting response',
                    ].filter(Boolean),
                },
            });

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
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white z-10">
                <div className="flex items-center gap-2.5">
                    <GmailIcon size={18} />
                    <span className="text-[13px] font-semibold text-[#171717]">{displayName}</span>
                    {sent && (
                        <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Sent</span>
                    )}
                </div>
                <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#374151] text-lg font-light w-6 h-6 flex items-center justify-center">
                    ×
                </button>
            </div>

            {/* Email fields */}
            <div className="px-4 py-3 space-y-2.5 bg-[#F9FAFB] border-b border-[#E5E7EB]">
                {/* From - read only */}
                <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[#6B7280] w-12 flex-shrink-0 font-medium">From</span>
                    <span className="text-[12px] text-[#374151]">{fromAddr}</span>
                </div>
                {/* To - editable */}
                <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[#6B7280] w-12 flex-shrink-0 font-medium">To</span>
                    <input
                        value={to} onChange={e => setTo(e.target.value)}
                        disabled={sent}
                        className="flex-1 text-[12px] text-[#171717] bg-white border border-[#E5E7EB] rounded px-2 py-1 focus:outline-none focus:border-[#9CA3AF] disabled:bg-[#F3F4F6] disabled:text-[#6B7280]"
                    />
                </div>
                {/* CC - editable */}
                <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[#6B7280] w-12 flex-shrink-0 font-medium">CC</span>
                    <input
                        value={cc} onChange={e => setCc(e.target.value)}
                        disabled={sent}
                        className="flex-1 text-[12px] text-[#171717] bg-white border border-[#E5E7EB] rounded px-2 py-1 focus:outline-none focus:border-[#9CA3AF] disabled:bg-[#F3F4F6] disabled:text-[#6B7280]"
                    />
                </div>
                {/* Subject - editable */}
                <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[#6B7280] w-12 flex-shrink-0 font-medium">Subject</span>
                    <input
                        value={subject} onChange={e => setSubject(e.target.value)}
                        disabled={sent}
                        className="flex-1 text-[12px] text-[#171717] font-semibold bg-white border border-[#E5E7EB] rounded px-2 py-1 focus:outline-none focus:border-[#9CA3AF] disabled:bg-[#F3F4F6] disabled:text-[#6B7280]"
                    />
                </div>
            </div>

            {/* Body - editable textarea */}
            <div className="flex-1 px-4 py-3 overflow-y-auto custom-scrollbar">
                <textarea
                    value={body} onChange={e => setBody(e.target.value)}
                    disabled={sent}
                    className="w-full h-full min-h-[200px] text-[12px] text-[#374151] leading-relaxed font-sans resize-none border-0 focus:outline-none bg-transparent disabled:text-[#6B7280]"
                    placeholder="Email body..."
                />
            </div>

            {/* Footer with Send button */}
            <div className="px-4 py-3 border-t border-[#E5E7EB] bg-white">
                {error && (
                    <div className="text-[11px] text-red-600 bg-red-50 rounded px-2 py-1 mb-2">
                        {error}
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#9CA3AF]">
                        {sent ? 'Email sent successfully' : 'Review and send when ready'}
                    </span>
                    <button
                        onClick={handleSend}
                        disabled={sending || sent || !to.trim()}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[12px] font-medium transition-all
                            ${sent
                                ? 'bg-green-50 text-green-600 cursor-default'
                                : sending
                                    ? 'bg-[#E5E7EB] text-[#9CA3AF] cursor-wait'
                                    : !to.trim()
                                        ? 'bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'
                                        : 'bg-[#171717] text-white hover:bg-[#333]'
                            }`}
                    >
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
        </div>
    );
}
