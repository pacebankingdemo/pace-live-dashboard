import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Paperclip, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ToolCallRow = ({ label }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="my-0.5">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1.5 text-[12px] text-[#8f8f8f] hover:text-[#555] transition-colors py-0.5"
            >
                {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                <span>{label}</span>
            </button>
        </div>
    );
};

const ChatMessage = ({ msg }) => {
    const isUser = msg.role === 'user';
    const userName = sessionStorage.getItem('userName') ||
        sessionStorage.getItem('userEmail')?.split('@')[0] || 'You';
    const initial = userName.charAt(0).toUpperCase();

    return (
        <div className="flex gap-2.5 mb-5 w-full">
            <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold ${
                isUser ? 'bg-[#FFE2D1] text-[#AF521F]' : 'bg-[#2445ff] text-white'
            }`}>
                {isUser ? initial : <img src="/home-pace.svg" alt="P" className="w-3.5 h-3.5 brightness-0 invert" />}
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
                <span className="text-[11px] font-[600] text-[#171717]">
                    {isUser ? userName : 'Pace'}
                </span>
                <div className="text-[12px] text-[#383838] leading-relaxed break-words">
                    {isUser ? (
                        <span>{msg.content}</span>
                    ) : msg.isError ? (
                        <span className="text-red-500">{msg.content}</span>
                    ) : (
                        <div className="prose prose-xs max-w-none prose-p:my-0.5 prose-ul:my-0.5 prose-li:my-0 prose-headings:my-1 prose-headings:text-[#171717] prose-strong:text-[#171717] prose-code:text-[11px] prose-code:bg-[#f5f5f5] prose-code:px-1 prose-code:rounded">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                    )}
                </div>
                {/* Simulated tool call rows for assistant messages */}
                {!isUser && msg.toolCalls?.map((t, i) => (
                    <ToolCallRow key={i} label={t} />
                ))}
            </div>
        </div>
    );
};

const InlineChatPanel = ({ title }) => {
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
        const userMsg = { role: 'user', content: trimmed };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);
        try {
            const orgId      = sessionStorage.getItem('currentOrgId') || '';
            const orgName    = sessionStorage.getItem('currentOrgName') || '';
            const processId  = sessionStorage.getItem('currentProcessId') || '';
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: trimmed, history: messages.slice(-20), orgId, orgName, processId, processName }),
            });
            if (!response.ok) { const e = await response.json(); throw new Error(e.error || 'Error'); }
            const data = await response.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, isError: true }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    return (
        <div className="flex flex-col h-full bg-[#FAFAFA]">
            {/* Thread title */}
            <div className="px-4 pt-4 pb-3 border-b border-[#f0f0f0] flex-shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-[13px] font-[600] text-[#171717] truncate">{processName}</span>
                    <ChevronDown size={12} className="text-[#b0b0b0] flex-shrink-0" />
                </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center px-4">
                        <img src="/home-pace.svg" alt="Pace" className="w-8 h-8 mb-3 opacity-15" />
                        <p className="text-[12px] font-[500] text-[#383838] mb-1">Chat with Pace</p>
                        <p className="text-[11px] text-[#9f9f9f] leading-relaxed">
                            Ask about tasks, processes, or anything on the dashboard.
                        </p>
                    </div>
                )}
                {messages.map((msg, idx) => <ChatMessage key={idx} msg={msg} />)}
                {isLoading && (
                    <div className="flex gap-2.5 mb-5">
                        <div className="w-6 h-6 rounded-md bg-[#2445ff] flex items-center justify-center flex-shrink-0">
                            <img src="/home-pace.svg" alt="P" className="w-3.5 h-3.5 brightness-0 invert" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-[600] text-[#171717]">Pace</span>
                            <div className="flex gap-1 items-center mt-1">
                                <div className="w-1.5 h-1.5 bg-[#2445ff] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1.5 h-1.5 bg-[#2445ff] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1.5 h-1.5 bg-[#2445ff] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input box */}
            <div className="flex-shrink-0 px-3 pb-4 pt-2 border-t border-[#f0f0f0]">
                <div className="bg-white border border-[#e8e8e8] rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                    <textarea
                        ref={inputRef}
                        rows={2}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Do your life's best work with Pace"
                        className="w-full bg-transparent px-3 pt-2.5 pb-1 text-[12px] placeholder-[#b0b0b0] text-[#171717] resize-none outline-none leading-relaxed"
                    />
                    <div className="flex items-center justify-between px-3 pb-2">
                        <div className="flex items-center gap-1">
                            <button className="p-1 text-[#c0c0c0] hover:text-[#8f8f8f] transition-colors">
                                <Paperclip size={13} />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#b0b0b0]">Sonnet 4.6</span>
                            <button
                                onClick={sendMessage}
                                disabled={!input.trim() || isLoading}
                                className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                                    input.trim() ? 'bg-[#171717] text-white' : 'bg-[#ebebeb] text-[#c0c0c0]'
                                }`}
                            >
                                <ArrowUp size={11} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InlineChatPanel;
