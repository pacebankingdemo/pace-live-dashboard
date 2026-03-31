import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
    Check, Activity, FileText, Clock, ExternalLink, Loader2, X,
    Database, Presentation, ChevronDown, ChevronUp,
    Download, Briefcase,
    Eye, Image, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight,
    Play, Hash, ToggleLeft, Calendar, Type, ArrowUpDown
} from 'lucide-react';
import { fetchLogs, fetchArtifacts, fetchBrowserRecordings, subscribeToTable } from '../services/supabase';

// Processes that use the structured DXC sidebar — suppress generic Case Details block for these
const DXC_PROCESS_IDS = new Set([
    'c4e944f7-1133-4961-a8c3-2378ca591857', // P1 — Prepaid Data Ingestion
    'c9846f46-ff57-4cc8-9f71-addf4185aeb5', // P2 — Prepaid Expense Booking
]);
import { supabase } from '../services/supabase';
import VideoPlayer from './VideoPlayer';
import HitlDecisionPanel from './HitlDecisionPanel';
import EmailDraftViewer from './EmailDraftViewer';

/* ─── Helpers: classify metadata fields ─── */
const REASONING_KEYS = new Set([
    'confidence', 'match_score', 'score', 'status', 'result',
    'reason', 'note', 'validation', 'match_result', 'flag',
    'accuracy', 'threshold', 'decision', 'outcome', 'verdict',
    'similarity', 'match_type', 'method', 'model', 'duration_ms',
    'document_type', 'action', 'completeness', 'quality_score',
    'match_found', 'search_method', 'recommendation', 'action_id',
    'decision_by', 'final_status', 'match_verdict', 'line_items_total'
]);

const SKIP_KEYS = new Set([
    'step_name', 'reasoning_steps', 'dataset_name',
    'artifact_url', 'artifact_name', 'artifact_id', 'email_draft',
    // OPEX noise keys — routing/control fields, not display-worthy
    'routing', 'capitalize', 'enriched', 'pdf_available', 'file_count',
    'g17_valid', 'je_line_count', 'clearing_account',
]);

/* Fields we want to surface in Case Details sidebar */
const CASE_DETAIL_KEYS = new Set([
    'vendor', 'vendor_name', 'invoice_number', 'invoice_no',
    'po_number', 'total', 'currency',
    'match_verdict', 'quality_score',
    'document_type', 'invoice_date', 'po_date', 'department',
    'linkages', 'decision_by', 'recommendation',
    // Sanction screening keys (snake_case normalized from actual data)
    'originator', 'beneficiary', 'beneficiary_name', 'sender', 'amount',
    'screening_outcome', 'risk_level', 'payment_channel', 'payment_route',
    // Alert ingestion / disposition keys
    'alert_id', 'source_system', 'trigger_type', 'screening_type',
    'disposition', 'referral_id', 'sar_required', 'account_action',
    'priority', 'customer_name', 'kyc_status', 'risk_rating',
    'ubo_sanctions_status', 'ultimate_beneficial_owner',
    'confidence', 'value_date', 'screening_party',
    // Chubb FI D&O Submission Intake keys
    'case_id', 'named_insured', 'ticker', 'institution_type',
    'total_assets', 'broker', 'underwriter', 'line',
    'transaction_type', 'effective_date', 'prior_policy',
    'documents_received', 'regulatory_flag', 'prior_do_claim',
    'triage_decision', 'premium_indication', 'pace_processing_time',
    // Block OPEX Review keys
    'txn_number', 'workflow_type', 'invoice_amount', 'gl_account',
    'vendor', 'vendor_name', 'cost_center', 'entity',
    'classification', 'reclassification_type', 'useful_life',
    'asset_category', 'prepaid_months', 'amortization_start',
    'g8_filter', 'accap_eligible', 'po_number', 'invoice_date',
    'journal_entry', 'approver', 'classification_rationale',
    // DXC Delta Sync keys
    'current_status', 'date', 'start_date', 'end_date',
    'erp_records_found', 'erp_records_processed', 'erp_invoices_extracted',
    // DXC Contract Setup keys
    'contract_id', 'client_id', 'client_legal_name',
    'region', 'contract_status',
]);

function isLargeData(value) {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 2;
    if (typeof value === 'object') {
        const keys = Object.keys(value);
        if (keys.length >= 4) return true;
        return keys.some(k => {
            const v = value[k];
            return (typeof v === 'object' && v !== null && Object.keys(v).length >= 2);
        });
    }
    if (typeof value === 'string') return value.length > 300;
    return false;
}


/* --- Split long log messages into summary + detail --- */
function splitLogMessage(message) {
    if (!message || typeof message !== 'string') return { summary: message || '', detail: '' };
    // If short enough, no split needed
    if (message.length <= 140) return { summary: message, detail: '' };
    // Try to split at first sentence boundary (period followed by space + capital letter)
    const sentenceMatch = message.match(/^([^.]+\.\s?)(.+)/s);
    if (sentenceMatch && sentenceMatch[1].length >= 20 && sentenceMatch[1].length <= 200) {
        return { summary: sentenceMatch[1].trim(), detail: sentenceMatch[2].trim() };
    }
    // Fallback: truncate at ~120 chars on word boundary
    const truncAt = message.lastIndexOf(' ', 120);
    if (truncAt > 40) {
        return { summary: message.slice(0, truncAt) + '...', detail: message };
    }
    return { summary: message.slice(0, 120) + '...', detail: message };
}

/* --- Artifact-to-Dataset schema transformers ---
 * When an artifact_url JSON is fetched, transform it to match the canonical
 * dataset schema so the DatasetViewer renders it identically to the Datasets tab.
 */
const ARTIFACT_TRANSFORMERS = {
    // FA Classification artifact -> Classifications dataset schema
    'FA Classification': (raw) => ({
        transaction_number: raw.transaction_number,
        party_name: raw.vendor,
        net_amount: raw.amount,
        decision: raw.capitalize ? 'capitalize' : 'no_action',
        confidence: raw.confidence,
        asset_category: raw.category,
        reason: raw.category,
        reasoning: raw.reasoning,
        is_laptop: raw.is_laptop,
        is_cip: raw.is_cip,
        cip_asset_number: raw.cip_asset_number,
    }),
    // JE Build artifact -> Journal Entries dataset schema (array of je_lines)
    'JE Build': (raw) => {
        if (!raw.je_lines || !Array.isArray(raw.je_lines)) return raw;
        return raw.je_lines.map(line => ({
            JE_NAME: line.je_name,
            JE_CATEGORY: line.je_type,
            ACCOUNT: line.account,
            CODE_COMBINATION: line.coa_string,
            ENTERED_DR: line.debit,
            ENTERED_CR: line.credit,
            PARTY_NAME: line.party_name,
            COMPANY: line.entity,
            DESCRIPTION: line.description,
            REVERSING: line.reversing,
            REVERSAL_DATE: line.reversal_date,
            ITEM_ID: line.item_id,
        }));
    },
    // Enrichment Data -> structured flat view matching PO Data / Invoice PDF Extractions
    'Enrichment Data': (raw) => ({
        transaction_number: raw.transaction_number,
        party_name: raw.vendor,
        net_amount: raw.amount,
        po_number: raw.po_number,
        po_description: raw.po_description,
        invoice_pdf_available: raw.invoice_pdf_available,
    }),
};

function transformArtifactData(stepName, rawData) {
    const transformer = ARTIFACT_TRANSFORMERS[stepName];
    if (transformer) return transformer(rawData);
    // No transformer — return raw data as-is (DatasetViewer handles flat objects fine)
    return rawData;
}

function classifyMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') return { reasoning: {}, dataArtifacts: [], narrative: null };

    const reasoning = {};
    const dataArtifacts = [];
    let narrative = null;
    // Use dataset_name or step_name as the artifact label instead of the raw key
    const preferredLabel = metadata.dataset_name || metadata.step_name || null;

    // Handle explicit artifacts array — pass through directly (SharePoint, Excel, etc.)
    if (Array.isArray(metadata.artifacts)) {
        metadata.artifacts.forEach((art, i) => {
            dataArtifacts.push({
                id: art.id || `meta-artifact-${i}`,
                filename: art.filename || art.name || 'Artifact',
                file_type: art.file_type || 'file',
                url: art.url || null,
                description: art.description || null,
                _isMetaArtifact: true,
                _isExplicit: true,
            });
        });
    }

    // Handle artifact_url + artifact_name pattern (Gen-2 Block OPEX logs)
    // e.g. { artifact_url: "https://...storage.../K32388450103_classification.json", artifact_name: "K32388450103_classification.json" }
    if (metadata.artifact_url) {
        const fname = metadata.artifact_name || metadata.artifact_url.split('/').pop() || 'Artifact';
        const artId = metadata.artifact_id || `url-artifact-${fname}`;
        dataArtifacts.push({
            id: artId,
            filename: fname,
            file_type: fname.endsWith('.json') ? 'application/json' : 'file',
            url: metadata.artifact_url,
            _isMetaArtifact: true,
            _isExplicit: true,
            _stepName: metadata.step_name || null,
        });
    }

    // Handle email_draft metadata → produces a clickable pill that opens EmailDraftViewer
    if (metadata.email_draft && typeof metadata.email_draft === 'object') {
        const ed = metadata.email_draft;
        dataArtifacts.push({
            id: `email-draft-${Math.random().toString(36).slice(2, 8)}`,
            filename: ed.pill_label || (ed.mode === 'draft' ? 'Email Draft' : 'Email Received'),
            file_type: 'email',
            _isMetaArtifact: true,
            _isEmailDraft: true,
            _emailDraft: {
                to: ed.to || '',
                cc: ed.cc || '',
                subject: ed.subject || '',
                body: ed.body || '',
                from: ed.from || 'pace@ferring.com',
                display_name: ed.pill_label || (ed.mode === 'draft' ? 'Email Draft' : 'Email Received'),
                mode: ed.mode || 'received',
            },
        });
    }

    Object.entries(metadata).forEach(([key, value]) => {
        if (SKIP_KEYS.has(key)) return;
        if (key === 'artifacts' || key === 'email_draft') return; // already handled above

        // 'reasoning' and 'error' strings are narrative explanations — surface them
        // as the step's primary text, not as collapsed kv pairs
        if ((key === 'reasoning' || key === 'error') && typeof value === 'string' && value.length > 0) {
            narrative = value;
            return;
        }

        if (isLargeData(value)) {
            const fallbackLabel = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
            const label = preferredLabel || (fallbackLabel.charAt(0).toUpperCase() + fallbackLabel.slice(1));
            dataArtifacts.push({
                id: `meta-${key}-${Math.random().toString(36).slice(2, 8)}`,
                filename: label,
                file_type: 'json',
                content: value,
                _isMetaArtifact: true,
            });
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            Object.entries(value).forEach(([subKey, subVal]) => {
                const flatKey = `${key}.${subKey}`;
                if (typeof subVal !== 'object' || subVal === null) {
                    reasoning[flatKey] = subVal;
                }
            });
        } else {
            reasoning[key] = value;
        }
    });

    return { reasoning, dataArtifacts, narrative };
}

