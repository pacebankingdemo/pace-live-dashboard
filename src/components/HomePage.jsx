import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, Paperclip, Search } from 'lucide-react';

const RECENT_CHATS = [
    { id: 1, title: 'UI changes for org dashboard',        time: '1m' },
    { id: 2, title: 'Testing agent needs action task',     time: '5h' },
    { id: 3, title: 'UI changes for run relay system',     time: '5h' },
    { id: 4, title: 'Banking demo repo progress check',    time: '23h' },
    { id: 5, title: 'Can you run a browser agent and search my name', time: '1d' },
    { id: 6, title: 'Banking demo repository project context',        time: '1d' },
];

const HomePage = () => {
    const [input, setInput] = useState('');
    const navigate = useNavigate();

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
            e.preventDefault();
            // For now just navigate to tasks; later wire to new chat
            navigate('/done/tasks');
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#111] text-white font-sans antialiased">
            {/* Centered content */}
            <div className="flex-1 flex flex-col items-center justify-center px-6">
                {/* Pace logo orb */}
                <div className="mb-5 w-12 h-12 rounded-full border border-[#3a3a3a] flex items-center justify-center">
                    <img src="/home-pace.svg" alt="Pace" className="w-7 h-7 opacity-60" />
                </div>

                <h1 className="text-[22px] font-[400] text-[#e8e8e8] mb-8 tracking-[-0.01em]">
                    You've got momentum.
                </h1>

                {/* Input box */}
                <div className="w-full max-w-[500px] bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.4)]">
                    <textarea
                        rows={2}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Do your life's best work with Pace"
                        className="w-full bg-transparent px-4 pt-3.5 pb-1 text-[13px] text-[#e0e0e0] placeholder-[#4a4a4a] resize-none outline-none leading-relaxed"
                        autoFocus
                    />
                    <div className="flex items-center justify-between px-4 pb-3">
                        <div className="flex items-center gap-2">
                            <button className="text-[#4a4a4a] hover:text-[#8f8f8f] transition-colors">
                                <Paperclip size={14} />
                            </button>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <span className="text-[11px] text-[#4a4a4a]">Sonnet 4.6</span>
                            <button
                                disabled={!input.trim()}
                                className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                                    input.trim() ? 'bg-white text-black' : 'bg-[#2e2e2e] text-[#4a4a4a]'
                                }`}
                            >
                                <ArrowUp size={12} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Recent chats */}
                <div className="w-full max-w-[500px] mt-8">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[12px] font-[500] text-[#6a6a6a]">Chats</span>
                        <button className="text-[#4a4a4a] hover:text-[#8f8f8f] transition-colors">
                            <Search size={13} />
                        </button>
                    </div>
                    <div className="flex flex-col">
                        {RECENT_CHATS.map(chat => (
                            <button
                                key={chat.id}
                                onClick={() => navigate('/done/tasks')}
                                className="flex items-center justify-between py-2 px-0 text-left hover:bg-[#1a1a1a] rounded-md px-2 -mx-2 transition-colors group"
                            >
                                <span className="text-[13px] text-[#c8c8c8] truncate flex-1 group-hover:text-white transition-colors">
                                    {chat.title}
                                </span>
                                <span className="text-[12px] text-[#4a4a4a] flex-shrink-0 ml-4">
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
