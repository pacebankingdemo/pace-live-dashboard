import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronDown, ChevronRight, Activity, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Search } from 'lucide-react';
import { supabase, fetchProcesses, subscribeToTable } from '../services/supabase';
import ProcessDetails from './ProcessDetails';
import InlineChatPanel from './InlineChatPanel';

const HIDDEN_PROCESS_IDS = new Set([
    '795b85bb-ef67-4e56-aaec-2a07d5ed8c90',
    'fa91e289-044b-4fc9-a626-ebdb6c0ee64b',
    '634c603a-b18f-4605-aa2a-1160bcc26f20',
    '16ff2409-24ba-4df3-ab36-f1b70d8243e4',
    'ba0c4a4c-815c-4e10-8720-bbb891c6f5b7',
    'ac2bc5a3-8501-466b-bc68-d2d5e7ccaf96',
    '1b9b7c8c-d65b-4c8a-a76e-d1dc1b23ab90',
]);

const STATUS_GROUPS = [
    { key: 'needs_attention', label: 'Needs input',  dot: 'bg-[#ff5050]',  border: 'border-[#ff5050]', matchFn: r => r.status === 'needs_attention' },
    { key: 'needs_review',    label: 'Needs review', dot: 'bg-[#ED6704]',  border: 'border-[#ED6704]', matchFn: r => r.status === 'needs_review' },
    { key: 'failed',          label: 'Failed',       dot: 'bg-[#cc2222]',  border: 'border-[#cc2222]', matchFn: r => r.status === 'failed' },
    { key: 'in_progress',     label: 'In progress',  dot: 'bg-[#3b6fff]',  border: 'border-[#3b6fff]', matchFn: r => r.status === 'in_progress' || r.status === 'ready' },
    { key: 'done',            label: 'Completed',    dot: 'bg-[#22aa44]',  border: 'border-[#22aa44]', matchFn: r => r.status === 'done' },
    { key: 'void',            label: 'Cancelled',    dot: 'bg-[#555]',     border: 'border-[#555]',    matchFn: r => r.status === 'void' },
];

const StatusDot = ({ group }) => (
    <span className={`inline-block flex-shrink-0 w-[7px] h-[7px] rounded-[2px] border ${group.dot} ${group.border} opacity-80`} />
);

const fmtDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const TasksView = () => {
    const { currentOrg, openTab } = useOutletContext();
    const [activeTab, setActiveTab]                 = useState('all');
    const [processes, setProcesses]                 = useState([]);
    const [selectedProcessId, setSelectedProcessId] = useState(null);
    const [runs, setRuns]                           = useState([]);
    const [collapsed, setCollapsed]                 = useState({});
    const [loading, setLoading]                     = useState(true);
    const [selectedRun, setSelectedRun]             = useState(null);
    const [leftOpen, setLeftOpen]                   = useState(true);
    const [rightOpen, setRightOpen]                 = useState(true);

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

    const loadRuns = useCallback(async () => {
        if (!currentOrg) return;
        setLoading(true);
        try {
            const visibleIds = processes.filter(p => !HIDDEN_PROCESS_IDS.has(p.id)).map(p => p.id);
            if (visibleIds.length === 0) { setRuns([]); setLoading(false); return; }
            let query = supabase
                .from('activity_runs')
                .select('id, name, status, updated_at, created_at, process_id')
                .not('name', 'like', '[GOLDEN]%')
                .order('updated_at', { ascending: false });
            query = selectedProcessId
                ? query.eq('process_id', selectedProcessId)
                : query.in('process_id', visibleIds);
            const { data, error } = await query;
            if (!error) setRuns(data || []);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [currentOrg, selectedProcessId, processes]);

    useEffect(() => { loadRuns(); }, [loadRuns]);

    useEffect(() => {
        if (!currentOrg) return;
        const unsub = subscribeToTable('activity_runs', undefined, loadRuns);
        return unsub;
    }, [currentOrg, loadRuns]);

    const visibleRuns = activeTab === 'needs_action'
        ? runs.filter(r => r.status === 'needs_attention' || r.status === 'needs_review')
        : runs;

    const groups = STATUS_GROUPS
        .map(g => ({ ...g, runs: visibleRuns.filter(g.matchFn) }))
        .filter(g => g.runs.length > 0);

    const toggleCollapse = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
    const processMap = Object.fromEntries(processes.map(p => [p.id, p]));

    return (
        <div className="flex h-full bg-[#111] overflow-hidden">

            {/* ── LEFT: collapsible chat panel ── */}
            {leftOpen && (
                <div className="w-[272px] flex-shrink-0 border-r border-[#222] flex flex-col overflow-hidden bg-[#111]">
                    <InlineChatPanel />
                </div>
            )}

            {/* ── CENTER: task list OR run detail ── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

                {/* Center toolbar — collapse toggles + tabs */}
                <div className="flex items-center h-9 px-3 border-b border-[#222] flex-shrink-0 gap-1">
                    <button
                        onClick={() => setLeftOpen(o => !o)}
                        className="w-6 h-6 flex items-center justify-center rounded text-[#444] hover:text-[#888] hover:bg-[#1e1e1e] transition-colors flex-shrink-0"
                        title={leftOpen ? 'Collapse chat' : 'Expand chat'}
                    >
                        {leftOpen ? <PanelLeftClose size={13} /> : <PanelLeftOpen size={13} />}
                    </button>

                    <div className="flex-1" />

                    {/* Search icon */}
                    <button className="w-6 h-6 flex items-center justify-center rounded text-[#444] hover:text-[#888] hover:bg-[#1e1e1e] transition-colors flex-shrink-0" title="Search tasks">
                        <Search size={13} />
                    </button>

                    <button
                        onClick={() => setRightOpen(o => !o)}
                        className="w-6 h-6 flex items-center justify-center rounded text-[#444] hover:text-[#888] hover:bg-[#1e1e1e] transition-colors flex-shrink-0"
                        title={rightOpen ? 'Collapse processes' : 'Expand processes'}
                    >
                        {rightOpen ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />}
                    </button>
                </div>

                {selectedRun ? (
                    <ProcessDetails runId={selectedRun.id} onBack={() => setSelectedRun(null)} />
                ) : (
                <>
                {/* Header */}
                <div className="px-6 pt-5 pb-0 flex-shrink-0">
                    <h1 className="text-[15px] font-[600] text-[#e8e8e8] mb-3">Tasks</h1>
                    <div className="flex items-center gap-1 border-b border-[#222]">
                        {[{ key: 'all', label: 'All' }, { key: 'needs_action', label: 'Needs Action' }].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`px-3 py-2 text-[12px] font-[500] border-b-2 transition-colors -mb-px ${
                                    activeTab === tab.key
                                        ? 'border-[#e8e8e8] text-[#e8e8e8]'
                                        : 'border-transparent text-[#555] hover:text-[#999]'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="w-4 h-4 border-2 border-[#2a2a2a] border-t-[#555] rounded-full animate-spin" />
                        </div>
                    ) : groups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-center">
                            <div className="text-[13px] font-[500] text-[#555] mb-1">No tasks</div>
                            <div className="text-[12px] text-[#444]">
                                {activeTab === 'needs_action' ? 'Nothing needs attention.' : 'Runs will appear here in real-time.'}
                            </div>
                        </div>
                    ) : groups.map(group => (
                        <div key={group.key}>
                            <button
                                onClick={() => toggleCollapse(group.key)}
                                className="w-full flex items-center gap-2 px-6 py-2 hover:bg-[#ffffff05] transition-colors group"
                            >
                                <span className="text-[#333] group-hover:text-[#555] transition-colors">
                                    {collapsed[group.key] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                </span>
                                <StatusDot group={group} />
                                <span className="text-[12px] font-[500] text-[#777]">{group.label}</span>
                                <span className="text-[12px] text-[#444] ml-0.5">{group.runs.length}</span>
                            </button>

                            {!collapsed[group.key] && group.runs.map(run => (
                                <div
                                    key={run.id}
                                    onClick={() => { setSelectedRun(run); openTab?.({ id: run.id, label: run.name || 'Untitled run' }); }}
                                    className={`flex items-center gap-3 px-10 py-[7px] cursor-pointer transition-colors border-b border-[#ffffff04] last:border-0 group ${
                                        selectedRun?.id === run.id ? 'bg-[#1e1e1e]' : 'hover:bg-[#ffffff05]'
                                    }`}
                                >
                                    <StatusDot group={group} />
                                    <span className="flex-1 text-[13px] text-[#ccc] truncate min-w-0">
                                        {run.name || 'Untitled run'}
                                    </span>
                                    <div className="w-5 h-5 bg-[#2a2a2a] rounded-full flex items-center justify-center text-[#888] font-bold text-[9px] flex-shrink-0">
                                        V
                                    </div>
                                    <span className="text-[12px] text-[#444] flex-shrink-0 w-[38px] text-right">
                                        {fmtDate(run.updated_at)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
                </>
                )}
            </div>

            {/* ── RIGHT: collapsible process filter ── */}
            {rightOpen && (
                <div className="w-[200px] flex-shrink-0 border-l border-[#222] flex flex-col overflow-hidden bg-[#111]">
                    <div className="px-4 pt-[13px] pb-2 flex-shrink-0 border-b border-[#222]">
                        <span className="text-[11px] font-[550] text-[#444] uppercase tracking-wide">Processes</span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 py-3">
                        <button
                            onClick={() => setSelectedProcessId(null)}
                            className={`w-full flex items-center gap-2 px-2.5 py-[7px] rounded-md text-[12px] transition-colors mb-0.5 ${
                                selectedProcessId === null ? 'bg-[#1e1e1e] text-[#e8e8e8] font-[550]' : 'text-[#666] hover:bg-[#1a1a1a] hover:text-[#aaa]'
                            }`}
                        >
                            <Activity size={12} className={selectedProcessId === null ? 'text-[#888]' : 'text-[#444]'} strokeWidth={1.5} />
                            <span className="truncate flex-1 text-left">All processes</span>
                            {selectedProcessId === null && (
                                <span className="text-[11px] text-[#555] font-normal">{runs.length}</span>
                            )}
                        </button>
                        <div className="border-t border-[#222] my-2 mx-1" />
                        {processes.map(proc => {
                            const count    = runs.filter(r => r.process_id === proc.id).length;
                            const isActive = selectedProcessId === proc.id;
                            return (
                                <button
                                    key={proc.id}
                                    onClick={() => setSelectedProcessId(isActive ? null : proc.id)}
                                    className={`w-full flex items-center gap-2 px-2.5 py-[7px] rounded-md text-[12px] transition-colors mb-0.5 ${
                                        isActive ? 'bg-[#1e1e1e] text-[#e8e8e8] font-[550]' : 'text-[#666] hover:bg-[#1a1a1a] hover:text-[#aaa]'
                                    }`}
                                >
                                    <Activity size={12} className={isActive ? 'text-[#888]' : 'text-[#444]'} strokeWidth={1.5} />
                                    <span className="truncate flex-1 text-left">{proc.name}</span>
                                    {count > 0 && (
                                        <span className={`text-[11px] font-normal flex-shrink-0 ${isActive ? 'text-[#555]' : 'text-[#333]'}`}>{count}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TasksView;
