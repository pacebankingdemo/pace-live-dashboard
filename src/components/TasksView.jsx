import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronDown, ChevronRight, Activity } from 'lucide-react';
import { supabase, fetchProcesses, subscribeToTable } from '../services/supabase';
import TaskChatPanel from './TaskChatPanel';

// Sub-skill process IDs to hide (same as DashboardLayout)
const HIDDEN_PROCESS_IDS = new Set([
    '795b85bb-ef67-4e56-aaec-2a07d5ed8c90',
    'fa91e289-044b-4fc9-a626-ebdb6c0ee64b',
    '634c603a-b18f-4605-aa2a-1160bcc26f20',
    '16ff2409-24ba-4df3-ab36-f1b70d8243e4',
    'ba0c4a4c-815c-4e10-8720-bbb891c6f5b7',
    'ac2bc5a3-8501-466b-bc68-d2d5e7ccaf96',
    '1b9b7c8c-d65b-4c8a-a76e-d1dc1b23ab90',
]);

// Status group config — order determines display order
const STATUS_GROUPS = [
    {
        key: 'needs_attention',
        label: 'Needs input',
        dot: 'bg-[#ff5050]',
        dotBorder: 'border-[#e03030]',
        matchFn: r => r.status === 'needs_attention',
    },
    {
        key: 'needs_review',
        label: 'Needs review',
        dot: 'bg-[#FCEDB9]',
        dotBorder: 'border-[#ED6704]',
        matchFn: r => r.status === 'needs_review',
    },
    {
        key: 'failed',
        label: 'Failed',
        dot: 'bg-[#ff5050]',
        dotBorder: 'border-[#A40000]',
        matchFn: r => r.status === 'failed',
    },
    {
        key: 'in_progress',
        label: 'In progress',
        dot: 'bg-[#EAF3FF]',
        dotBorder: 'border-[#2546F5]',
        matchFn: r => r.status === 'in_progress' || r.status === 'ready',
    },
    {
        key: 'done',
        label: 'Completed',
        dot: 'bg-[#E2F1EB]',
        dotBorder: 'border-[#038408]',
        matchFn: r => r.status === 'done',
    },
    {
        key: 'void',
        label: 'Cancelled',
        dot: 'bg-[#EBEBEB]',
        dotBorder: 'border-[#8F8F8F]',
        matchFn: r => r.status === 'void',
    },
];

// Status dot inline component
const StatusDot = ({ group, size = 'sm' }) => {
    const sz = size === 'sm' ? 'w-[7px] h-[7px]' : 'w-2 h-2';
    return (
        <span className={`inline-block flex-shrink-0 rounded-[2px] border ${sz} ${group.dot} ${group.dotBorder}`} />
    );
};

// Format date as "Apr 2" style
const fmtDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Avatar letter circle (matches sidebar style)
const Avatar = ({ letter, size = 6 }) => (
    <div className={`w-${size} h-${size} bg-[#ebebeb] rounded flex items-center justify-center text-[#171717] font-bold text-[10px] flex-shrink-0`}>
        {letter || '?'}
    </div>
);


