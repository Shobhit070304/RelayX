"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { relayApi, apiClient, StatsData, Job } from "@/lib/api";

// Default basic valid payloads matching backend registered handlers in src/workers/handlers/index.ts
const DEFAULT_PAYLOADS: Record<string, string> = {
  send_email: '{\n  "to": "user@example.com"\n}',
  resize_image: '{\n  "url": "https://example.com/photo.jpg"\n}',
  custom: '{\n  "key": "value"\n}',
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
  const [activeStatus, setActiveStatus] = useState<string>("");
  const [stats, setStats] = useState<StatsData | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [metaText, setMetaText] = useState<string>("Connecting via Axios...");
  const [loading, setLoading] = useState<boolean>(true);

  // --- Toast State ---
  const [toast, setToast] = useState<Toast | null>(null);

  // --- Playground Form State ---
  const [selectedJobType, setSelectedJobType] = useState<string>("send_email");
  const [customJobType, setCustomJobType] = useState<string>("");
  const [payloadJson, setPayloadJson] = useState<string>(DEFAULT_PAYLOADS["send_email"]);
  const [simulateFailure, setSimulateFailure] = useState<boolean>(false);
  const [maxAttempts, setMaxAttempts] = useState<number>(3);
  const [delaySeconds, setDelaySeconds] = useState<string>("");
  const [runAt, setRunAt] = useState<string>("");
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");

  // Full HTTP Response Details State
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
    return d.toLocaleTimeString() + " " + d.toLocaleDateString();
  };

  // Fetch Dashboard Stats & Jobs using Axios API Service
  const fetchDashboardData = async () => {
    try {
      const [statsData, jobsData] = await Promise.all([
        relayApi.getStats(),
        relayApi.getJobs({ status: activeStatus || undefined, limit: 20 }),
      ]);

      setStats(statsData);
      setJobs(jobsData.jobs);
      setMetaText(`Last updated: ${new Date().toLocaleTimeString()} · Auto-refreshes every 5s`);
      setLoading(false);
    } catch (err: any) {
      setMetaText(`⚠ Axios Error: ${err.message || "Backend server offline (http://localhost:3000)"}`);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, [activeStatus]);

  // Handle Job Type change
  const handleJobTypeChange = (type: string) => {
    setSelectedJobType(type);
    if (DEFAULT_PAYLOADS[type]) {
      setPayloadJson(DEFAULT_PAYLOADS[type]);
    }
  };

  // --- Enqueue Job Handler (Only fires on Dispatch Job button click) ---
  const handleEnqueueJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFullResponse(null);
    const startTime = Date.now();

    const finalType = selectedJobType === "custom" ? customJobType.trim() : selectedJobType;

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
    const runAtStr = runAt.trim() !== "" ? runAt.trim() : undefined;

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
        delay_seconds: delayNum,
        run_at: runAtStr,
        idempotency_key: idempotencyKey.trim() || undefined,
      });

      const durationMs = Date.now() - startTime;
      const createdJobId = response.data?.data?.id || response.data?.job?.id || response.data?.id;

      setFullResponse({
        status: response.status,
        statusText: response.statusText || "Created",
        durationMs,
        data: response.data,
        isError: false,
      });

      showToast(
        "success",
        "🚀 Job Fired Successfully!",
        `Job type "${finalType}" dispatched to queue with status PENDING.`,
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

  // Retry Dead Letter Job via Axios
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

      showToast("success", "🔄 DLQ Job Re-queued", `Job ${id.slice(0, 8)}… moved back to PENDING.`, id);
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
      showToast("error", "Retry Error", data.error || "Failed to retry job");
    }
  };

  // Discard Dead Letter Job via Axios
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

      showToast("info", "🗑️ DLQ Job Deleted", `Job ${id.slice(0, 8)}… removed from database.`);
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
      showToast("error", "Delete Error", data.error || "Failed to discard job");
    }
  };

  const copyResponseJson = () => {
    if (!fullResponse) return;
    navigator.clipboard.writeText(JSON.stringify(fullResponse.data, null, 2));
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  const scrollToJobsTable = () => {
    const el = document.getElementById("jobs-table-section");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="relative min-h-screen bg-neutral-950 text-neutral-200 overflow-x-hidden font-sans selection:bg-neutral-800 selection:text-neutral-100">
      
      {/* ── FLOATING TOAST NOTIFICATION ──────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 max-w-sm w-full bg-neutral-900 border border-neutral-700 shadow-2xl rounded-lg p-4 font-mono text-xs animate-in slide-in-from-top-3 duration-200 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-base">
                {toast.type === "success" ? "✅" : toast.type === "error" ? "❌" : "ℹ️"}
              </span>
              <span className="font-bold text-white text-xs">{toast.title}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-neutral-500 hover:text-white transition font-bold"
            >
              ✕
            </button>
          </div>

          <p className="text-[11px] text-neutral-300 font-sans leading-tight">{toast.message}</p>

          {toast.jobId && (
            <div className="flex items-center justify-between pt-1 border-t border-neutral-800 text-[10px]">
              <span className="text-neutral-400">ID: <code className="text-indigo-400 font-bold">{toast.jobId}</code></span>
              <button
                onClick={scrollToJobsTable}
                className="text-indigo-400 hover:underline font-bold"
              >
                View in Table ↓
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ambient background light effects matching main site */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(99,102,241,0.12),transparent_70%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-grid-subtle opacity-30" />

      {/* Navigation Header (Fixed & Blurry) */}
      <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-neutral-800/80 bg-neutral-950/75 backdrop-blur-md backdrop-saturate-150 px-6 py-3.5 shadow-lg">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs text-neutral-400 hover:text-white transition flex items-center gap-1 font-mono">
              ← Home
            </Link>
            <span className="text-neutral-800">|</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-tnr text-base font-bold text-white italic">
                RelayX Dashboard
              </span>
            </div>
            <span className="px-1.5 py-0.5 text-[10px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-800 rounded">
              CONSOLE
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-neutral-400 font-mono hidden md:inline">{metaText}</span>
            <a
              href="https://github.com/Shobhit070304/distributed-job-platform"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 text-xs font-mono rounded border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 transition flex items-center gap-1.5"
            >
              <span>⭐ Star</span>
              <span className="text-neutral-500 font-bold">Shobhit070304</span>
            </a>
          </div>

        </div>
      </header>

      {/* Main Content Area (Adjusted for Fixed Header) */}
      <main className="relative z-10 max-w-6xl mx-auto pt-20 sm:pt-22 p-4 sm:p-6 space-y-6">

        {/* DLQ Alert Banner */}
        {stats && stats.dead_letter.count > 0 && (
          <div className="p-3 rounded border border-rose-900/80 bg-rose-950/30 text-rose-300 text-xs font-mono flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="animate-bounce">⚠️</span>
              <span>
                <strong>{stats.dead_letter.count} job(s)</strong> in Dead Letter Queue (DLQ)
                {stats.dead_letter.oldest_dead_lettered_at
                  ? ` — oldest since ${fmtTime(stats.dead_letter.oldest_dead_lettered_at)}`
                  : ""}
              </span>
            </div>
            <button
              onClick={() => setActiveStatus("dead_letter")}
              className="px-2 py-0.5 text-[10px] rounded bg-rose-900 text-rose-100 hover:bg-rose-800 transition uppercase"
            >
              Filter DLQ Jobs ↓
            </button>
          </div>
        )}

        {/* Overview Stats Cards */}
        <div>
          <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-2">
            [ System Overview ]
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-3.5 rounded border border-neutral-800 bg-neutral-900/50">
              <div className="text-[10px] font-mono text-neutral-500">Total Jobs</div>
              <div className="font-tnr text-2xl font-bold text-white mt-1">{stats ? stats.counts.total : "—"}</div>
            </div>
            <div className="p-3.5 rounded border border-neutral-800 bg-neutral-900/50">
              <div className="text-[10px] font-mono text-amber-500">Pending</div>
              <div className="font-tnr text-2xl font-bold text-amber-400 mt-1">{stats ? stats.counts.pending : "—"}</div>
            </div>
            <div className="p-3.5 rounded border border-neutral-800 bg-neutral-900/50">
              <div className="text-[10px] font-mono text-blue-500">Processing</div>
              <div className="font-tnr text-2xl font-bold text-blue-400 mt-1">{stats ? stats.counts.processing : "—"}</div>
            </div>
            <div className="p-3.5 rounded border border-neutral-800 bg-neutral-900/50">
              <div className="text-[10px] font-mono text-emerald-500">Completed</div>
              <div className="font-tnr text-2xl font-bold text-emerald-400 mt-1">{stats ? stats.counts.completed : "—"}</div>
            </div>
            <div className="p-3.5 rounded border border-neutral-800 bg-neutral-900/50">
              <div className="text-[10px] font-mono text-purple-400">Dead Letter</div>
              <div className="font-tnr text-2xl font-bold text-purple-400 mt-1">{stats ? stats.counts.dead_letter : "—"}</div>
            </div>
          </div>
        </div>

        {/* Throughput & Performance Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Throughput */}
          <div className="p-4 rounded border border-neutral-800 bg-neutral-900/40 space-y-2">
            <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
              [ Engine Throughput ]
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded bg-neutral-950 border border-neutral-900">
                <span className="text-neutral-500 block text-[10px]">Completed (1h)</span>
                <span className="font-tnr text-lg text-emerald-400 font-bold">{stats ? stats.throughput.completed_last_hour : "—"}</span>
              </div>
              <div className="p-2.5 rounded bg-neutral-950 border border-neutral-900">
                <span className="text-neutral-500 block text-[10px]">Completed (24h)</span>
                <span className="font-tnr text-lg text-emerald-400 font-bold">{stats ? stats.throughput.completed_last_24h : "—"}</span>
              </div>
              <div className="p-2.5 rounded bg-neutral-950 border border-neutral-900">
                <span className="text-neutral-500 block text-[10px]">Failed (1h)</span>
                <span className="font-tnr text-lg text-rose-400 font-bold">{stats ? stats.throughput.failed_last_hour : "—"}</span>
              </div>
              <div className="p-2.5 rounded bg-neutral-950 border border-neutral-900">
                <span className="text-neutral-500 block text-[10px]">Failed (24h)</span>
                <span className="font-tnr text-lg text-rose-400 font-bold">{stats ? stats.throughput.failed_last_24h : "—"}</span>
              </div>
            </div>
          </div>

          {/* Performance */}
          <div className="p-4 rounded border border-neutral-800 bg-neutral-900/40 space-y-2">
            <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
              [ Processing Telemetry ]
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3.5 rounded bg-neutral-950 border border-neutral-900">
                <span className="text-neutral-500 block text-[10px]">Avg Processing Time</span>
                <span className="font-tnr text-xl text-white font-bold">
                  {stats && stats.performance.avg_processing_time_seconds !== null
                    ? `${stats.performance.avg_processing_time_seconds}s`
                    : "N/A"}
                </span>
              </div>
              <div className="p-3.5 rounded bg-neutral-950 border border-neutral-900">
                <span className="text-neutral-500 block text-[10px]">Success Rate</span>
                <span className="font-tnr text-xl text-emerald-400 font-bold">
                  {stats && stats.performance.success_rate_percent !== null
                    ? `${stats.performance.success_rate_percent}%`
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Jobs Table (Dashboard Section) */}
        <div id="jobs-table-section" className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
              [ Recent Jobs Table ]
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs font-mono">
              {[
                { label: "All Jobs", value: "" },
                { label: "Pending", value: "pending" },
                { label: "Processing", value: "processing" },
                { label: "Completed", value: "completed" },
                { label: "Dead Letter", value: "dead_letter" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveStatus(tab.value)}
                  className={`px-2.5 py-1 rounded transition border ${
                    activeStatus === tab.value
                      ? "border-indigo-500 text-indigo-300 bg-indigo-950/40 font-bold"
                      : "border-neutral-800 text-neutral-400 bg-neutral-900/60 hover:text-neutral-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded border border-neutral-800 bg-neutral-900/60 overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-neutral-950/80 text-[10px] text-neutral-500 uppercase border-b border-neutral-800">
                <tr>
                  <th className="p-3">Job ID</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Attempts</th>
                  <th className="p-3">Last Error</th>
                  <th className="p-3">Created At</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-neutral-500">
                      Loading queue data via Axios...
                    </td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-neutral-500">
                      No jobs match current status filter.
                    </td>
                  </tr>
                ) : (
                  jobs.map((j) => {
                    const statusColor =
                      j.status === "completed"
                        ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                        : j.status === "processing"
                        ? "bg-blue-950 text-blue-400 border-blue-800 animate-pulse"
                        : j.status === "failed"
                        ? "bg-amber-950 text-amber-400 border-amber-800"
                        : j.status === "dead_letter"
                        ? "bg-rose-950 text-rose-400 border-rose-800"
                        : "bg-neutral-900 text-neutral-400 border-neutral-800";

                    const isToastTarget = toast?.jobId === j.id;

                    return (
                      <tr
                        key={j.id}
                        className={`transition-colors ${
                          isToastTarget ? "bg-indigo-950/50 border-l-2 border-l-indigo-500" : "hover:bg-neutral-900/80"
                        }`}
                      >
                        <td className="p-3 font-bold text-neutral-200" title={j.id}>
                          {j.id.slice(0, 8)}…
                        </td>
                        <td className="p-3 text-neutral-300 font-mono text-[11px]">{j.type}</td>
                        <td className="p-3">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] border uppercase ${statusColor}`}>
                            {j.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-3 text-neutral-400">
                          {j.attempts} / {j.max_attempts}
                        </td>
                        <td className="p-3 text-neutral-400 max-w-[180px] truncate text-[11px]" title={j.last_error || ""}>
                          {j.last_error || "—"}
                        </td>
                        <td className="p-3 text-neutral-400 text-[11px]">{fmtTime(j.created_at)}</td>
                        <td className="p-3 text-right">
                          {j.status === "dead_letter" ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleRetryDlq(j.id)}
                                className="px-2 py-0.5 text-[10px] rounded bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-300 transition"
                                title="Re-queue to Pending"
                              >
                                Retry
                              </button>
                              <button
                                onClick={() => handleDiscardDlq(j.id)}
                                className="px-2 py-0.5 text-[10px] rounded bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 transition"
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
        </div>

        {/* ── SEPARATED API PLAYGROUND (AT THE BOTTOM OF THE PAGE) ───────────── */}
        <section className="mt-14 border-t-2 border-indigo-600/80 rounded-xl bg-neutral-900/90 border border-neutral-800 shadow-2xl p-5 sm:p-6 space-y-5">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-3">
            <div>
              <div className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest font-bold">
                ⚡ API Request Testing Playground
              </div>
              <h2 className="font-tnr text-2xl font-normal text-white">
                Dispatch Background Jobs
              </h2>
              <p className="text-xs text-neutral-400">
                Jobs are sent <strong>only when you click &quot;Dispatch Job Request&quot;</strong> below.
              </p>
            </div>
            
            <div className="text-right">
              <span className="px-2 py-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 rounded">
                POST /api/jobs
              </span>
            </div>
          </div>

          {/* Playground Form */}
          <form onSubmit={handleEnqueueJob} className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs font-mono">
            
            {/* Job Type Selector */}
            <div className="md:col-span-4 space-y-1">
              <label className="text-[10px] text-neutral-300 block font-bold">
                Job Type <span className="text-rose-400">*</span>
              </label>
              <select
                value={selectedJobType}
                onChange={(e) => handleJobTypeChange(e.target.value)}
                className="w-full px-3 py-2 rounded bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="send_email">send_email (Handler registered)</option>
                <option value="resize_image">resize_image (Handler registered)</option>
                <option value="custom">Custom Job Type...</option>
              </select>
            </div>

            {/* Custom Job Type Input if selected */}
            {selectedJobType === "custom" && (
              <div className="md:col-span-4 space-y-1">
                <label className="text-[10px] text-neutral-300 block font-bold">
                  Custom Type Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={customJobType}
                  onChange={(e) => setCustomJobType(e.target.value)}
                  placeholder="e.g. webhook.dispatch"
                  className="w-full px-3 py-2 rounded bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            )}

            {/* Simulate Failure Single Toggle */}
            <div className="md:col-span-4 flex items-center gap-2 pt-5">
              <label className="flex items-center gap-2 cursor-pointer bg-neutral-950 px-3 py-2 rounded border border-neutral-800 hover:border-amber-700/80 transition w-full">
                <input
                  type="checkbox"
                  checked={simulateFailure}
                  onChange={(e) => setSimulateFailure(e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                />
                <span className="text-xs text-amber-300 font-bold">
                  ⚡ Simulate Failure <span className="text-[10px] text-neutral-400 font-normal">(simulateFailure: true)</span>
                </span>
              </label>
            </div>

            {/* Max Attempts (Optional) */}
            <div className="md:col-span-4 space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-neutral-300 block font-bold">Max Attempts</label>
                <span className="text-[9px] text-neutral-500 uppercase font-mono">(Optional)</span>
              </div>
              <input
                type="number"
                min="1"
                max="10"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Idempotency Key (Optional) */}
            <div className="md:col-span-8 space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-neutral-300 block font-bold">Idempotency Key (idempotency_key)</label>
                <span className="text-[9px] text-neutral-500 uppercase font-mono">(Optional)</span>
              </div>
              <input
                type="text"
                value={idempotencyKey}
                onChange={(e) => setIdempotencyKey(e.target.value)}
                placeholder="e.g. unique_email_usr42_tx99"
                className="w-full px-3 py-1.5 rounded bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Timing Options Guidance Note */}
            <div className="md:col-span-12 p-2.5 rounded bg-indigo-950/30 border border-indigo-900/40 text-[11px] text-indigo-300 flex items-center gap-2">
              <span>ℹ️</span>
              <span>
                <strong>Scheduling Timing:</strong> Specify <em>EITHER</em> <strong>Delay (Seconds)</strong> <em>OR</em> <strong>Scheduled Run At (run_at)</strong>. Leave both blank for instant execution.
              </span>
            </div>

            {/* Delay Seconds (Optional) */}
            <div className="md:col-span-6 space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-neutral-300 block font-bold">Option A: Delay (Seconds)</label>
                <span className="text-[9px] text-neutral-500 uppercase font-mono">(Optional)</span>
              </div>
              <input
                type="number"
                min="0"
                max="86400"
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(e.target.value)}
                placeholder="e.g. 10 (delays by 10 seconds)"
                className="w-full px-3 py-1.5 rounded bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Scheduled Run At (Optional) */}
            <div className="md:col-span-6 space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-neutral-300 block font-bold">Option B: Scheduled Run At (run_at)</label>
                <span className="text-[9px] text-neutral-500 uppercase font-mono">(Optional)</span>
              </div>
              <input
                type="text"
                value={runAt}
                onChange={(e) => setRunAt(e.target.value)}
                placeholder="e.g. 2026-08-04T16:00:00.000Z"
                className="w-full px-3 py-1.5 rounded bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Payload JSON Textarea */}
            <div className="md:col-span-12 space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-neutral-300 block font-bold">
                  Payload JSON <span className="text-rose-400">*</span>
                </label>
                <span className="text-[9px] text-neutral-400">
                  {selectedJobType === "send_email" && "Requires: { \"to\": \"string\" }"}
                  {selectedJobType === "resize_image" && "Requires: { \"url\": \"string\" }"}
                </span>
              </div>
              <textarea
                rows={3}
                value={payloadJson}
                onChange={(e) => setPayloadJson(e.target.value)}
                className="w-full p-3 rounded bg-neutral-950 border border-neutral-800 text-emerald-400 font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Dispatch Action Button */}
            <div className="md:col-span-12 flex items-center justify-between pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-sans text-xs font-semibold transition shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? "Dispatching Job..." : "🚀 Dispatch Job Request"}
              </button>

              <button
                type="button"
                onClick={fetchDashboardData}
                className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-mono transition"
              >
                🔄 Refresh Dashboard Stats
              </button>
            </div>

          </form>

          {/* ── FULL RAW HTTP RESPONSE & ERROR CONSOLE ──────────────────────── */}
          {fullResponse && (
            <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950 overflow-hidden font-mono text-xs shadow-inner">
              
              {/* Response Header */}
              <div className="px-4 py-2.5 border-b border-neutral-800 bg-neutral-900/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">
                    HTTP Response Details
                  </span>
                  
                  {/* Status Badge */}
                  <span
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase border ${
                      !fullResponse.isError && fullResponse.status >= 200 && fullResponse.status < 300
                        ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                        : "bg-rose-950 text-rose-400 border-rose-800"
                    }`}
                  >
                    HTTP {fullResponse.status} {fullResponse.statusText}
                  </span>

                  <span className="text-[10px] text-neutral-500">
                    ⏱ {fullResponse.durationMs}ms
                  </span>
                </div>

                <button
                  onClick={copyResponseJson}
                  className="px-2.5 py-1 rounded text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition"
                >
                  {copiedResponse ? "Copied JSON!" : "Copy Response JSON"}
                </button>
              </div>

              {/* Response Body JSON Code Box & Highlighted Errors */}
              <div className="p-4 bg-neutral-950 overflow-x-auto text-[11px] leading-relaxed">
                {fullResponse.isError && (
                  <div className="mb-3 p-2.5 rounded bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-bold font-sans">
                    ⚠️ Error: {fullResponse.data?.error || fullResponse.data?.message || "Request Failed"}
                  </div>
                )}

                <pre
                  className={
                    fullResponse.isError ? "text-rose-400" : "text-emerald-400"
                  }
                >
                  <code>{JSON.stringify(fullResponse.data, null, 2)}</code>
                </pre>
              </div>

            </div>
          )}

        </section>

      </main>
    </div>
  );
}
