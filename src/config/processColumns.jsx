import React from 'react';

/* ─────────────────────────────────────────────────────────────────
   Primitive renderers — imported by every column definition below.
   Keep these pure (no hooks, no state).
───────────────────────────────────────────────────────────────── */

export const pill = (val, color) => {
    if (!val) return <span className="text-[#d1d5db]">—</span>;
    const palettes = {
        green:  'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
        amber:  'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
        blue:   'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
        red:    'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]',
        gray:   'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]',
        purple: 'bg-[#F5F3FF] text-[#5B21B6] border-[#DDD6FE]',
        indigo: 'bg-[#EEF2FF] text-[#3730A3] border-[#C7D2FE]',
        teal:   'bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]',
        orange: 'bg-[#FFF7ED] text-[#9A3412] border-[#FED7AA]',
    };
    const cls = palettes[color] || palettes.gray;
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>
            {val}
        </span>
    );
};

export const autoPill = (val) => {
    if (!val) return <span className="text-[#d1d5db]">—</span>;
    const s = String(val).toLowerCase();
    if (s.includes('pass') || s.includes('complete') || s.includes('verified') || s.includes('cleared') ||
        s.includes('done') || s.includes('yes') || s.includes('approved') || s.includes('resolved'))
        return pill(val, 'green');
    if (s.includes('fail') || s.includes('error') || s.includes('reject') || s.includes('blocked') ||
        s.includes('void') || s.includes('no') || s.includes('invalid') || s.includes('false'))
        return pill(val, 'red');
    if (s.includes('review') || s.includes('pending') || s.includes('await') ||
        s.includes('hold') || s.includes('escalat') || s.includes('attention'))
        return pill(val, 'amber');
    if (s.includes('progress') || s.includes('process') || s.includes('active') || s.includes('running'))
        return pill(val, 'blue');
    if (s.includes('match') || s.includes('positive'))
        return pill(val, 'red');
    return pill(val, 'gray');
};

export const mono = (val) => val
    ? <span className="font-mono text-[11px] text-[#555]">{val}</span>
    : <span className="text-[#d1d5db]">—</span>;

export const bold = (val) => val
    ? <span className="font-[500] text-[#171717]">{val}</span>
    : <span className="text-[#d1d5db]">—</span>;

export const usd = (val) => val
    ? <span className="font-[500] text-[#171717]">${Number(val).toLocaleString()}</span>
    : <span className="text-[#d1d5db]">—</span>;

export const num = (val) => (val !== undefined && val !== null && val !== '')
    ? <span className="font-[500] text-[#171717]">{Number(val).toLocaleString()}</span>
    : <span className="text-[#d1d5db]">—</span>;

export const dim = (val) => val
    ? <span className="text-[#555] text-[11px]">{val}</span>
    : <span className="text-[#d1d5db]">—</span>;

export const trunc = (val, max = 65) => val
    ? <span className="text-[#555] text-[11px] max-w-[220px] truncate block">{String(val).slice(0, max)}</span>
    : <span className="text-[#d1d5db]">—</span>;


/* ─────────────────────────────────────────────────────────────────
   DEFAULT columns — shown for any process not explicitly mapped.
   Gracefully surfaces run name, status, and last status text.
───────────────────────────────────────────────────────────────── */
export const DEFAULT_COLUMNS = [
    { id: 'name',   header: 'Run',     align: 'left',
      render: (r) => bold(r.name) },
    { id: 'status', header: 'Status',  align: 'center',
      render: (r) => autoPill(
          r.status === 'done' ? 'Complete'
        : r.status === 'needs_review' ? 'Needs Review'
        : r.status === 'void' ? 'Void'
        : r.status
      )},
    { id: 'txt',    header: 'Summary', align: 'left',
      render: (r) => trunc(r.current_status_text, 80) },
];

