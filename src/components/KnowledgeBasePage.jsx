import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    PanelLeftOpen, PanelLeftClose,
    PanelRightOpen, PanelRightClose,
    Activity,
} from 'lucide-react';
import { fetchProcesses, subscribeToTable } from '../services/supabase';
import InlineChatPanel from './InlineChatPanel';
import KnowledgeBase from './KnowledgeBase';

const HIDDEN_PROCESS_IDS = new Set([
    '795b85bb-ef67-4e56-aaec-2a07d5ed8c90',
    'fa91e289-044b-4fc9-a626-ebdb6c0ee64b',
    '634c603a-b18f-4605-aa2a-1160bcc26f20',
    '16ff2409-24ba-4df3-ab36-f1b70d8243e4',
    'ba0c4a4c-815c-4e10-8720-bbb891c6f5b7',
    'ac2bc5a3-8501-466b-bc68-d2d5e7ccaf96',
    '1b9b7c8c-d65b-4c8a-a76e-d1dc1b23ab90',
]);

const KnowledgeBasePage = () => {
    const { currentOrg, currentProcess, chatOpen, setChatOpen, theme, rightOpen, setRightOpen } = useOutletContext();

    const [processes, setProcesses]           = useState([]);
    const [selectedProcessId, setSelectedProcessId] = useState(null);
    // kbOpen: whether KB content column is visible (false = chat takes full width)
    const [kbOpen, setKbOpen]                 = useState(true);

    // When chat closes, always restore KB
    useEffect(() => {
        if (!chatOpen) setKbOpen(true);
    }, [chatOpen]);

    useEffect(() => {
        if (!currentOrg) return;
        const load = async () => {
            try {
                const data = await fetchProcesses(currentOrg.id);
                setProcesses(data.filter(p => !HIDDEN_PROCESS_IDS.has(p.id)));
            } catch (e) { console.error(e); }
        };
        load();
        return subscribeToTable('processes', `org_id=eq.${currentOrg.id}`, load);
    }, [currentOrg]);

    const activeProcess = selectedProcessId
        ? processes.find(p => p.id === selectedProcessId) || currentProcess
        : currentProcess;

    const renderChat  = chatOpen;
    const renderRight = rightOpen;

    return (
        <div className="flex h-full bg-[#0d0d0d] overflow-hidden">

            {/* LEFT: Chat sidebar — fixed width when KB visible, full-width when KB hidden */}
            {renderChat && (
                <div
                    style={kbOpen ? { width: 'clamp(300px, 22vw, 460px)' } : {}}
                    className={`flex flex-col overflow-hidden transition-all duration-200 ${theme === 'light' ? 'bg-white' : 'bg-[#111]'} ${
                        kbOpen
                            ? 'flex-shrink-0 border-r border-[#1e1e1e]'
                            : 'flex-1'
                    }`}
                >
                    <InlineChatPanel
                        theme={theme}
                        onClose={() => setChatOpen(false)}
                        tasksOpen={kbOpen}
                        onOpenTasks={() => setKbOpen(true)}
                        onCloseTasks={() => setKbOpen(false)}
                    />
                </div>
            )}

            {/* CENTER: Knowledge Base — only shown when kbOpen (or chat is closed) */}
            {(!renderChat || kbOpen) && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[#111] min-w-0 transition-all duration-200">
                    {/* Toolbar */}
                    <div className="flex items-center h-9 px-3 border-b border-[#1e1e1e] flex-shrink-0 gap-1">
                        {!chatOpen && (
                            <button
                                onClick={() => setChatOpen(true)}
                                className="w-6 h-6 flex items-center justify-center rounded text-[#444] hover:text-[#888] hover:bg-[#1e1e1e] transition-colors flex-shrink-0"
                                title="Open chat"
                            >
                                <PanelLeftOpen size={13} />
                            </button>
                        )}
                        {chatOpen && kbOpen && (
                            <button
                                onClick={() => setKbOpen(false)}
                                className="w-6 h-6 flex items-center justify-center rounded text-[#444] hover:text-[#888] hover:bg-[#1e1e1e] transition-colors flex-shrink-0"
                                title="Expand chat, hide KB"
                            >
                                <PanelLeftClose size={13} />
                            </button>
                        )}
                        <div className="flex-1" />
                        <button
                            onClick={() => setRightOpen(o => !o)}
                            className="w-6 h-6 flex items-center justify-center rounded text-[#444] hover:text-[#888] hover:bg-[#1e1e1e] transition-colors flex-shrink-0"
                            title={rightOpen ? 'Hide processes' : 'Show processes'}
                        >
                            {rightOpen ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />}
                        </button>
                    </div>

                    {/* KB content */}
                    <div className="flex-1 overflow-hidden">
                        <KnowledgeBase
                            embedded
                            onClose={null}
                            currentProcess={activeProcess}
                        />
                    </div>
                </div>
            )}

            {/* RIGHT: Processes */}
            {renderRight && (
                <div className="w-[200px] flex-shrink-0 border-l border-[#1e1e1e] flex flex-col overflow-hidden bg-[#0d0d0d]">
                    <div className="flex items-center justify-between px-4 pt-[13px] pb-2 flex-shrink-0 border-b border-[#1e1e1e]">
                        <span className="text-[11px] font-[550] text-[#444] uppercase tracking-wide">Processes</span>
                        <button
                            onClick={() => setRightOpen(false)}
                            className="w-5 h-5 flex items-center justify-center rounded text-[#333] hover:text-[#888] hover:bg-[#1e1e1e] transition-colors"
                            title="Hide processes"
                        >
                            <PanelRightClose size={12} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 py-3">
                        <button
                            onClick={() => setSelectedProcessId(null)}
                            className={`w-full flex items-center gap-2 px-2.5 py-[7px] rounded-md text-[12px] transition-colors mb-0.5 ${
                                selectedProcessId === null
                                    ? 'bg-[#1e1e1e] text-[#e8e8e8] font-[550]'
                                    : 'text-[#666] hover:bg-[#1a1a1a] hover:text-[#aaa]'
                            }`}
                        >
                            <Activity size={12} className={selectedProcessId === null ? 'text-[#888]' : 'text-[#444]'} strokeWidth={1.5} />
                            <span className="truncate flex-1 text-left">All processes</span>
                        </button>
                        <div className="border-t border-[#222] my-2 mx-1" />
                        {processes.map(proc => {
                            const isActive = selectedProcessId === proc.id;
                            return (
                                <button
                                    key={proc.id}
                                    onClick={() => setSelectedProcessId(isActive ? null : proc.id)}
                                    className={`w-full flex items-center gap-2 px-2.5 py-[7px] rounded-md text-[12px] transition-colors mb-0.5 ${
                                        isActive
                                            ? 'bg-[#1e1e1e] text-[#e8e8e8] font-[550]'
                                            : 'text-[#666] hover:bg-[#1a1a1a] hover:text-[#aaa]'
                                    }`}
                                >
                                    <Activity size={12} className={isActive ? 'text-[#888]' : 'text-[#444]'} strokeWidth={1.5} />
                                    <span className="truncate flex-1 text-left">{proc.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

        </div>
    );
};

export default KnowledgeBasePage;