/* Normalize a key to snake_case for matching against CASE_DETAIL_KEYS */
function normalizeKey(key) {
    return String(key).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/* Extract case details from all logs */
function extractCaseDetails(logs) {
    const details = {};
    // Process logs in order so later steps overwrite earlier ones (more complete data)
    logs.forEach(log => {
        if (!log.metadata) return;

        // Scan both the top-level metadata AND the nested metadata.data object.
        // NatWest artifact logs store all case fields inside metadata.data{} with
        // Title Case keys (e.g. "Alert ID", "Risk Level"). We normalize to snake_case
        // before matching against CASE_DETAIL_KEYS.
        const sources = [log.metadata];
        if (
            log.metadata.data &&
            typeof log.metadata.data === 'object' &&
            !Array.isArray(log.metadata.data)
        ) {
            sources.push(log.metadata.data);
        }

        sources.forEach(source => {
            Object.entries(source).forEach(([key, value]) => {
                const normalizedKey = normalizeKey(key);
                if (CASE_DETAIL_KEYS.has(normalizedKey) && value !== null && value !== undefined) {
                    // Only take simple displayable values
                    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                        details[normalizedKey] = value;
                    } else if (typeof value === 'object' && !Array.isArray(value)) {
                        // For small objects like linkages, flatten to a readable string
                        const parts = Object.entries(value)
                            .filter(([, v]) => v !== null)
                            .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
                        if (parts.length > 0 && parts.length <= 3) {
                            details[normalizedKey] = parts.join(', ');
                        }
                    }
                }
            });
        });
    });
    return details;
}

/* Format field key for display */
const formatFieldKey = (key) => {
    const display = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/\./g, ' > ')
        .trim();
    return display.charAt(0).toUpperCase() + display.slice(1);
};

