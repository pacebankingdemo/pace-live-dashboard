import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://csvjcpmxndgaujxlvikw.supabase.co";
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const DEFAULT_PROCESS_ID = "edbee70e-72bd-4573-ae80-cd3888f6a75f";

// ─── Tool definitions for Gemini function calling ───
const tools = [
  {
    name: "read_knowledge_base",
    description: "Read the current Knowledge Base for this process. Returns the full KB markdown content.",
    parameters: {
      type: "object",
      properties: {
        process_id: { type: "string", description: "The process ID. Defaults to current process context." }
      }
    }
  },
  {
    name: "update_knowledge_base",
    description: "Replace the entire Knowledge Base with new content. Use when user wants to overwrite or completely rewrite the KB.",
    parameters: {
      type: "object",
      properties: {
        process_id: { type: "string", description: "The process ID." },
        content: { type: "string", description: "The full new markdown content for the KB." }
      },
      required: ["content"]
    }
  },
  {
    name: "append_to_knowledge_base",
    description: "Append new content to the end of the Knowledge Base, optionally under a new section heading.",
    parameters: {
      type: "object",
      properties: {
        process_id: { type: "string", description: "The process ID." },
        content: { type: "string", description: "The markdown content to append." },
        section: { type: "string", description: "Optional section heading to add before the content." }
      },
      required: ["content"]
    }
  },
  {
    name: "log_change",
    description: "Log an action or change to the audit trail. Use this whenever you make a modification.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", description: "What was done (e.g. 'updated_kb', 'modified_skill')" },
        entity_type: { type: "string", description: "What was changed: 'knowledge_base', 'skill', 'workflow'" },
        entity_name: { type: "string", description: "Name of the entity" },
        details: { type: "string", description: "Human-readable description of the change." }
      },
      required: ["action", "entity_type", "details"]
    }
  },
  {
    name: "queue_pending_change",
    description: "Queue a change that requires the main Pace chat to apply (code deployments, GitHub changes, external API calls, new features).",
    parameters: {
      type: "object",
      properties: {
        change_type: { type: "string", description: "Type: 'code_change', 'deployment', 'feature_request', 'integration', 'external_api'" },
        description: { type: "string", description: "Clear description of what needs to be done." },
        details: { type: "string", description: "Technical details or context needed to implement." },
        priority: { type: "string", enum: ["low", "medium", "high"], description: "Priority level." }
      },
      required: ["change_type", "description"]
    }
  },
  {
    name: "get_change_log",
    description: "Retrieve recent changes from the audit log.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of recent entries to return. Default 10." }
      }
    }
  },
  {
    name: "get_pending_changes",
    description: "List pending changes queued for the main Pace chat to review and apply.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "approved", "applied", "rejected"], description: "Filter by status." }
      }
    }
  }
];

// ─── Internal change logging ───
async function logChangeInternal(action, entityType, entityName, details) {
  const entry = {
    id: crypto.randomUUID(),
    action,
    entity_type: entityType,
    entity_name: entityName,
    details,
    performed_by: "dashboard-chat",
    created_at: new Date().toISOString()
  };
  const buf = new TextEncoder().encode(JSON.stringify(entry, null, 2));
  const { error } = await supabase.storage.from("change-log")
    .upload(`${entry.created_at.replace(/[:.]/g, "-")}_${entry.id.slice(0, 8)}.json`, buf, {
      contentType: "application/json", upsert: false
    });
  return error ? { error: error.message } : { success: true, id: entry.id };
}

