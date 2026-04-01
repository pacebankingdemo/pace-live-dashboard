import React from 'react';
import { pill, autoPill, mono, bold, usd, num, dim, trunc } from './processColumns';

/* ─────────────────────────────────────────────────────────────────
   Dynamic Column Builder
   
   Converts a JSON column schema (stored in processes.metadata.columns)
   into the same { id, header, align, render } objects the dashboard 
   already understands.
   
   Schema format (stored in DB):
   {
     "columns": [
       {
         "id": "pr_number",
         "header": "PR Number",
         "type": "bold",           // renderer type
         "path": "metadata.pr_number",  // dot-path into run/meta/artifacts
         "align": "left",          // optional, defaults to "left"
         "width": "120px"          // optional
       },
       ...
     ]
   }
   
   Supported types:
     "bold"     → bold(val)
     "mono"     → mono(val)
     "pill"     → autoPill(val)
     "usd"      → usd(val)
     "num"      → num(val)
     "dim"      → dim(val)
     "trunc"    → trunc(val)
     "text"     → plain text with font-500 (Ferring style)
     "status"   → the standard status renderer with colored square + spark icon
     "status_plain" → plain text status label (no icon)
───────────────────────────────────────────────────────────────── */

/* Resolve a dot-path like "metadata.pr_number" against the three data objects */
function resolvePath(path, run, meta, artifacts) {
    if (!path) return null;
    
    // Handle special prefixes
    if (path.startsWith('artifacts.')) {
        const rest = path.slice(10); // after "artifacts."
        const parts = rest.split('.');
        let val = artifacts;
        for (const p of parts) {
            if (val == null) return null;
            val = val[p];
        }
        return val;
    }
    
    if (path.startsWith('metadata.')) {
        const rest = path.slice(9);
        const parts = rest.split('.');
        let val = meta;
        for (const p of parts) {
            if (val == null) return null;
            val = val[p];
        }
        return val;
    }
    
    // Default: resolve against the run object
    const parts = path.split('.');
    let val = run;
    for (const p of parts) {
        if (val == null) return null;
        val = val[p];
    }
    return val;
}

/* Standard status renderer (spark icon + colored square + label) */
function renderStatus(r) {
    const statusMap = {
        needs_attention: { bg: '#FFDADA', border: '#A40000' },
        needs_review:    { bg: '#FCEDB9', border: '#ED6704' },
        void:            { bg: '#EBEBEB', border: '#8F8F8F' },
        in_progress:     { bg: '#EAF3FF', border: '#2546F5' },
        ready:           { bg: '#EAF3FF', border: '#2546F5' },
        done:            { bg: '#E2F1EB', border: '#038408' },
    };
    const sc = statusMap[r.status] || statusMap.in_progress;
    const label = r.status === 'done'
        ? r.current_status_text || r.name
        : r.status === 'needs_attention'
        ? `Needs Attention — ${r.current_status_text || r.name}`
        : r.status === 'needs_review'
        ? `Needs Review — ${r.current_status_text || r.name}`
        : r.current_status_text || r.name;
    return (
        <span className="flex items-center gap-2 max-w-[550px]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C4841D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
            </svg>
            <span style={{ width: 8, height: 8, borderRadius: 2, border: `1px solid ${sc.border}`, background: sc.bg, flexShrink: 0 }} />
            <span className="text-[#171717] font-[450] text-[12px] truncate">{label}</span>
        </span>
    );
}

/* Plain status label (no icon, no pill — Ferring style) */
function renderStatusPlain(r) {
    const label = r.status === 'done' ? 'Complete'
        : r.status === 'needs_review' ? 'Needs Review'
        : r.status === 'needs_attention' ? 'Needs Attention'
        : r.status === 'void' ? 'Void'
        : r.status === 'in_progress' ? 'In Progress'
        : r.status || '—';
    return <span className="text-[#171717] text-[12px] font-[500]">{label}</span>;
}

/* Renderer lookup */
const RENDERERS = {
    bold:         (val) => bold(val),
    mono:         (val) => mono(val),
    pill:         (val) => autoPill(val),
    usd:          (val) => usd(val),
    num:          (val) => num(val),
    dim:          (val) => dim(val),
    trunc:        (val) => trunc(val),
    text:         (val) => val 
        ? <span className="text-[#171717] text-[12px] font-[500]">{val}</span>
        : <span className="text-[#d1d5db]">—</span>,
    boolean:      (val) => {
        if (val === null || val === undefined || val === '') return <span className="text-[#d1d5db]">—</span>;
        const isTrue = val === true || val === 'true' || val === 1;
        return isTrue
            ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-[600] bg-[#FFDADA] text-[#A40000] border border-[#A40000]/20">Yes</span>
            : <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-[600] bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]">No</span>;
    },
};

/**
 * Convert a JSON column schema array into dashboard-ready column definitions.
 * @param {Array} columnDefs - Array of { id, header, type, path, align, width }
 * @returns {Array} - Array of { id, header, align, render(run, meta, artifacts) }
 */
export function buildColumnsFromSchema(columnDefs) {
    if (!Array.isArray(columnDefs) || columnDefs.length === 0) return null;
    
    return columnDefs.map((col) => {
        const base = {
            id: col.id,
            header: col.header || col.id,
            align: col.align || 'left',
        };
        
        // Special types that need the full run object
        if (col.type === 'status') {
            base.render = (r) => renderStatus(r);
            return base;
        }
        if (col.type === 'status_plain') {
            base.render = (r) => renderStatusPlain(r);
            return base;
        }
        
        // Standard types — resolve path, then apply renderer
        const renderer = RENDERERS[col.type] || RENDERERS.text;
        base.render = (r, m, art) => {
            const val = resolvePath(col.path, r, m, art);
            return renderer(val);
        };
        
        return base;
    });
}