// ─────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────
const TasksView = () => {
    const navigate = useNavigate();
    const { currentOrg } = useOutletContext();

    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'needs_action'
    const [processes, setProcesses] = useState([]);
    const [selectedProcessId, setSelectedProcessId] = useState(null); // null = all
    const [selectedRun, setSelectedRun] = useState(null);
    const [runs, setRuns] = useState([]);
    const [collapsed, setCollapsed] = useState({}); // { [groupKey]: bool }
    const [loading, setLoading] = useState(true);

    // ── Load processes for the org ──
    useEffect(() => {
        if (!currentOrg) return;
        const load = async () => {
            try {
                const data = await fetchProcesses(currentOrg.id);
                setProcesses(data.filter(p => !HIDDEN_PROCESS_IDS.has(p.id)));
            } catch (e) { console.error('TasksView: error loading processes', e); }
        };
        load();
        const unsub = subscribeToTable('processes', `org_id=eq.${currentOrg.id}`, load);
        return unsub;
    }, [currentOrg]);

    // ── Load all runs for selected process (or all processes) ──
    const loadRuns = useCallback(async () => {
        if (!currentOrg) return;
        setLoading(true);
        try {
            let query = supabase
                .from('activity_runs')
                .select('id, name, status, updated_at, created_at, process_id')
                .not('name', 'like', '[GOLDEN]%')
                .order('updated_at', { ascending: false });

            if (selectedProcessId) {
                query = query.eq('process_id', selectedProcessId);
            } else {
                // All visible processes for this org
                const visibleIds = processes
                    .filter(p => !HIDDEN_PROCESS_IDS.has(p.id))
                    .map(p => p.id);
                if (visibleIds.length === 0) { setRuns([]); setLoading(false); return; }
                query = query.in('process_id', visibleIds);
            }

            const { data, error } = await query;
            if (error) throw error;
            setRuns(data || []);
        } catch (e) {
            console.error('TasksView: error loading runs', e);
        } finally {
            setLoading(false);
        }
    }, [currentOrg, selectedProcessId, processes]);

    useEffect(() => {
        loadRuns();
    }, [loadRuns]);

    // Realtime subscription on activity_runs
    useEffect(() => {
        if (!currentOrg) return;
        const unsub = subscribeToTable('activity_runs', undefined, loadRuns);
        return unsub;
    }, [currentOrg, loadRuns]);

    // ── Tab filtering ──
    const needsActionStatuses = new Set(['needs_attention', 'needs_review', 'failed']);
    const visibleRuns = activeTab === 'needs_action'
        ? runs.filter(r => needsActionStatuses.has(r.status))
        : runs;

    // ── Group runs by status ──
    const groups = STATUS_GROUPS.map(g => ({
        ...g,
        runs: visibleRuns.filter(g.matchFn),
    })).filter(g => g.runs.length > 0);

    const toggleCollapse = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

    // ── Process name lookup ──
    const processMap = Object.fromEntries(processes.map(p => [p.id, p]));


    // ── Render ──
    return (
        <div className="flex h-full bg-white overflow-hidden">

            {/* ── Left: chat panel ── */}
            <div className="w-[300px] flex-shrink-0 border-r border-[#f0f0f0] flex flex-col overflow-hidden bg-[#FAFAFA]">
                <TaskChatPanel run={selectedRun} />
            </div>

            {/* ── Center: task list ── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-[#f0f0f0]">

                {/* Header */}
                <div className="px-6 pt-5 pb-3 flex-shrink-0">
                    <h1 className="text-[15px] font-[600] text-[#171717] mb-3">Tasks</h1>

                    {/* Tabs */}
                    <div className="flex items-center gap-1">
                        {[
                            { key: 'all', label: 'All' },
                            { key: 'needs_action', label: 'Needs Action' },
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-[500] transition-colors ${
                                    activeTab === tab.key
                                        ? 'bg-[#f0f0f0] text-[#171717]'
                                        : 'text-[#8f8f8f] hover:text-[#555] hover:bg-[#00000005]'
                                }`}
                            >
                                {tab.key === 'all'
                                    ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="4" height="4" rx="0.75" fill="currentColor" opacity="0.6"/><rect x="7" y="1" width="4" height="4" rx="0.75" fill="currentColor" opacity="0.6"/><rect x="1" y="7" width="4" height="4" rx="0.75" fill="currentColor" opacity="0.6"/><rect x="7" y="7" width="4" height="4" rx="0.75" fill="currentColor" opacity="0.6"/></svg>
                                    : <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1.5L7.5 4.5H10.5L8.25 6.75L9 9.75L6 8.25L3 9.75L3.75 6.75L1.5 4.5H4.5L6 1.5Z" fill="currentColor" opacity="0.7"/></svg>
                                }
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Task list */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="w-4 h-4 border-2 border-[#ebebeb] border-t-[#8f8f8f] rounded-full animate-spin" />
                        </div>
                    ) : groups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-center">
                            <div className="text-[13px] font-[500] text-[#171717] mb-1">No tasks</div>
                            <div className="text-[12px] text-[#8f8f8f]">
                                {activeTab === 'needs_action' ? 'Nothing needs attention right now.' : 'Activity runs will appear here in real-time.'}
                            </div>
                        </div>
                    ) : (
                        groups.map(group => (
                            <div key={group.key}>
                                {/* Group header */}
                                <button
                                    onClick={() => toggleCollapse(group.key)}
                                    className="w-full flex items-center gap-2 px-6 py-2 hover:bg-[#00000003] transition-colors group"
                                >
                                    <span className="text-[#cacaca] group-hover:text-[#8f8f8f] transition-colors">
                                        {collapsed[group.key]
                                            ? <ChevronRight size={12} />
                                            : <ChevronDown size={12} />
                                        }
                                    </span>
                                    <StatusDot group={group} />
                                    <span className="text-[12px] font-[500] text-[#555]">{group.label}</span>
                                    <span className="text-[12px] text-[#cacaca] ml-0.5">{group.runs.length}</span>
                                </button>

                                {/* Rows */}
                                {!collapsed[group.key] && group.runs.map(run => {
                                    const proc = processMap[run.process_id];
                                    return (
                                        <div
                                            key={run.id}
                                            onClick={() => setSelectedRun(run)}
                                            className={`flex items-center gap-3 px-8 py-2 cursor-pointer transition-colors border-b border-[#fafafa] last:border-0 group ${selectedRun?.id === run.id ? 'bg-[#f4f4f4]' : 'hover:bg-[#f9f9f9]'}`}
                                        >
                                            <StatusDot group={group} />
                                            <span className="flex-1 text-[13px] text-[#171717] truncate min-w-0">
                                                {run.name || 'Untitled run'}
                                            </span>
                                            {proc && (
                                                <span className="text-[11px] text-[#b0b0b0] flex-shrink-0 hidden group-hover:inline">
                                                    {proc.name}
                                                </span>
                                            )}
                                            <Avatar letter={currentOrg?.avatar_letter} />
                                            <span className="text-[12px] text-[#b0b0b0] flex-shrink-0 w-[36px] text-right">
                                                {fmtDate(run.updated_at)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ── Right: process filter panel ── */}
            <div className="w-[220px] flex-shrink-0 flex flex-col overflow-hidden bg-[#FAFAFA]">
                <div className="px-4 pt-5 pb-3 flex-shrink-0">
                    <span className="text-[11px] font-[550] text-[#8f8f8f] uppercase tracking-wide">Processes</span>
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-4">
                    {/* All processes option */}
                    <button
                        onClick={() => setSelectedProcessId(null)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px] transition-colors mb-0.5 ${
                            selectedProcessId === null
                                ? 'bg-[#efefef] text-[#171717] font-[550]'
                                : 'text-[#383838] hover:bg-[#00000005]'
                        }`}
                    >
                        <Activity size={13} className={selectedProcessId === null ? 'text-[#171717]' : 'text-[#8f8f8f]'} strokeWidth={selectedProcessId === null ? 2 : 1.5} />
                        <span className="truncate">All processes</span>
                        {selectedProcessId === null && (
                            <span className="ml-auto text-[11px] text-[#8f8f8f] font-normal">{runs.length}</span>
                        )}
                    </button>

                    {/* Divider */}
                    <div className="border-t border-[#f0f0f0] my-2 mx-1" />

                    {/* Individual processes */}
                    {processes.length === 0 ? (
                        <div className="px-2 py-2 text-[12px] text-[#cacaca]">No processes</div>
                    ) : (
                        processes.map(proc => {
                            const count = runs.filter(r => r.process_id === proc.id).length;
                            const isActive = selectedProcessId === proc.id;
                            return (
                                <button
                                    key={proc.id}
                                    onClick={() => setSelectedProcessId(isActive ? null : proc.id)}
                                    className={`w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px] transition-colors mb-0.5 ${
                                        isActive
                                            ? 'bg-[#efefef] text-[#171717] font-[550]'
                                            : 'text-[#383838] hover:bg-[#00000005]'
                                    }`}
                                >
                                    <Activity size={13} className={isActive ? 'text-[#171717]' : 'text-[#8f8f8f]'} strokeWidth={isActive ? 2 : 1.5} />
                                    <span className="truncate flex-1 text-left">{proc.name}</span>
                                    {count > 0 && (
                                        <span className={`text-[11px] font-normal flex-shrink-0 ${isActive ? 'text-[#8f8f8f]' : 'text-[#cacaca]'}`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

        </div>
    );
};

export default TasksView;
