import React, { useState, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, FileText, Briefcase, Database, ChevronDown } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────
   ArtifactDetailCard
   Block-only structured card view for OPEX Review artifact data.
   Replaces the generic DatasetViewer table with a clean label:value
   card layout matching the Pace_Dashboard_v1/v2 design references.

   Scoped to Block OPEX process: 84ff0fec-7dfd-48ef-a411-854c708b5e0a
───────────────────────────────────────────────────────────────── */

const BLOCK_OPEX_PROCESS_ID = '84ff0fec-7dfd-48ef-a411-854c708b5e0a';

/* ── Field display config per artifact/step type ──
   Each entry defines:
     - label: display name
     - key:   path into the data object (supports dot notation)
     - format: optional formatter ('usd', 'date', 'pill', 'mono')
     - section: optional section grouper
*/

const FIELD_CONFIGS = {
    'Classification Result': {
        tabs: [
            {
                name: 'Classification',
                fields: [
                    { label: 'Vendor', key: 'Vendor' },
                    { label: 'Transaction Number', key: 'transaction_number', format: 'mono' },
                    { label: 'Invoice Amount', key: 'Amount' },
                    { label: 'Entity', key: 'Entity' },
                    { label: 'Workflow', key: 'Workflow', format: 'pill' },
                    { label: 'Decision', key: 'Decision', format: 'pill' },
                    { label: 'Confidence', key: 'Confidence', format: 'pill' },
                    { label: 'Asset Category', key: 'category' },
                    { label: 'JE Type', key: 'JE Type', format: 'mono' },
                    { label: 'Is Laptop', key: 'is_laptop' },
                    { label: 'Is CIP', key: 'is_cip' },
                    { label: 'CIP Asset Number', key: 'cip_asset_number', format: 'mono' },
                ],
            },
            {
                name: 'Reasoning',
                textKey: 'reasoning',
            },
        ],
    },
    'FA Classification': {
        tabs: [
            {
                name: 'Classification',
                fields: [
                    { label: 'Vendor', key: 'vendor' },
                    { label: 'Transaction Number', key: 'transaction_number', format: 'mono' },
                    { label: 'Amount', key: 'amount' },
                    { label: 'Decision', key: 'capitalize', format: 'boolean_decision' },
                    { label: 'Confidence', key: 'confidence', format: 'pill' },
                    { label: 'Asset Category', key: 'category' },
                    { label: 'Is Laptop', key: 'is_laptop' },
                    { label: 'Is CIP', key: 'is_cip' },
                    { label: 'CIP Asset Number', key: 'cip_asset_number', format: 'mono' },
                ],
            },
            {
                name: 'Reasoning',
                textKey: 'reasoning',
            },
        ],
    },
    'Invoice Details': {
        tabs: [
            {
                name: 'Invoice',
                fields: [
                    { label: 'Vendor', key: 'Vendor' },
                    { label: 'Invoice Number', key: 'Invoice Number', format: 'mono' },
                    { label: 'Invoice Amount', key: 'Amount' },
                    { label: 'Entity', key: 'Entity' },
                    { label: 'GL Account', key: 'GL Account', format: 'mono' },
                    { label: 'Cost Center', key: 'Cost Center' },
                    { label: 'PO Number', key: 'PO Number', format: 'mono' },
                    { label: 'Invoice Date', key: 'Invoice Date', format: 'date' },
                    { label: 'Payment Status', key: 'Payment Status', format: 'pill' },
                ],
            },
        ],
    },
    'Enrichment Data': {
        tabs: [
            {
                name: 'Enrichment',
                fields: [
                    { label: 'Vendor', key: 'party_name' },
                    { label: 'Transaction Number', key: 'transaction_number', format: 'mono' },
                    { label: 'Amount', key: 'net_amount' },
                    { label: 'PO Number', key: 'po_number', format: 'mono' },
                    { label: 'PO Description', key: 'po_description' },
                    { label: 'Invoice PDF Available', key: 'invoice_pdf_available', format: 'pill' },
                ],
            },
        ],
    },
    'Screening Result': {
        tabs: [
            {
                name: 'Screening',
                fields: [
                    { label: 'Overall', key: 'Overall', format: 'pill' },
                    { label: 'Final Decision', key: 'Final Decision', format: 'pill' },
                    { label: 'Vendor', key: 'Vendor' },
                    { label: 'Amount', key: 'Amount' },
                    { label: 'Entity', key: 'Entity' },
                    { label: 'Reason', key: 'Reason' },
                ],
            },
        ],
    },
    'Payment Detection Result': {
        tabs: [
            {
                name: 'Payment',
                fields: [
                    { label: 'JE Type', key: 'JE Type', format: 'mono' },
                    { label: 'JE Family', key: 'JE Family' },
                    { label: 'Payment Status', key: 'Payment Status', format: 'pill' },
                    { label: 'Payment Date', key: 'Payment Date', format: 'date' },
                    { label: 'Amount Remaining', key: 'Amount Remaining' },
                ],
            },
        ],
    },
    'Journal Entry': {
        tabs: [
            {
                name: 'Journal Entry',
                fields: [
                    { label: 'JE Type', key: 'JE Type', format: 'mono' },
                    { label: 'Entity', key: 'Entity' },
                    { label: 'Debit Account', key: 'Debit Account', format: 'mono' },
                    { label: 'Credit Account', key: 'Credit Account', format: 'mono' },
                    { label: 'Amount', key: 'Amount' },
                    { label: 'Description', key: 'Description' },
                    { label: 'Reversing', key: 'Reversing', format: 'pill' },
                    { label: 'Reversal Date', key: 'Reversal Date', format: 'date' },
                ],
            },
        ],
    },
    'JE Build': {
        isMultiRow: true,
        tabs: [
            {
                name: 'JE Lines',
                fields: [
                    { label: 'JE Name', key: 'JE_NAME', format: 'mono' },
                    { label: 'JE Category', key: 'JE_CATEGORY' },
                    { label: 'Account', key: 'ACCOUNT', format: 'mono' },
                    { label: 'COA String', key: 'CODE_COMBINATION', format: 'mono' },
                    { label: 'Debit', key: 'ENTERED_DR' },
                    { label: 'Credit', key: 'ENTERED_CR' },
                    { label: 'Party', key: 'PARTY_NAME' },
                    { label: 'Entity', key: 'COMPANY' },
                    { label: 'Description', key: 'DESCRIPTION' },
                    { label: 'Reversing', key: 'REVERSING', format: 'pill' },
                    { label: 'Reversal Date', key: 'REVERSAL_DATE', format: 'date' },
                ],
            },
        ],
    },
};

