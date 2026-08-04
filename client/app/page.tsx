"use client";

import React, { useState } from "react";
import Link from "next/link";

// --- Types for Interactive Simulator ---
type JobStatus = "pending" | "processing" | "completed" | "failed" | "dead_letter";

interface SimJob {
  id: string;
  type: string;
  payload: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  time: string;
}

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<"api" | "locking" | "schema">("api");
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  // Interactive Simulator State
  const [jobs, setJobs] = useState<SimJob[]>([
    { id: "job_9x81a", type: "send_email", payload: '{"to":"usr_42@test.com"}', status: "completed", attempts: 1, maxAttempts: 3, time: "14:20:01" },
    { id: "job_7f42b", type: "resize_image", payload: '{"url":"img_88.png"}', status: "processing", attempts: 1, maxAttempts: 5, time: "14:20:12" },
    { id: "job_3k19c", type: "send_email", payload: '{"to":"alice@test.com"}', status: "pending", attempts: 0, maxAttempts: 3, time: "14:20:25" },
    { id: "job_1m04d", type: "resize_image", payload: '{"url":"avatar.jpg","simulateFailure":true}', status: "failed", attempts: 2, maxAttempts: 3, time: "14:20:30" },
    { id: "job_8p33e", type: "send_email", payload: '{"to":"bad@domain.com","simulateFailure":true}', status: "dead_letter", attempts: 3, maxAttempts: 3, time: "14:19:40" },
  ]);

  const [simLogs, setSimLogs] = useState<string[]>([
    "[14:20:30] [worker-02] ERROR job_1m04d: Simulated resize failure (attempt 2/3)",
    "[14:20:25] [api-server] POST /api/jobs -> job_3k19c: send_email (state: PENDING)",
    "[14:20:12] [worker-01] CLAIM job_7f42b: resize_image -> locked via FOR UPDATE SKIP LOCKED",
    "[14:20:01] [worker-03] ACK job_9x81a: send_email -> COMPLETED in 142ms",
  ]);

  const handleAddJob = (type: string) => {
    const newId = `job_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toLocaleTimeString("en-US", { hour12: false });
    const newJob: SimJob = {
      id: newId,
      type,
      payload: type === "send_email" ? '{"to":"user@test.com"}' : '{"url":"photo.jpg"}',
      status: "pending",
      attempts: 0,
      maxAttempts: 3,
      time: now,
    };
    setJobs((prev) => [newJob, ...prev.slice(0, 7)]);
    setSimLogs((prev) => [`[${now}] [api-server] POST /api/jobs -> ${newId}: ${type} (PENDING)`, ...prev.slice(0, 9)]);
  };

  const handleProcessJob = () => {
    const pendingJob = jobs.find((j) => j.status === "pending");
    if (!pendingJob) return;

    const now = new Date().toLocaleTimeString("en-US", { hour12: false });
    setJobs((prev) =>
      prev.map((j) => (j.id === pendingJob.id ? { ...j, status: "processing", attempts: j.attempts + 1 } : j))
    );
    setSimLogs((prev) => [
      `[${now}] [worker-01] CLAIM ${pendingJob.id}: ${pendingJob.type} -> locked via SKIP LOCKED`,
      ...prev.slice(0, 9),
    ]);

    setTimeout(() => {
      const finishNow = new Date().toLocaleTimeString("en-US", { hour12: false });
      setJobs((prev) =>
        prev.map((j) => (j.id === pendingJob.id ? { ...j, status: "completed" } : j))
      );
      setSimLogs((prev) => [
        `[${finishNow}] [worker-01] ACK ${pendingJob.id} -> COMPLETED (elapsed 240ms)`,
        ...prev.slice(0, 9),
      ]);
    }, 800);
  };

  const handleSimulateFailure = () => {
    const now = new Date().toLocaleTimeString("en-US", { hour12: false });
    const target = jobs.find((j) => j.status !== "completed" && j.status !== "dead_letter");
    if (!target) return;

    const newAttempts = target.attempts + 1;
    const isDlq = newAttempts >= target.maxAttempts;
    const newStatus: JobStatus = isDlq ? "dead_letter" : "failed";

    setJobs((prev) =>
      prev.map((j) => (j.id === target.id ? { ...j, status: newStatus, attempts: newAttempts } : j))
    );

    setSimLogs((prev) => [
      `[${now}] [worker-02] ${isDlq ? "FATAL" : "WARN"} ${target.id}: Handler exception (attempt ${newAttempts}/${target.maxAttempts}) -> state: ${newStatus.toUpperCase()}`,
      ...prev.slice(0, 9),
    ]);
  };

  const handleRequeueDlq = () => {
    const dlqJob = jobs.find((j) => j.status === "dead_letter" || j.status === "failed");
    if (!dlqJob) return;

    const now = new Date().toLocaleTimeString("en-US", { hour12: false });
    setJobs((prev) =>
      prev.map((j) => (j.id === dlqJob.id ? { ...j, status: "pending", attempts: 0 } : j))
    );
    setSimLogs((prev) => [
      `[${now}] [dashboard] POST /api/dead-letter/${dlqJob.id}/retry -> state: PENDING`,
      ...prev.slice(0, 9),
    ]);
  };

  return (
    <div className="relative min-h-screen bg-neutral-950 text-neutral-200 overflow-x-hidden font-sans selection:bg-neutral-800 selection:text-neutral-100">
      
      {/* ── BACKGROUND OVERLAYS ──────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-50 grain-jitter-overlay animate-subtle-jitter opacity-60" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-ambient-glow" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-grid-subtle opacity-40" />

      {/* ── 1. CLEAN ESSENTIAL NAVBAR (FIXED & BLURRY) ───────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-neutral-800/80 bg-neutral-950/75 backdrop-blur-md backdrop-saturate-150 px-6 py-3.5 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
              <span className="font-tnr text-lg font-bold tracking-tight text-white italic">
                RelayX
              </span>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-mono text-neutral-400 bg-neutral-900/90 border border-neutral-800 rounded-md">
              v1.0 ENGINE
            </span>
          </div>

          {/* Essentials Right CTAs */}
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Shobhit070304/distributed-job-platform"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 text-xs font-mono rounded-md border border-neutral-700 bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 transition flex items-center gap-1.5 shadow-xs"
            >
              <span>⭐ Star</span>
              <span className="text-neutral-500 font-bold">Shobhit070304</span>
            </a>

            <Link
              href="/dashboard"
              className="px-4 py-1.5 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-md shadow-indigo-600/20 font-sans flex items-center gap-1.5 font-semibold"
            >
              <span>📊 Live Dashboard</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── 2. HERO SECTION (ADJUSTED FOR FIXED NAVBAR) ─────────────────────── */}
      <section className="relative z-10 pt-28 pb-14 md:pt-32 md:pb-18 px-6 border-b border-neutral-900/80 min-h-[58vh] flex flex-col justify-center">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          
          {/* Top Badge */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-neutral-800 bg-neutral-900/90 text-xs text-neutral-300 font-mono shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-tnr text-neutral-100 italic font-semibold">PostgreSQL Queue Engine</span>
            <span className="text-neutral-600">•</span>
            <span className="text-neutral-400">Interactive Visualizer</span>
          </div>

          {/* Hero Headline in Times New Roman */}
          <h1 className="font-tnr text-4xl sm:text-5xl md:text-6xl font-normal tracking-tight text-white leading-[1.1]">
            Distributed job processing, <br />
            <span className="italic text-neutral-400 font-normal">visualized in real time.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-base text-neutral-400 max-w-xl mx-auto leading-relaxed font-sans font-light">
            RelayX is a backend queue engine demonstrator powered by PostgreSQL.
            Inspect atomic <code className="text-neutral-200 font-mono bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 text-xs rounded">FOR UPDATE SKIP LOCKED</code> row claims, retries with exponential backoff, and dead-letter queue isolation.
          </p>

          {/* Action CTAs */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href="/dashboard"
              className="px-5 py-2.5 text-xs sm:text-sm font-medium rounded-lg bg-neutral-100 text-neutral-950 hover:bg-white transition shadow-lg shadow-white/5 font-sans flex items-center gap-2 font-semibold"
            >
              <span>📊 Launch Live Dashboard</span>
              <span>→</span>
            </Link>

            <a
              href="#specs"
              className="px-4.5 py-2.5 text-xs sm:text-sm font-medium rounded-lg bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 transition font-sans flex items-center gap-2"
            >
              <span>📜 View REST API Spec</span>
            </a>
          </div>

          {/* Micro Specs Bar */}
          <div className="pt-8 grid grid-cols-2 sm:grid-cols-4 gap-3.5 max-w-4xl mx-auto text-left">
            <div className="p-3.5 rounded-xl border border-neutral-800/90 bg-neutral-900/50 backdrop-blur-md shadow-xl">
              <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Engine Type</div>
              <div className="font-tnr text-base text-white font-bold mt-0.5">PostgreSQL Queue</div>
              <div className="text-[11px] text-neutral-400 font-light mt-0.5">ACID Persistence</div>
            </div>

            <div className="p-3.5 rounded-xl border border-neutral-800/90 bg-neutral-900/50 backdrop-blur-md shadow-xl">
              <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Lock Claiming</div>
              <div className="font-tnr text-base text-emerald-400 font-bold mt-0.5">SKIP LOCKED</div>
              <div className="text-[11px] text-neutral-400 font-light mt-0.5">Zero Lock Conflicts</div>
            </div>

            <div className="p-3.5 rounded-xl border border-neutral-800/90 bg-neutral-900/50 backdrop-blur-md shadow-xl">
              <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Fault Handling</div>
              <div className="font-tnr text-base text-white font-bold mt-0.5">Retries + DLQ</div>
              <div className="text-[11px] text-neutral-400 font-light mt-0.5">Exponential Backoff</div>
            </div>

            <div className="p-3.5 rounded-xl border border-neutral-800/90 bg-neutral-900/50 backdrop-blur-md shadow-xl">
              <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Safety</div>
              <div className="font-tnr text-base text-white font-bold mt-0.5">Idempotent Keys</div>
              <div className="text-[11px] text-neutral-400 font-light mt-0.5">Deduplication Safe</div>
            </div>
          </div>

        </div>
      </section>

      {/* ── 3. INTERACTIVE SIMULATOR (EXPANDED IMPRESSIVE HEIGHT) ───────────── */}
      <section id="simulator" className="relative z-10 py-20 px-6 border-b border-neutral-900/80 bg-neutral-950/60">
        <div className="max-w-6xl mx-auto space-y-6">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-mono text-emerald-400 uppercase tracking-widest font-bold">
                [ Interactive Visualizer ]
              </div>
              <h2 className="font-tnr text-3xl md:text-4xl text-white font-normal mt-1">
                Live Queue State Simulation
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 max-w-xl mt-1">
                Simulate how background workers pick up, process, retry, or dead-letter pending jobs.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => handleAddJob("send_email")}
                className="px-3 py-1.5 text-xs font-mono rounded-md bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-neutral-200 transition shadow-sm"
              >
                + Enqueue Job
              </button>
              <button
                onClick={handleProcessJob}
                className="px-3 py-1.5 text-xs font-mono rounded-md bg-emerald-950/90 border border-emerald-800 text-emerald-300 hover:bg-emerald-900 transition shadow-sm"
              >
                ▶ Claim Job
              </button>
              <button
                onClick={handleSimulateFailure}
                className="px-3 py-1.5 text-xs font-mono rounded-md bg-amber-950/90 border border-amber-800 text-amber-300 hover:bg-amber-900 transition shadow-sm"
              >
                ⚡ Trigger Error
              </button>
              <button
                onClick={handleRequeueDlq}
                className="px-3 py-1.5 text-xs font-mono rounded-md bg-purple-950/90 border border-purple-800 text-purple-300 hover:bg-purple-900 transition shadow-sm"
              >
                🔄 Re-queue DLQ
              </button>
            </div>
          </div>

          {/* Simulator Grid (Spacious Height Panels) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* Left: Job Table */}
            <div className="lg:col-span-7 rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden flex flex-col justify-between h-[330px] shadow-2xl">
              <div>
                <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-900 flex items-center justify-between text-xs font-mono text-neutral-400">
                  <span className="font-tnr text-neutral-200 italic font-bold text-sm">Active Simulated Queue ({jobs.length})</span>
                  <span className="text-[10px] text-neutral-500 uppercase tracking-widest">SIMULATED</span>
                </div>
                
                <div className="divide-y divide-neutral-800/60 overflow-y-auto max-h-[275px]">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-neutral-950/80 text-[10px] text-neutral-500 uppercase sticky top-0 backdrop-blur-md">
                      <tr>
                        <th className="px-4 py-2">Job ID</th>
                        <th className="px-4 py-2">Type</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2 text-right">Attempts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900 text-neutral-300">
                      {jobs.map((job) => {
                        const statusColor =
                          job.status === "completed"
                            ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                            : job.status === "processing"
                            ? "bg-blue-950 text-blue-400 border-blue-800 animate-pulse"
                            : job.status === "failed"
                            ? "bg-amber-950 text-amber-400 border-amber-800"
                            : job.status === "dead_letter"
                            ? "bg-rose-950 text-rose-400 border-rose-800"
                            : "bg-neutral-900 text-neutral-400 border-neutral-800";

                        return (
                          <tr key={job.id} className="hover:bg-neutral-900/70 transition-colors">
                            <td className="px-4 py-2.5 text-neutral-200 font-bold">{job.id}</td>
                            <td className="px-4 py-2.5 text-neutral-400 text-xs truncate max-w-[140px]">
                              {job.type}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] border uppercase ${statusColor}`}>
                                {job.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-neutral-400 text-xs">
                              {job.attempts}/{job.maxAttempts}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right: Worker Log Stream */}
            <div className="lg:col-span-5 rounded-xl border border-neutral-800 bg-neutral-950 font-mono text-xs flex flex-col justify-between h-[330px] overflow-hidden shadow-2xl">
              <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-900 flex items-center justify-between text-neutral-400 text-xs">
                <span className="font-tnr text-neutral-200 italic font-bold text-sm">Worker Logs Stream</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              </div>

              <div className="p-4 space-y-2 overflow-y-auto text-neutral-400 bg-neutral-950/90 leading-relaxed flex-1 text-[11px]">
                {simLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`whitespace-pre-wrap break-all ${
                      log.includes("ERROR") || log.includes("FATAL")
                        ? "text-rose-400"
                        : log.includes("CLAIM")
                        ? "text-blue-300"
                        : log.includes("ACK")
                        ? "text-emerald-400"
                        : log.includes("RE-QUEUE")
                        ? "text-purple-300"
                        : "text-neutral-400"
                    }`}
                  >
                    {log}
                  </div>
                ))}
              </div>

              <div className="px-4 py-2 border-t border-neutral-900 bg-neutral-900/50 text-[10px] text-neutral-500 flex justify-between">
                <span>QUERY: FOR UPDATE SKIP LOCKED</span>
                <span>STATUS: DEMO ACTIVE</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── 4. ENGINE CAPABILITIES (IMPRESSIVE 6 CARDS GRID) ─────────────────── */}
      <section className="relative z-10 py-20 px-6 border-b border-neutral-900/80">
        <div className="max-w-6xl mx-auto space-y-10">
          
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <div className="text-[11px] font-mono text-indigo-400 uppercase tracking-widest font-bold">
              [ Engine Capabilities ]
            </div>
            <h2 className="font-tnr text-3xl md:text-4xl text-white font-normal">
              Postgres-Native Queue Reliability
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400">
              Key capabilities built directly into RelayX&apos;s database queue architecture.
            </p>
          </div>

          {/* Equal height grid cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            
            {/* Feature 1 */}
            <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/40 hover:border-indigo-500/50 hover:bg-neutral-900/60 transition duration-200 flex flex-col justify-between h-full space-y-3 group shadow-xl">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                <span className="font-tnr text-lg text-white font-bold group-hover:text-indigo-300 transition">01. Atomic Row Locks</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase font-mono">PostgreSQL</span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed font-sans font-light">
                Uses <code className="font-mono text-xs text-neutral-300 bg-neutral-950 px-1.5 py-0.5 rounded">FOR UPDATE SKIP LOCKED</code> so concurrent worker nodes claim pending tasks without lock conflicts or duplicate execution.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/40 hover:border-indigo-500/50 hover:bg-neutral-900/60 transition duration-200 flex flex-col justify-between h-full space-y-3 group shadow-xl">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                <span className="font-tnr text-lg text-white font-bold group-hover:text-indigo-300 transition">02. Exponential Backoff</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800 uppercase font-mono">Resilience</span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed font-sans font-light">
                Configurable retry strategies with randomized jitter to safeguard third-party APIs and downstream services during temporary outages.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/40 hover:border-indigo-500/50 hover:bg-neutral-900/60 transition duration-200 flex flex-col justify-between h-full space-y-3 group shadow-xl">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                <span className="font-tnr text-lg text-white font-bold group-hover:text-indigo-300 transition">03. Dead Letter Queue</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 uppercase font-mono">Quarantine</span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed font-sans font-light">
                Failed jobs that exhaust max retry attempts automatically isolate into DLQ status with error stack traces and manual re-queue capabilities.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/40 hover:border-indigo-500/50 hover:bg-neutral-900/60 transition duration-200 flex flex-col justify-between h-full space-y-3 group shadow-xl">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                <span className="font-tnr text-lg text-white font-bold group-hover:text-indigo-300 transition">04. Strict Idempotency</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800 uppercase font-mono">Deduplication</span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed font-sans font-light">
                Unique <code className="font-mono text-xs text-neutral-300 bg-neutral-950 px-1.5 py-0.5 rounded">idempotency_key</code> database constraints ensure duplicate requests do not produce redundant background jobs.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/40 hover:border-indigo-500/50 hover:bg-neutral-900/60 transition duration-200 flex flex-col justify-between h-full space-y-3 group shadow-xl">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                <span className="font-tnr text-lg text-white font-bold group-hover:text-indigo-300 transition">05. Scheduled Delays</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 uppercase font-mono">Scheduling</span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed font-sans font-light">
                Delay job execution via <code className="font-mono text-xs text-neutral-300 bg-neutral-950 px-1.5 py-0.5 rounded">delay_seconds</code> or explicit timestamps (<code className="font-mono text-xs text-neutral-300 bg-neutral-950 px-1.5 py-0.5 rounded">available_at</code>) for delayed workflow execution.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/40 hover:border-indigo-500/50 hover:bg-neutral-900/60 transition duration-200 flex flex-col justify-between h-full space-y-3 group shadow-xl">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                <span className="font-tnr text-lg text-white font-bold group-hover:text-indigo-300 transition">06. Clean SIGINT Draining</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase font-mono">Zero Loss</span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed font-sans font-light">
                Workers intercept system shutdown signals (SIGINT/SIGTERM) to drain active in-flight jobs gracefully before stopping.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ── 5. SYSTEM EXPLANATION & ARCHITECTURE (SPACIOUS HEIGHT) ────────────── */}
      <section id="specs" className="relative z-10 py-20 px-6 border-b border-neutral-900/80 bg-neutral-950/80">
        <div className="max-w-6xl mx-auto space-y-8">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest">
                [ System Architecture & Guide ]
              </div>
              <h2 className="font-tnr text-3xl md:text-4xl text-white font-normal mt-1">
                Understanding How RelayX Works
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                A clear explanation of how job dispatching, row-level locking, and state transitions operate.
              </p>
            </div>

            {/* Tab Switcher */}
            <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs font-mono">
              <button
                onClick={() => setActiveTab("api")}
                className={`px-3 py-1.5 rounded-md transition ${
                  activeTab === "api" ? "bg-neutral-800 text-white font-bold shadow-xs" : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                1. REST API
              </button>
              <button
                onClick={() => setActiveTab("locking")}
                className={`px-3 py-1.5 rounded-md transition ${
                  activeTab === "locking" ? "bg-neutral-800 text-white font-bold shadow-xs" : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                2. Lock Claiming
              </button>
              <button
                onClick={() => setActiveTab("schema")}
                className={`px-3 py-1.5 rounded-md transition ${
                  activeTab === "schema" ? "bg-neutral-800 text-white font-bold shadow-xs" : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                3. Data Schema
              </button>
            </div>
          </div>

          {/* Explanation Box */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 space-y-4 text-xs font-sans shadow-2xl">
            
            {activeTab === "api" && (
              <div className="space-y-4">
                <div className="font-tnr text-lg text-white font-bold flex items-center justify-between">
                  <span>1. Express REST API Endpoints</span>
                  <span className="font-mono text-xs text-emerald-400">HTTP SERVICE</span>
                </div>
                <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
                  The API server accepts background job dispatches over HTTP and records them into PostgreSQL inside an ACID transaction.
                </p>
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800 flex items-start justify-between gap-3">
                    <div>
                      <span className="text-emerald-400 font-bold text-sm">POST /api/jobs</span>
                      <p className="text-neutral-400 text-xs font-sans mt-1">
                        Dispatches a new job with payload, max attempts, delay seconds, or idempotency key.
                      </p>
                    </div>
                    <span className="text-[10px] text-neutral-500">PRODUCER</span>
                  </div>

                  <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800 flex items-start justify-between gap-3">
                    <div>
                      <span className="text-blue-400 font-bold text-sm">GET /api/stats</span>
                      <p className="text-neutral-400 text-xs font-sans mt-1">
                        Returns current queue counts (pending, processing, completed, DLQ) and throughput telemetry.
                      </p>
                    </div>
                    <span className="text-[10px] text-neutral-500">TELEMETRY</span>
                  </div>

                  <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800 flex items-start justify-between gap-3">
                    <div>
                      <span className="text-purple-400 font-bold text-sm">POST /api/dead-letter/:id/retry</span>
                      <p className="text-neutral-400 text-xs font-sans mt-1">
                        Resets a dead-lettered job&apos;s attempts to 0 and moves it back to PENDING.
                      </p>
                    </div>
                    <span className="text-[10px] text-neutral-500">RECOVERY</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "locking" && (
              <div className="space-y-4">
                <div className="font-tnr text-lg text-white font-bold flex items-center justify-between">
                  <span>2. Row Lock Claiming (`FOR UPDATE SKIP LOCKED`)</span>
                  <span className="font-mono text-xs text-emerald-400">ENGINE CORE</span>
                </div>
                <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
                  Traditional relational database queue polling suffered from lock contention: when multiple worker nodes attempted to query pending jobs at the same instant, they blocked each other or picked up duplicate jobs.
                </p>
                <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 font-mono text-xs text-neutral-300 space-y-2">
                  <div className="text-emerald-400 font-bold text-sm">How SKIP LOCKED Solves This:</div>
                  <p className="text-neutral-400 text-xs font-sans leading-relaxed">
                    When Worker A executes <code className="text-neutral-200 bg-neutral-900 px-1.5 py-0.5 rounded">UPDATE jobs SET status = &apos;processing&apos; WHERE id = (SELECT id FROM jobs WHERE status = &apos;pending&apos; FOR UPDATE SKIP LOCKED LIMIT 1)</code>, Postgres locks only row #1. Worker B running at the exact same millisecond automatically skips row #1 and claims row #2 with zero waiting or database lock contention.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "schema" && (
              <div className="space-y-4">
                <div className="font-tnr text-lg text-white font-bold flex items-center justify-between">
                  <span>3. PostgreSQL Data Schema</span>
                  <span className="font-mono text-xs text-emerald-400">STORAGE LAYER</span>
                </div>
                <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
                  The engine relies on a single relational table <code className="text-neutral-200 font-mono bg-neutral-950 px-1.5 py-0.5 rounded">jobs</code> with structured columns for status management and retry tracking:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                  <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                    <span className="text-white font-bold text-sm">status</span>
                    <span className="text-neutral-400 block text-xs font-sans mt-1">
                      State enum: `pending`, `processing`, `completed`, `failed`, `dead_letter`.
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                    <span className="text-white font-bold text-sm">available_at</span>
                    <span className="text-neutral-400 block text-xs font-sans mt-1">
                      Timestamp controlling when job becomes eligible for worker pickup.
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                    <span className="text-white font-bold text-sm">idempotency_key</span>
                    <span className="text-neutral-400 block text-xs font-sans mt-1">
                      UNIQUE constraint preventing duplicate job dispatches.
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                    <span className="text-white font-bold text-sm">attempts / max_attempts</span>
                    <span className="text-neutral-400 block text-xs font-sans mt-1">
                      Tracks execution count & DLQ escalation threshold.
                    </span>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Bottom Section Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-3 flex flex-col justify-between shadow-xl">
              <div className="text-sm font-tnr font-bold text-white flex items-center gap-2">
                <span>🔄</span>
                <span>Job Lifecycle State Machine</span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed font-sans font-light">
                Jobs progress through deterministic state transitions: <br />
                <code className="text-amber-400 font-mono">PENDING</code> ➔ <code className="text-blue-400 font-mono">PROCESSING</code> ➔ <code className="text-emerald-400 font-mono">COMPLETED</code> or <code className="text-rose-400 font-mono font-bold">DEAD_LETTER</code> (after max retries).
              </p>
            </div>

            <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-3 flex flex-col justify-between shadow-xl">
              <div className="text-sm font-tnr font-bold text-white flex items-center gap-2">
                <span>🛡️</span>
                <span>Orphaned Worker Reaper</span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed font-sans font-light">
                A background process <code className="text-neutral-200 font-mono">cleanOrphanedJobs()</code> periodically inspects jobs stuck in <code className="text-blue-400 font-mono">PROCESSING</code> for &gt;10m and resets them safely.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ── 6. REVISED FAQ SECTION ───────────────────────────────────────────── */}
      <section className="relative z-10 py-20 px-6 border-b border-neutral-900/80 bg-neutral-950/60">
        <div className="max-w-6xl mx-auto space-y-8">
          
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest">
              [ Project Context ]
            </div>
            <h2 className="font-tnr text-3xl md:text-4xl text-white font-normal">
              Project Overview & Concepts
            </h2>
          </div>

          {/* Accordion List */}
          <div className="space-y-3 max-w-4xl mx-auto">
            {[
              {
                q: "What is the core purpose of this project?",
                a: "RelayX is a backend engineering portfolio demonstration showing how PostgreSQL row-level locks (FOR UPDATE SKIP LOCKED) can power a high-concurrency background job processing engine with retries and dead-letter queues.",
              },
              {
                q: "Is RelayX a third-party service or library?",
                a: "No. RelayX is an open-source visual demonstration codebase created to inspect and test distributed queue mechanics, worker polling loops, and dead-letter queue operations directly in the browser.",
              },
              {
                q: "How does row locking work under high concurrency?",
                a: "When multiple worker processes poll PostgreSQL simultaneously, FOR UPDATE SKIP LOCKED locks only the specific row being claimed and skips locked rows, allowing workers to scale without blocking each other.",
              },
              {
                q: "How can I test job creation and error handling?",
                a: "Navigate to the Live Dashboard (/dashboard) where you can use the API Request Playground to dispatch test jobs, trigger simulated failures, and inspect dead-letter retries.",
              },
            ].map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-neutral-800 bg-neutral-900/40 overflow-hidden text-xs shadow-md"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                  className="w-full p-4 text-left font-tnr text-base text-neutral-200 font-medium flex items-center justify-between hover:bg-neutral-900/80 transition"
                >
                  <span>{faq.q}</span>
                  <span className="font-mono text-xs text-neutral-500">{activeFaq === i ? "−" : "+"}</span>
                </button>

                {activeFaq === i && (
                  <div className="px-4 pb-4 pt-1 text-neutral-400 font-sans leading-relaxed text-xs sm:text-sm border-t border-neutral-900 font-light">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── 7. MINIMALIST FOOTER ──────────────────────────────────────────────── */}
      <footer className="relative z-10 py-12 px-6 border-t border-neutral-900 bg-neutral-950 text-xs font-mono text-neutral-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <span className="font-tnr text-white italic font-bold text-base">RelayX</span>
            <span>•</span>
            <span className="text-xs text-neutral-400">PostgreSQL Queue Engine Visualizer</span>
          </div>

          <div className="text-xs font-tnr italic text-neutral-400">
            Created by <a href="https://github.com/Shobhit070304" target="_blank" rel="noopener noreferrer" className="text-neutral-200 hover:underline">Shobhit070304</a>.
          </div>

          <div className="flex items-center gap-4 text-xs">
            <Link href="/dashboard" className="hover:text-neutral-200 transition">Dashboard</Link>
            <a href="https://github.com/Shobhit070304/distributed-job-platform" target="_blank" rel="noopener noreferrer" className="hover:text-neutral-200 transition">GitHub Repo</a>
          </div>

        </div>
      </footer>

    </div>
  );
}
