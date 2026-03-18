import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Filter } from 'lucide-react';
import { fetchRuns, subscribeToTable } from '../services/supabase';
import { supabase } from '../services/supabase';

/* ── Per-process column definitions ──────────────────────────────────────────
   Each entry: { id, header, align, render(run, meta, artMeta) }
   meta      = step-1 log metadata (or step-1 artifact data for dataset-style procs)
   artMeta   = map of { [dataset_name]: data_object } from artifact-type logs
   run       = the activity_run row itself
─────────────────────────────────────────────────────────────────────────────*/

const pill = (val, color) => {
    if (!val) return <span className="text-[#d1d5db]">—</span>;
    const palettes = {
        green:  'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
        amber:  'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
        blue:   'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
        red:    'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]',
        gray:   'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]',
        purple: 'bg-[#F5F3FF] text-[#5B21B6] border-[#DDD6FE]',
        indigo: 'bg-[#EEF2FF] text-[#3730A3] border-[#C7D2FE]',
    };
    const cls = palettes[color] || palettes.gray;
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>{val}</span>;
};

const autoPill = (val) => {
    if (!val) return <span className="text-[#d1d5db]">—</span>;
    const s = String(val).toLowerCase();
    if (s.includes('pass') || s.includes('complete') || s.includes('verified') || s.includes('cleared') || s.includes('done') || s.includes('yes'))
        return pill(val, 'green');
    if (s.includes('fail') || s.includes('error') || s.includes('reject') || s.includes('blocked') || s.includes('void') || s.includes('no'))
        return pill(val, 'red');
    if (s.includes('review') || s.includes('pending') || s.includes('await') || s.includes('hold') || s.includes('escalat'))
        return pill(val, 'amber');
    if (s.includes('progress') || s.includes('process') || s.includes('active'))
        return pill(val, 'blue');
    return pill(val, 'gray');
};

const mono = (val) => val
    ? <span className="font-mono text-[11px] text-[#555]">{val}</span>
    : <span className="text-[#d1d5db]">—</span>;

const bold = (val) => val
    ? <span className="font-[500] text-[#171717]">{val}</span>
    : <span className="text-[#d1d5db]">—</span>;

const usd = (val) => val
    ? <span className="font-[500] text-[#171717]">${Number(val).toLocaleString()}</span>
    : <span className="text-[#d1d5db]">—</span>;

const num = (val) => (val !== undefined && val !== null && val !== '')
    ? <span className="font-[500] text-[#171717]">{Number(val).toLocaleString()}</span>
    : <span className="text-[#d1d5db]">—</span>;