/* ─── CollapsibleReasoning ─── */
const CollapsibleReasoning = ({ reasoning, messageDetail, reasoningSteps, summaryText }) => {
    const [isOpen, setIsOpen] = useState(false);
    const entries = Object.entries(reasoning || {});
    const hasSteps = Array.isArray(reasoningSteps) && reasoningSteps.length > 0;
    if (entries.length === 0 && !messageDetail && !hasSteps) return null;

    const formatValue = (val) => {
        if (val === true) return 'Yes';
        if (val === false) return 'No';
        if (val === null || val === undefined) return '\u2014';
        return String(val);
    };

    /* Collect all displayable lines into a flat array for the tree connector */
    const lines = [];
    if (summaryText) {
        lines.push({ type: 'narrative', text: summaryText.replace(/^[•·\-*]\s*/, '') });
    }
    if (messageDetail) {
        lines.push({ type: 'narrative', text: messageDetail });
    }
    entries.forEach(([key, val]) => {
        lines.push({ type: 'kv', label: formatFieldKey(key), value: formatValue(val) });
    });
    if (hasSteps) {
        reasoningSteps.forEach((step) => {
            lines.push({ type: 'step', text: step });
        });
    }

    return (
        <div className="mt-2.5">
            <div className="border border-[#E5E7EB] rounded-lg overflow-hidden" style={{ width: "min(50vw, 480px)" }}>
                {/* Toggle row — compact width, grey */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 text-[12px] text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
                >
                    <span className="font-medium">{isOpen ? 'Hide reasoning' : 'See reasoning'}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {/* Expanded content with tree-branch connectors */}
                {isOpen && (
                    <div className="px-3 pb-3 pt-0.5">
                        <div className="space-y-0">
                            {lines.map((line, idx) => {
                                const isLast = idx === lines.length - 1;
                                return (
                                    <div key={idx} className="flex items-start gap-2 min-h-[24px]">
                                        {/* Tree connector — L-shaped elbow for every item */}
                                        <div className="flex flex-col items-center w-4 flex-shrink-0">
                                            <svg width="16" height="24" viewBox="0 0 16 24" fill="none" className="flex-shrink-0">
                                                {/* vertical line from top to midpoint */}
                                                <line x1="4" y1="0" x2="4" y2="12" stroke="#D1D5DB" strokeWidth="1.5" />
                                                {/* horizontal line to right */}
                                                <line x1="4" y1="12" x2="16" y2="12" stroke="#D1D5DB" strokeWidth="1.5" />
                                            </svg>
                                        </div>
                                        {/* Content */}
                                        <div className="flex-1 py-0.5">
                                            {line.type === 'narrative' && (
                                                <p className="text-[12px] text-[#555] leading-relaxed whitespace-pre-wrap">{line.text}</p>
                                            )}
                                            {line.type === 'kv' && (
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-[12px] text-[#6B7280] flex-shrink-0">{line.label}:</span>
                                                    <span className="text-[12px] text-[#171717] font-medium break-all">{line.value}</span>
                                                </div>
                                            )}
                                            {line.type === 'step' && (
                                                <span className="text-[12px] text-[#555]">{line.text}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ─── Document type detection ─── */
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'tif', 'gif', 'bmp', 'webp', 'svg']);
const DOCUMENT_MIMETYPES = new Set([
    'application/pdf', 'image/png', 'image/jpeg', 'image/tiff',
    'image/gif', 'image/bmp', 'image/webp', 'image/svg+xml',
]);

function isDocumentFile(artifact) {
    if (!artifact) return false;
    // Check file extension
    const ext = (artifact.file_type || artifact.filename || '').split('.').pop().toLowerCase();
    if (DOCUMENT_EXTENSIONS.has(ext)) return true;
    // Check metadata file_type (MIME)
    const mime = artifact.metadata?.file_type || '';
    if (DOCUMENT_MIMETYPES.has(mime)) return true;
    // Check if artifact has a URL and extension in filename
    if (artifact.url && artifact.filename) {
        const fnExt = artifact.filename.split('.').pop().toLowerCase();
        if (DOCUMENT_EXTENSIONS.has(fnExt)) return true;
    }
    return false;
}

function getDocumentType(artifact) {
    const fname = artifact?.filename || '';
    const ext = fname.split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'tif'].includes(ext)) return 'image';
    return 'unknown';
}
function isEmailFile(artifact) {
    if (!artifact) return false;
    const fname = artifact.filename || '';
    if (fname.toLowerCase().endsWith('.eml')) return true;
    if (artifact.file_type === 'message/rfc822') return true;
    return false;
}

function parseEmailContent(artifact) {
    // Email fields stored as JSON in artifact.content
    if (!artifact) return {};
    try {
        if (artifact.content && typeof artifact.content === 'string' && artifact.content.trim().startsWith('{')) {
            return JSON.parse(artifact.content);
        }
    } catch (e) {}
    return {};
}

/* ─── Gmail icon (real M logo colors) ─── */
const GmailIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
        <path d="M2 6.5C2 5.4 2.9 4.5 4 4.5H20C21.1 4.5 22 5.4 22 6.5V17.5C22 18.6 21.1 19.5 20 19.5H4C2.9 19.5 2 18.6 2 17.5V6.5Z" fill="white"/>
        <path d="M2 6.5L12 13.5L22 6.5" fill="none" stroke="#EA4335" strokeWidth="1.5"/>
        <path d="M2 6.5L8 12" fill="none" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M22 6.5L16 12" fill="none" stroke="#34A853" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M2 17.5L8 12" fill="none" stroke="#FBBC05" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M22 17.5L16 12" fill="none" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round"/>
        <rect x="2" y="4.5" width="20" height="15" rx="2" fill="none" stroke="#DADCE0" strokeWidth="1"/>
    </svg>
);

const EmailArtifactPill = ({ artifact, onClick }) => {
    const email = parseEmailContent(artifact);
    const displayName = email.display_name || artifact.filename?.replace(/\.eml$/i, '') || 'Email';
    return (
        <button
            onClick={() => onClick && onClick(artifact)}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#F3F4F6] hover:bg-[#E5E7EB] border border-[#E5E7EB] transition-colors text-[#374151] text-[12px] font-medium"
            style={{maxWidth: '360px'}}
        >
            <GmailIcon />
            <span className="truncate">{displayName}</span>
        </button>
    );
};

/* ─── EmailViewer modal ─── */
const EmailViewer = ({ artifact, onClose }) => {
    if (!artifact) return null;
    const email = parseEmailContent(artifact);
    const displayName = email.display_name || artifact.filename?.replace(/\.eml$/i, '') || 'Email';
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
                    <div className="flex items-center gap-2.5">
                        <GmailIcon />
                        <span className="text-[14px] font-semibold text-[#171717]">{displayName}</span>
                    </div>
                    <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#374151] text-xl font-light leading-none w-6 h-6 flex items-center justify-center">×</button>
                </div>
                {/* Fields */}
                <div className="px-5 py-3 space-y-1.5 bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    {email.from && <div className="flex gap-3 text-[12px]"><span className="text-[#6B7280] w-14 flex-shrink-0 font-medium">From</span><span className="text-[#171717]">{email.from}</span></div>}
                    {email.to && <div className="flex gap-3 text-[12px]"><span className="text-[#6B7280] w-14 flex-shrink-0 font-medium">To</span><span className="text-[#171717]">{email.to}</span></div>}
                    {email.cc && <div className="flex gap-3 text-[12px]"><span className="text-[#6B7280] w-14 flex-shrink-0 font-medium">CC</span><span className="text-[#171717]">{email.cc}</span></div>}
                    {email.date && <div className="flex gap-3 text-[12px]"><span className="text-[#6B7280] w-14 flex-shrink-0 font-medium">Date</span><span className="text-[#171717]">{email.date}</span></div>}
                    {email.subject && <div className="flex gap-3 text-[12px]"><span className="text-[#6B7280] w-14 flex-shrink-0 font-medium">Subject</span><span className="text-[#171717] font-semibold">{email.subject}</span></div>}
                </div>
                {/* Body */}
                <div className="px-5 py-4 max-h-80 overflow-y-auto custom-scrollbar">
                    <pre className="text-[12px] text-[#374151] whitespace-pre-wrap font-sans leading-relaxed">{email.body || '(No body)'}</pre>
                </div>
            </div>
        </div>
    );
};



/* ─── DocumentPreview ─── */
const DocumentPreview = ({ artifact, onClose }) => {
    const [zoom, setZoom] = useState(100);
    const [rotation, setRotation] = useState(0);
    const docType = getDocumentType(artifact);
    const fileUrl = artifact?.url || artifact?.file_url || '';
    const fileName = artifact?.filename || 'Document';
    const fileSize = artifact?.metadata?.file_size_bytes || artifact?.file_size_bytes;

    const formatSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1048576).toFixed(1)} MB`;
    };

    const handleDownload = () => {
        if (fileUrl) {
            const a = document.createElement('a');
            a.href = fileUrl;
            a.download = fileName;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white flex-1 min-w-[400px] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white z-10 w-full">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 bg-red-50 rounded">
                        {docType === 'pdf'
                            ? <FileText className="w-4 h-4 text-red-500" strokeWidth={1.5} />
                            : <Image className="w-4 h-4 text-blue-500" strokeWidth={1.5} />
                        }
                    </div>
                    <div className="min-w-0">
                        <span className="text-[14px] font-medium text-[#171717] truncate block">{fileName}</span>
                        {fileSize && (
                            <span className="text-[11px] text-[#9CA3AF]">{formatSize(fileSize)}</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={handleDownload} title="Download"
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors">
                        <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => fileUrl && window.open(fileUrl, '_blank')} title="Open in new tab"
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors">
                        <ExternalLink className="w-4 h-4" />
                    </button>
                    <button onClick={onClose} title="Close"
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Toolbar for zoom/rotate (images) */}
            {docType === 'image' && (
                <div className="flex items-center justify-center gap-2 px-4 py-2 border-b border-gray-100 bg-[#fafafa]">
                    <button onClick={() => setZoom(z => Math.max(25, z - 25))}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500"><ZoomOut className="w-4 h-4" /></button>
                    <span className="text-[11px] text-gray-500 w-12 text-center">{zoom}%</span>
                    <button onClick={() => setZoom(z => Math.min(300, z + 25))}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500"><ZoomIn className="w-4 h-4" /></button>
                    <div className="w-px h-4 bg-gray-200 mx-1" />
                    <button onClick={() => setRotation(r => (r + 90) % 360)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500"><RotateCw className="w-4 h-4" /></button>
                    <button onClick={() => setZoom(100)}
                        className="px-2 py-0.5 text-[10px] text-gray-500 hover:bg-gray-200 rounded">Reset</button>
                </div>
            )}

            {/* Document content */}
            <div className="flex-1 overflow-auto bg-[#f5f5f5]">
                {docType === 'pdf' && fileUrl ? (
                    <iframe
                        src={`${fileUrl}#toolbar=1&navpanes=0`}
                        className="w-full h-full border-0"
                        title={fileName}
                        style={{ minHeight: '100%' }}
                    />
                ) : docType === 'image' && fileUrl ? (
                    <div className="flex items-center justify-center p-4 min-h-full">
                        <img
                            src={fileUrl}
                            alt={fileName}
                            style={{
                                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                                transition: 'transform 0.2s ease',
                                maxWidth: zoom <= 100 ? '100%' : 'none',
                            }}
                            className="shadow-lg rounded"
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                        <FileText className="w-12 h-12" strokeWidth={1} />
                        <p className="text-sm">Preview not available</p>
                        <button onClick={handleDownload}
                            className="px-3 py-1.5 bg-black text-white text-xs rounded-md hover:bg-gray-800 transition-colors">
                            Download File
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ─── DatasetViewer ─── */
/* ─── DatasetViewer (enhanced: tabs + row navigation) ─── */
const DatasetViewer = ({ artifact, onClose, allDataArtifacts, onSelectTab }) => {

    // Infer a type label from a JS value (matches DataExplorer type icons)
    const inferType = (v) => {
        if (v === null || v === undefined) return 'string';
        if (typeof v === 'boolean') return 'boolean';
        if (typeof v === 'number') return 'number';
        if (Array.isArray(v)) return 'json';
        if (typeof v === 'object') return 'json';
        const s = String(v);
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return 'date';
        if (/^\$[\d,.]+/.test(s) || /^-?\d[\d,]*\.\d{2}$/.test(s)) return 'number';
        if (/^(true|false)$/i.test(s)) return 'boolean';
        return 'string';
    };

    const parsedData = useMemo(() => {
        if (!artifact) return {};
        if (artifact._loading) return {};
        let raw = artifact.content || artifact.data;
        if (typeof raw === 'string') {
            try { raw = JSON.parse(raw); } catch { return { raw_content: raw }; }
        }
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'object' && raw !== null) return raw;
        return { value: String(raw) };
    }, [artifact]);

    const isTableData = Array.isArray(parsedData);

    // Always normalise to an array of row objects
    const rowData = useMemo(() => {
        if (isTableData) return parsedData;
        return [parsedData];
    }, [parsedData, isTableData]);

    // Row navigation state
    const [currentRow, setCurrentRow] = useState(0);
    // Reset row when artifact changes
    useEffect(() => { setCurrentRow(0); }, [artifact?.id]);

    // Build schema fields from union of all keys (matches DataExplorer)
    const fields = useMemo(() => {
        const keySet = new Set();
        rowData.forEach(row => {
            if (row && typeof row === 'object') Object.keys(row).forEach(k => keySet.add(k));
        });
        return Array.from(keySet).map(k => {
            const sample = rowData.find(r => r[k] !== null && r[k] !== undefined)?.[k];
            return { name: k, type: inferType(sample) };
        });
    }, [rowData]);

    // Format cell values identically to DataExplorer
    const formatCell = (value, type) => {
        if (value === null || value === undefined) return <span className="text-gray-300">\u2014</span>;
        if (type === 'json' || typeof value === 'object') {
            return <span className="font-mono text-[10px] text-gray-500">{JSON.stringify(value).slice(0, 80)}</span>;
        }
        if (type === 'number') return <span className="font-mono">{value}</span>;
        if (type === 'boolean') return value ? '\u2713' : '\u2717';
        if (type === 'date') {
            try { return new Date(value).toLocaleDateString(); } catch { return String(value); }
        }
        const s = String(value);
        return s.length > 120 ? s.slice(0, 117) + '...' : s;
    };

    // Type icon helper (same as DataExplorer)
    const typeIcon = (type) => {
        switch (type) {
            case 'number': return <Hash className="w-3 h-3" />;
            case 'boolean': return <ToggleLeft className="w-3 h-3" />;
            case 'date': return <Calendar className="w-3 h-3" />;
            case 'json': return <Database className="w-3 h-3" />;
            default: return <Type className="w-3 h-3" />;
        }
    };

    const [sortField, setSortField] = useState(null);
    const [sortAsc, setSortAsc] = useState(true);
    const handleSort = (fieldName) => {
        if (sortField === fieldName) setSortAsc(!sortAsc);
        else { setSortField(fieldName); setSortAsc(true); }
    };
    const sortedRows = useMemo(() => {
        if (!sortField) return rowData;
        return [...rowData].sort((a, b) => {
            const va = a?.[sortField] ?? '';
            const vb = b?.[sortField] ?? '';
            const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
            return sortAsc ? cmp : -cmp;
        });
    }, [rowData, sortField, sortAsc]);

    // Determine view mode: vertical key-value for single rows, table for multiple
    const useVerticalView = rowData.length <= 1;
    const currentRowData = sortedRows[currentRow] || {};

    // Tabs from allDataArtifacts
    const hasTabs = Array.isArray(allDataArtifacts) && allDataArtifacts.length > 1;
    const activeTabId = artifact?.id;

    return (
        <div className="flex flex-col h-full bg-white flex-1 min-w-[340px] overflow-hidden">
            {/* Tabs row — only if multiple data artifacts */}
            {hasTabs && (
                <div className="flex items-center gap-0 border-b border-gray-100 bg-[#FAFAFA] overflow-x-auto flex-shrink-0">
                    {allDataArtifacts.map(da => (
                        <button
                            key={da.id}
                            onClick={() => onSelectTab && onSelectTab(da)}
                            className={`px-4 py-2.5 text-[12px] font-medium whitespace-nowrap border-b-2 transition-colors ${
                                da.id === activeTabId
                                    ? 'border-[#171717] text-[#171717] bg-white'
                                    : 'border-transparent text-[#9CA3AF] hover:text-[#6B7280] hover:bg-gray-50'
                            }`}
                        >
                            {da._stepName || da.filename || 'Data'}
                        </button>
                    ))}
                </div>
            )}

            {/* Header — matches DataExplorer exactly */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white z-10 w-full">
                <div className="flex items-center gap-3">
                    <Database className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-900">
                        {artifact?._stepName || artifact?.filename || 'Artifact Data'}
                    </span>
                    <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                        {rowData.length} {rowData.length === 1 ? 'row' : 'rows'} \u00b7 {fields.length} fields
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    {/* Row navigation for multi-row data */}
                    {rowData.length > 1 && useVerticalView && (
                        <div className="flex items-center gap-1 mr-2">
                            <button
                                onClick={() => setCurrentRow(r => Math.max(0, r - 1))}
                                disabled={currentRow === 0}
                                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[11px] text-[#6B7280] font-medium tabular-nums min-w-[60px] text-center">
                                ROW {currentRow + 1} / {rowData.length}
                            </span>
                            <button
                                onClick={() => setCurrentRow(r => Math.min(rowData.length - 1, r + 1))}
                                disabled={currentRow >= rowData.length - 1}
                                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
            </div>

            {/* Data content */}
            <div className="flex-1 overflow-auto bg-white custom-scrollbar min-h-0">
                {artifact?._loading ? (
                    <div className="flex items-center justify-center h-full gap-2 text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-[12px]">Loading data\u2026</span>
                    </div>
                ) : useVerticalView ? (
                    /* ── Vertical key-value view (single row / row-by-row navigation) ── */
                    <div className="divide-y divide-gray-50">
                        {fields.map(f => {
                            const val = currentRowData[f.name];
                            return (
                                <div key={f.name} className="flex items-start gap-4 px-4 py-3 hover:bg-gray-50/50 transition-colors">
                                    <div className="flex items-center gap-1.5 min-w-[140px] max-w-[180px] flex-shrink-0">
                                        <span className="text-[#9CA3AF]">{typeIcon(f.type)}</span>
                                        <span className="text-[12px] text-[#6B7280] font-medium truncate">{f.name}</span>
                                    </div>
                                    <div className="flex-1 text-[12px] text-[#171717] font-[500] break-words">
                                        {formatCell(val, f.type)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* ── Horizontal table view (multiple rows) ── */
                    <div className="w-full h-full overflow-auto">
                        <table className="min-w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-white z-10">
                                <tr className="border-b border-gray-100">
                                    {fields.map(f => (
                                        <th key={f.name}
                                            onClick={() => handleSort(f.name)}
                                            className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-gray-600 select-none">
                                            <span className="flex items-center gap-1">
                                                {typeIcon(f.type)}
                                                {f.name}
                                                <ArrowUpDown className={`w-2.5 h-2.5 ${sortField === f.name ? 'text-gray-600' : 'text-gray-300'}`} />
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedRows.map((row, i) => (
                                    <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                                        {fields.map(f => (
                                            <td key={f.name} className="px-3 py-2 text-[11px] text-gray-700 max-w-[200px] truncate">
                                                {formatCell(row?.[f.name], f.type)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ─── ProcessDetails ─── */
const ProcessDetails = () => {
    const { runId } = useParams();
    const [logs, setLogs] = useState([]);
    const [artifacts, setArtifacts] = useState([]);
    const [run, setRun] = useState(null);
    const [recordings, setRecordings] = useState([]);
    const [selectedArtifact, setSelectedArtifact] = useState(null);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [artifactWidth, setArtifactWidth] = useState(550);
    const [isResizing, setIsResizing] = useState(false);
    const logsEndRef = useRef(null);

    // Three-panel mode state
    const [selectedDocument, setSelectedDocument] = useState(null);   // PDF for right panel
    const [dataArtifactTabs, setDataArtifactTabs] = useState([]);     // all data artifacts for tabs

    useEffect(() => {
        if (!runId) return;
        const loadRun = async () => {
            const { data } = await supabase.from('activity_runs').select('*').eq('id', runId).single();
            if (data) setRun(data);
        };
        loadRun();
        const loadLogs = async () => {
            try { setLogs(await fetchLogs(runId)); } catch (err) { console.error(err); }
        };
        loadLogs();
        const loadArtifacts = async () => {
            try { setArtifacts(await fetchArtifacts(runId)); } catch (err) { console.error(err); }
        };
        loadArtifacts();
        const loadRecordings = async () => {
            try { setRecordings(await fetchBrowserRecordings(runId)); } catch (err) { console.error(err); }
        };
        loadRecordings();
        const unsubLogs = subscribeToTable('activity_logs', `run_id=eq.${runId}`, () => loadLogs());
        const unsubArtifacts = subscribeToTable('artifacts', `run_id=eq.${runId}`, () => loadArtifacts());
        const unsubRun = subscribeToTable('activity_runs', `id=eq.${runId}`, () => loadRun());
        const unsubRecordings = subscribeToTable('browser_recordings', `run_id=eq.${runId}`, () => loadRecordings());
        return () => { unsubLogs(); unsubArtifacts(); unsubRun(); unsubRecordings(); };
    }, [runId]);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    useEffect(() => {
        if (!isResizing) return;
        const handleMouseMove = (e) => {
            const newWidth = window.innerWidth - e.clientX;
            setArtifactWidth(Math.max(400, Math.min(newWidth, window.innerWidth - 400)));
        };
        const handleMouseUp = () => setIsResizing(false);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }, [isResizing]);

    const logMetaClassified = useMemo(() => {
        const map = {};
        logs.forEach(log => {
            const result = classifyMetadata(log.metadata);
            map[log.id] = result;
        });
        return map;
    }, [logs]);

    const allArtifacts = useMemo(() => {
        const combined = [...artifacts];
        Object.values(logMetaClassified).forEach(({ dataArtifacts }) => {
            dataArtifacts.forEach(da => {
                if (!combined.some(a => a.id === da.id)) combined.push(da);
            });
        });
        return combined;
    }, [artifacts, logs, logMetaClassified]);

    // Extract case details from log metadata

    // Collect all PDF artifacts available in this run (for auto-detection)
    const pdfArtifacts = useMemo(() => {
        return allArtifacts.filter(a => isDocumentFile(a) && getDocumentType(a) === 'pdf');
    }, [allArtifacts]);

    // Collect all data artifacts (non-document, viewable) for tabs
    const allViewableDataArtifacts = useMemo(() => {
        return allArtifacts.filter(a => !isDocumentFile(a) && (a.content || a.data || a._isMetaArtifact || (a.url && (a.file_type === 'application/json' || a.file_type === 'json' || a.filename?.endsWith('.json')))));
    }, [allArtifacts]);

    // Three-panel mode is active when we have both a data artifact AND a document
    const threePanelActive = selectedArtifact && !selectedArtifact._isVideo && !selectedArtifact._isDocument && selectedDocument;


    const caseDetails = useMemo(() => extractCaseDetails(logs), [logs]);

    /* ─── Group logs by step_number so sub-steps render as one entry ─── */
    const groupedLogs = useMemo(() => {
        const groups = [];
        const stepMap = new Map(); // step_number -> group index

        logs.forEach((log) => {
            const stepNum = log.step_number;
            if (stepNum != null && stepMap.has(stepNum)) {
                // Add to existing group
                const group = groups[stepMap.get(stepNum)];
                group.logs.push(log);
                // Prefer non-artifact step_name as the group label (system/decision types)
                const sn = log.metadata?.step_name;
                if (sn && log.log_type !== 'artifact' && !group.stepName) {
                    group.stepName = sn;
                }
            } else {
                // New group
                const idx = groups.length;
                if (stepNum != null) stepMap.set(stepNum, idx);
                const sn = log.metadata?.step_name;
                // For the label, prefer non-artifact step_name
                const label = (log.log_type !== 'artifact' && sn) ? sn : null;
                groups.push({ stepName: label, logs: [log] });
            }
        });

        // Second pass: fill in any group that still has no stepName
        groups.forEach((group) => {
            if (!group.stepName) {
                for (const l of group.logs) {
                    const sn = l.metadata?.step_name;
                    if (sn) { group.stepName = sn; break; }
                }
            }
        });

        // Pre-compute which artifacts are already claimed by some log (via artifact_id / artifact_name)
        const claimedArtifactIds = new Set();
        groups.forEach(group => {
            group.logs.forEach(l => {
                if (l.log_type === 'artifact') {
                    if (l.metadata?.artifact_id) claimedArtifactIds.add(l.metadata.artifact_id);
                    if (l.metadata?.artifact_name) {
                        const matched = artifacts.find(a => a.filename === l.metadata.artifact_name);
                        if (matched) claimedArtifactIds.add(matched.id);
                    }
                    artifacts.forEach(a => {
                        if (l.message?.includes(a.filename)) claimedArtifactIds.add(a.id);
                    });
                }
            });
        });

        // Orphaned PDFs — artifacts in the DB that are not claimed by any artifact log
        const orphanedPdfs = artifacts.filter(
            a => (a.file_type === 'pdf' || a.filename?.toLowerCase().endsWith('.pdf')) && !claimedArtifactIds.has(a.id)
        );

        // Find the index of the group that handles document retrieval (step_name match)
        const DOC_RETRIEVAL_NAMES = new Set([
            'invoice pdf retrieval', 'po enrichment', 'document retrieval',
            'invoice retrieval', 'po retrieval', 'source document fetch',
        ]);
        const docGroupIdx = groups.findIndex(group =>
            group.logs.some(l => {
                const sn = (l.metadata?.step_name || '').toLowerCase();
                return DOC_RETRIEVAL_NAMES.has(sn);
            })
        );
        // Fallback: attach orphaned PDFs to first group if no retrieval step found
        const orphanTargetIdx = docGroupIdx >= 0 ? docGroupIdx : 0;

        // Enrich each group with combined artifacts, reasoning, recordings
        return groups.map((group, groupIdx) => {
            const firstLog = group.logs[0];
            const lastLog = group.logs[group.logs.length - 1];
            const stepNumbers = new Set(group.logs.map(l => l.step_number));

            // Collect all DB artifacts claimed by logs in this group (via artifact_id / name / message)
            const dbArts = artifacts.filter(a =>
                group.logs.some(l =>
                    l.log_type === 'artifact' && (
                        l.message?.includes(a.filename) ||
                        (l.metadata?.artifact_id && l.metadata.artifact_id === a.id) ||
                        (l.metadata?.artifact_name && l.metadata.artifact_name === a.filename)
                    )
                )
            );

            // Attach orphaned PDFs to the designated group
            if (groupIdx === orphanTargetIdx) {
                orphanedPdfs.forEach(a => {
                    if (!dbArts.some(x => x.id === a.id)) dbArts.push(a);
                });
            }

            // Collect all meta artifacts from classified metadata
            const metaArts = [];
            group.logs.forEach(l => {
                const classified = logMetaClassified[l.id];
                if (classified?.dataArtifacts) metaArts.push(...classified.dataArtifacts);
            });

            // Collect recordings for any step_number in the group
            const recs = recordings.filter(r => stepNumbers.has(r.step_number));

            // Merge reasoning + narratives from all logs
            const mergedReasoning = {};
            const allReasoningSteps = [];
            const allNarratives = [];
            group.logs.forEach(l => {
                const classified = logMetaClassified[l.id];
                if (classified?.reasoning) Object.assign(mergedReasoning, classified.reasoning);
                if (classified?.narrative) allNarratives.push(classified.narrative);
                const rs = l.metadata?.reasoning_steps;
                if (Array.isArray(rs)) allReasoningSteps.push(...rs);
            });

            // Collect non-artifact messages
            const messages = group.logs
                .filter(l => l.log_type !== 'artifact' && l.message)
                .map(l => l.message);

            // First message becomes the step title label; remaining go into msgSplit
            const remainingMessages = messages.slice(1);
            const combinedMessage = remainingMessages.join(' ');
            const msgSplit = splitLogMessage(combinedMessage);

            return {
                ...group,
                firstLog,
                lastLog,
                stepNumbers,
                dbArtifacts: dbArts,
                metaArtifacts: metaArts,
                recordings: recs,
                mergedReasoning,
                allReasoningSteps,
                allNarratives,
                messages,
                msgSplit,
            };
        });
    }, [logs, artifacts, recordings, logMetaClassified]);

    const formatTime = (ts) => {
        if (!ts) return '';
        return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };
    const formatDate = (ts) => {
        if (!ts) return '';
        return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    const getStepName = (log) => log.metadata?.step_name || `Step ${log.step_number}`;

    const getIconStatus = (log, index) => {
        if (log.log_type === 'error') return 'error';
        if (log.log_type === 'complete') return 'complete';
        const isLast = index === logs.length - 1;
        if (!isLast) return 'complete';
        if (!run) return 'in-progress';
        if (run.status === 'done') return 'complete';
        if (run.status === 'needs_attention' || run.status === 'needs_review') return 'error';
        return 'in-progress';
    };

    const isViewableArtifact = (art) => {
        if (art.content) return true;
        if (art._isMetaArtifact) return true;
        if (art.file_type === 'application/json' || art.file_type === 'json') return true;
        return false;
    };

    const getRecordingForLog = (log) => {
        return recordings.find(r => r.step_number === log.step_number) || null;
    };

    const handleArtifactClick = (art) => {
        // Email draft artifacts → open EmailDraftViewer in right panel
        if (art._isEmailDraft) {
            setSelectedDocument(null);
            setSelectedArtifact(art);
            return;
        }
        // Excel files with base64 content → trigger browser download
        const isExcelArt = /\.(xlsx|xls|csv)$/i.test(art.filename || '') || art.file_type?.includes('spreadsheet') || art.file_type?.includes('excel');
        if (isExcelArt && art.content) {
            try {
                const raw = atob(art.content);
                const bytes = new Uint8Array(raw.length);
                for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
                const blob = new Blob([bytes], { type: art.file_type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = art.filename || 'file.xlsx';
                document.body.appendChild(a); a.click();
                document.body.removeChild(a); URL.revokeObjectURL(url);
            } catch (e) { console.error('xlsx download error', e); }
            return;
        }
        if (art._isVideo) {
            setSelectedDocument(null);
            setSelectedArtifact(art);
        } else if (isDocumentFile(art)) {
            // Document clicked directly — show in right panel as document
            // If we already have a data artifact open, keep it and show PDF alongside
            if (selectedArtifact && !selectedArtifact._isDocument && !selectedArtifact._isVideo) {
                setSelectedDocument({ ...art, _isDocument: true });
            } else {
                setSelectedDocument(null);
                setSelectedArtifact({ ...art, _isDocument: true });
            }
        } else if (isViewableArtifact(art) && (art.content || art.data)) {
            // Data artifact with inline content — open DatasetViewer
            // Auto-detect PDF to show alongside
            const pdf = pdfArtifacts[0] || null;
            setSelectedArtifact(art);
            setSelectedDocument(pdf ? { ...pdf, _isDocument: true } : null);
            // Build tabs from all meta artifacts in the same group
            setDataArtifactTabs(allViewableDataArtifacts.length > 1 ? allViewableDataArtifacts : []);
        } else if (art.url) {
            const isJson = art.file_type === 'application/json' || art.file_type === 'json' || art.filename?.endsWith('.json');
            if (isJson) {
                // Auto-detect PDF to show alongside
                const pdf = pdfArtifacts[0] || null;
                setSelectedArtifact({ ...art, _loading: true });
                setSelectedDocument(pdf ? { ...pdf, _isDocument: true } : null);
                setDataArtifactTabs(allViewableDataArtifacts.length > 1 ? allViewableDataArtifacts : []);
                fetch(art.url)
                    .then(r => r.json())
                    .then(rawData => {
                        const data = transformArtifactData(art._stepName, rawData);
                        setSelectedArtifact(prev =>
                            prev?.id === art.id ? { ...art, data } : prev
                        );
                    })
                    .catch(() => setSelectedArtifact(prev =>
                        prev?.id === art.id ? { ...art, data: { error: 'Failed to load content' } } : prev
                    ));
            } else if (isDocumentFile(art)) {
                if (selectedArtifact && !selectedArtifact._isDocument && !selectedArtifact._isVideo) {
                    setSelectedDocument({ ...art, _isDocument: true });
                } else {
                    setSelectedDocument(null);
                    setSelectedArtifact({ ...art, _isDocument: true });
                }
            } else {
                window.open(art.url, '_blank');
            }
        }
    };

    const getDbArtifactsForLog = (log) => {
        if (log.log_type !== 'artifact') return [];
        return artifacts.filter(a =>
            log.message?.includes(a.filename) ||
            (log.metadata?.artifact_id && log.metadata.artifact_id === a.id)
        );
    };

    const formatCaseValue = (key, val) => {
        if (typeof val === 'number') {
            if (key.includes('amount') || key.includes('total')) {
                return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
            if (key.includes('score')) return val.toFixed(2);
            return String(val);
        }
        return String(val);
    };

    return (
        <>
        <div className="flex h-full bg-white overflow-hidden">
            {/* Main content - NO margin-right, flex handles it */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="flex-shrink-0 px-6 py-5 border-b border-[#f0f0f0] bg-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h2 className="text-[16px] font-semibold text-[#171717]">
                                {run?.document_name || run?.name || `Run ${runId?.slice(0, 8)}`}
                            </h2>
                            {(() => {
                                const n = run?.document_name || run?.name || '';
                                const isFA  = n.includes('EXP_TO_FA');
                                const isPPD = n.includes('EXP_TO_PPD');
                                if (!isFA && !isPPD) return null;
                                return (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-[600] tracking-wide uppercase ${
                                        isFA
                                            ? 'bg-[#EAF3FF] text-[#2546F5] border border-[#c3d8ff]'
                                            : 'bg-[#FFF4E5] text-[#B45309] border border-[#fcd99c]'
                                    }`}>
                                        {isFA ? 'Fixed Asset' : 'Prepaid'}
                                    </span>
                                );
                            })()}
                            {run?.status && (
                                <span className={`flex items-center gap-1 text-[12px] font-medium ${
                                    run.status === 'done' ? 'text-[#038408]' :
                                    run.status === 'in_progress' ? 'text-[#0000A4]' :
                                    (run.status === 'needs_attention' || run.status === 'needs_review') ? 'text-[#A40000]' :
                                    'text-[#666]'
                                }`}>
                                    {run.status === 'done' && (
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none"><path d="M13.3 4.3a1 1 0 010 1.4l-6 6a1 1 0 01-1.4 0l-3-3a1 1 0 011.4-1.4L6.5 9.6l5.3-5.3a1 1 0 011.4 0z" fill="currentColor"/></svg>
                                    )}
                                    {run.status.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}
                                </span>
                            )}
                        </div>
                        <p className="text-[12px] text-[#9CA3AF]">
                            {run?.started_at && `Started ${formatDate(run.started_at)}`}
                        </p>
                    </div>
                </div>


                {/* Timeline */}
                <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
                    {logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="w-10 h-10 border border-[#f0f0f0] rounded-lg flex items-center justify-center mb-3">
                                <Activity className="w-5 h-5 text-[#9CA3AF]" />
                            </div>
                            <p className="text-sm text-[#666]">No activity logs yet</p>
                            <p className="text-xs text-[#9CA3AF] mt-1">Logs will appear here as the run progresses</p>
                        </div>
                    ) : (
                        <div className="relative">
                            {groupedLogs.map((group, groupIndex) => {
                                const { firstLog, lastLog, mergedReasoning, allReasoningSteps, allNarratives, msgSplit, dbArtifacts, metaArtifacts, recordings: groupRecordings } = group;
                                const isLastGroup = groupIndex === groupedLogs.length - 1;
                                const status = getIconStatus(lastLog, isLastGroup ? logs.length - 1 : logs.indexOf(lastLog));
                                // Use the first non-artifact message as a descriptive label, fall back to step_name
                                const summaryPhrase = group.messages?.[0] || '';
                                const stepLabel = summaryPhrase || group.stepName || getStepName(firstLog);
                                const hasReasoning = (
                                    Object.keys(mergedReasoning || {}).length > 0 ||
                                    !!msgSplit.detail ||
                                    allReasoningSteps.length > 0
                                );
                                // Narratives (reasoning/error strings) shown as visible text below step label
                                const visibleNarrative = allNarratives.length > 0 ? allNarratives.join(' ') : null;
                                // Deduplicate DB artifacts by id
                                const seenArtIds = new Set();
                                const uniqueDbArts = dbArtifacts.filter(a => {
                                    if (seenArtIds.has(a.id)) return false;
                                    seenArtIds.add(a.id);
                                    return true;
                                });
                                // All attachments: DB artifacts + meta artifacts + recordings
                                const hasAttachments = uniqueDbArts.length > 0 || metaArtifacts.length > 0 || groupRecordings.length > 0;

                                return (
                                    <div key={firstLog.id} className="flex gap-4 pb-6 relative">
                                        {/* Timestamp gutter */}
                                        <div className="w-[52px] flex-shrink-0 flex items-start justify-end pt-[2px]">
                                            <span className="text-[10px] text-[#9CA3AF] whitespace-nowrap">
                                                {formatTime(firstLog.created_at)}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-center w-[11px] flex-shrink-0 pt-[4px]">
                                            <div className={`w-[11px] h-[11px] rounded-[2px] border flex-shrink-0 ${
                                                status === 'complete'
                                                    ? 'bg-[#E6F3EA] border-[#66B280]'
                                                    : status === 'error'
                                                    ? 'bg-[#FFDADA] border-[#A40000]'
                                                    : 'bg-[#DADAFF] border-[#0000A4] animate-square-to-diamond'
                                            }`} />
                                            {!isLastGroup && (
                                                <div className="w-[1px] bg-[#E5E7EB] flex-1 min-h-[20px] mt-1" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 pb-2">
                                            {/* Step name */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[13px] font-medium text-[#171717]">
                                                    {stepLabel}
                                                </span>
                                                {group.logs.length > 1 && (
                                                    <span className="text-[10px] text-[#D1D5DB]">
                                                        ({group.logs.length} sub-steps)
                                                    </span>
                                                )}
                                            </div>
                                            {/* Narrative text (from reasoning/error fields) — always visible */}
                                            {visibleNarrative && (
                                                <p className="text-[12px] text-[#666] mt-0.5 leading-relaxed">
                                                    {visibleNarrative}
                                                </p>
                                            )}
                                            {/* Summary text — shown when no reasoning box and no narrative */}
                                            {!hasReasoning && !visibleNarrative && msgSplit.summary && (
                                                <p className="text-[12px] text-[#666] mt-0.5 leading-relaxed">
                                                    {msgSplit.summary.replace(/^[\u2022\u00b7\-*]\s*/, '')}
                                                </p>
                                            )}
                                            {/* Reasoning box — only when there are actual kv pairs or steps */}
                                            {hasReasoning && (
                                                <CollapsibleReasoning
                                                    reasoning={mergedReasoning}
                                                    messageDetail={msgSplit.detail}
                                                    reasoningSteps={allReasoningSteps}
                                                    summaryText={!visibleNarrative ? msgSplit.summary : null}
                                                />
                                            )}
                                            {/* All attachments: DB artifacts + data artifacts + recordings */}
                                            {hasAttachments && (
                                                <div className="flex flex-wrap gap-2 mt-2.5">
                                                    {uniqueDbArts.map(art => {
                                                        if (isEmailFile(art)) {
                                                            return (
                                                                <EmailArtifactPill key={art.id} artifact={art} onClick={() => setSelectedEmail(art)} />
                                                            );
                                                        }
                                                        const isPdf = art.filename?.toLowerCase().endsWith('.pdf');
                                                        const isImg = /\.(png|jpg|jpeg|gif|webp)$/i.test(art.filename || '');
                                                        return (
                                                            <button key={art.id} onClick={() => handleArtifactClick(art)}
                                                                className={"bg-[#F3F4F6] hover:bg-[#E5E7EB] border border-[#E5E7EB] rounded-md px-2 py-0.5 flex items-center gap-1.5 transition-colors group/chip"}>
                                                                <div className={"w-4 h-4 rounded flex items-center justify-center flex-shrink-0 bg-[#E5E7EB]"}>
                                                                    {isPdf ? (
                                                                        <FileText className="h-3 w-3 text-[#6B7280]" strokeWidth={2} />
                                                                    ) : isImg ? (
                                                                        <Image className="h-3 w-3 text-[#6B7280]" strokeWidth={2} />
                                                                    ) : (
                                                                        <FileText className="h-3 w-3 text-[#6B7280]" strokeWidth={2} />
                                                                    )}
                                                                </div>
                                                                <span className="text-[11px] font-medium text-[#374151]">{art.filename}</span>
                                                                <Eye className="h-3 w-3 text-[#D1D5DB] group-hover/chip:text-[#9CA3AF] flex-shrink-0 ml-0.5" strokeWidth={1.5} />
                                                            </button>
                                                        );
                                                    })}
                                                    {metaArtifacts.map(da => {
                                                        // SharePoint links — blue pill with SP icon
                                                        if (da.file_type === 'sharepoint') {
                                                            return (
                                                                <a key={da.id} href={da.url || '#'} target="_blank" rel="noreferrer"
                                                                    className="bg-[#f0f6ff] hover:bg-[#e1ecff] border border-[#c8dfff] rounded-lg px-2.5 py-1.5 flex items-center gap-2 transition-colors group/chip no-underline">
                                                                    <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 bg-white border border-[#d0e4ff]">
                                                                        <svg width="12" height="12" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                            <circle cx="12" cy="12" r="10" fill="#0364B8"/>
                                                                            <circle cx="21" cy="19" r="9" fill="#0078D4"/>
                                                                            <circle cx="12" cy="22" r="8" fill="#1490DF"/>
                                                                            <ellipse cx="17" cy="28" rx="11" ry="4" fill="#28A8E8"/>
                                                                            <text x="7" y="22" fontFamily="Arial" fontWeight="bold" fontSize="12" fill="white">S</text>
                                                                        </svg>
                                                                    </div>
                                                                    <span className="text-[11px] font-medium text-[#0364B8]">{da.filename}</span>
                                                                    <svg className="h-3 w-3 text-[#0078D4] flex-shrink-0 ml-0.5" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                                </a>
                                                            );
                                                        }
                                                        // Email pills — Gmail icon + label, matching reference UI
                                                        if (da._isEmailDraft) {
                                                            return (
                                                                <button key={da.id} onClick={() => handleArtifactClick(da)}
                                                                    className="bg-white hover:bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 flex items-center gap-2 transition-colors group/chip">
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                                                                        <path d="M1 5.5V18.5C1 19.6 1.9 20.5 3 20.5H5V9.5L12 14.5L19 9.5V20.5H21C22.1 20.5 23 19.6 23 18.5V5.5C23 4.1 21.4 3.2 20.2 4L12 9.5L3.8 4C2.6 3.2 1 4.1 1 5.5Z" fill="#EA4335"/>
                                                                        <path d="M5 20.5V9.5L12 14.5" fill="#4285F4"/>
                                                                        <path d="M19 20.5V9.5L12 14.5" fill="#34A853"/>
                                                                        <path d="M5 9.5L1 5.5V18.5C1 19.6 1.9 20.5 3 20.5H5V9.5Z" fill="#C5221F"/>
                                                                        <path d="M19 9.5L23 5.5V18.5C23 19.6 22.1 20.5 21 20.5H19V9.5Z" fill="#0B8043"/>
                                                                        <path d="M19 5.5V9.5L23 5.5C23 4.1 21.4 3.2 20.2 4L19 5.5Z" fill="#F8BD00"/>
                                                                        <path d="M5 5.5V9.5L1 5.5C1 4.1 2.6 3.2 3.8 4L5 5.5Z" fill="#1E88E5"/>
                                                                    </svg>
                                                                    <span className="text-[11px] font-medium text-[#374151]">{da.filename}</span>
                                                                </button>
                                                            );
                                                        }
                                                        // All URL-based artifacts — open inline via handleArtifactClick (fetches JSON, opens DatasetViewer)
                                                        const isDataArt = !da.url && (da.content || da.data); // inline data — open DatasetViewer
                                                        if (da.url && !isDataArt) {
                                                            return (
                                                                <button key={da.id} onClick={() => handleArtifactClick(da)}
                                                                    className="bg-[#F3F4F6] hover:bg-[#E5E7EB] border border-[#E5E7EB] rounded-md px-2 py-0.5 flex items-center gap-1.5 transition-colors group/chip">
                                                                    <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 bg-[#E5E7EB]">
                                                                        <Database className="h-3 w-3 text-[#6B7280]" strokeWidth={2} />
                                                                    </div>
                                                                    <span className="text-[11px] font-medium text-[#374151]">{da.filename}</span>
                                                                    <Eye className="h-3 w-3 text-[#D1D5DB] group-hover/chip:text-[#9CA3AF] flex-shrink-0 ml-0.5" strokeWidth={1.5} />
                                                                </button>
                                                            );
                                                        }
                                                        // Inline data artifacts (NatWest data{} pattern) — open DatasetViewer
                                                        return (
                                                            <button key={da.id} onClick={() => handleArtifactClick(da)}
                                                                className="bg-[#F3F4F6] hover:bg-[#E5E7EB] border border-[#E5E7EB] rounded-md px-2 py-0.5 flex items-center gap-1.5 transition-colors group/chip">
                                                                <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 bg-[#E5E7EB]">
                                                                    <Database className="h-3 w-3 text-[#6B7280]" strokeWidth={2} />
                                                                </div>
                                                                <span className="text-[11px] font-medium text-[#374151]">{da.filename}</span>
                                                                <Eye className="h-3 w-3 text-[#D1D5DB] group-hover/chip:text-[#9CA3AF] flex-shrink-0 ml-0.5" strokeWidth={1.5} />
                                                            </button>
                                                        );
                                                    })}
                                                    {groupRecordings.map(rec => (
                                                        <button key={rec.id}
                                                            onClick={() => handleArtifactClick({ ...rec, _isVideo: true })}
                                                            className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-[6px] px-2.5 py-1.5 flex items-center gap-2 transition-colors">
                                                            <Play className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0" strokeWidth={1.5} />
                                                            <span className="text-xs font-normal text-black">{rec.metadata?.label || 'Browser Recording'}</span>
                                                            {rec.status === 'pending' && (
                                                                <span className="text-[9px] text-indigo-400">(processing)</span>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {/* HITL decision buttons - inline at end of last log entry */}
                                            {isLastGroup && (run?.status === 'needs_attention' || run?.status === 'needs_review') && !logs?.some(l => l.metadata?.hitl_decision === true) && (
                                                <HitlDecisionPanel key={`hitl-${run.id}`} run={run} logs={logs} artifacts={artifacts} />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={logsEndRef} />
                        </div>
                    )}
                </div>
            </div>

            {/* Right panel: Three-panel (data + PDF) OR single artifact viewer OR Key Details sidebar */}
            {threePanelActive ? (
                <>
                    {/* Middle panel: DatasetViewer with tabs */}
                    <div className="w-1 cursor-col-resize hover:bg-blue-200 active:bg-blue-300 transition-colors flex-shrink-0"
                        onMouseDown={() => setIsResizing(true)} />
                    <div className="flex-1 min-w-[340px] border-l border-[#f0f0f0]">
                        <DatasetViewer
                                artifact={selectedArtifact}
                                onClose={() => { setSelectedArtifact(null); setSelectedDocument(null); setDataArtifactTabs([]); }}
                                allDataArtifacts={dataArtifactTabs}
                                onSelectTab={(da) => handleArtifactClick(da)}
                            />
                    </div>
                    {/* Right panel: PDF DocumentPreview */}
                    <div className="w-[480px] flex-shrink-0 border-l border-[#f0f0f0]">
                        <DocumentPreview
                            artifact={selectedDocument}
                            onClose={() => setSelectedDocument(null)}
                        />
                    </div>
                </>
            ) : selectedArtifact ? (
                <>
                    <div className="w-1 cursor-col-resize hover:bg-blue-200 active:bg-blue-300 transition-colors flex-shrink-0"
                        onMouseDown={() => setIsResizing(true)} />
                    <div style={{ width: artifactWidth }} className="flex-shrink-0 border-l border-[#f0f0f0]">
                        {selectedArtifact._isEmailDraft ? (
                            <EmailDraftViewer
                                artifact={selectedArtifact}
                                run={run}
                                logs={logs}
                                onClose={() => setSelectedArtifact(null)}
                                onSent={() => setSelectedArtifact(null)}
                            />
                        ) : selectedArtifact._isVideo ? (
                            <VideoPlayer recording={selectedArtifact} onClose={() => setSelectedArtifact(null)} />
                        ) : selectedArtifact._isDocument ? (
                            <DocumentPreview artifact={selectedArtifact} onClose={() => setSelectedArtifact(null)} />
                        ) : (
                            <DatasetViewer
                                artifact={selectedArtifact}
                                onClose={() => { setSelectedArtifact(null); setDataArtifactTabs([]); }}
                                allDataArtifacts={dataArtifactTabs}
                                onSelectTab={(da) => handleArtifactClick(da)}
                            />
                        )}
                    </div>
                </>
            ) : (
                <div className="w-[400px] flex-shrink-0 border-l border-[#f0f0f0] bg-white overflow-y-auto custom-scrollbar">
                    <div className="px-5 pt-5 pb-4">
                        <h3 className="text-[14px] font-semibold text-[#171717]">Key Details</h3>
                    </div>

                    {/* P2 Prepaid Expense Booking — Key Details panel */}
                    {(() => {
                        if (run?.process_id !== 'c9846f46-ff57-4cc8-9f71-addf4185aeb5') return null;
                        const meta = logs?.find(l => l.step_number === 1)?.metadata || {};
                        if (!meta.invoice_value) return null;
                        const fmt = (n) => n != null ? `USD ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
                        const rows = [
                            { label: 'Vendor',               value: meta.vendor || '—' },
                            { label: 'Invoice No.',          value: meta.invoice_no || '—' },
                            { label: 'Invoice Value',        value: fmt(meta.invoice_value) },
                            { label: 'Currency',             value: meta.currency || 'USD' },
                            { label: 'GL Code',              value: meta.gl_code || '—' },
                            { label: 'Service / Commodity',  value: meta.service_commodity_code || '—' },
                            { label: 'Period of Performance',value: meta.pop || '—' },
                            { label: 'Prepaid Term',         value: meta.prepaid_year ? `${meta.prepaid_year} year${meta.prepaid_year > 1 ? 's' : ''}` : '—' },
                            { label: 'Amortization Schedule',value: meta.amortization_schedule || '—' },
                        ];
                        // pull amort monthly from step 12
                        const amortLog = logs?.find(l => l.step_number === 12);
                        if (amortLog?.metadata?.monthly_amount != null) {
                            rows.push({ label: 'Monthly Amort. Amount', value: fmt(amortLog.metadata.monthly_amount) });
                        }
                        const catchupLog = logs?.find(l => l.step_number === 11);
                        if (catchupLog?.metadata?.catchup_amount != null) {
                            rows.push({ label: 'Catch-up Expense', value: fmt(catchupLog.metadata.catchup_amount) });
                        }
                        const dividerAfter = new Set([2, 5, 8]);
                        return (
                            <div className="mx-4 mb-3 bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                                <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
                                    <Briefcase className="w-3.5 h-3.5 text-[#6B7280]" />
                                    <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Invoice Details</span>
                                </div>
                                <div className="px-4 pb-3.5 space-y-0">
                                    {rows.map((row, idx) => (
                                        <React.Fragment key={row.label}>
                                            <div className="flex items-start justify-between py-2.5 gap-4">
                                                <p className="text-[12px] text-[#6B7280] whitespace-nowrap">{row.label}</p>
                                                <p className="text-[12px] font-semibold text-[#171717] text-right">{row.value}</p>
                                            </div>
                                            {dividerAfter.has(idx) && <div className="border-t border-[#F3F4F6]" />}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* DXC Run Details — process-aware field panel */}
                    {(() => {
                        const CONTRACT_SETUP_ID = '8b340d78-c83a-4e9c-adef-b867514e45ec';
                        const isContractSetup = run?.process_id === CONTRACT_SETUP_ID;

                        // Pick field set based on process
                        const fieldKeys = isContractSetup
                            ? ['contract_id','client_id','client_legal_name','region','contract_status']
                            : ['current_status','date','start_date','end_date','erp_records_found','erp_records_processed','erp_invoices_extracted'];

                        const hasData = fieldKeys.some(k => caseDetails[k]);
                        if (!hasData) return null;

                        const statusPill = (val) => {
                            if (!val) return <span className="text-[13px] text-[#9CA3AF]">—</span>;
                            const v = String(val);
                            const vl = v.toLowerCase();
                            const color = (vl === 'complete' || vl === 'active') ? 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]'
                                        : (vl === 'in progress' || vl.includes('draft')) ? 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]'
                                        : vl === 'awaiting' ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
                                        : 'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]';
                            return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${color}`}>{v}</span>;
                        };

                        const statusKeys = isContractSetup
                            ? new Set(['contract_status'])
                            : new Set(['current_status','erp_lh','erp_gsap','erp_compass','ariba_lh_compass','ariba_gsap']);

                        const sectionLabels = isContractSetup ? {
                            contract_id: 'Contract ID',
                            client_id: 'Client ID',
                            client_legal_name: 'Client Legal Name',
                            region: 'Region',
                            contract_status: 'Contract Status',
                        } : {
                            current_status: 'Current Status',
                            date: 'Date',
                            start_date: 'Start Date',
                            end_date: 'End Date',
                            erp_records_found: 'ERP Records Found',
                            erp_records_processed: 'ERP Records Processed',
                            erp_invoices_extracted: 'ERP Invoices Extracted',
                        };

                        const dividerAfter = isContractSetup
                            ? new Set(['region'])
                            : new Set(['end_date', 'erp_invoices_extracted']);

                        return (
                            <div className="mx-4 mb-3 bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                                <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
                                    <Briefcase className="w-3.5 h-3.5 text-[#6B7280]" />
                                    {isContractSetup
                                        ? <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Contract Details</span>
                                        : <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Run Details</span>
                                    }
                                </div>
                                <div className="px-4 pb-3.5 space-y-0">
                                    {fieldKeys.map((key, idx) => {
                                        const val = caseDetails[key];
                                        return (
                                            <React.Fragment key={key}>
                                                <div className="flex items-start justify-between py-2.5 gap-4">
                                                    <p className="text-[12px] text-[#6B7280] flex-shrink-0 whitespace-nowrap">{sectionLabels[key]}</p>
                                                    {statusKeys.has(key)
                                                        ? statusPill(val)
                                                        : <p className="text-[13px] font-semibold text-[#171717] text-right">{key === 'region' && val ? String(val).toUpperCase() : (val || '—')}</p>
                                                    }
                                                </div>
                                                {dividerAfter.has(key) && <div className="border-t border-[#F3F4F6]" />}
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Case Details - extracted from log metadata (non-DXC processes only) */}
                    {(() => {
                        // Suppress entirely for DXC P1/P2 — they use the structured Run Details panel above
                        if (DXC_PROCESS_IDS.has(run?.process_id)) return null;
                        const dxcKeys = new Set([
                            'current_status','date','start_date','end_date',
                            'erp_records_found','erp_records_processed','erp_invoices_extracted',
                            'erp_lh','erp_gsap','erp_compass','ariba_lh_compass','ariba_gsap',
                            'final_status','invoice_amount','invoice_number','vendor',
                            'step_name','reasoning_steps','data','artifacts',
                            // Contract Setup keys (shown in Run Details panel, not here)
                            'contract_id','client_id','client_legal_name',
                            'region','contract_status',
                        ]);
                        const nonDxc = Object.fromEntries(Object.entries(caseDetails).filter(([k]) => !dxcKeys.has(k)));
                        if (Object.keys(nonDxc).length === 0) return null;
                        return (
                            <div className="mx-4 mb-3 bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                                <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
                                    <Briefcase className="w-3.5 h-3.5 text-[#6B7280]" />
                                    <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Case Details</span>
                                </div>
                                <div className="px-4 pb-3.5 space-y-3">
                                    {Object.entries(nonDxc).map(([key, value]) => (
                                        <div key={key}>
                                            <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wider mb-0.5">{formatFieldKey(key)}</p>
                                            <p className="text-[13px] text-[#171717] font-medium break-words leading-snug">
                                                {formatCaseValue(key, value)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}


                    {/* Artifacts */}
                    <div className="mx-4 mb-4 bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
                            <Presentation className="w-3.5 h-3.5 text-[#6B7280]" />
                            <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Artifacts</span>
                        </div>
                        <div className="px-4 pb-3.5">
                            {allArtifacts.length === 0 ? (
                                <p className="text-[12px] text-[#9CA3AF]">No artifacts generated</p>
                            ) : (
                                <div className="space-y-1">
                                    {allArtifacts.map(art => {
                                        if (isEmailFile(art)) {
                                            return (
                                                <div key={art.id} className="py-1">
                                                    <EmailArtifactPill artifact={art} onClick={() => setSelectedEmail(art)} />
                                                </div>
                                            );
                                        }
                                        const isPdf       = art.filename?.toLowerCase().endsWith('.pdf');
                                        const isImg       = /\.(png|jpg|jpeg|gif|webp)$/i.test(art.filename || '');
                                        const isExcel     = /\.(xlsx|xls|csv)$/i.test(art.filename || '') || art.file_type?.includes('spreadsheet') || art.file_type?.includes('excel');
                                        const isSharePoint = art.file_type === 'sharepoint';

                                        if (isSharePoint) {
                                            return (
                                                <a key={art.id} href={art.url || '#'} target="_blank" rel="noreferrer"
                                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#f0f6ff] transition-colors text-left group border border-[#e1ecff] bg-[#f7fbff] mb-1">
                                                    {/* SharePoint logo SVG */}
                                                    <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-white border border-[#d0e4ff] shadow-sm">
                                                        <svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <circle cx="12" cy="12" r="10" fill="#0364B8"/>
                                                            <circle cx="21" cy="19" r="9" fill="#0078D4"/>
                                                            <circle cx="12" cy="22" r="8" fill="#1490DF"/>
                                                            <ellipse cx="17" cy="28" rx="11" ry="4" fill="#28A8E8"/>
                                                            <text x="7" y="22" fontFamily="Arial" fontWeight="bold" fontSize="12" fill="white">S</text>
                                                        </svg>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[12px] font-semibold text-[#0364B8] truncate">{art.filename}</p>
                                                        <p className="text-[10px] text-[#0078D4]">SharePoint · Open site</p>
                                                    </div>
                                                    <svg className="w-3 h-3 text-[#0078D4] flex-shrink-0" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                </a>
                                            );
                                        }

                                        if (isExcel) {
                                            return (
                                                <button key={art.id} onClick={() => handleArtifactClick(art)}
                                                    className="w-full flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-[#E5E7EB] bg-[#F3F4F6] transition-colors text-left group">
                                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#E5E7EB]">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                                            <rect x="2" y="3" width="20" height="18" rx="2" fill="#217346"/>
                                                            <path d="M8 8l3 4-3 4M12 8l4 8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                                        </svg>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[12px] font-medium text-[#171717] truncate">{art.filename}</p>
                                                        <p className="text-[10px] text-[#9CA3AF]">{art.content ? 'Excel · Click to download' : 'Excel · SharePoint'}</p>
                                                    </div>
                                                    <Eye className="w-3.5 h-3.5 text-[#d1d5db] group-hover:text-[#9CA3AF] flex-shrink-0" />
                                                </button>
                                            );
                                        }

                                        return (
                                            <button key={art.id} onClick={() => handleArtifactClick(art)}
                                                className="w-full flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-[#E5E7EB] bg-[#F3F4F6] transition-colors text-left group">
                                                <div className={"w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#E5E7EB]"}>
                                                    {art._isMetaArtifact ? (
                                                        <Database className="w-3.5 h-3.5 text-[#6B7280]" />
                                                    ) : isPdf ? (
                                                        <FileText className="w-3.5 h-3.5 text-[#6B7280]" />
                                                    ) : isImg ? (
                                                        <Image className="w-3.5 h-3.5 text-[#6B7280]" />
                                                    ) : (
                                                        <FileText className="w-3.5 h-3.5 text-[#6B7280]" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[12px] font-medium text-[#171717] truncate">
                                                        {art._isMetaArtifact
                                                            ? (run?.name || art.filename)
                                                            : art.filename}
                                                    </p>
                                                    <p className="text-[10px] text-[#9CA3AF]">
                                                        {art._isMetaArtifact ? 'Extracted data' : (art.file_type || 'file')}
                                                    </p>
                                                </div>
                                                <Eye className="w-3.5 h-3.5 text-[#d1d5db] group-hover:text-[#9CA3AF] flex-shrink-0" />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
        {/* Email viewer modal */}
        {selectedEmail && (
            <EmailViewer artifact={selectedEmail} onClose={() => setSelectedEmail(null)} />
        )}
        </>
    );
};

export default ProcessDetails;
