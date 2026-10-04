"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { relayApi, apiClient, StatsData, Job } from "@/lib/api";

// Default valid payloads matching registered handlers in server/src/workers/handlers/index.ts
const DEFAULT_PAYLOADS: Record<string, string> = {
  send_email: '{\n  "to": "user@example.com"\n}',
  resize_image: '{\n  "url": "https://example.com/photo.jpg"\n}',
};

interface ResponseDetails {
  status: number;
  statusText: string;
  durationMs: number;
  data: any;
  isError: boolean;
}

interface Toast {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message: string;
  jobId?: string;
}

export default function DashboardPage() {
  // Filter & Queue State
  const [activeStatus, setActiveStatus] = useState<string>("");
  const [stats, setStats] = useState<StatsData | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalJobs, setTotalJobs] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [metaText, setMetaText] = useState<string>("Connecting to RelayX API...");
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Toast State
  const [toast, setToast] = useState<Toast | null>(null);

  // Dispatch Studio State
  const [selectedJobType, setSelectedJobType] = useState<string>("send_email");
  const [payloadJson, setPayloadJson] = useState<string>(DEFAULT_PAYLOADS["send_email"]);
  const [simulateFailure, setSimulateFailure] = useState<boolean>(false);
  const [maxAttempts, setMaxAttempts] = useState<number>(3);
  const [priority, setPriority] = useState<number>(0);
  const [delaySeconds, setDelaySeconds] = useState<string>("");
  const [runAt, setRunAt] = useState<string>("");
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");

  // Response Details State
  const [fullResponse, setFullResponse] = useState<ResponseDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedResponse, setCopiedResponse] = useState<boolean>(false);

  const showToast = (type: "success" | "error" | "info", title: string, message: string, jobId?: string) => {
    const toastObj: Toast = { id: Math.random().toString(), type, title, message, jobId };
    setToast(toastObj);
    setTimeout(() => {
      setToast((current) => (current?.id === toastObj.id ? null : current));
    }, 5000);
  };

  const fmtTime = (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " " + d.toLocaleDateString();
  };

  // Fetch Dashboard Stats & Jobs using API Service
  const fetchDashboardData = useCallback(async () => {
    try {
      const [statsData, jobsData] = await Promise.all([
        relayApi.getStats(),
        relayApi.getJobs({
          status: activeStatus || undefined,
          limit: pageSize,
          offset: (currentPage - 1) * pageSize,
        }),
      ]);

      setStats(statsData);
      setJobs(jobsData.jobs);
      setTotalJobs(jobsData.total);
      setMetaText(`Live Sync · ${new Date().toLocaleTimeString()}`);
      setLoading(false);
      setIsRefreshing(false);
    } catch (err: any) {
      setMetaText(`⚠ Backend Offline (http://localhost:5000)`);
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [activeStatus, currentPage, pageSize]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData();
  };

  // Handle Job Type change
  const handleJobTypeChange = (type: string) => {
    setSelectedJobType(type);
    if (DEFAULT_PAYLOADS[type]) {
      setPayloadJson(DEFAULT_PAYLOADS[type]);
    }
  };

  // Enqueue Job Handler
  const handleEnqueueJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFullResponse(null);
    const startTime = Date.now();

    const finalType = selectedJobType;

    // Validation 1: Job Type Check
    if (!finalType) {
      const errMsg = "Validation Error: Job Type is required.";
      setFullResponse({
        status: 400,
        statusText: "Bad Request",
        durationMs: 0,
        data: { error: errMsg },
        isError: true,
      });
      showToast("error", "Dispatch Validation Failed", errMsg);
      setIsSubmitting(false);
      return;
    }

    // Validation 2: Either delay_seconds OR run_at check
    const delayNum = delaySeconds.trim() !== "" ? Number(delaySeconds) : undefined;
    const runAtStr = runAt.trim() !== "" ? new Date(runAt).toISOString() : undefined;

    if (delayNum !== undefined && runAtStr !== undefined) {
      const errMsg = "Conflict: Provide EITHER Delay (Seconds) OR Scheduled Run At (run_at), not both.";
      setFullResponse({
        status: 400,
        statusText: "Bad Request",
        durationMs: 0,
        data: { error: errMsg },
        isError: true,
      });
      showToast("error", "Timing Conflict", errMsg);
      setIsSubmitting(false);
      return;
    }

    // Validation 3: Parse Payload JSON & merge simulateFailure flag
    let parsedPayload: Record<string, any> = {};
    try {
      if (payloadJson.trim()) {
        parsedPayload = JSON.parse(payloadJson);
      }
    } catch (err) {
      const errMsg = "JSON Syntax Error: Invalid formatting in Payload JSON.";
      setFullResponse({
        status: 400,
        statusText: "Bad Request",
        durationMs: 0,
        data: { error: errMsg },
        isError: true,
      });
      showToast("error", "Invalid JSON", errMsg);
      setIsSubmitting(false);
      return;
    }

    if (simulateFailure) {
      parsedPayload.simulateFailure = true;
    }

    // Dispatch Request via Axios
    try {
      const response = await apiClient.post("/api/jobs", {
        type: finalType,
        payload: parsedPayload,
        max_attempts: Number(maxAttempts),
        priority: Number(priority),
        delay_seconds: delayNum,
        run_at: runAtStr,
        idempotency_key: idempotencyKey.trim() || undefined,
      });

      const durationMs = Date.now() - startTime;
      const createdJobId = response.data?.id;
      const isReplay = response.headers["idempotent-replay"] === "true" || response.status === 200;

      setFullResponse({
        status: response.status,
        statusText: response.statusText || (isReplay ? "OK (Replay)" : "Created"),
        durationMs,
        data: response.data,
        isError: false,
      });

      showToast(
        "success",
        isReplay ? "♻️ Idempotent Replay" : "🚀 Job Enqueued Successfully",
        isReplay
          ? `Returned existing job ${createdJobId?.slice(0, 8)}… (status: ${response.data?.status?.toUpperCase()}).`
          : `Dispatched "${finalType}" to PostgreSQL queue with status PENDING.`,
        createdJobId
      );

      fetchDashboardData();
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const status = err.response?.status || 500;
      const statusText = err.response?.statusText || "Internal Server Error";
      const data = err.response?.data || { error: err.message || "Network / Server Connection Failed" };

      setFullResponse({
        status,
        statusText,
        durationMs,
        data,
        isError: true,
      });

      showToast("error", "Dispatch Failed", data.error || data.message || "Job request rejected");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Retry Dead Letter Job
  const handleRetryDlq = async (id: string) => {
    const startTime = Date.now();
    try {
      const response = await apiClient.post(`/api/dead-letter/${id}/retry`);
      const durationMs = Date.now() - startTime;
      setFullResponse({
        status: response.status,
        statusText: response.statusText || "OK",
        durationMs,
        data: response.data,
        isError: false,
      });

      showToast("success", "🔄 Job Re-queued", `Job ${id.slice(0, 8)}… moved back to PENDING.`, id);
      fetchDashboardData();
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const data = err.response?.data || { error: err.message };
      setFullResponse({
        status: err.response?.status || 500,
        statusText: "Error",
        durationMs,
        data,
        isError: true,
      });
      showToast("error", "Retry Failed", data.error || "Failed to retry job");
    }
  };

  // Discard Dead Letter Job
  const handleDiscardDlq = async (id: string) => {
    const startTime = Date.now();
    try {
      const response = await apiClient.delete(`/api/dead-letter/${id}`);
      const durationMs = Date.now() - startTime;
      setFullResponse({
        status: response.status,
        statusText: response.statusText || "OK",
        durationMs,
        data: response.data || { success: true, message: `Job ${id} deleted from DLQ` },
        isError: false,
      });

      showToast("info", "🗑️ Job Discarded", `Job ${id.slice(0, 8)}… removed permanently.`);
      fetchDashboardData();
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const data = err.response?.data || { error: err.message };
      setFullResponse({
        status: err.response?.status || 500,
        statusText: "Error",
        durationMs,
        data,
        isError: true,
      });
      showToast("error", "Delete Failed", data.error || "Failed to discard job");
    }
  };

  const copyResponseJson = () => {
    if (!fullResponse) return;
    navigator.clipboard.writeText(JSON.stringify(fullResponse.data, null, 2));
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  // Filter jobs by search query
  const filteredJobs = searchQuery.trim() === ""
    ? jobs
    : jobs.filter(
        (j) =>
          j.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          j.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (j.last_error && j.last_error.toLowerCase().includes(searchQuery.toLowerCase()))
      );

  return (
    <div className="relative min-h-screen bg-neutral-950 text-neutral-200 overflow-x-hidden font-sans selection:bg-amber-900/40 selection:text-white">
      {/* ── SaaS Tactile Background: Grain Jitter + Warm Ambient Spotlight ──── */}
      <div className="pointer-events-none fixed inset-0 z-50 grain-jitter-overlay animate-subtle-jitter opacity-80" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-ambient-glow animate-ambient-glow" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-grid-subtle opacity-70" />

      {/* ── Toast Notification ────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-3 right-4 z-200 max-w-sm w-full bg-neutral-900/95 border border-neutral-700 shadow-2xl rounded-xl p-3.5 font-sans text-xs backdrop-blur-md animate-in slide-in-from-top-2 duration-200 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {toast.type === "success" ? "✅" : toast.type === "error" ? "❌" : "ℹ️"}
              </span>
              <span className="font-bold text-white text-xs">{toast.title}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-neutral-500 hover:text-white transition font-bold text-sm"
            >
              ✕
            </button>
          </div>

          <p className="text-[11px] text-neutral-300 leading-snug">{toast.message}</p>

          {toast.jobId && (
            <div className="flex items-center justify-between pt-1 border-t border-neutral-800 text-[10px] font-mono">
              <span className="text-neutral-400">ID: <code className="text-amber-400 font-bold">{toast.jobId.slice(0, 8)}…</code></span>
              <button
                onClick={() => setSearchQuery(toast.jobId || "")}
                className="text-amber-400 hover:underline font-bold"
              >
                Find in Explorer →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Compact Navigation Header ─────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-40 w-full border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2.5 group">
              <img src="/logo.svg" alt="RelayX Logo" className="h-5 w-auto object-contain transition group-hover:scale-105" />
              <span className="font-tnr text-base font-bold tracking-tight text-white">RelayX</span>
            </Link>
            <span className="text-neutral-700">/</span>
            <span className="px-1.5 py-0.5 text-[9px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-800 rounded">
              CONSOLE WORKSPACE
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-neutral-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px]">{metaText}</span>
            </div>

            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Refresh Queue State"
              className="px-2 py-1 text-xs font-mono rounded border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 transition flex items-center gap-1"
            >
              <span>{isRefreshing ? "..." : "🔄"}</span>
              <span className="hidden md:inline text-[11px]">Sync</span>
            </button>

            <Link
              href="/about"
              className="px-2 py-1 text-xs font-mono rounded border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 transition text-[11px]"
            >
              Guide
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Dashboard Workspace ──────────────────────────────────────── */}
      <main className="relative z-10 max-w-7xl mx-auto pt-24 pb-16 px-4 sm:px-5 space-y-4">

        {/* ── 1. Top Metrics Strip (7 Stat Boxes with Times New Roman Numerals) ── */}
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            
            <div className="p-3 rounded-lg border border-neutral-800/80 bg-neutral-900/50 backdrop-blur-md">
              <div className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider">Total Jobs</div>
              <div className="font-tnr text-xl font-bold text-white mt-0.5">
                {stats ? stats.counts.total : "—"}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-amber-900/30 bg-amber-950/15 backdrop-blur-md">
              <div className="text-[9px] font-mono text-amber-500 uppercase tracking-wider">Pending</div>
              <div className="font-tnr text-xl font-bold text-amber-400 mt-0.5">
                {stats ? stats.counts.pending : "—"}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-sky-900/30 bg-sky-950/15 backdrop-blur-md">
              <div className="text-[9px] font-mono text-sky-500 uppercase tracking-wider">Processing</div>
              <div className="font-tnr text-xl font-bold text-sky-400 mt-0.5 flex items-center gap-1.5">
                <span>{stats ? stats.counts.processing : "—"}</span>
                {stats && stats.counts.processing > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
                )}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-emerald-900/30 bg-emerald-950/15 backdrop-blur-md">
              <div className="text-[9px] font-mono text-emerald-500 uppercase tracking-wider">Completed</div>
              <div className="font-tnr text-xl font-bold text-emerald-400 mt-0.5">
                {stats ? stats.counts.completed : "—"}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-rose-900/30 bg-rose-950/15 backdrop-blur-md">
              <div className="text-[9px] font-mono text-rose-500 uppercase tracking-wider">Dead Letter (DLQ)</div>
              <div className="font-tnr text-xl font-bold text-rose-400 mt-0.5">
                {stats ? stats.counts.dead_letter : "—"}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-neutral-800/80 bg-neutral-900/50 backdrop-blur-md">
              <div className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider">Success Rate</div>
              <div className="font-tnr text-xl font-bold text-white mt-0.5">
                {stats && stats.performance.success_rate_percent !== null
                  ? `${stats.performance.success_rate_percent}%`
                  : "100%"}
              </div>
            </div>

            {/* 7th Stat Box: Avg Duration */}
            <div className="p-3 rounded-lg border border-neutral-800/80 bg-neutral-900/50 backdrop-blur-md">
              <div className="text-[9px] font-mono text-amber-500 uppercase tracking-wider">Avg Duration</div>
              <div className="font-tnr text-xl font-bold text-amber-300 mt-0.5">
                {stats?.performance.avg_processing_time_seconds !== undefined
                  ? `${stats.performance.avg_processing_time_seconds}s`
                  : "0s"}
              </div>
            </div>

          </div>
        </div>

        {/* ── 2. DLQ Alert Banner (Appears only when DLQ > 0) ───────────────── */}
        {stats && stats.dead_letter.count > 0 && (
          <div className="p-3 rounded-lg border border-rose-800/80 bg-rose-950/20 text-rose-200 text-xs font-mono flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2">
              <span className="animate-pulse">⚠️</span>
              <span>
                <strong>{stats.dead_letter.count} poison-pill job(s) in Dead Letter Queue</strong>
                {stats.dead_letter.oldest_dead_lettered_at
                  ? ` — oldest since ${fmtTime(stats.dead_letter.oldest_dead_lettered_at)}`
                  : ""}
              </span>
            </div>
            <button
              onClick={() => {
                setActiveStatus("dead_letter");
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded bg-rose-900 hover:bg-rose-800 text-white font-bold transition text-xs font-mono"
            >
              Filter DLQ Jobs →
            </button>
          </div>
        )}

        {/* ── 3. Side-by-Side Structured Workspace (Dispatch Studio LEFT, Queue Explorer RIGHT) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          
          {/* ══════════════════════════════════════════════════════════════════
              LEFT COLUMN: DISPATCH STUDIO (lg:col-span-5)
          ══════════════════════════════════════════════════════════════════ */}
          <section className="lg:col-span-5 space-y-3.5">
            
            {/* Dispatch Studio Card */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-md p-4 space-y-3.5 shadow-lg">
              
              <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2.5">
                <div>
                  <h2 className="font-tnr text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                    <span>⚡ Dispatch Studio</span>
                  </h2>
                  <p className="text-[10px] text-neutral-400 font-light">
                    Enqueue tasks directly into PostgreSQL queue
                  </p>
                </div>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-neutral-400">
                  POST /api/jobs
                </span>
              </div>

              <form onSubmit={handleEnqueueJob} className="space-y-3 text-xs font-mono">
                
                {/* Job Type Selector */}
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-300 block font-bold">
                    Job Type <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={selectedJobType}
                    onChange={(e) => handleJobTypeChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-md bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-amber-500 font-mono text-xs"
                  >
                    <option value="send_email">send_email (Handler registered)</option>
                    <option value="resize_image">resize_image (Handler registered)</option>
                  </select>
                </div>

                {/* Priority & Max Attempts */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] text-neutral-300 block font-bold">Priority (0-100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
                      className="w-full px-2.5 py-1 rounded-md bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-amber-500 text-xs"
                    />
                    <span className="text-[8px] text-neutral-500">Higher = claimed first</span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-neutral-300 block font-bold">Max Attempts</label>
                    <input
                      type="number"
                      min="1"
                      max="25"
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(e.target.value === "" ? 1 : Math.max(1, Math.min(25, Number(e.target.value))))}
                      className="w-full px-2.5 py-1 rounded-md bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-amber-500 text-xs"
                    />
                    <span className="text-[8px] text-neutral-500">DLQ threshold</span>
                  </div>
                </div>

                {/* Delay & Schedule */}
                <div className="space-y-1.5 pt-1 border-t border-neutral-800/80">
                  <div className="text-[9px] text-neutral-400">Scheduling (Optional — Choose One)</div>
                  
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-0.5">
                      <label className="text-[9px] text-neutral-400">Delay (Seconds)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 10"
                        value={delaySeconds}
                        onChange={(e) => setDelaySeconds(e.target.value)}
                        className="w-full px-2.5 py-1 rounded-md bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-amber-500 text-xs"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[9px] text-neutral-400">Scheduled (run_at)</label>
                      <input
                        type="datetime-local"
                        value={runAt}
                        onChange={(e) => setRunAt(e.target.value)}
                        className="w-full px-2 py-1 rounded-md bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-amber-500 text-[10px]"
                      />
                    </div>
                  </div>
                </div>

                {/* Idempotency Key */}
                <div className="space-y-1 pt-1 border-t border-neutral-800/80">
                  <label className="text-[10px] text-neutral-300 block font-bold">Idempotency Key (Optional)</label>
                  <input
                    type="text"
                    value={idempotencyKey}
                    onChange={(e) => setIdempotencyKey(e.target.value)}
                    placeholder="e.g. tx_order_8829"
                    className="w-full px-2.5 py-1 rounded-md bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-amber-500 text-xs"
                  />
                  <span className="text-[8px] text-neutral-500">Duplicate requests return existing job without re-executing</span>
                </div>

                {/* Payload JSON with Error Simulation Toggle */}
                <div className="space-y-1.5 pt-1 border-t border-neutral-800/80">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-neutral-300 block font-bold">
                      Payload JSON
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800 hover:border-amber-700/80 transition">
                      <input
                        type="checkbox"
                        checked={simulateFailure}
                        onChange={(e) => setSimulateFailure(e.target.checked)}
                        className="w-3 h-3 rounded accent-amber-500 cursor-pointer"
                      />
                      <span className="text-[9px] text-amber-300 font-bold">⚡ Simulate Error</span>
                    </label>
                  </div>

                  <textarea
                    rows={4}
                    value={payloadJson}
                    onChange={(e) => setPayloadJson(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 text-emerald-400 font-mono text-[11px] focus:outline-none focus:border-amber-500 leading-relaxed"
                  />
                  <span className="text-[9px] text-neutral-500 block">
                    {selectedJobType === "send_email" && "Required schema: { \"to\": \"string\" }"}
                    {selectedJobType === "resize_image" && "Required schema: { \"url\": \"string\" }"}
                  </span>
                </div>

                {/* Submit Action */}
                <div className="pt-2 border-t border-neutral-800 space-y-1">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2 rounded-lg bg-linear-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-semibold text-xs transition shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <span>{isSubmitting ? "Dispatching to PostgreSQL..." : "🚀 Dispatch Job Request"}</span>
                  </button>
                </div>

              </form>

            </div>

            {/* HTTP Response Card (Clean Inspection Box) */}
            {fullResponse && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden font-mono text-xs shadow-lg">
                <div className="px-3 py-2 border-b border-neutral-800 bg-neutral-900/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border ${
                      !fullResponse.isError && fullResponse.status >= 200 && fullResponse.status < 300
                        ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                        : "bg-rose-950 text-rose-400 border-rose-800"
                    }`}>
                      HTTP {fullResponse.status} {fullResponse.statusText}
                    </span>
                    <span className="text-[9px] text-neutral-500">{fullResponse.durationMs}ms</span>
                  </div>

                  <button
                    onClick={copyResponseJson}
                    className="px-2 py-0.5 rounded text-[9px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition"
                  >
                    {copiedResponse ? "Copied!" : "Copy JSON"}
                  </button>
                </div>

                <div className="p-3 overflow-x-auto text-[10px] leading-relaxed max-h-48 overflow-y-auto">
                  <pre className={fullResponse.isError ? "text-rose-400" : "text-emerald-400"}>
                    <code>{JSON.stringify(fullResponse.data, null, 2)}</code>
                  </pre>
                </div>
              </div>
            )}

          </section>

          {/* ══════════════════════════════════════════════════════════════════
              RIGHT COLUMN: QUEUE EXPLORER (lg:col-span-7)
          ══════════════════════════════════════════════════════════════════ */}
          <section className="lg:col-span-7 space-y-3">
            
            {/* Filter Pills & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1 flex-wrap text-xs font-mono">
                {[
                  { label: "All Statuses", value: "" },
                  { label: "Pending", value: "pending" },
                  { label: "Processing", value: "processing" },
                  { label: "Completed", value: "completed" },
                  { label: "Dead Letter", value: "dead_letter" },
                ].map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => {
                      setActiveStatus(tab.value);
                      setCurrentPage(1);
                    }}
                    className={`px-2 py-1 rounded transition border text-[11px] ${
                      activeStatus === tab.value
                        ? "border-amber-500/80 text-amber-200 bg-amber-950/40 font-bold"
                        : "border-neutral-800 text-neutral-400 bg-neutral-900/60 hover:text-neutral-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="w-full sm:w-48">
                <input
                  type="text"
                  placeholder="Filter UUID / type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Table Frame */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 backdrop-blur-md overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-neutral-950/90 text-[9px] text-neutral-400 uppercase border-b border-neutral-800">
                    <tr>
                      <th className="p-2.5">Job ID</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Priority</th>
                      <th className="p-2.5">Attempts</th>
                      <th className="p-2.5">Last Error</th>
                      <th className="p-2.5">Created</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 text-[11px]">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-neutral-500">
                          Fetching PostgreSQL queue state...
                        </td>
                      </tr>
                    ) : filteredJobs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-neutral-500">
                          No background jobs match current criteria. Dispatch one from the studio on the left!
                        </td>
                      </tr>
                    ) : (
                      filteredJobs.map((j) => {
                        const statusBadge =
                          j.status === "completed"
                            ? "bg-emerald-950/80 text-emerald-400 border-emerald-800"
                            : j.status === "processing"
                            ? "bg-sky-950/80 text-sky-400 border-sky-800 animate-pulse"
                            : j.status === "dead_letter"
                            ? "bg-rose-950/80 text-rose-400 border-rose-800"
                            : "bg-neutral-900 text-neutral-400 border-neutral-800";

                        const isToastTarget = toast?.jobId === j.id;

                        return (
                          <tr
                            key={j.id}
                            className={`transition-colors ${
                              isToastTarget ? "bg-amber-950/30 border-l-2 border-l-amber-500" : "hover:bg-neutral-900/60"
                            }`}
                          >
                            <td className="p-2.5 font-bold text-neutral-200" title={j.id}>
                              {j.id.slice(0, 8)}…
                            </td>
                            <td className="p-2.5 text-neutral-300 font-mono text-[11px]">{j.type}</td>
                            <td className="p-2.5">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] border uppercase font-mono ${statusBadge}`}>
                                {j.status.replace("_", " ")}
                              </span>
                            </td>
                            <td className="p-2.5">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border font-mono ${
                                j.priority > 50
                                  ? "bg-rose-950 text-rose-300 border-rose-800"
                                  : j.priority > 0
                                  ? "bg-amber-950 text-amber-300 border-amber-800"
                                  : "bg-neutral-900 text-neutral-500 border-neutral-800"
                              }`}>
                                {j.priority ?? 0}
                              </span>
                            </td>
                            <td className="p-2.5 text-neutral-400">
                              {j.attempts} / {j.max_attempts}
                            </td>
                            <td className="p-2.5 text-neutral-400 max-w-35 truncate text-[10px]" title={j.last_error || ""}>
                              {j.last_error || "—"}
                            </td>
                            <td className="p-2.5 text-neutral-400 text-[10px]">{fmtTime(j.created_at)}</td>
                            <td className="p-2.5 text-right">
                              {j.status === "dead_letter" ? (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleRetryDlq(j.id)}
                                    className="px-2 py-0.5 text-[9px] rounded bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-300 transition"
                                    title="Re-queue to Pending"
                                  >
                                    Retry
                                  </button>
                                  <button
                                    onClick={() => handleDiscardDlq(j.id)}
                                    className="px-2 py-0.5 text-[9px] rounded bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 transition"
                                    title="Delete from DLQ"
                                  >
                                    Delete
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-neutral-600">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Compact Pagination Bar */}
              {(() => {
                const totalPages = Math.max(1, Math.ceil(totalJobs / pageSize));
                const startItem = totalJobs === 0 ? 0 : (currentPage - 1) * pageSize + 1;
                const endItem = Math.min(currentPage * pageSize, totalJobs);

                return (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-2.5 bg-neutral-950/80 border-t border-neutral-800 text-xs font-mono">
                    <div className="flex items-center gap-2.5">
                      <span className="text-neutral-400 text-[10px]">
                        Showing <strong className="text-white font-mono">{startItem}</strong>–<strong className="text-white font-mono">{endItem}</strong> of <strong className="text-amber-400 font-mono">{totalJobs}</strong> jobs
                      </span>
                      
                      <div className="flex items-center gap-1 pl-2 border-l border-neutral-800">
                        <span className="text-[9px] text-neutral-500 uppercase">Per page:</span>
                        <select
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                          className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 text-[10px] focus:outline-none focus:border-amber-500 cursor-pointer"
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1 || loading}
                        className="px-1.5 py-0.5 rounded border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition text-[11px]"
                      >
                        «
                      </button>
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1 || loading}
                        className="px-2 py-0.5 rounded border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition text-[11px]"
                      >
                        ‹ Prev
                      </button>

                      <span className="px-2 text-neutral-300 font-mono text-[11px]">
                        Page {currentPage} of {totalPages}
                      </span>

                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages || loading}
                        className="px-2 py-0.5 rounded border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition text-[11px]"
                      >
                        Next ›
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage >= totalPages || loading}
                        className="px-1.5 py-0.5 rounded border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition text-[11px]"
                      >
                        »
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

          </section>

        </div>

      </main>
    </div>
  );
}
