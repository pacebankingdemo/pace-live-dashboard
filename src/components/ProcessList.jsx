import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Filter } from 'lucide-react';
import { fetchRuns, subscribeToTable } from '../services/supabase';
import { supabase } from '../services/supabase';
import { PROCESS_COLUMNS, DEFAULT_COLUMNS } from '../config/processColumns';
import { buildColumnsFromSchema } from '../config/dynamicColumns';

/* ─────────────────────────────────────────────────────────────────
   ProcessList
   ─ Renders a tab-filtered table of activity runs for the active process.
   ─ Column layout is fully driven by processColumns.jsx — zero column
     logic lives in this file.  To add or change columns for any process,
     edit src/config/processColumns.jsx only.
   ─ Data strategy per run:
       • metaMap    step-0 system logs (primary) + step-1 fallback → flat metadata object
       • artMetaMap artifact-type logs  → { [dataset_name]: data } map
       Both are merged into run._meta so column renderers can reach either.
───────────────────────────────────────────────────────────────── */

const ProcessList = () => {
    const navigate = useNavigate();
    const { currentProcess } = useOutletContext();
    const [activeTab, setActiveTab] = useState('in_progress');
    const [runs, setRuns] = useState([]);

    useEffect(() => {
        if (!currentProcess) return;

        const loadRuns = async () => {
            try {
                const data = await fetchRuns(currentProcess.id);
                const runIds = data.map(r => r.id);
                const metaMap    = {};
                const artMetaMap = {};

                if (runIds.length > 0) {
                    /* ── Step-0 system logs → flat metadata (primary for dynamic columns) ── */
                    const { data: logs0 } = await supabase
                        .from('activity_logs')
                        .select('run_id, metadata')
                        .in('run_id', runIds)
                        .eq('step_number', 0)
                        .eq('log_type', 'system');
                    (logs0 || []).forEach(l => {
                        if (l.metadata && Object.keys(l.metadata).length > 0) {
                            metaMap[l.run_id] = l.metadata;
                        }
                    });

                    /* ── Step-1 system/complete logs → flat metadata (legacy fallback) ── */
                    const { data: logs } = await supabase
                        .from('activity_logs')
                        .select('run_id, metadata')
                        .in('run_id', runIds)
                        .eq('step_number', 1)
                        .neq('log_type', 'artifact');
                    (logs || []).forEach(l => {
                        // Only use step-1 if step-0 didn\'t already populate this run
                        if (!metaMap[l.run_id]) {
                            metaMap[l.run_id] = l.metadata || {};
                        }
                    });

                    /* ── Artifact logs (all steps) → artMeta keyed by dataset_name ── */
                    const { data: artLogs } = await supabase
                        .from('activity_logs')
                        .select('run_id, metadata')
                        .in('run_id', runIds)
                        .eq('log_type', 'artifact');
                    (artLogs || []).forEach(l => {
                        const m      = l.metadata || {};
                        const dsName = m.dataset_name || m.step_name;
                        const dsData = m.data;
                        if (dsName && dsData) {
                            if (!artMetaMap[l.run_id]) artMetaMap[l.run_id] = {};
                            artMetaMap[l.run_id][dsName] = dsData;
                        }
                    });
                }

                setRuns(data.map(r => ({
                    ...r,
                    _meta: {
                        ...(metaMap[r.id] || {}),
                        artMeta: artMetaMap[r.id] || {},
                    },
                })));
            } catch (err) {
                console.error('ProcessList: error fetching runs', err);
            }
        };

        loadRuns();
        const unsub = subscribeToTable(
            'activity_runs',
            `process_id=eq.${currentProcess.id}`,
            () => loadRuns()
        );
        return unsub;
    }, [currentProcess]);

    /* ── Tab helpers ── */
    const getRunsByTab = (tab) => {
        if (tab === 'in_progress')
            return runs.filter(r => r.status === 'in_progress' || r.status === 'ready');
        return runs.filter(r => r.status === tab);
    };

    const tabs = [
        { key: 'needs_attention', name: 'Needs attention', squareBg: 'bg-[#FFDADA]', squareBorder: 'border-[#A40000]' },
        { key: 'needs_review',    name: 'Needs review',    squareBg: 'bg-[#FCEDB9]', squareBorder: 'border-[#ED6704]' },
        { key: 'void',            name: 'Void',            squareBg: 'bg-[#EBEBEB]', squareBorder: 'border-[#8F8F8F]' },
        { key: 'in_progress',     name: 'In progress',     squareBg: 'bg-[#EAF3FF]', squareBorder: 'border-[#2546F5]' },
        { key: 'done',            name: 'Done',            squareBg: 'bg-[#E2F1EB]', squareBorder: 'border-[#038408]' },
    ].map(tab => ({ ...tab, count: getRunsByTab(tab.key).length }));

    const currentRuns = getRunsByTab(activeTab);

    /* ── Column resolution: process-specific or default ── */
    /* Column resolution: hardcoded → DB metadata → fallback */
    const columns = PROCESS_COLUMNS[currentProcess?.id]
        ?? buildColumnsFromSchema(currentProcess?.metadata?.columns)
        ?? DEFAULT_COLUMNS;

    /* ── Guard: no process selected ── */
    if (!currentProcess) return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-[14px] font-[500] text-[#171717] mb-1">No process selected</div>
            <div className="text-[13px] text-[#7d7d7d] max-w-[300px]">
                Pace will create processes here when you start a new workflow from chat.
            </div>
        </div>
    );

    /* ── Empty state ── */
    const renderEmptyState = () => (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-250px)] bg-white text-center mt-[-50px]">
            <div className="relative flex h-[150px] w-[190px] items-center justify-center mb-4">
                <img src="/file3.svg" className="h-full w-full object-contain" alt="" />
            </div>
            <div className="text-[14px] font-[500] text-[#171717] mb-1">All clear for now</div>
            <div className="text-[13px] text-[#7d7d7d] max-w-[260px]">
                Activity runs will appear here in real-time as Pace works on tasks.
            </div>
        </div>
    );

    return (
        <div className="bg-white flex flex-col h-full overflow-hidden">
            {/* Status Tabs */}
            <div className="px-6 pt-2 pb-1 flex-shrink-0">
                <div className="flex items-center gap-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-2 py-0.5 text-[11px] rounded-[6px] transition-colors ${
                                activeTab === tab.key
                                    ? 'bg-[#00000005] border border-[#ebebeb] font-[500] text-[#171717]'
                                    : 'text-[#666666] hover:text-[#171717] hover:bg-[#00000005] font-[500]'
                            }`}
                        >
                            <div className={`w-2 h-2 rounded-[1.5px] border ${tab.squareBg} ${tab.squareBorder}`} />
                            <span>{tab.name}</span>
                            <span className={activeTab === tab.key ? 'text-[#171717]' : 'text-[#cacaca]'}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Filter Row */}
            <div className="flex items-center justify-between px-6 py-2 flex-shrink-0">
                <button className="flex items-center gap-1.5 px-3 py-1 text-[12px] font-[500] text-[#171717] hover:bg-[#fbfbfb] rounded-[4px] border border-[#ebebeb] shadow-sm">
                    <Filter className="w-3 h-3" />Filter
                </button>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                {currentRuns.length > 0 ? (
                    <table className="min-w-full border-collapse text-[12px]">
                        <thead className="sticky top-0 bg-white z-10 border-t border-b border-[#ebebeb]">
                            <tr className="text-[#8f8f8f] font-normal">
                                {columns.map(col => (
                                    <th
                                        key={col.id}
                                        className={`px-4 py-2 font-normal whitespace-nowrap text-${
                                            col.align === 'right' ? 'right'
                                            : col.align === 'center' ? 'center'
                                            : 'left'
                                        }`}
                                    >
                                        {col.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {currentRuns.map(run => {
                                const meta = run._meta || {};
                                return (
                                    <tr
                                        key={run.id}
                                        className="hover:bg-[#f9f9f9] cursor-pointer transition-colors border-b border-[#f2f2f2] last:border-0"
                                        onClick={() => navigate(`/done/process/${run.id}`)}
                                    >
                                        {columns.map(col => (
                                            <td
                                                key={col.id}
                                                className={`px-4 py-2.5 whitespace-nowrap text-${
                                                    col.align === 'right' ? 'right'
                                                    : col.align === 'center' ? 'center'
                                                    : 'left'
                                                }`}
                                            >
                                                {col.render(run, meta, meta.artMeta)}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : renderEmptyState()}
            </div>
        </div>
    );
};

export default ProcessList;