/* ── Value formatters ── */
const formatValue = (val, format) => {
    if (val === null || val === undefined || val === '') {
        return <span className="text-[#D1D5DB]">—</span>;
    }

    const s = String(val);

    if (format === 'usd') {
        const n = Number(s.replace(/[^0-9.-]/g, ''));
        if (isNaN(n)) return <span className="font-[500] text-[#171717]">{s}</span>;
        return <span className="font-[500] text-[#171717]">${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
    }

    if (format === 'mono') {
        return <span className="font-mono text-[12px] text-[#555]">{s}</span>;
    }

    if (format === 'date') {
        try {
            const d = new Date(val);
            if (!isNaN(d)) return <span className="text-[#171717]">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>;
        } catch {}
        return <span className="text-[#171717]">{s}</span>;
    }

    if (format === 'boolean_decision') {
        const isYes = val === true || s.toUpperCase() === 'YES' || s.toUpperCase() === 'CAPITALIZE';
        const label = isYes ? 'Capitalize' : 'No Action';
        const cls = isYes
            ? 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]'
            : 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]';
        return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>{label}</span>;
    }

    if (format === 'pill') {
        const u = s.toUpperCase();
        let cls = 'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]';
        if (u.includes('YES') || u.includes('CAPITALIZE') || u.includes('TRUE') || u.includes('PAID') || u.includes('CLEARED') || u.includes('HIGH'))
            cls = 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]';
        else if (u.includes('NO') || u.includes('NO_ACTION') || u.includes('NO ACTION') || u.includes('FALSE') || u === 'N/A')
            cls = 'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]';
        else if (u.includes('PROCEED') || u.includes('MEDIUM') || u.includes('PENDING') || u.includes('REVIEW'))
            cls = 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]';
        else if (u.includes('LOW') || u.includes('FAIL') || u.includes('REJECT') || u.includes('ERROR'))
            cls = 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]';
        else if (u.includes('EXP_TO_FA') || u.includes('FA'))
            cls = 'bg-[#EAF3FF] text-[#2546F5] border-[#c3d8ff]';
        else if (u.includes('EXP_TO_PPD') || u.includes('PPD'))
            cls = 'bg-[#FFF4E5] text-[#B45309] border-[#fcd99c]';
        return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>{s}</span>;
    }

    return <span className="font-[500] text-[#171717]">{s}</span>;
};

