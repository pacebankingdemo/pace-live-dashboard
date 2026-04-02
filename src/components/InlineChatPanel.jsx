import React, { useState, useRef, useEffect } from 'react';
import {
    ArrowUp, Paperclip, ChevronDown, ChevronRight,
    Mic, PanelRightOpen, PanelRightClose, PanelLeftClose
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/* ── Tool call row ────────────────────────────────────────────── */
const ToolCallRow = ({ label, isLast }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="flex gap-0">
            {/* Left vertical connector */}
            <div className="flex flex-col items-center w-5 flex-shrink-0">
                <div className="w-px flex-1 bg-[#2a2a2a]" />
                {isLast && <div className="w-px h-2 bg-transparent" />}
            </div>
            <div className="flex-1 py-[3px]">
                <button
                    onClick={() => setOpen(o => !o)}
                    className="flex items-center gap-2 text-[12px] text-[#555] hover:text-[#888] transition-colors w-full"
                >
                    <span className="font-mono text-[11px] text-[#444]">&gt;_</span>
                    <span className="flex-1 text-left">{label}</span>
                    <ChevronDown size={12} className={`text-[#444] transition-transform flex-shrink-0 ${open ? '' : '-rotate-90'}`} />
                </button>
            </div>
        </div>
    );
};

/* ── Inline code + code block styling ────────────────────────── */
const MarkdownComponents = {
    code({ node, inline, className, children, ...props }) {
        const lang = /language-(\w+)/.exec(className || '')?.[1] || '';
        const code = String(children).replace(/\n$/, '');
        if (inline) {
            return (
                <code
                    className="px-1.5 py-0.5 rounded text-[11px] font-mono"
                    style={{ background: 'rgba(180,60,40,0.18)', color: '#e07060' }}
                    {...props}
                >
                    {children}
                </code>
            );
        }
        const copyCode = () => navigator.clipboard.writeText(code).catch(() => {});
        return (
            <div className="my-3 rounded-lg overflow-hidden border border-[#252525] bg-[#161616]">
                <div className="flex items-center justify-between px-4 py-2 border-b border-[#252525]">
                    <span className="text-[11px] text-[#555] font-mono">{lang || 'code'}</span>
                    <button onClick={copyCode} className="text-[#444] hover:text-[#888] transition-colors">
                        <Copy size={12} />
                    </button>
                </div>
                <pre className="px-4 py-3 overflow-x-auto text-[12px] text-[#c8c8c8] font-mono leading-relaxed">
                    <code>{code}</code>
                </pre>
            </div>
        );
    },
    p({ children }) {
        return <p className="my-1.5 leading-relaxed">{children}</p>;
    },
    ul({ children }) {
        return <ul className="my-1.5 pl-4 space-y-0.5 list-disc">{children}</ul>;
    },
    li({ children }) {
        return <li className="leading-relaxed">{children}</li>;
    },
    strong({ children }) {
        return <strong className="font-[600] text-[#ddd]">{children}</strong>;
    },
};

/* ── Message bubble ───────────────────────────────────────────── */
const ChatMessage = ({ msg }) => {
    const isUser = msg.role === 'user';
    const userName = sessionStorage.getItem('userName') ||
        sessionStorage.getItem('userEmail')?.split('@')[0] || 'You';

    if (isUser) {
        return (
            <div className="mb-6 flex justify-end px-6">
                <div
                    className={`max-w-[72%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${theme === 'light' ? 'bg-[#f0f0f0] text-[#111]' : 'bg-[#1e1e1e] text-[#e0e0e0]'}`}
                >
                    {msg.content}
                </div>
            </div>
        );
    }

    /* Assistant message */
    const toolCalls = msg.toolCalls || [];
    return (
        <div className="mb-6 px-6">
            {/* Tool call rows with connectors */}
            {toolCalls.length > 0 && (
                <div className="mb-3">
                    {toolCalls.map((t, i) => (
                        <ToolCallRow key={i} label={t} isLast={i === toolCalls.length - 1} />
                    ))}
                </div>
            )}

            {/* Prose content */}
            {msg.content && (
                <>
                    {msg.isError ? (
                        <p className="text-[13px] text-red-400 leading-relaxed">{msg.content}</p>
                    ) : (
                        <div className={`text-[13px] leading-relaxed prose-custom ${theme === 'light' ? 'text-[#222]' : 'text-[#c8c8c8]'}`}>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={MarkdownComponents}
                            >
                                {msg.content}
                            </ReactMarkdown>
                        </div>
                    )}


                </>
            )}
        </div>
    );
};