/* ─────────────────────────────────────────────────────────────────
   PROCESS_COLUMNS
   Key   = process UUID (from `processes` table)
   Value = array of column definitions: { id, header, align, render(run, meta, artMeta) }
     - run     = activity_runs row
     - meta    = step-1 log metadata (merged flat object)
     - artMeta = { [dataset_name]: data_object } from artifact-type logs
───────────────────────────────────────────────────────────────── */
export const PROCESS_COLUMNS = {

    /* ── Block: OPEX Review ──────────────────────────────────────── */
    '84ff0fec-7dfd-48ef-a411-854c708b5e0a': [
        /* Run name → vendor + txn, e.g. "Point One — 32660 (EXP_TO_FA)" */
        { id: 'name',       header: 'Invoice / Run',        align: 'left',
          render: (r) => <span className="font-[500] text-[#171717] max-w-[260px] truncate block">{r.name}</span> },

        /* Vendor — Classification Result is the most consistent source across all run variants.
           Phase 1 — Data Fetch Summary and Invoice Details are additional fallbacks. */
        { id: 'vendor',     header: 'Vendor',               align: 'left',
          render: (r, m) => {
              const v = m.artMeta?.['Classification Result']?.Vendor
                     || m.artMeta?.['Phase 1 — Data Fetch Summary']?.Vendor
                     || m.artMeta?.['Invoice Details']?.Vendor
                     || m.artMeta?.['Phase 3 — Data Retrieval']?.Vendor
                     || m.artMeta?.['Phase 3 — PDF Extraction']?.Vendor;
              return v ? <span className="text-[#555] text-[11px] max-w-[180px] truncate block">{v}</span>
                       : <span className="text-[#d1d5db]">—</span>;
          }},

        /* Amount — prefer Classification Result (already dollar-formatted), then data retrieval */
        { id: 'amount',     header: 'Amount',               align: 'right',
          render: (r, m) => {
              const raw = m.artMeta?.['Classification Result']?.Amount
                       || m.artMeta?.['Phase 1 — Data Fetch Summary']?.['Invoice Amount']
                       || m.artMeta?.['Invoice Details']?.Amount
                       || m.artMeta?.['Invoice Details']?.['Invoice Amount']
                       || m.artMeta?.['Phase 3 — Data Retrieval']?.Amount;
              return raw ? <span className="font-[500] text-[#171717]">{raw}</span>
                         : <span className="text-[#d1d5db]">—</span>;
          }},

        /* Entity — Invoice Details is the canonical source in the locked 8-step format */
        { id: 'entity',     header: 'Entity',               align: 'center',
          render: (r, m) => {
              const raw = m.artMeta?.['Invoice Details']?.Entity
                       || m.artMeta?.['Classification Result']?.Entity
                       || m.artMeta?.['Phase 1 — Data Fetch Summary']?.Entity
                       || m.artMeta?.['Journal Entry']?.Entity;
              if (!raw) return <span className="text-[#d1d5db]">—</span>;
              // "101 — Block, Inc." → show just "101"
              const num = String(raw).match(/^(\d+)/);
              return <span className="text-[#555] text-[13px] font-[450]">{num ? num[1] : raw}</span>;
          }},

        /* Workflow type: EXP_TO_FA or EXP_TO_PPD — check Classification Result first, then run name */
        { id: 'workflow',   header: 'Workflow',             align: 'center',
          render: (r, m) => {
              const cr = m.artMeta?.['Classification Result'];
              const wf = cr?.Workflow
                      || cr?.['JE Type']
                      || m.artMeta?.['Payment Detection Result']?.['JE Type']
                      || m.artMeta?.['Payment Detection Result']?.['JE Family']
                      || (() => {
                            const n = r.name || '';
                            if (n.includes('EXP_TO_FA'))  return 'EXP_TO_FA';
                            if (n.includes('EXP_TO_PPD')) return 'EXP_TO_PPD';
                            return null;
                        })();
              return wf ? <span className="text-[#555] text-[13px] font-[450]">{wf}</span>
                        : <span className="text-[#d1d5db]">—</span>;
          }},

        /* Classification decision — newer runs use 'Decision', older use 'Route'/'Capitalize'/'Routing' */
        { id: 'decision',   header: 'Decision',             align: 'center',
          render: (r, m) => {
              const cr = m.artMeta?.['Classification Result'] || {};
              const raw = cr.Decision || cr.Capitalize || cr.Route || cr.Routing
                       || m.artMeta?.['Screening Result']?.['Final Decision']
                       || (() => {
                              // Step-2 terminated runs: Screening Result 'Overall' key
                              // e.g. "NO ACTION" or "PROCEED to classification"
                              const overall = m.artMeta?.['Screening Result']?.Overall;
                              if (!overall) return null;
                              const u = String(overall).toUpperCase();
                              if (u.includes('NO ACTION') || u.includes('PROCEED')) return overall;
                              return null;
                          })();
              if (!raw) return <span className="text-[#d1d5db]">—</span>;
              const s = String(raw).toUpperCase();
              const label = (s === 'YES' || s === 'CAPITALIZE') ? 'Capitalize'
                          : (s === 'NO'  || s === 'NO_ACTION' || s.startsWith('NO ACTION')) ? 'No Action'
                          : s.startsWith('PROCEED') ? 'Proceed'
                          : raw;
              return <span className="text-[#555] text-[13px] font-[450]">{label}</span>;
          }},

        /* Confidence — only lives in Classification Result */
        { id: 'confidence', header: 'Confidence',           align: 'center',
          render: (r, m) => {
              const c = m.artMeta?.['Classification Result']?.Confidence;
              if (!c) return <span className="text-[#d1d5db]">—</span>;
              // "95% (HIGH)" → show as-is
              return <span className="text-[#555] text-[13px] font-[450]">{c}</span>;
          }},

        /* JE type — Payment Detection Result is canonical (clean ACCAP1/PPD1); others as fallback */
        { id: 'je',         header: 'JE Type',              align: 'center',
          render: (r, m) => {
              const je = m.artMeta?.['Payment Detection Result']?.['JE Type']
                      || m.artMeta?.['Journal Entry']?.['JE Type']
                      || m.artMeta?.['Classification Result']?.['JE Type']
                      || m.artMeta?.['Journal Entry Lines']?.['JE Name'];
              if (!je) return <span className="text-[#d1d5db]">—</span>;
              return <span className="text-[#555] text-[13px] font-[450]">{je}</span>;
          }},

        /* Last status text */
        { id: 'txt',        header: 'Notes',                align: 'left',
          render: (r) => trunc(r.current_status_text, 60) },
    ],

    /* ── DXC: Prepaid — Data Ingestion & Invoice Extraction (P1) ─── */
    'c4e944f7-1133-4961-a8c3-2378ca591857': [
        { id: 'name',     header: 'Run Name',               align: 'left',
          render: (r) => <span className="font-[500] text-[#171717] whitespace-nowrap max-w-[220px] truncate block">{r.name}</span> },
        { id: 'cstatus',  header: 'Current Status',         align: 'left',
          render: (r, m) => autoPill(m.current_status || (r.status === 'done' ? 'Complete' : r.status === 'in_progress' ? 'In Progress' : null)) },
        { id: 'date',     header: 'Date',                   align: 'left',
          render: (r, m) => <span className="text-[#555] whitespace-nowrap">{m.date || '—'}</span> },
        { id: 'start',    header: 'Start Date',             align: 'left',
          render: (r, m) => <span className="text-[#555] whitespace-nowrap">{m.start_date || '—'}</span> },
        { id: 'end',      header: 'End Date',               align: 'left',
          render: (r, m) => <span className="text-[#555] whitespace-nowrap">{m.end_date || '—'}</span> },
        { id: 'found',    header: 'ERP Records Found',      align: 'right',
          render: (r, m) => <span className="font-[500] text-[#171717]">{m.erp_records_found || '—'}</span> },
        { id: 'proc',     header: 'ERP Records Processed',  align: 'right',
          render: (r, m) => <span className="font-[500] text-[#171717]">{m.erp_records_processed || '—'}</span> },
        { id: 'inv',      header: 'ERP Invoices Extracted', align: 'right',
          render: (r, m) => <span className="font-[500] text-[#171717]">{m.erp_invoices_extracted || '—'}</span> },
        { id: 'erp_lh',   header: 'ERP — LH',              align: 'center',
          render: (r, m) => autoPill(m.erp_lh) },
        { id: 'erp_gsap', header: 'ERP — GSAP',            align: 'center',
          render: (r, m) => autoPill(m.erp_gsap) },
        { id: 'erp_comp', header: 'ERP — Compass',         align: 'center',
          render: (r, m) => autoPill(m.erp_compass) },
        { id: 'ariba_lh', header: 'Ariba — LH / Compass',  align: 'center',
          render: (r, m) => autoPill(m.ariba_lh_compass) },
        { id: 'ariba_gs', header: 'Ariba — GSAP',          align: 'center',
          render: (r, m) => autoPill(m.ariba_gsap) },
    ],

    /* ── DXC: Prepaid — Expense Booking (P2) ─────────────────────── */
    'c9846f46-ff57-4cc8-9f71-addf4185aeb5': [
        { id: 'vendor',  header: 'Vendor',               align: 'left',
          render: (r, m) => bold(m.vendor) },
        { id: 'inv_no',  header: 'Invoice No.',          align: 'left',
          render: (r, m) => mono(m.invoice_no) },
        { id: 'amount',  header: 'Invoice Value',        align: 'right',
          render: (r, m) => usd(m.invoice_value) },
        { id: 'monthly', header: 'Monthly Amort.',       align: 'right',
          render: (r, m) => m.monthly_amount
              ? <span className="font-[500] text-[#171717]">${Number(m.monthly_amount).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
              : <span className="text-[#d1d5db]">—</span> },
        { id: 'pop',     header: 'POP',                  align: 'center',
          render: (r, m) => m.pop ? pill(m.pop, 'blue') : <span className="text-[#d1d5db]">—</span> },
        { id: 'term',    header: 'Term',                 align: 'center',
          render: (r, m) => m.prepaid_year
              ? <span className="text-[#555]">{m.prepaid_year * 12} mo</span>
              : <span className="text-[#d1d5db]">—</span> },
        { id: 'gl',      header: 'GL Code',              align: 'left',
          render: (r, m) => mono(m.gl_code) },
        { id: 'svc',     header: 'Service Type',         align: 'center',
          render: (r, m) => m.service_type ? pill(m.service_type, 'indigo') : <span className="text-[#d1d5db]">—</span> },
    ],

    /* ── DXC: Billing Operations — Contract Setup ——————————— */
    '8b340d78-c83a-4e9c-adef-b867514e45ec': [
        { id: 'cname',   header: 'Contract Name',     align: 'left',
          render: (r, m) => bold(m.artMeta?.['contracts']?.contract_name || m.contract_name || r.name) },
        { id: 'cid',     header: 'Contract ID',       align: 'left',
          render: (r, m) => mono(m.artMeta?.['contracts']?.contract_id || m.contract_id) },
        { id: 'clid',    header: 'Client ID',         align: 'left',
          render: (r, m) => mono(m.artMeta?.['contracts']?.client_id || m.client_id) },
        { id: 'clname',  header: 'Client Legal Name', align: 'left',
          render: (r, m) => dim(m.artMeta?.['contracts']?.client_legal_name || m.client_legal_name) },
        { id: 'region',  header: 'Region',            align: 'center',
          render: (r, m) => {
              const v = m.artMeta?.['contracts']?.region || m.region;
              return v ? pill(v.toUpperCase(), 'blue') : <span className="text-[#d1d5db]">—</span>;
          }},
        { id: 'eff',     header: 'Effective Date',    align: 'center',
          render: (r, m) => dim(m.artMeta?.['contracts']?.effective_date || m.effective_date) },
        { id: 'end',     header: 'End Date',          align: 'center',
          render: (r, m) => dim(m.artMeta?.['contracts']?.end_date || m.end_date) },
        { id: 'cstat',   header: 'Contract Status',   align: 'center',
          render: (r, m) => autoPill(m.artMeta?.['contracts']?.contract_status || m.contract_status) },
        { id: 'law',     header: 'Governing Law',     align: 'left',
          render: (r, m) => dim(m.artMeta?.['contracts']?.governing_law || m.governing_law) },
        { id: 'curr',    header: 'Currency',          align: 'center',
          render: (r, m) => {
              const v = m.artMeta?.['contracts']?.contract_currency || m.contract_currency;
              return v ? pill(v, 'green') : <span className="text-[#d1d5db]">—</span>;
          }},
    ],

    /* ── Instacart: AP Invoicing ───────────────────────────────────── */
    '05e70ed1-7884-4a0c-be03-26d9e04b36f1': [
        { id: 'from',    header: 'From',            align: 'left',
          render: (r, m) => dim(m.data?.From) },
        { id: 'subject', header: 'Subject',         align: 'left',
          render: (r, m) => trunc(m.data?.Subject || r.name, 55) },
        { id: 'recv',    header: 'Received',        align: 'left',
          render: (r, m) => <span className="text-[#777] text-[11px]">{m.data?.Received?.slice(0, 16) || '—'}</span> },
        { id: 'attach',  header: 'Attachments',     align: 'center',
          render: (r, m) => m.data?.Attachments ? pill(m.data.Attachments, 'gray') : <span className="text-[#d1d5db]">—</span> },
        { id: 'status',  header: 'Status',          align: 'center',
          render: (r) => autoPill(r.status === 'done' ? 'Complete' : r.status === 'needs_review' ? 'Needs Review' : 'In Progress') },
    ],

    /* ── Instacart: Account Reconciliation ────────────────────────── */
    'cf3f0dbc-eb89-438c-bbad-1c43ddf5ebb5': [
        { id: 'inv',     header: 'Invoice / Run',   align: 'left',
          render: (r) => bold(r.name) },
        { id: 'cust',    header: 'Customer',        align: 'left',
          render: (r, m) => dim(m.data?.Customer || m.artMeta?.['Contract Details']?.Customer) },
        { id: 'po',      header: 'PO Reference',    align: 'left',
          render: (r, m) => mono(m.artMeta?.['PO Details']?.['PO Reference']) },
        { id: 'status',  header: 'Status',          align: 'center',
          render: (r) => autoPill(r.status === 'done' ? 'Complete' : r.status === 'needs_review' ? 'Needs Review' : 'In Progress') },
        { id: 'txt',     header: 'Last Action',     align: 'left',
          render: (r) => trunc(r.current_status_text, 65) },
    ],

    /* ── Uber Eats: Dispute Resolution ────────────────────────────── */
    'd629444d-b53f-4779-9884-65e3169cf30a': [
        { id: 'case',     header: 'Case',           align: 'left',
          render: (r, m) => bold(m.data?.['Selected Case'] || r.name) },
        { id: 'customer', header: 'Customer',       align: 'left',
          render: (r, m) => dim(m.data?.Customer) },
        { id: 'amount',   header: 'Amount',         align: 'right',
          render: (r, m) => <span className="font-[500] text-[#171717]">{m.data?.Amount || '—'}</span> },
        { id: 'category', header: 'Category',       align: 'center',
          render: (r, m) => m.data?.Category ? pill(m.data.Category, 'amber') : <span className="text-[#d1d5db]">—</span> },
        { id: 'priority', header: 'Priority',       align: 'center',
          render: (r, m) => { const p = m.data?.Priority; return p ? pill(p, p==='High'?'red':p==='Medium'?'amber':'gray') : <span className="text-[#d1d5db]">—</span>; }},
        { id: 'owner',    header: 'Case Owner',     align: 'left',
          render: (r, m) => dim(m.data?.['Case Owner']) },
        { id: 'status',   header: 'Status',         align: 'center',
          render: (r) => autoPill(r.status === 'done' ? 'Resolved' : r.status === 'void' ? 'Closed' : 'In Progress') },
    ],

    /* ── Uber Freight: TMS Ops ────────────────────────────────────── */
    '65dbe6b4-122f-458c-b7ff-6f99c951c109': [
        { id: 'load',      header: 'Load ID',       align: 'left',
          render: (r, m) => mono(m.data?.['Load ID'] || m.data?.LoadID || r.name) },
        { id: 'customer',  header: 'Customer',      align: 'left',
          render: (r, m) => dim(m.data?.Customer) },
        { id: 'route',     header: 'Route',         align: 'left',
          render: (r, m) => dim(m.data?.Route || (m.data?.Origin && m.data?.Destination ? `${m.data.Origin} → ${m.data.Destination}` : null)) },
        { id: 'pickup',    header: 'Pickup',        align: 'left',
          render: (r, m) => <span className="text-[#777] text-[11px]">{m.data?.Pickup?.slice(0, 16) || '—'}</span> },
        { id: 'commodity', header: 'Commodity',     align: 'left',
          render: (r, m) => dim(m.data?.Commodity) },
        { id: 'ticket',    header: 'Ticket',        align: 'left',
          render: (r, m) => mono(m.data?.Ticket) },
        { id: 'status',    header: 'Status',        align: 'center',
          render: (r, m) => autoPill(r.status === 'done' ? 'Resolved' : m.data?.Status || r.status) },
    ],

    /* ── Playlist: Payment Risk Analysis ─────────────────────────── */
    '8ebe49d5-a94d-4047-9f3a-df454819b228': [
        { id: 'account', header: 'Account ID',   align: 'left',
          render: (r, m) => mono(m.data?.['Account ID'] || r.name) },
        { id: 'country', header: 'Country',      align: 'center',
          render: (r, m) => dim(m.data?.Country) },
        { id: 'month',   header: 'Report Month', align: 'left',
          render: (r, m) => dim(m.data?.['Report Month']) },
        { id: 'vol',     header: 'Volume Ratio', align: 'center',
          render: (r, m) => <span className="font-mono text-[11px]">{m.data?.['Volume Ratio'] || '—'}</span> },
        { id: 'cb',      header: 'CB Ratio',     align: 'center',
          render: (r, m) => <span className="font-mono text-[11px]">{m.data?.['CB Ratio'] || '—'}</span> },
        { id: 'result',  header: 'Result',       align: 'center',
          render: (r) => autoPill(r.current_status_text?.split('—').pop()?.trim() || (r.status === 'done' ? 'Complete' : r.status)) },
    ],

    /* ── NatWest (old org): Sanction Screening ────────────────────── */
    'ed6dc37d-111d-46f3-a929-200ca3d21843': [
        { id: 'alert',   header: 'Alert ID',     align: 'left',
          render: (r) => mono(r.name) },
        { id: 'party',   header: 'Screened Party', align: 'left',
          render: (r, m) => dim(m.artMeta?.['Customer Profile']?.['Customer Name'] || m.artMeta?.['Payment Details']?.Beneficiary) },
        { id: 'prog',    header: 'Programme',    align: 'center',
          render: (r, m) => { const t = m.artMeta?.['Sanctions Matches']?.Programme; return t ? pill(t, 'red') : <span className="text-[#d1d5db]">—</span>; }},
        { id: 'outcome', header: 'Outcome',      align: 'center',
          render: (r) => { const t = r.current_status_text || ''; return autoPill(
              t.includes('True Match') ? 'True Match'
            : t.includes('False') ? 'False Positive'
            : t.includes('MLRO') ? 'MLRO Referral'
            : r.status === 'done' ? 'Complete' : r.status
          );}},
        { id: 'txt',     header: 'Summary',      align: 'left',
          render: (r) => trunc(r.current_status_text, 65) },
    ],

    /* ── NatWest (new org): Sanctions Screening ───────────────────── */
    '499ade3b-0c28-44e0-ad0c-8d8681498c94': [
        { id: 'alert',   header: 'Alert ID',      align: 'left',
          render: (r) => mono(r.name) },
        { id: 'party',   header: 'Screened Party', align: 'left',
          render: (r, m) => dim(m.artMeta?.['Customer Profile']?.['Customer Name'] || m.artMeta?.['Payment Details']?.Beneficiary) },
        { id: 'amount',  header: 'Amount',         align: 'right',
          render: (r, m) => dim(m.artMeta?.['Payment Details']?.Amount) },
        { id: 'prog',    header: 'Programme',      align: 'center',
          render: (r, m) => { const t = m.artMeta?.['Sanctions Matches']?.Programme; return t ? pill(t, 'red') : <span className="text-[#d1d5db]">—</span>; }},
        { id: 'outcome', header: 'Outcome',        align: 'center',
          render: (r) => { const t = r.current_status_text || ''; return autoPill(
              t.includes('True Match') || t.includes('SAR') ? 'True Match'
            : t.includes('False') ? 'False Positive'
            : t.includes('MLRO') ? 'MLRO Referral'
            : r.status === 'done' ? 'Complete' : r.status
          );}},
        { id: 'txt',     header: 'Summary',        align: 'left',
          render: (r) => trunc(r.current_status_text, 55) },
    ],

    /* ── NatWest (new org): Insights / Company Brain ─────────────── */
    '795b85bb-ef67-4e56-aaec-2a07d5ed8c90': [
        { id: 'id',      header: 'Insight ID',    align: 'left',
          render: (r) => mono(r.name) },
        { id: 'kyc',     header: 'KYC Risk',      align: 'center',
          render: (r, m) => autoPill(m.artMeta?.['Alert Prioritisation']?.['KYC Risk Rating'] || m.data?.['KYC Risk Rating']) },
        { id: 'media',   header: 'Adverse Media', align: 'center',
          render: (r, m) => autoPill(m.data?.['Adverse Media'] || m.artMeta?.['Alert Prioritisation']?.['Adverse Media']) },
        { id: 'score',   header: 'Priority Score', align: 'center',
          render: (r, m) => <span className="font-mono text-[11px]">{m.data?.['Priority Score'] || '—'}</span> },
        { id: 'status',  header: 'Status',         align: 'center',
          render: (r) => autoPill(r.current_status_text?.split('—')[0]?.trim() || (r.status === 'done' ? 'Complete' : r.status)) },
    ],

    /* ── NatWest (new org): Correspondent Banking ─────────────────── */
    '697273eb-4d3b-4768-b921-7cada743a782': [
        { id: 'bank',    header: 'Correspondent Bank', align: 'left',
          render: (r, m) => bold(m.artMeta?.['Bank Profile']?.bank_name || r.name) },
        { id: 'country', header: 'Country',            align: 'left',
          render: (r, m) => dim(m.artMeta?.['Bank Profile']?.country || m.data?.Country) },
        { id: 'risk',    header: 'Risk Rating',        align: 'center',
          render: (r, m) => autoPill(m.artMeta?.['Risk Assessment']?.risk_rating || m.data?.['Risk Rating']) },
        { id: 'aml',     header: 'AML Score',          align: 'center',
          render: (r, m) => <span className="font-mono text-[11px]">{m.artMeta?.['Risk Assessment']?.aml_score || m.data?.['AML Score'] || '—'}</span> },
        { id: 'status',  header: 'Status',             align: 'center',
          render: (r) => autoPill(r.status === 'done' ? 'Complete' : r.status === 'needs_review' ? 'Needs Review' : 'In Progress') },
        { id: 'txt',     header: 'Summary',            align: 'left',
          render: (r) => trunc(r.current_status_text, 55) },
    ],

    /* ── NatWest (new org): KYC & Onboarding ─────────────────────── */
    '30e670c2-24db-43b1-ad99-3f19db2f6451': [
        { id: 'entity',  header: 'Entity',        align: 'left',
          render: (r, m) => bold(m.artMeta?.['Application Details']?.entity_name || r.name) },
        { id: 'type',    header: 'Entity Type',   align: 'center',
          render: (r, m) => { const t = m.artMeta?.['Application Details']?.entity_type || m.data?.entity_type; return t ? pill(t, 'blue') : <span className="text-[#d1d5db]">—</span>; }},
        { id: 'risk',    header: 'Risk Level',    align: 'center',
          render: (r, m) => autoPill(m.artMeta?.['Risk Scoring']?.risk_level || m.data?.risk_level) },
        { id: 'pep',     header: 'PEP Check',     align: 'center',
          render: (r, m) => autoPill(m.artMeta?.['Screening Results']?.pep_check || m.data?.pep_check) },
        { id: 'sanctions',header: 'Sanctions',    align: 'center',
          render: (r, m) => autoPill(m.artMeta?.['Screening Results']?.sanctions_check || m.data?.sanctions_check) },
        { id: 'status',  header: 'Decision',      align: 'center',
          render: (r) => autoPill(r.status === 'done' ? 'Approved' : r.status === 'needs_review' ? 'Review' : r.status === 'void' ? 'Rejected' : 'In Progress') },
    ],

    /* ── NatWest (new org): Regulatory Reporting ─────────────────── */
    '09b27f9f-3c4b-4f77-87bd-1ad42ca9d1a7': [
        { id: 'report',  header: 'Report',        align: 'left',
          render: (r, m) => bold(m.artMeta?.['Report Details']?.report_name || r.name) },
        { id: 'regulator',header: 'Regulator',    align: 'left',
          render: (r, m) => dim(m.artMeta?.['Report Details']?.regulator || m.data?.Regulator) },
        { id: 'period',  header: 'Period',         align: 'left',
          render: (r, m) => dim(m.artMeta?.['Report Details']?.reporting_period || m.data?.Period) },
        { id: 'deadline',header: 'Deadline',       align: 'left',
          render: (r, m) => <span className="text-[#777] text-[11px]">{m.artMeta?.['Report Details']?.deadline || m.data?.Deadline || '—'}</span> },
        { id: 'status',  header: 'Status',         align: 'center',
          render: (r) => autoPill(r.status === 'done' ? 'Submitted' : r.status === 'needs_review' ? 'Needs Review' : 'In Progress') },
        { id: 'txt',     header: 'Notes',          align: 'left',
          render: (r) => trunc(r.current_status_text, 55) },
    ],

    /* ── NatWest (new org): Trade Finance ────────────────────────── */
    'db634c3c-f6ea-4915-a584-5c370eefc8cc': [
        { id: 'lc',      header: 'LC / Instrument', align: 'left',
          render: (r, m) => mono(m.artMeta?.['Instrument Details']?.lc_number || r.name) },
        { id: 'applicant',header: 'Applicant',       align: 'left',
          render: (r, m) => dim(m.artMeta?.['Instrument Details']?.applicant || m.data?.Applicant) },
        { id: 'beneficiary',header: 'Beneficiary',  align: 'left',
          render: (r, m) => dim(m.artMeta?.['Instrument Details']?.beneficiary || m.data?.Beneficiary) },
        { id: 'amount',  header: 'Amount',           align: 'right',
          render: (r, m) => dim(m.artMeta?.['Instrument Details']?.amount || m.data?.Amount) },
        { id: 'expiry',  header: 'Expiry',           align: 'left',
          render: (r, m) => <span className="text-[#777] text-[11px]">{m.artMeta?.['Instrument Details']?.expiry_date || m.data?.Expiry || '—'}</span> },
        { id: 'status',  header: 'Status',           align: 'center',
          render: (r) => autoPill(r.status === 'done' ? 'Complete' : r.status === 'needs_review' ? 'Needs Review' : 'In Progress') },
    ],

    /* ── NatWest (new org): Financial Crime Detection ────────────── */
    '9575d5d5-2061-453c-8423-1bb061443e47': [
        { id: 'customer', header: 'Customer',    align: 'left',
          render: (r, m) => bold(m.artMeta?.['Assessment Summary']?.Customer || r.name) },
        { id: 'account',  header: 'Account',     align: 'left',
          render: (r, m) => mono(m.artMeta?.['Data Ingestion']?.Account) },
        { id: 'lrs',      header: 'LRS Score',   align: 'center',
          render: (r, m) => { const s = m.artMeta?.['Assessment Summary']?.['LRS Score']; return s ? <span className="font-mono text-[11px] font-[600]">{s}</span> : <span className="text-[#d1d5db]">—</span>; }},
        { id: 'alert',    header: 'Alert Level', align: 'center',
          render: (r, m) => autoPill(m.artMeta?.['Assessment Summary']?.['Alert Level']) },
        { id: 'sar',      header: 'SAR Required', align: 'center',
          render: (r, m) => autoPill(m.artMeta?.['Assessment Summary']?.['SAR Required']) },
        { id: 'syndicate',header: 'Syndicate',   align: 'center',
          render: (r, m) => { const s = m.artMeta?.['Assessment Summary']?.Syndicate; return s && s !== 'None' ? pill(s, 'red') : <span className="text-[#d1d5db]">—</span>; }},
        { id: 'status',   header: 'Exit Phase',  align: 'center',
          render: (r, m) => autoPill(m.artMeta?.['Assessment Summary']?.['Exit Phase'] || (r.status === 'done' ? 'Complete' : r.status)) },
    ],

    /* ── Stripe: Contract Extraction ──────────────────────────────── */
    '6c605488-89d9-4558-bc8a-dacbe10a2d36': [
        { id: 'contract', header: 'Contract',     align: 'left',
          render: (r) => bold(r.name) },
        { id: 'type',     header: 'Doc Type',     align: 'center',
          render: (r, m) => autoPill(m.artMeta?.['Document Classification']?.document_type
              || (m.artMeta?.['Document Classification']?.title?.includes('Amendment') ? 'Amendment' : 'Agreement')) },
        { id: 'entity',   header: 'User Entity',  align: 'left',
          render: (r, m) => dim(m.artMeta?.['Contract Parties']?.user_entity) },
        { id: 'territory',header: 'Territory',    align: 'left',
          render: (r, m) => dim(m.artMeta?.['Contract Parties']?.territory) },
        { id: 'effective',header: 'Effective',    align: 'left',
          render: (r, m) => <span className="text-[#777] text-[11px]">{m.artMeta?.['Contract Terms']?.effective_date || '—'}</span> },
        { id: 'status',   header: 'Status',       align: 'center',
          render: (r) => autoPill(r.status === 'done' ? 'Complete' : r.status) },
    ],

    /* ── Stripe (process row — generic) ──────────────────────────── */
    'b07cd721-15a6-4961-9d5a-00e53c1af1f1': [
        { id: 'run',     header: 'Run',          align: 'left',
          render: (r) => bold(r.name) },
        { id: 'type',    header: 'Type',         align: 'center',
          render: (r, m) => autoPill(m.artMeta?.['Document Classification']?.document_type || m.data?.doc_type) },
        { id: 'entity',  header: 'Entity',       align: 'left',
          render: (r, m) => dim(m.artMeta?.['Contract Parties']?.user_entity || m.data?.entity) },
        { id: 'status',  header: 'Status',       align: 'center',
          render: (r) => autoPill(r.status === 'done' ? 'Complete' : r.status) },
        { id: 'txt',     header: 'Summary',      align: 'left',
          render: (r) => trunc(r.current_status_text, 60) },
    ],

    /* ── Lilly: Batch Record Review ───────────────────────────────── */
    '6f037763-bd41-410e-ba46-a74dc65dde61': [
        { id: 'record',   header: 'Record',      align: 'left',
          render: (r) => bold(r.name) },
        { id: 'product',  header: 'Product',     align: 'left',
          render: (r, m) => dim(m.product) },
        { id: 'batch',    header: 'Batch',       align: 'left',
          render: (r, m) => mono(m.batch) },
        { id: 'lot',      header: 'Lot',         align: 'left',
          render: (r, m) => mono(m.lot_number || m.artMeta?.['Batch Record']?.lot_number) },
        { id: 'outcome',  header: 'Outcome',     align: 'center',
          render: (r) => { const t = r.current_status_text || ''; return autoPill(
              t.includes('HOLD') ? 'Needs Review'
            : t.includes('Superseded') ? 'Superseded'
            : r.status === 'done' ? 'Approved'
            : r.status === 'needs_review' ? 'Needs Review'
            : r.status === 'needs_attention' ? 'Needs Attention'
            : r.status === 'in_progress' ? 'In Progress'
            : r.status
          );}},
        { id: 'notes',    header: 'Notes',       align: 'left',
          render: (r) => trunc(r.current_status_text, 60) },
    ],

    /* ── Lilly: AEPC Reporting ────────────────────────────────────── */
    '7ea1aae3-bd96-441c-b747-651ae9bea9d4': [
        { id: 'case',     header: 'Case',        align: 'left',
          render: (r, m) => bold(m.artMeta?.['Case Details']?.case_number
              ? `Case #${m.artMeta['Case Details'].case_number}`
              : r.name) },
        { id: 'product',  header: 'Product',     align: 'left',
          render: (r, m) => dim(m.artMeta?.['Case Details']?.product_mentioned || m.artMeta?.['Extracted Fields']?.product_name) },
        { id: 'priority', header: 'Priority',    align: 'center',
          render: (r, m) => autoPill(m.artMeta?.['Case Details']?.case_priority) },
        { id: 'serious',  header: 'Seriousness', align: 'center',
          render: (r, m) => autoPill(m.artMeta?.['Extracted Fields']?.seriousness) },
        { id: 'report',   header: 'Reportable',  align: 'center',
          render: (r, m) => autoPill(m.artMeta?.['Tag Validation Results']?.reportable) },
        { id: 'deadline', header: 'Deadline',    align: 'left',
          render: (r, m) => <span className="text-[#777] text-[11px]">{m.artMeta?.['Case Details']?.reporting_deadline || '—'}</span> },
        { id: 'status',   header: 'Status',      align: 'center',
          render: (r) => autoPill(r.status === 'done' ? 'Complete' : r.status) },
    ],

    /* ── Lilly: Risk Analysis (DFMEA) ────────────────────────────── */
    'ab610a3b-235d-4458-b6dd-a38bd2267ba5': [
        { id: 'fmea',    header: 'FMEA ID',      align: 'left',
          render: (r) => mono(r.name) },
        { id: 'system',  header: 'System',       align: 'left',
          render: (r, m) => dim(m.artMeta?.['FMEA Scope']?.system || m.data?.System) },
        { id: 'rpn',     header: 'RPN',          align: 'center',
          render: (r, m) => { const n = m.artMeta?.['Risk Assessment']?.rpn || m.data?.RPN; return n ? <span className={`font-mono text-[11px] font-[600] ${Number(n) > 100 ? 'text-[#DC2626]' : Number(n) > 50 ? 'text-[#D97706]' : 'text-[#065F46]'}`}>{n}</span> : <span className="text-[#d1d5db]">—</span>; }},
        { id: 'sev',     header: 'Severity',     align: 'center',
          render: (r, m) => autoPill(m.artMeta?.['Risk Assessment']?.severity_level) },
        { id: 'status',  header: 'Status',       align: 'center',
          render: (r) => autoPill(r.status === 'done' ? 'Complete' : r.status) },
        { id: 'txt',     header: 'Summary',      align: 'left',
          render: (r) => trunc(r.current_status_text, 80) },
    ],

    /* ── dLocal: Payout Reconciliation ───────────────────────────── */
    '4bec057b-30fc-4c8f-a7cd-8e0c231c065e': [
        { id: 'run',      header: 'Recon Run',       align: 'left',
          render: (r) => bold(r.name) },
        { id: 'dlocal',   header: 'dLocal Records',  align: 'right',
          render: (r, m) => num(m.artMeta?.['Data Ingestion']?.['Total dLocal']) },
        { id: 'proc',     header: 'Processor Recs',  align: 'right',
          render: (r, m) => num(m.artMeta?.['Data Ingestion']?.['Total Processor']) },
        { id: 'matched',  header: 'Matched',         align: 'right',
          render: (r, m) => num(m.artMeta?.['4-Step Reconciliation Cascade']?.['Matched Records']) },
        { id: 'diff',     header: 'Differences',     align: 'right',
          render: (r, m) => { const d = m.artMeta?.['4-Step Reconciliation Cascade']?.['Total Differences'];
              return d ? <span className={`font-[500] ${Number(d)>0?'text-[#DC2626]':'text-[#065F46]'}`}>{d}</span> : <span className="text-[#d1d5db]">—</span>; }},
        { id: 'status',   header: 'Status',          align: 'center',
          render: (r) => autoPill(r.status === 'done' ? 'Complete' : r.status) },
        { id: 'txt',      header: 'Summary',         align: 'left',
          render: (r) => trunc(r.current_status_text, 55) },
    ],

    /* ── Chubb: Smart Submission Intake ──────────────────────────── */
    '480108a8-5ec2-412c-ae0c-87a1457d547b': [
        { id: 'sub',     header: 'Submission ID',  align: 'left',
          render: (r, m) => mono(m.artMeta?.['Submission Details']?.submission_id || r.name) },
        { id: 'from',    header: 'From',           align: 'left',
          render: (r, m) => dim(m.email_from) },
        { id: 'subject', header: 'Subject',        align: 'left',
          render: (r, m) => trunc(m.email_subject || r.name, 50) },
        { id: 'lob',     header: 'Line of Business', align: 'center',
          render: (r, m) => { const l = m.artMeta?.['Submission Details']?.line_of_business; return l ? pill(l, 'blue') : <span className="text-[#d1d5db]">—</span>; }},
        { id: 'date',    header: 'Date',           align: 'left',
          render: (r, m) => <span className="text-[#777] text-[11px]">{m.email_date?.slice(5, 16) || '—'}</span> },
        { id: 'status',  header: 'Status',         align: 'center',
          render: (r) => autoPill(r.status === 'done' ? 'Complete' : r.status === 'needs_review' ? 'Needs Review' : 'In Progress') },
    ],

    /* ── Zamp Finance: Invoice Processing ────────────────────────── */
    'edbee70e-72bd-4573-ae80-cd3888f6a75f': [
        { id: 'inv',     header: 'Invoice',      align: 'left',
          render: (r) => bold(r.name) },
        { id: 'vendor',  header: 'Vendor',       align: 'left',
          render: (r, m) => dim(m.artMeta?.['Invoice Details']?.vendor || m.data?.Vendor) },
        { id: 'amount',  header: 'Amount',       align: 'right',
          render: (r, m) => dim(m.artMeta?.['Invoice Details']?.amount || m.data?.Amount) },
        { id: 'file',    header: 'Filename',     align: 'left',
          render: (r, m) => dim(m.data?.Filename) },
        { id: 'pages',   header: 'Pages',        align: 'center',
          render: (r, m) => <span className="text-[#555]">{m.data?.Pages || '—'}</span> },
        { id: 'status',  header: 'Status',       align: 'center',
          render: (r) => autoPill(r.status === 'done' ? 'Complete' : r.status === 'in_progress' ? 'In Progress' : r.status) },
    ],

    /* ── Document Verification (Clutch / Auto) ────────────────────── */
    'c4e4c409-4c04-427c-b473-71d0bbf26427': [
        { id: 'record',  header: 'Record',           align: 'left',
          render: (r) => bold(r.name) },
        { id: 'vin',     header: 'VIN',              align: 'left',
          render: (r, m) => mono(m.artMeta?.['Bill of Sale Details']?.VIN) },
        { id: 'vehicle', header: 'Vehicle',          align: 'left',
          render: (r, m) => dim(m.artMeta?.['Bill of Sale Details']?.Vehicle
              || [m.artMeta?.['Bill of Sale Details']?.Year, m.artMeta?.['Bill of Sale Details']?.Make, m.artMeta?.['Bill of Sale Details']?.Model].filter(Boolean).join(' ')) },
        { id: 'sale',    header: 'Sale Price',       align: 'right',
          render: (r, m) => dim(m.artMeta?.['Bill of Sale Details']?.['Sale Price']) },
        { id: 'owner',   header: 'Ownership',        align: 'center',
          render: (r, m) => autoPill(m.artMeta?.['Ownership Verification Results']?.['Overall Ownership Verification'] || m.artMeta?.['Ownership Verification Results']?.['Seller = Owner']) },
        { id: 'rate',    header: 'Pass Rate',        align: 'center',
          render: (r, m) => { const pr = m.artMeta?.['Final Verification Summary']?.['Pass Rate']; return pr ? <span className="font-mono text-[11px] font-[600]">{pr}</span> : <span className="text-[#d1d5db]">—</span>; }},
        { id: 'status',  header: 'Status',           align: 'center',
          render: (r, m) => autoPill(m.artMeta?.['Final Verification Summary']?.['Overall Status'] || (r.status === 'done' ? 'Complete' : r.status)) },
    ],

    /* ── Vendor Onboarding ────────────────────────────────────────── */
    'c23e067c-5d11-4dd9-aaa3-9f01d2459ca8': [
        { id: 'vendor',  header: 'Vendor',           align: 'left',
          render: (r, m) => bold(m.artMeta?.['Application Details']?.['Company Name'] || r.name) },
        { id: 'app_id',  header: 'Application ID',   align: 'left',
          render: (r, m) => mono(m.artMeta?.['Application Details']?.['Application ID']) },
        { id: 'type',    header: 'Type',             align: 'center',
          render: (r, m) => { const t = m.artMeta?.['Application Details']?.Type; return t ? pill(t, 'blue') : <span className="text-[#d1d5db]">—</span>; }},
        { id: 'tax',     header: 'Tax / TIN',        align: 'center',
          render: (r, m) => autoPill(m.artMeta?.['Tax Documents']?.['TIN Verified'] || m.artMeta?.['Tax Documents']?.['W-9 Status']) },
        { id: 'bank',    header: 'Banking',          align: 'center',
          render: (r, m) => autoPill(m.artMeta?.['Banking Details']?.Verification) },
        { id: 'contact', header: 'Contact',          align: 'left',
          render: (r, m) => dim(m.artMeta?.['Application Details']?.Contact) },
        { id: 'status',  header: 'Status',           align: 'center',
          render: (r) => autoPill(r.status === 'done' ? 'Approved' : r.status === 'needs_review' ? 'Needs Review' : r.status === 'void' ? 'Rejected' : 'In Progress') },
    ],

    /* ── AP (generic — no runs yet) ──────────────────────────────── */
    '989da4e1-f887-4cb6-a939-03f34d78c701': [
        { id: 'invoice', header: 'Invoice',          align: 'left',
          render: (r, m) => bold(m.artMeta?.['Invoice Details']?.invoice_number || r.name) },
        { id: 'vendor',  header: 'Vendor',           align: 'left',
          render: (r, m) => dim(m.artMeta?.['Invoice Details']?.vendor || m.data?.vendor) },
        { id: 'amount',  header: 'Amount',           align: 'right',
          render: (r, m) => usd(m.artMeta?.['Invoice Details']?.amount || m.data?.amount) },
        { id: 'po',      header: 'PO',               align: 'left',
          render: (r, m) => mono(m.artMeta?.['PO Details']?.po_number || m.data?.po_number) },
        { id: 'status',  header: 'Status',           align: 'center',
          render: (r) => autoPill(r.status === 'done' ? 'Posted' : r.status === 'needs_review' ? 'Exception' : 'In Progress') },
        { id: 'txt',     header: 'Notes',            align: 'left',
          render: (r) => trunc(r.current_status_text, 60) },
    ],

    /* ── Chargeback (no runs yet) ────────────────────────────────── */
    'f1ca650a-6a75-430e-b14a-8a51bf57bf5e': [
        { id: 'case',    header: 'Case ID',          align: 'left',
          render: (r, m) => mono(m.artMeta?.['Chargeback Details']?.case_id || r.name) },
        { id: 'merchant',header: 'Merchant',         align: 'left',
          render: (r, m) => dim(m.artMeta?.['Chargeback Details']?.merchant || m.data?.merchant) },
        { id: 'amount',  header: 'Amount',           align: 'right',
          render: (r, m) => usd(m.artMeta?.['Chargeback Details']?.amount || m.data?.amount) },
        { id: 'reason',  header: 'Reason Code',      align: 'center',
          render: (r, m) => { const r2 = m.artMeta?.['Chargeback Details']?.reason_code || m.data?.reason_code; return r2 ? pill(r2, 'amber') : <span className="text-[#d1d5db]">—</span>; }},
        { id: 'status',  header: 'Status',           align: 'center',
          render: (r) => autoPill(r.status === 'done' ? 'Resolved' : r.status === 'needs_review' ? 'Disputed' : 'In Progress') },
        { id: 'txt',     header: 'Notes',            align: 'left',
          render: (r) => trunc(r.current_status_text, 55) },
    ],

    /* ── Expense Report Processing (no runs yet) ─────────────────── */
    'e0944250-97f4-4662-94cf-9a424278514c': [
        { id: 'report',  header: 'Report',           align: 'left',
          render: (r, m) => bold(m.artMeta?.['Report Details']?.report_id || r.name) },
        { id: 'submitter',header: 'Submitted By',    align: 'left',
          render: (r, m) => dim(m.artMeta?.['Report Details']?.submitted_by || m.data?.submitted_by) },
        { id: 'total',   header: 'Total',            align: 'right',
          render: (r, m) => usd(m.artMeta?.['Report Details']?.total || m.data?.total) },
        { id: 'policy',  header: 'Policy Check',     align: 'center',
          render: (r, m) => autoPill(m.artMeta?.['Policy Validation']?.result || m.data?.policy_check) },
        { id: 'status',  header: 'Status',           align: 'center',
          render: (r) => autoPill(r.status === 'done' ? 'Approved' : r.status === 'needs_review' ? 'Flagged' : 'In Progress') },
    ],

};