/* ── Resolve a key from data, supporting alternative key casing ── */
const resolveValue = (data, key) => {
    if (!data || !key) return undefined;
    // Direct match
    if (data[key] !== undefined) return data[key];
    // Case-insensitive match
    const lower = key.toLowerCase();
    for (const k of Object.keys(data)) {
        if (k.toLowerCase() === lower) return data[k];
    }
    // Snake_case to Title Case fallback
    const snaked = key.replace(/\s+/g, '_').toLowerCase();
    for (const k of Object.keys(data)) {
        if (k.replace(/\s+/g, '_').toLowerCase() === snaked) return data[k];
    }
    return undefined;
};

/* ── Check if artifact should use the card view ── */
export function shouldUseDetailCard(artifact, processId) {
    if (processId !== BLOCK_OPEX_PROCESS_ID) return false;
    if (!artifact) return false;
    // Match by _stepName (from artifact log metadata.step_name) or filename
    const stepName = artifact._stepName || artifact.filename || '';
    return !!getFieldConfig(stepName);
}

function getFieldConfig(stepName) {
    if (!stepName) return null;
    // Direct match
    if (FIELD_CONFIGS[stepName]) return FIELD_CONFIGS[stepName];
    // Partial match — check if stepName contains any config key
    for (const [key, config] of Object.entries(FIELD_CONFIGS)) {
        if (stepName.includes(key) || key.includes(stepName)) return config;
    }
    return null;
}

/* ── Fallback: auto-generate fields from data keys ── */
function autoGenerateFields(data) {
    if (!data || typeof data !== 'object') return [];
    return Object.keys(data)
        .filter(k => {
            const v = data[k];
            return v !== null && v !== undefined && typeof v !== 'object';
        })
        .map(k => ({
            label: k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()
                     .replace(/^\w/, c => c.toUpperCase()),
            key: k,
        }));
}