// ─── Tool execution ───
async function executeTool(name, args, processId) {
  const pid = args.process_id || processId || DEFAULT_PROCESS_ID;
  console.log(`[TOOL] ${name}`, JSON.stringify(args).substring(0, 200));

  try {
    if (name === "read_knowledge_base") {
      const { data, error } = await supabase.storage.from("knowledge-base").download(`${pid}/kb.md`);
      if (error) return { error: `KB not found: ${error.message}` };
      return { content: await data.text(), process_id: pid };
    }

    if (name === "update_knowledge_base") {
      const buf = new TextEncoder().encode(args.content);
      const { error } = await supabase.storage.from("knowledge-base")
        .upload(`${pid}/kb.md`, buf, { contentType: "text/markdown", upsert: true, cacheControl: "no-cache" });
      if (error) return { error: error.message };
      await logChangeInternal("updated_kb", "knowledge_base", `Process ${pid} KB`, "Knowledge base content was replaced.");
      return { success: true, action: "replaced", process_id: pid };
    }

    if (name === "append_to_knowledge_base") {
      let existing = "";
      const { data } = await supabase.storage.from("knowledge-base").download(`${pid}/kb.md`);
      if (data) existing = await data.text();
      const sep = args.section ? `\n\n## ${args.section}\n\n` : "\n\n";
      const updated = existing + sep + args.content;
      const buf = new TextEncoder().encode(updated);
      const { error } = await supabase.storage.from("knowledge-base")
        .upload(`${pid}/kb.md`, buf, { contentType: "text/markdown", upsert: true, cacheControl: "no-cache" });
      if (error) return { error: error.message };
      await logChangeInternal("appended_kb", "knowledge_base", `Process ${pid} KB`, `Appended content${args.section ? " under section: " + args.section : ""}.`);
      return { success: true, action: "appended", process_id: pid };
    }

    if (name === "log_change") {
      return await logChangeInternal(args.action, args.entity_type, args.entity_name || "", args.details);
    }

    if (name === "queue_pending_change") {
      const entry = {
        id: crypto.randomUUID(),
        change_type: args.change_type,
        description: args.description,
        details: args.details || "",
        priority: args.priority || "medium",
        status: "pending",
        requested_by: "dashboard-chat",
        created_at: new Date().toISOString()
      };
      const buf = new TextEncoder().encode(JSON.stringify(entry, null, 2));
      const { error } = await supabase.storage.from("pending-changes")
        .upload(`${entry.id}.json`, buf, { contentType: "application/json", upsert: false });
      if (error) return { error: error.message };
      await logChangeInternal("queued_change", "pending_change", args.change_type, args.description);
      return { success: true, id: entry.id, status: "pending" };
    }

    if (name === "get_change_log") {
      const limit = args.limit || 10;
      const { data: files, error } = await supabase.storage.from("change-log")
        .list("", { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      if (error || !files) return { entries: [], error: error?.message };
      const entries = [];
      for (const file of files.slice(0, limit)) {
        try {
          const { data } = await supabase.storage.from("change-log").download(file.name);
          if (data) entries.push(JSON.parse(await data.text()));
        } catch (e) {}
      }
      return { entries, count: entries.length };
    }

    if (name === "get_pending_changes") {
      const { data: files, error } = await supabase.storage.from("pending-changes")
        .list("", { limit: 50, sortBy: { column: "created_at", order: "desc" } });
      if (error || !files) return { changes: [], error: error?.message };
      const changes = [];
      for (const file of files) {
        try {
          const { data } = await supabase.storage.from("pending-changes").download(file.name);
          if (data) {
            const change = JSON.parse(await data.text());
            if (!args.status || change.status === args.status) changes.push(change);
          }
        } catch (e) {}
      }
      return { changes, count: changes.length };
    }

    return { error: `Unknown tool: ${name}` };
  } catch (e) {
    console.error(`[TOOL ERROR] ${name}:`, e.message);
    return { error: e.message };
  }
}

// ─── System prompt — scoped strictly to the current process ───
function buildSystemPrompt(orgName, processId, processName, kbContent) {
  const kbSection = kbContent
    ? `\n\n--- Knowledge Base for "${processName}" ---\n${kbContent}\n--- End of Knowledge Base ---`
    : `\n\n(No Knowledge Base has been set up for "${processName}" yet.)`;

  return `You are Pace, a digital employee at Zamp, embedded in the Pace Live Dashboard as an interactive assistant.

Your personality: Direct, warm, genuinely helpful. No emojis, no filler. Speak like a sharp colleague.

CURRENT CONTEXT:
- Organization: ${orgName || "Unknown"}
- Process: ${processName || "Unknown"} (ID: ${processId || DEFAULT_PROCESS_ID})

You are scoped exclusively to this process. All your answers, KB reads/writes, and tool calls should operate on process ID: ${processId || DEFAULT_PROCESS_ID}.
${kbSection}

WHAT YOU CAN DO:

1. ANSWER QUESTIONS about this process using the Knowledge Base above as your primary source of truth.
   - Answer directly from the KB content when possible.
   - If the KB doesn't cover something, say so honestly.

2. KNOWLEDGE BASE MANAGEMENT
   - Read the latest KB (use read_knowledge_base if you need the freshest version)
   - Update or append to the KB when the user asks you to
   - Always use the tools — don't just describe what you would do

3. QUEUED CHANGES (for the main Pace chat to apply)
   - Code changes, deployments, new features, external API integrations
   - Queue these as pending changes — they'll be reviewed from the main Pace chat

4. AUDIT TRAIL
   - Every change you make is logged automatically
   - You can view the change log and pending changes queue

IMPORTANT RULES:
- When the user asks to modify something, USE THE TOOLS. Don't just describe what you would do.
- Log every significant change for auditability.
- If a requested change requires code deployment or external access, queue it as a pending change.
- Default process ID for all tool calls is: ${processId || DEFAULT_PROCESS_ID}.
- Do NOT reference other processes or organisations — stay scoped to this one.`;
}

// ─── Fetch KB for the current process (to inject into system prompt) ───
async function fetchProcessKB(processId) {
  try {
    const pid = processId || DEFAULT_PROCESS_ID;
    const { data, error } = await supabase.storage.from("knowledge-base").download(`${pid}/kb.md`);
    if (error || !data) return null;
    return await data.text();
  } catch (e) {
    return null;
  }
}

// ─── Fetch recent runs for this process (context only) ───
async function fetchRecentRuns(processId) {
  try {
    const pid = processId || DEFAULT_PROCESS_ID;
    let query = supabase.from("activity_runs")
      .select("id, name, document_name, status, current_status_text, created_at")
      .eq("process_id", pid)
      .order("updated_at", { ascending: false })
      .limit(5);
    const { data: runs } = await query;
    if (!runs || runs.length === 0) return "";
    let ctx = "\n\n--- Recent Runs for This Process ---\n";
    for (const run of runs) {
      ctx += `- ${run.name} | Status: ${run.status} | ${run.current_status_text || ""} | ${run.created_at}\n`;
    }
    return ctx;
  } catch (e) {
    return "";
  }
}

// ─── Save chat log ───
async function saveChatLog(userMessage, assistantResponse) {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const log = `## Dashboard Chat — ${ts}\n**User:** ${userMessage}\n**Pace:** ${assistantResponse}\n`;
    const buf = new TextEncoder().encode(log);
    await supabase.storage.from("chat-logs")
      .upload(`dashboard-chat/${ts}.md`, buf, { contentType: "text/markdown", upsert: false, cacheControl: "no-cache" });
  } catch (e) {
    console.error("Failed to save chat log:", e.message);
  }
}

// ─── Main handler ───
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { message, history = [], orgName, processId, processName } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    const pid = processId || DEFAULT_PROCESS_ID;

    // Fetch KB + recent runs in parallel — both scoped to this process
    const [kbContent, recentRuns] = await Promise.all([
      fetchProcessKB(pid),
      fetchRecentRuns(pid),
    ]);

    const systemPrompt = buildSystemPrompt(orgName, pid, processName, kbContent) + recentRuns;

    // Build Gemini model with function calling
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations: tools }],
    });

    // Convert prior history to Gemini format
    // Gemini alternates user/model roles strictly — filter to valid pairs
    const geminiHistory = [];
    for (const msg of history.slice(-20)) {
      const role = msg.role === "assistant" ? "model" : "user";
      geminiHistory.push({ role, parts: [{ text: msg.content }] });
    }

    const chat = model.startChat({ history: geminiHistory });

    // Send first message
    let result = await chat.sendMessage(message);
    let response = result.response;
    let finalText = "";

    // Function calling loop (up to 10 rounds)
    for (let round = 0; round < 10; round++) {
      const candidate = response.candidates?.[0];
      if (!candidate) break;

      const parts = candidate.content?.parts || [];
      const functionCalls = parts.filter(p => p.functionCall);

      // No function calls — we have a final text response
      if (functionCalls.length === 0) {
        finalText = parts
          .filter(p => p.text)
          .map(p => p.text)
          .join("");
        break;
      }

      // Execute all function calls
      const functionResponses = [];
      for (const part of functionCalls) {
        const { name, args } = part.functionCall;
        console.log(`[ROUND ${round}] Tool: ${name}`);
        const toolResult = await executeTool(name, args || {}, pid);
        functionResponses.push({
          functionResponse: {
            name,
            response: toolResult,
          }
        });
      }

      // Send function results back to Gemini
      result = await chat.sendMessage(functionResponses);
      response = result.response;
    }

    if (!finalText) {
      finalText = "I processed your request but couldn't generate a text response.";
    }

    saveChatLog(message, finalText).catch(() => {});
    return res.status(200).json({ response: finalText });

  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