/* ── Column sets per process ID ── */
const PROCESS_COLUMNS = {

    /* DXC — Prepaid Expense Booking (P2) */
    'c9846f46-ff57-4cc8-9f71-addf4185aeb5': [
        { id: 'vendor',     header: 'Vendor',           align: 'left',   render: (r,m) => bold(m.vendor) },
        { id: 'inv_no',     header: 'Invoice No.',      align: 'left',   render: (r,m) => mono(m.invoice_no) },
        { id: 'amount',     header: 'Invoice Value',    align: 'right',  render: (r,m) => usd(m.invoice_value) },
        { id: 'monthly',    header: 'Monthly Amort.',   align: 'right',  render: (r,m) => m.monthly_amount ? <span className="font-[500] text-[#171717]">${Number(m.monthly_amount).toLocaleString()}</span> : <span className="text-[#d1d5db]">—</span> },
        { id: 'pop',        header: 'POP',              align: 'center', render: (r,m) => m.pop ? pill(m.pop, 'blue') : <span className="text-[#d1d5db]">—</span> },
        { id: 'term',       header: 'Term',             align: 'center', render: (r,m) => m.prepaid_year ? <span className="text-[#555]">{m.prepaid_year * 12} mo</span> : <span className="text-[#d1d5db]">—</span> },
        { id: 'gl',         header: 'GL Code',          align: 'left',   render: (r,m) => mono(m.gl_code) },
        { id: 'svc',        header: 'Service Code',     align: 'left',   render: (r,m) => mono(m.service_commodity_code) },
    ],

    /* DXC — Prepaid Data Ingestion (P1) */
    'c4e944f7-1133-4961-a8c3-2378ca591857': [
        { id: 'period',   header: 'Sync Period',          align: 'left',   render: (r,m) => bold(m.start_date ? `${m.start_date} → ${m.end_date}` : r.name) },
        { id: 'found',    header: 'ERP Records Found',    align: 'right',  render: (r,m) => num(m.erp_records_found) },
        { id: 'proc',     header: 'Records Processed',    align: 'right',  render: (r,m) => num(m.erp_records_processed) },
        { id: 'inv',      header: 'Invoices Extracted',   align: 'right',  render: (r,m) => num(m.erp_invoices_extracted) },
        { id: 'status',   header: 'Status',               align: 'center', render: (r,m) => autoPill(m.current_status || (r.status === 'done' ? 'Complete' : null)) },
    ],

    /* DXC — Billing Ops Contract Setup */
    '8b340d78-c83a-4e9c-adef-b867514e45ec': [
        { id: 'contract', header: 'Contract',       align: 'left',   render: (r,m) => bold(r.name) },
        { id: 'status',   header: 'Stage',          align: 'center', render: (r,m) => autoPill(r.status === 'done' ? 'Complete' : r.status === 'needs_review' ? 'Needs Review' : r.status === 'void' ? 'Rolled Back' : 'In Progress') },
        { id: 'txt',      header: 'Last Action',    align: 'left',   render: (r,m) => <span className="text-[#555] text-[11px]">{r.current_status_text?.slice(0,60) || '—'}</span> },
    ],

    /* Block — OPEX Review */
    '84ff0fec-7dfd-48ef-a411-854c708b5e0a': [
        { id: 'period',   header: 'Period',         align: 'left',   render: (r,m) => bold(m.period) },
        { id: 'type',     header: 'Type',           align: 'center', render: (r,m) => m.period_type ? pill(m.period_type.charAt(0).toUpperCase()+m.period_type.slice(1), 'blue') : <span className="text-[#d1d5db]">—</span> },
        { id: 'entities', header: 'Entities',       align: 'center', render: (r,m) => m.entities ? <span className="font-mono text-[11px] text-[#555]">{Array.isArray(m.entities) ? m.entities.join(', ') : m.entities}</span> : <span className="text-[#d1d5db]">—</span> },
        { id: 'close',    header: 'Close Date',     align: 'left',   render: (r,m) => <span className="text-[#555]">{m.close_date || '—'}</span> },
        { id: 'oracle',   header: 'Oracle Instance', align: 'left',  render: (r,m) => <span className="font-mono text-[10px] text-[#777]">{m.oracle_instance?.replace('ehsg.fa.','').replace('.oraclecloud.com','') || '—'}</span> },
        { id: 'status',   header: 'Status',         align: 'center', render: (r,m) => autoPill(r.status === 'done' ? 'Complete' : r.current_status_text?.split('—')[0]?.trim() || r.status) },
    ],

    /* Instacart — AP Invoicing */
    '05e70ed1-7884-4a0c-be03-26d9e04b36f1': [
        { id: 'from',    header: 'From',            align: 'left',   render: (r,m) => <span className="text-[#555] text-[11px]">{m.data?.From || '—'}</span> },
        { id: 'subject', header: 'Subject',         align: 'left',   render: (r,m) => <span className="text-[#555] text-[11px] max-w-[200px] truncate block">{m.data?.Subject || r.name}</span> },
        { id: 'recv',    header: 'Received',        align: 'left',   render: (r,m) => <span className="text-[#777] text-[11px]">{m.data?.Received?.slice(0,16) || '—'}</span> },
        { id: 'attach',  header: 'Attachments',     align: 'center', render: (r,m) => m.data?.Attachments ? pill(m.data.Attachments, 'gray') : <span className="text-[#d1d5db]">—</span> },
        { id: 'status',  header: 'Status',          align: 'center', render: (r,m) => autoPill(r.status === 'done' ? 'Complete' : r.status === 'needs_review' ? 'Needs Review' : 'In Progress') },
    ],

    /* Instacart — Account Reconciliation */
    'cf3f0dbc-eb89-438c-bbad-1c43ddf5ebb5': [
        { id: 'inv',     header: 'Invoice / Run',   align: 'left',   render: (r,m) => bold(r.name) },
        { id: 'cust',    header: 'Customer',        align: 'left',   render: (r,m) => <span className="text-[#555]">{m.data?.Customer || m.artMeta?.['Contract Details']?.Customer || '—'}</span> },
        { id: 'po',      header: 'PO Reference',    align: 'left',   render: (r,m) => mono(m.artMeta?.['PO Details']?.['PO Reference'] || '—') },
        { id: 'status',  header: 'Status',          align: 'center', render: (r,m) => autoPill(r.status === 'done' ? 'Complete' : r.status === 'needs_review' ? 'Needs Review' : 'In Progress') },
        { id: 'txt',     header: 'Last Action',     align: 'left',   render: (r,m) => <span className="text-[#555] text-[11px]">{r.current_status_text?.slice(0,65) || '—'}</span> },
    ],

    /* Uber Eats — Dispute Resolution */
    'd629444d-b53f-4779-9884-65e3169cf30a': [
        { id: 'case',     header: 'Case',           align: 'left',   render: (r,m) => bold(m.data?.['Selected Case'] || r.name) },
        { id: 'customer', header: 'Customer',       align: 'left',   render: (r,m) => <span className="text-[#555]">{m.data?.Customer || '—'}</span> },
        { id: 'amount',   header: 'Amount',         align: 'right',  render: (r,m) => <span className="font-[500] text-[#171717]">{m.data?.Amount || '—'}</span> },
        { id: 'category', header: 'Category',       align: 'center', render: (r,m) => m.data?.Category ? pill(m.data.Category, 'amber') : <span className="text-[#d1d5db]">—</span> },
        { id: 'priority', header: 'Priority',       align: 'center', render: (r,m) => { const p = m.data?.Priority; return p ? pill(p, p==='High'?'red':p==='Medium'?'amber':'gray') : <span className="text-[#d1d5db]">—</span>; } },
        { id: 'owner',    header: 'Case Owner',     align: 'left',   render: (r,m) => <span className="text-[#555]">{m.data?.['Case Owner'] || '—'}</span> },
        { id: 'status',   header: 'Status',         align: 'center', render: (r,m) => autoPill(r.status === 'done' ? 'Resolved' : r.status === 'void' ? 'Closed' : 'In Progress') },
    ],

    /* Uber Freight — TMS Ops */
    '65dbe6b4-122f-458c-b7ff-6f99c951c109': [
        { id: 'load',     header: 'Load ID',        align: 'left',   render: (r,m) => mono(m.data?.['Load ID'] || m.data?.LoadID || r.name) },
        { id: 'customer', header: 'Customer',       align: 'left',   render: (r,m) => <span className="text-[#555]">{m.data?.Customer || '—'}</span> },
        { id: 'route',    header: 'Route',          align: 'left',   render: (r,m) => <span className="text-[#555] text-[11px]">{m.data?.Route || (m.data?.Origin && m.data?.Destination ? `${m.data.Origin} → ${m.data.Destination}` : '—')}</span> },
        { id: 'pickup',   header: 'Pickup',         align: 'left',   render: (r,m) => <span className="text-[#777] text-[11px]">{m.data?.Pickup?.slice(0,16) || '—'}</span> },
        { id: 'commodity',header: 'Commodity',      align: 'left',   render: (r,m) => <span className="text-[#555]">{m.data?.Commodity || '—'}</span> },
        { id: 'ticket',   header: 'Ticket',         align: 'left',   render: (r,m) => mono(m.data?.Ticket || '—') },
        { id: 'status',   header: 'Status',         align: 'center', render: (r,m) => autoPill(r.status === 'done' ? 'Resolved' : m.data?.Status || r.status) },
    ],

    /* Playlist — Payment Risk Analysis */
    '8ebe49d5-a94d-4047-9f3a-df454819b228': [
        { id: 'account',  header: 'Account ID',     align: 'left',   render: (r,m) => mono(m.data?.['Account ID'] || r.name) },
        { id: 'country',  header: 'Country',        align: 'center', render: (r,m) => <span className="text-[#555]">{m.data?.Country || '—'}</span> },
        { id: 'month',    header: 'Report Month',   align: 'left',   render: (r,m) => <span className="text-[#555]">{m.data?.['Report Month'] || '—'}</span> },
        { id: 'vol',      header: 'Volume Ratio',   align: 'center', render: (r,m) => <span className="font-mono text-[11px]">{m.data?.['Volume Ratio'] || '—'}</span> },
        { id: 'cb',       header: 'CB Ratio',       align: 'center', render: (r,m) => <span className="font-mono text-[11px]">{m.data?.['CB Ratio'] || '—'}</span> },
        { id: 'status',   header: 'Result',         align: 'center', render: (r,m) => autoPill(r.current_status_text?.split('—').pop()?.trim() || (r.status === 'done' ? 'Complete' : r.status)) },
    ],

    /* NatWest — Sanction Screening (old org) */
    'ed6dc37d-111d-46f3-a929-200ca3d21843': [
        { id: 'alert',   header: 'Alert ID',        align: 'left',   render: (r,m) => mono(r.name) },
        { id: 'outcome', header: 'Outcome',         align: 'center', render: (r,m) => { const t = r.current_status_text || ''; return autoPill(t.includes('True Match') ? 'True Match' : t.includes('False') ? 'False Positive' : t.includes('MLRO') ? 'MLRO Referral' : r.status); }},
        { id: 'txt',     header: 'Summary',         align: 'left',   render: (r,m) => <span className="text-[#555] text-[11px]">{r.current_status_text?.slice(0,70) || '—'}</span> },
    ],

    /* NatWest_new — Sanctions Screening */
    '499ade3b-0c28-44e0-ad0c-8d8681498c94': [
        { id: 'alert',   header: 'Alert ID',        align: 'left',   render: (r,m) => mono(r.name) },
        { id: 'outcome', header: 'Outcome',         align: 'center', render: (r,m) => { const t = r.current_status_text || ''; return autoPill(t.includes('True Match') || t.includes('SAR') ? 'True Match' : t.includes('False') ? 'False Positive' : t.includes('MLRO') ? 'MLRO Referral' : r.status); }},
        { id: 'txt',     header: 'Summary',         align: 'left',   render: (r,m) => <span className="text-[#555] text-[11px]">{r.current_status_text?.slice(0,70) || '—'}</span> },
    ],

    /* NatWest_new — Insights */
    '795b85bb-ef67-4e56-aaec-2a07d5ed8c90': [
        { id: 'id',       header: 'Insight ID',     align: 'left',   render: (r,m) => mono(r.name) },
        { id: 'kyc',      header: 'KYC Risk',       align: 'center', render: (r,m) => autoPill(m.artMeta?.['Alert Prioritisation']?.['KYC Risk Rating'] || m.data?.['KYC Risk Rating']) },
        { id: 'media',    header: 'Adverse Media',  align: 'center', render: (r,m) => autoPill(m.data?.['Adverse Media'] || m.artMeta?.['Alert Prioritisation']?.['Adverse Media']) },
        { id: 'score',    header: 'Priority Score', align: 'center', render: (r,m) => <span className="font-mono text-[11px]">{m.data?.['Priority Score'] || '—'}</span> },
        { id: 'status',   header: 'Status',         align: 'center', render: (r,m) => autoPill(r.current_status_text?.split('—')[0]?.trim() || (r.status === 'done' ? 'Complete' : r.status)) },
    ],

    /* Stripe — Contract Extraction */
    '6c605488-89d9-4558-bc8a-dacbe10a2d36': [
        { id: 'contract', header: 'Contract',       align: 'left',   render: (r,m) => bold(r.name) },
        { id: 'type',     header: 'Doc Type',       align: 'center', render: (r,m) => autoPill(m.artMeta?.['Document Classification']?.document_type || m.artMeta?.['Document Classification']?.title?.includes('Amendment') ? 'Amendment' : 'Agreement') },
        { id: 'parties',  header: 'User Entity',    align: 'left',   render: (r,m) => <span className="text-[#555] text-[11px]">{m.artMeta?.['Contract Parties']?.user_entity || '—'}</span> },
        { id: 'territory',header: 'Territory',      align: 'left',   render: (r,m) => <span className="text-[#555]">{m.artMeta?.['Contract Parties']?.territory || '—'}</span> },
        { id: 'status',   header: 'Status',         align: 'center', render: (r,m) => autoPill(r.status === 'done' ? 'Complete' : r.status) },
    ],

    /* Lilly — Batch Record Review */
    '6f037763-bd41-410e-ba46-a74dc65dde61': [
        { id: 'record',   header: 'Record',         align: 'left',   render: (r,m) => bold(r.name) },
        { id: 'product',  header: 'Product',        align: 'left',   render: (r,m) => <span className="text-[#555]">{m.product || '—'}</span> },
        { id: 'batch',    header: 'Batch',          align: 'left',   render: (r,m) => mono(m.batch || '—') },
        { id: 'status',   header: 'Outcome',        align: 'center', render: (r,m) => { const t = r.current_status_text || ''; return autoPill(t.includes('HOLD') ? 'On Hold' : t.includes('Superseded') ? 'Superseded' : r.status === 'done' ? 'Approved' : r.status); }},
        { id: 'txt',      header: 'Notes',          align: 'left',   render: (r,m) => <span className="text-[#555] text-[11px]">{r.current_status_text?.slice(0,60) || '—'}</span> },
    ],

    /* Lilly — AEPC Reporting */
    '7ea1aae3-bd96-441c-b747-651ae9bea9d4': [
        { id: 'case',     header: 'Case',           align: 'left',   render: (r,m) => bold(m.artMeta?.['Case Details']?.case_number ? `Case #${m.artMeta['Case Details'].case_number}` : r.name) },
        { id: 'product',  header: 'Product',        align: 'left',   render: (r,m) => <span className="text-[#555]">{m.artMeta?.['Case Details']?.product_mentioned || m.artMeta?.['Extracted Fields']?.product_name || '—'}</span> },
        { id: 'priority', header: 'Priority',       align: 'center', render: (r,m) => autoPill(m.artMeta?.['Case Details']?.case_priority) },
        { id: 'serious',  header: 'Seriousness',    align: 'center', render: (r,m) => autoPill(m.artMeta?.['Extracted Fields']?.seriousness) },
        { id: 'report',   header: 'Reportable',     align: 'center', render: (r,m) => autoPill(m.artMeta?.['Tag Validation Results']?.reportable) },
        { id: 'status',   header: 'Status',         align: 'center', render: (r,m) => autoPill(r.status === 'done' ? 'Complete' : r.status) },
    ],

    /* Lilly — Risk Analysis (DFMEA) */
    'ab610a3b-235d-4458-b6dd-a38bd2267ba5': [
        { id: 'fmea',    header: 'FMEA ID',         align: 'left',   render: (r,m) => mono(r.name) },
        { id: 'status',  header: 'Status',          align: 'center', render: (r,m) => autoPill(r.status === 'done' ? 'Complete' : r.status) },
        { id: 'txt',     header: 'Summary',         align: 'left',   render: (r,m) => <span className="text-[#555] text-[11px]">{r.current_status_text?.slice(0,80) || '—'}</span> },
    ],

    /* dLocal — Payout Reconciliation */
    '4bec057b-30fc-4c8f-a7cd-8e0c231c065e': [
        { id: 'run',      header: 'Recon Run',      align: 'left',   render: (r,m) => bold(r.name) },
        { id: 'dlocal',   header: 'dLocal Records', align: 'right',  render: (r,m) => num(m.artMeta?.['Data Ingestion']?.['Total dLocal']) },
        { id: 'proc',     header: 'Processor Recs', align: 'right',  render: (r,m) => num(m.artMeta?.['Data Ingestion']?.['Total Processor']) },
        { id: 'diff',     header: 'Differences',    align: 'right',  render: (r,m) => { const d = m.artMeta?.['4-Step Reconciliation Cascade']?.['Total Differences']; return d ? <span className={`font-[500] ${Number(d)>0?'text-[#DC2626]':'text-[#065F46]'}`}>{d}</span> : <span className="text-[#d1d5db]">—</span>; }},
        { id: 'status',   header: 'Status',         align: 'center', render: (r,m) => autoPill(r.status === 'done' ? 'Complete' : r.status) },
        { id: 'txt',      header: 'Summary',        align: 'left',   render: (r,m) => <span className="text-[#555] text-[11px]">{r.current_status_text?.slice(0,55) || '—'}</span> },
    ],

    /* Chubb — Smart Submission Intake */
    '480108a8-5ec2-412c-ae0c-87a1457d547b': [
        { id: 'sub',     header: 'Submission ID',   align: 'left',   render: (r,m) => mono(r.name) },
        { id: 'from',    header: 'From',            align: 'left',   render: (r,m) => <span className="text-[#555] text-[11px]">{m.email_from || '—'}</span> },
        { id: 'subject', header: 'Subject',         align: 'left',   render: (r,m) => <span className="text-[#555] text-[11px] max-w-[200px] truncate block">{m.email_subject || r.name}</span> },
        { id: 'date',    header: 'Date',            align: 'left',   render: (r,m) => <span className="text-[#777] text-[11px]">{m.email_date?.slice(5,16) || '—'}</span> },
        { id: 'status',  header: 'Status',          align: 'center', render: (r,m) => autoPill(r.status === 'done' ? 'Complete' : r.status === 'needs_review' ? 'Needs Review' : 'In Progress') },
    ],

    /* Zamp Finance — Invoice Processing */
    'edbee70e-72bd-4573-ae80-cd3888f6a75f': [
        { id: 'inv',     header: 'Invoice',         align: 'left',   render: (r,m) => bold(r.name) },
        { id: 'file',    header: 'Filename',        align: 'left',   render: (r,m) => <span className="text-[#555] text-[11px]">{m.data?.Filename || '—'}</span> },
        { id: 'pages',   header: 'Pages',           align: 'center', render: (r,m) => <span className="text-[#555]">{m.data?.Pages || '—'}</span> },
        { id: 'source',  header: 'Source',          align: 'left',   render: (r,m) => <span className="text-[#555] text-[11px] max-w-[180px] truncate block">{m.data?.Source || '—'}</span> },
        { id: 'status',  header: 'Status',          align: 'center', render: (r,m) => autoPill(r.status === 'done' ? 'Complete' : r.status === 'in_progress' ? 'In Progress' : r.status) },
    ],
};

