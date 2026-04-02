import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, Paperclip, Mic, Search, ChevronDown } from 'lucide-react';

const RECENT_CHATS = [
    { id: 1,  title: 'Total conversation cost across organizations', time: '1m',  active: true  },
    { id: 2,  title: 'Chat cost pricing',                            time: '1h',  active: false },
    { id: 3,  title: 'Meeting recording follow-up email',            time: '2h',  active: false },
    { id: 4,  title: 'Meeting summary request',                      time: '7h',  active: false },
    { id: 5,  title: 'Pace spending across chats',                   time: '2d',  active: false },
    { id: 6,  title: 'Guidance on best approach',                    time: '2d',  active: false },
    { id: 7,  title: 'Revenue pod 2 optimization project plan',      time: '2d',  active: false },
    { id: 8,  title: 'Private folder contents',                      time: '2d',  active: false },
    { id: 9,  title: 'Process automation factory invocation',        time: '2d',  active: false },
];

const HomePage = () => {
    const [input, setInput] = useState('');
    const navigate = useNavigate();

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
            e.preventDefault();
            navigate('/done/tasks');
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#111] text-white font-sans antialiased overflow-y-auto">
            {/* Centered content */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">

                {/* Pace logo orb */}
                <div className="mb-5 w-11 h-11 rounded-full border border-[#2a2a2a] bg-[#191919] flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <img src="/home-pace.svg" alt="Pace" className="w-6 h-6 opacity-50" />
                </div>

                {/* Heading */}
                <h1 className="text-[20px] font-[450] text-[#d8d8d8] mb-7 tracking-[-0.01em]">
                    Let's finish what we started.
                </h1>

                {/* Input card */}
                <div className="w-full max-w-[640px] bg-[#171717] border border-[#242424] rounded-2xl overflow-visible shadow-[0_2px_24px_rgba(0,0,0,0.5)]">
                    <textarea
                        rows={2}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Do your life's best work with Pace"
                        className="w-full bg-transparent px-5 pt-4 pb-2 text-[13px] text-[#d8d8d8] placeholder-[#3a3a3a] resize-none outline-none leading-relaxed"
                        autoFocus
                    />
                    <div className="flex items-center justify-between px-4 pb-3.5 pt-1">
                        {/* Left: attachment */}
                        <button className="text-[#3a3a3a] hover:text-[#6a6a6a] transition-colors p-1 rounded">
                            <Paperclip size={14} />
                        </button>
                        {/* Right: model picker + mic + send */}
                        <div className="flex items-center gap-2">
                            <button className="flex items-center gap-1 text-[11px] text-[#4a4a4a] hover:text-[#777] transition-colors px-1">
                                <span>Sonnet 4.6</span>
                                <ChevronDown size={10} strokeWidth={2} />
                            </button>
                            <button className="text-[#3a3a3a] hover:text-[#6a6a6a] transition-colors p-1 rounded">
                                <Mic size={14} />
                            </button>
                            <button
                                onClick={() => input.trim() && navigate('/done/tasks')}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                    input.trim()
                                        ? 'bg-white text-black shadow-sm hover:bg-[#e8e8e8]'
                                        : 'bg-[#222] text-[#3a3a3a]'
                                }`}
                            >
                                <ArrowUp size={13} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Recent chats */}
                <div className="w-full max-w-[640px] mt-8">
                    {/* Section header */}
                    <div className="flex items-center justify-between mb-1 px-1">
                        <span className="text-[12px] font-[500] text-[#555]">Chats</span>
                        <button className="text-[#444] hover:text-[#777] transition-colors p-1 rounded">
                            <Search size={13} />
                        </button>
                    </div>

                    {/* Chat list */}
                    <div className="flex flex-col">
                        {RECENT_CHATS.map(chat => (
                            <button
                                key={chat.id}
                                onClick={() => navigate('/done/tasks')}
                                className="flex items-center justify-between py-[9px] px-2 -mx-2 text-left hover:bg-[#1a1a1a] rounded-md transition-colors group"
                            >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    {/* Active dot */}
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                        chat.active ? 'bg-blue-400' : 'bg-transparent'
                                    }`} />
                                    <span className="text-[13px] text-[#888] group-hover:text-[#c8c8c8] transition-colors truncate">
                                        {chat.title}
                                    </span>
                                </div>
                                <span className="text-[11px] text-[#3a3a3a] flex-shrink-0 ml-4 group-hover:text-[#555] transition-colors">
                                    {chat.time}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default HomePage;
