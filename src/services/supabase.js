import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Subscribe to realtime changes on a table with optional filter
export function subscribeToTable(table, filter, callback) {
    const channelName = `${table}-${filter || 'all'}-${Date.now()}`;
    const channel = supabase
        .channel(channelName)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: table,
            ...(filter ? { filter } : {})
        }, () => {
            callback();
        })
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

// Fetch all organizations
export async function fetchOrgs() {
    const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
}

// Fetch processes for an org
export async function fetchProcesses(orgId) {
    const { data, error } = await supabase
        .from('processes')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
}

// Fetch activity runs for a process
export async function fetchRuns(processId) {
    const { data, error } = await supabase
        .from('activity_runs')
        .select('*')
        .eq('process_id', processId)
        .not('name', 'like', '[GOLDEN]%')
        .order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

// Fetch activity logs for a run
// Actual columns: id, run_id, step_number, log_type, message, metadata, created_at
export async function fetchLogs(runId) {
    const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('run_id', runId)
        .order('step_number', { ascending: true });
    if (error) throw error;
    return data || [];
}

// Fetch artifacts for a run
// Actual columns: id, run_id, filename, file_type, content, url, created_at
export async function fetchArtifacts(runId) {
    const { data, error } = await supabase
        .from('artifacts')
        .select('*')
        .eq('run_id', runId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
}

// Fetch knowledge base for a process
export async function fetchKnowledgeBase(processId) {
    const { data, error } = await supabase
        .from('processes')
        .select('knowledge_base')
        .eq('id', processId)
        .single();
    if (error) throw error;
    if (!data?.knowledge_base) return null;
    try {
        return typeof data.knowledge_base === 'string'
            ? JSON.parse(data.knowledge_base)
            : data.knowledge_base;
    } catch {
        return data.knowledge_base;
    }
}

// Fetch datasets for a process
export async function fetchDatasets(processId) {
    const { data, error } = await supabase
        .from('datasets')
        .select('*')
        .eq('process_id', processId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
}

// Fetch rows for a dataset with pagination
export async function fetchDatasetRows(datasetId, { limit = 100, offset = 0, orderBy = 'created_at', ascending = false } = {}) {
    const { data, error, count } = await supabase
        .from('dataset_rows')
        .select('*, activity_runs!dataset_rows_run_id_fkey(name, status, created_at)', { count: 'exact' })
        .eq('dataset_id', datasetId)
        .order(orderBy, { ascending })
        .range(offset, offset + limit - 1);
    if (error) throw error;
    return { rows: data || [], total: count || 0 };
}

// Fetch browser recordings for a run
export async function fetchBrowserRecordings(runId) {
    const { data, error } = await supabase
        .from('browser_recordings')
        .select('*')
        .eq('run_id', runId)
        .order('step_number', { ascending: true });
    if (error) {
        console.warn('browser_recordings fetch error (table may not exist yet):', error.message);
        return [];
    }
    return data || [];
}

// Generate a fresh pre-signed URL for an S3 recording key (on-demand, 15min expiry)
export async function getRecordingUrl(s3Key) {
    try {
        const resp = await fetch(`/api/recording-url?key=${encodeURIComponent(s3Key)}`);
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${resp.status}`);
        }
        const { url } = await resp.json();
        return url;
    } catch (err) {
        console.error('Failed to get recording URL:', err.message);
        return null;
    }
}

// Export dataset rows as JSON (for client-side CSV generation)
export async function fetchAllDatasetRows(datasetId) {
    const { data, error } = await supabase
        .from('dataset_rows')
        .select('*')
        .eq('dataset_id', datasetId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
}

// --- KB Edit & Save (demo mode — uses service role key for Storage writes) ---
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzdmpjcG14bmRnYXVqeGx2aWt3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTkzNiwiZXhwIjoyMDg3NjA1OTM2fQ.81sjVPgI5QzYLlwz1YwbkCNxK-07Rki98px_JUhK6To';

export async function saveKnowledgeBase(processId, markdownContent) {
    const storagePath = `${processId}/kb.md`;
    const now = new Date();
    const version = Math.floor(now.getTime() / 1000);

    // 1. Upload markdown to Supabase Storage (upsert)
    const uploadUrl = `${supabaseUrl}/storage/v1/object/knowledge-base/${storagePath}`;
    const uploadResp = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'text/markdown',
            'x-upsert': 'true',
        },
        body: markdownContent,
    });

    if (!uploadResp.ok) {
        const err = await uploadResp.text();
        throw new Error(`Storage upload failed: ${err}`);
    }

    // 2. Fetch existing process metadata to preserve fields
    const { data: proc, error: fetchErr } = await supabase
        .from('processes')
        .select('knowledge_base')
        .eq('id', processId)
        .single();

    if (fetchErr) throw fetchErr;

    let existingMeta = {};
    try {
        existingMeta = typeof proc.knowledge_base === 'string'
            ? JSON.parse(proc.knowledge_base)
            : (proc.knowledge_base || {});
    } catch { existingMeta = {}; }

    // 3. Build updated metadata (preserve triggers, integrations, execution_skill)
    const meta = {
        ...existingMeta,
        version,
        storage_path: `knowledge-base/${storagePath}`,
        updated_at: now.toISOString(),
    };

    // If execution_skill exists, flag it as stale
    if (meta.execution_skill) {
        meta.execution_skill.kb_version_at_generation = existingMeta.version || 0;
        meta.execution_skill.needs_regen = true;
    }

    // 4. Update process record with new metadata (using service role client)
    const patchUrl = `${supabaseUrl}/rest/v1/processes?id=eq.${processId}`;
    const patchResp = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'apikey': SERVICE_ROLE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
        },
        body: JSON.stringify({ knowledge_base: JSON.stringify(meta) }),
    });

    if (!patchResp.ok) {
        const err = await patchResp.text();
        throw new Error(`Process update failed: ${err}`);
    }

    const updated = await patchResp.json();
    return updated[0] || updated;
}