/* ── Main component ───────────────────────────────────────────── */
const InlineChatPanel = ({ title, onClose, tasksOpen, onOpenTasks, onCloseTasks, theme }) => {
    const [messages, setMessages]   = useState([]);
    const [input, setInput]         = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef            = useRef(null);
    const inputRef                  = useRef(null);
    const processName = title || sessionStorage.getItem('currentProcessName') || 'Chat';

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;
        setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
        setInput('');
        setIsLoading(true);
        try {
            const orgId     = sessionStorage.getItem('currentOrgId') || '';
            const orgName   = sessionStorage.getItem('currentOrgName') || '';
            const processId = sessionStorage.getItem('currentProcessId') || '';
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: trimmed,
                    history: messages.slice(-20),
                    orgId, orgName, processId, processName,
                }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error'); }
            const data = await res.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Error: ${err.message}`,
                isError: true,
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    return (
        <div className={`flex flex-col h-full ${theme === 'light' ? 'bg-white' : 'bg-[#111]'}`}>

            {/* ── Header ─────────────────────────────────────── */}
            <div className={`flex items-center justify-between px-5 h-11 border-b flex-shrink-0 ${theme === 'light' ? 'border-[#e8e8e8]' : 'border-[#1e1e1e]'}`}>
                <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                    <span className={`text-[14px] font-[500] ${theme === 'light' ? 'text-[#111]' : 'text-[#d0d0d0]'}`}>{processName}</span>
                    <ChevronDown size={13} className="text-[#555]" />
                </button>
                <div className="flex items-center gap-1">
                    {/* Toggle tasks panel */}
                    {onOpenTasks && !tasksOpen && (
                        <button onClick={onOpenTasks} title="Open tasks"
                            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${theme === 'light' ? 'text-[#999] hover:text-[#444] hover:bg-[#f0f0f0]' : 'text-[#444] hover:text-[#888] hover:bg-[#1e1e1e]'}`}>
                            <PanelRightOpen size={14} strokeWidth={1.8} />
                        </button>
                    )}
                    {onCloseTasks && tasksOpen && (
                        <button onClick={onCloseTasks} title="Close tasks"
                            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${theme === 'light' ? 'text-[#999] hover:text-[#444] hover:bg-[#f0f0f0]' : 'text-[#444] hover:text-[#888] hover:bg-[#1e1e1e]'}`}>
                            <PanelRightClose size={14} strokeWidth={1.8} />
                        </button>
                    )}
                    {onClose && (
                        <button onClick={onClose} title="Close chat"
                            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${theme === 'light' ? 'text-[#999] hover:text-[#444] hover:bg-[#f0f0f0]' : 'text-[#444] hover:text-[#888] hover:bg-[#1e1e1e]'}`}>
                            <PanelLeftClose size={14} strokeWidth={1.8} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Messages ───────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto pt-6 pb-4">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center px-8">
                        <img src="/home-pace.svg" alt="Pace" className="w-10 h-10 mb-4 opacity-10" />
                        <p className={`text-[13px] font-[500] mb-1 ${theme === 'light' ? 'text-[#888]' : 'text-[#444]'}`}>Chat with Pace</p>
                        <p className={`text-[12px] leading-relaxed ${theme === 'light' ? 'text-[#aaa]' : 'text-[#333]'}`}>
                            Ask about tasks, processes, or anything on the dashboard.
                        </p>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <ChatMessage key={idx} msg={msg} />
                ))}

                {isLoading && (
                    <div className="px-6 mb-6">
                        <div className="flex gap-1 items-center mt-1">
                            <div className="w-1.5 h-1.5 bg-[#3b6fff] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 bg-[#3b6fff] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 bg-[#3b6fff] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* ── Input ──────────────────────────────────────── */}
            <div className="flex-shrink-0 px-5 pb-5 pt-2">
                <div
                    className={`rounded-2xl overflow-hidden ${theme === 'light' ? 'border border-[#e0e0e0] bg-[#f7f7f7]' : 'border border-[#282828] bg-[#181818]'}`}
                >
                    <textarea
                        ref={inputRef}
                        rows={3}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Do your life's best work with Pace"
                        className={`w-full bg-transparent px-4 pt-4 pb-2 text-[13px] resize-none outline-none leading-relaxed ${theme === 'light' ? 'placeholder-[#bbb] text-[#111]' : 'placeholder-[#404040] text-[#d0d0d0]'}`}
                    />
                    <div className="flex items-center justify-between px-4 pb-3 pt-1">
                        {/* Left: paperclip */}
                        <button className="text-[#3a3a3a] hover:text-[#666] transition-colors p-0.5">
                            <Paperclip size={15} strokeWidth={1.8} />
                        </button>
                        {/* Right: model selector + mic + send */}
                        <div className="flex items-center gap-2">
                            <button className="flex items-center gap-1 text-[#555] hover:text-[#888] transition-colors">
                                <span className="text-[12px]">Sonnet 4.6</span>
                                <ChevronDown size={11} />
                            </button>
                            <button className="text-[#3a3a3a] hover:text-[#666] transition-colors p-0.5">
                                <Mic size={15} strokeWidth={1.8} />
                            </button>
                            <button
                                onClick={sendMessage}
                                disabled={!input.trim() || isLoading}
                                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                    input.trim() && !isLoading
                                        ? 'bg-white text-black'
                                        : (theme === 'light' ? 'bg-[#ebebeb] text-[#bbb]' : 'bg-[#222] text-[#444]')
                                }`}
                            >
                                <ArrowUp size={13} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InlineChatPanel;