/* ── Main component ── */
const ArtifactDetailCard = ({ artifact, onClose, processId }) => {
    const [activeTab, setActiveTab] = useState(0);
    const [currentRow, setCurrentRow] = useState(0);

    // Parse the data from the artifact
    const rawData = useMemo(() => {
        if (!artifact) return null;
        if (artifact._loading) return null;
        let raw = artifact.content || artifact.data;
        if (typeof raw === 'string') {
            try { raw = JSON.parse(raw); } catch { return null; }
        }
        return raw;
    }, [artifact]);

    const stepName = artifact?._stepName || artifact?.filename || 'Details';
    const config = getFieldConfig(stepName);
    const isMultiRow = config?.isMultiRow && Array.isArray(rawData);
    const totalRows = isMultiRow ? rawData.length : 1;
    const currentData = isMultiRow ? rawData[currentRow] : rawData;

    // Resolve tabs — use config if available, otherwise auto-generate
    const tabs = useMemo(() => {
        if (config?.tabs) return config.tabs;
        // Auto-generate a single tab from the data
        const fields = autoGenerateFields(currentData);
        return fields.length > 0 ? [{ name: 'Details', fields }] : [];
    }, [config, currentData]);

    const currentTabConfig = tabs[activeTab] || tabs[0];

    if (!rawData && !artifact?._loading) {
        return (
            <div className="flex flex-col h-full bg-white flex-1 min-w-[400px] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <span className="text-sm font-semibold text-gray-900">{stepName}</span>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 flex items-center justify-center text-[#9CA3AF] text-sm">No data available</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white flex-1 min-w-[400px] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F0F0F0] bg-white flex-shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#F3F0FF] flex items-center justify-center">
                        <Database className="w-3.5 h-3.5 text-[#7C3AED]" />
                    </div>
                    <span className="text-[14px] font-semibold text-[#171717]">{stepName}</span>
                </div>
                <button onClick={onClose}
                    className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Tabs — only show if more than 1 */}
            {tabs.length > 1 && (
                <div className="flex items-center gap-1 px-5 pt-3 pb-0 flex-shrink-0">
                    {tabs.map((tab, i) => (
                        <button
                            key={i}
                            onClick={() => setActiveTab(i)}
                            className={`px-3 py-1.5 text-[12px] font-[500] rounded-md transition-colors ${
                                activeTab === i
                                    ? 'bg-[#171717] text-white'
                                    : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#171717]'
                            }`}
                        >
                            {tab.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Row navigator for multi-row data (e.g. JE Lines) */}
            {isMultiRow && totalRows > 1 && (
                <div className="flex items-center justify-between px-5 pt-3 pb-1 flex-shrink-0">
                    <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                        Row {currentRow + 1} of {totalRows}
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentRow(Math.max(0, currentRow - 1))}
                            disabled={currentRow === 0}
                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4 text-[#374151]" />
                        </button>
                        <button
                            onClick={() => setCurrentRow(Math.min(totalRows - 1, currentRow + 1))}
                            disabled={currentRow === totalRows - 1}
                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight className="w-4 h-4 text-[#374151]" />
                        </button>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
                {artifact?._loading ? (
                    <div className="flex items-center justify-center h-full gap-2 text-gray-400">
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                        <span className="text-[12px]">Loading data…</span>
                    </div>
                ) : currentTabConfig?.textKey ? (
                    /* Reasoning / text tab */
                    <div className="bg-[#FAFAFA] rounded-xl border border-[#E5E7EB] p-4">
                        <p className="text-[13px] text-[#374151] leading-relaxed whitespace-pre-wrap">
                            {currentData?.[currentTabConfig.textKey]
                                || resolveValue(currentData, currentTabConfig.textKey)
                                || 'No reasoning provided.'}
                        </p>
                    </div>
                ) : currentTabConfig?.fields ? (
                    /* Structured field card */
                    <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                        <div className="divide-y divide-[#F3F4F6]">
                            {currentTabConfig.fields.map((field, idx) => {
                                const val = resolveValue(currentData, field.key);
                                // Skip fields with no value
                                if (val === undefined || val === null || val === '') {
                                    return null;
                                }
                                return (
                                    <div key={idx} className="flex items-start justify-between px-4 py-3 gap-4 hover:bg-[#FAFAFA] transition-colors">
                                        <span className="text-[12px] text-[#6B7280] whitespace-nowrap flex-shrink-0 pt-0.5">
                                            {field.label}
                                        </span>
                                        <div className="text-right min-w-0">
                                            {formatValue(val, field.format)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    /* Fallback: show all keys as card */
                    <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                        <div className="divide-y divide-[#F3F4F6]">
                            {currentData && typeof currentData === 'object' && Object.entries(currentData)
                                .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
                                .map(([key, val], idx) => (
                                    <div key={idx} className="flex items-start justify-between px-4 py-3 gap-4 hover:bg-[#FAFAFA] transition-colors">
                                        <span className="text-[12px] text-[#6B7280] whitespace-nowrap flex-shrink-0 pt-0.5">
                                            {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().replace(/^\w/, c => c.toUpperCase())}
                                        </span>
                                        <div className="text-right min-w-0">
                                            {formatValue(val)}
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                )}

                {/* Show nested objects below the card if present */}
                {currentData && typeof currentData === 'object' && !currentTabConfig?.textKey && (
                    <div className="mt-4 space-y-3">
                        {Object.entries(currentData)
                            .filter(([key, val]) => val !== null && typeof val === 'object' && !Array.isArray(val) && key !== 'cross_item_signals')
                            .map(([key, val]) => (
                                <NestedObjectCard key={key} title={key} data={val} />
                            ))
                        }
                        {Object.entries(currentData)
                            .filter(([, val]) => Array.isArray(val) && val.length > 0)
                            .map(([key, val]) => (
                                <NestedArrayCard key={key} title={key} data={val} />
                            ))
                        }
                    </div>
                )}
            </div>
        </div>
    );
};

/* ── Nested object card (for sub-objects in data) ── */
const NestedObjectCard = ({ title, data }) => {
    const [isOpen, setIsOpen] = useState(false);
    if (!data || typeof data !== 'object') return null;
    const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object');
    if (entries.length === 0) return null;

    const displayTitle = title
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .trim()
        .replace(/^\w/, c => c.toUpperCase());

    return (
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#FAFAFA] transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Briefcase className="w-3 h-3 text-[#6B7280]" />
                    <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">{displayTitle}</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-[#9CA3AF] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="divide-y divide-[#F3F4F6]">
                    {entries.map(([key, val], idx) => (
                        <div key={idx} className="flex items-start justify-between px-4 py-2.5 gap-4">
                            <span className="text-[12px] text-[#6B7280] whitespace-nowrap flex-shrink-0">
                                {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().replace(/^\w/, c => c.toUpperCase())}
                            </span>
                            <span className="text-[12px] font-[500] text-[#171717] text-right break-all">{String(val)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

/* ── Nested array card (for arrays like je_lines) ── */
const NestedArrayCard = ({ title, data }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [row, setRow] = useState(0);
    if (!Array.isArray(data) || data.length === 0) return null;

    const displayTitle = title
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .trim()
        .replace(/^\w/, c => c.toUpperCase());

    const currentItem = data[row];
    const entries = currentItem && typeof currentItem === 'object'
        ? Object.entries(currentItem).filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
        : [];

    return (
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#FAFAFA] transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Database className="w-3 h-3 text-[#6B7280]" />
                    <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">{displayTitle}</span>
                    <span className="text-[10px] text-[#9CA3AF] bg-gray-50 px-1.5 py-0.5 rounded">{data.length} items</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-[#9CA3AF] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <>
                    {data.length > 1 && (
                        <div className="flex items-center justify-between px-4 py-2 border-t border-[#F3F4F6] bg-[#FAFAFA]">
                            <span className="text-[11px] text-[#6B7280] font-medium">Row {row + 1} of {data.length}</span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setRow(Math.max(0, row - 1))} disabled={row === 0}
                                    className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors">
                                    <ChevronLeft className="w-3.5 h-3.5 text-[#374151]" />
                                </button>
                                <button onClick={() => setRow(Math.min(data.length - 1, row + 1))} disabled={row === data.length - 1}
                                    className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors">
                                    <ChevronRight className="w-3.5 h-3.5 text-[#374151]" />
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="divide-y divide-[#F3F4F6]">
                        {entries.map(([key, val], idx) => (
                            <div key={idx} className="flex items-start justify-between px-4 py-2.5 gap-4">
                                <span className="text-[12px] text-[#6B7280] whitespace-nowrap flex-shrink-0">
                                    {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().replace(/^\w/, c => c.toUpperCase())}
                                </span>
                                <span className="text-[12px] font-[500] text-[#171717] text-right break-all">{String(val)}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default ArtifactDetailCard;
export { BLOCK_OPEX_PROCESS_ID };