/* Fallback columns for any process not in the map */
const DEFAULT_COLUMNS = [
    { id: 'name',   header: 'Run',     align: 'left',   render: (r,m) => bold(r.name) },
    { id: 'status', header: 'Status',  align: 'center', render: (r,m) => autoPill(r.status === 'done' ? 'Complete' : r.status === 'needs_review' ? 'Needs Review' : r.status === 'void' ? 'Void' : r.status) },
    { id: 'txt',    header: 'Summary', align: 'left',   render: (r,m) => <span className="text-[#555] text-[11px]">{r.current_status_text?.slice(0,80) || '—'}</span> },
];

/* ── Component ── */
const ProcessList = () => {
    const navigate = useNavigate();
    const { currentProcess } = useOutletContext();
    const [activeTab, setActiveTab] = useState('done');
    const [runs, setRuns] = useState([]);

    useEffect(() => {
        if (!currentProcess) return;
        const loadRuns = async () => {
            try {
                const data = await fetchRuns(currentProcess.id);
                const runIds = data.map(r => r.id);
                let metaMap = {};
                let artMetaMap = {};

                if (runIds.length > 0) {
                    /* Step-1 system logs → flat metadata */
                    const { data: logs } = await supabase
                        .from('activity_logs')
                        .select('run_id, metadata')
                        .in('run_id', runIds)
                        .eq('step_number', 1)
                        .neq('log_type', 'artifact');
                    (logs || []).forEach(l => { metaMap[l.run_id] = l.metadata || {}; });

                    /* Artifact-type logs (all steps) → artMeta keyed by dataset_name */
                    const { data: artLogs } = await supabase
                        .from('activity_logs')
                        .select('run_id, metadata')
                        .in('run_id', runIds)
                        .eq('log_type', 'artifact');
                    (artLogs || []).forEach(l => {
                        const m = l.metadata || {};
                        const dsName = m.dataset_name;
                        const data   = m.data;
                        if (dsName && data) {
                            if (!artMetaMap[l.run_id]) artMetaMap[l.run_id] = {};
                            artMetaMap[l.run_id][dsName] = data;
                        }
                    });
                }

                setRuns(data.map(r => ({
                    ...r,
                    _meta: { ...(metaMap[r.id] || {}), artMeta: artMetaMap[r.id] || {} },
                })));
            } catch (err) {
                console.error('Error fetching runs:', err);
            }
        };
        loadRuns();
        const unsub = subscribeToTable('activity_runs', `process_id=eq.${currentProcess.id}`, () => loadRuns());
        return unsub;
    }, [currentProcess]);

    const getRunsByTab = (tab) => {
        if (tab === 'in_progress') return runs.filter(r => r.status === 'in_progress' || r.status === 'ready');
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
    const columns = PROCESS_COLUMNS[currentProcess?.id] || DEFAULT_COLUMNS;

    if (!currentProcess) return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-[14px] font-[500] text-[#171717] mb-1">No process selected</div>
            <div className="text-[13px] text-[#7d7d7d] max-w-[300px]">Pace will create processes here when you start a new workflow from chat.</div>
        </div>
    );

    const renderEmptyState = () => (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-250px)] bg-white text-center mt-[-50px]">
            <div className="relative flex h-[150px] w-[190px] items-center justify-center mb-4">
                <img src="/file3.svg" className="h-full w-full object-contain" />
            </div>
            <div className="text-[14px] font-[500] text-[#171717] mb-1">All clear for now</div>
            <div className="text-[13px] text-[#7d7d7d] max-w-[260px]">Activity runs will appear here in real-time as Pace works on tasks.</div>
        </div>
    );

    return (
        <div className="bg-white flex flex-col h-full overflow-hidden">
            {/* Status Tabs */}
            <div className="px-6 pt-2 pb-1 flex-shrink-0">
                <div className="flex items-center gap-2">
                    {tabs.map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-2 py-0.5 text-[11px] rounded-[6px] transition-colors ${activeTab === tab.key
                                ? 'bg-[#00000005] border border-[#ebebeb] font-[500] text-[#171717]'
                                : 'text-[#666666] hover:text-[#171717] hover:bg-[#00000005] font-[500]'}`}>
                            <div className={`w-2 h-2 rounded-[1.5px] border ${tab.squareBg} ${tab.squareBorder}`} />
                            <span>{tab.name}</span>
                            <span className={activeTab === tab.key ? 'text-[#171717]' : 'text-[#cacaca]'}>{tab.count}</span>
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
                                    <th key={col.id}
                                        className={`px-4 py-2 font-normal whitespace-nowrap text-${col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left'}`}>
                                        {col.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {currentRuns.map(run => {
                                const meta = run._meta || {};
                                return (
                                    <tr key={run.id}
                                        className="hover:bg-[#f9f9f9] cursor-pointer transition-colors border-b border-[#f2f2f2] last:border-0"
                                        onClick={() => navigate(`/done/process/${run.id}`)}>
                                        {columns.map(col => (
                                            <td key={col.id}
                                                className={`px-4 py-2.5 whitespace-nowrap text-${col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left'}`}>
                                                {col.render(run, meta)}
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
