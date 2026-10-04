"use client";

import React, { useState } from "react";
import Link from "next/link";

// --- Types for Interactive Simulator ---
type JobStatus = "pending" | "processing" | "completed" | "dead_letter";

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
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  // Interactive Simulator State
  const [jobs, setJobs] = useState<SimJob[]>([
    { id: "job_9x81a", type: "send_email", payload: '{"to":"usr_42@test.com"}', status: "completed", attempts: 1, maxAttempts: 3, time: "14:20:01" },
    { id: "job_7f42b", type: "resize_image", payload: '{"url":"img_88.png"}', status: "processing", attempts: 1, maxAttempts: 5, time: "14:20:12" },
    { id: "job_3k19c", type: "send_email", payload: '{"to":"alice@test.com"}', status: "pending", attempts: 0, maxAttempts: 3, time: "14:20:25" },
    { id: "job_1m04d", type: "resize_image", payload: '{"url":"avatar.jpg","simulateFailure":true}', status: "pending", attempts: 2, maxAttempts: 3, time: "14:20:30" },
    { id: "job_8p33e", type: "send_email", payload: '{"to":"bad@domain.com","simulateFailure":true}', status: "dead_letter", attempts: 3, maxAttempts: 3, time: "14:19:40" },
  ]);

  const [simLogs, setSimLogs] = useState<string[]>([
    "[14:20:30] [worker-02] WARN job_1m04d: Simulated failure (attempt 2/3) -> retry scheduled via backoff",
    "[14:20:25] [api-server] POST /api/jobs -> job_3k19c: send_email recorded with status PENDING",
    "[14:20:12] [worker-01] CLAIM job_7f42b: resize_image -> atomic row locked via FOR UPDATE SKIP LOCKED",
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
    setJobs((prev) => [newJob, ...prev.slice(0, 5)]);
    setSimLogs((prev) => [`[${now}] [api-server] POST /api/jobs -> ${newId}: ${type} (state: PENDING)`, ...prev.slice(0, 7)]);
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
      ...prev.slice(0, 7),
    ]);

    setTimeout(() => {
      const finishNow = new Date().toLocaleTimeString("en-US", { hour12: false });
      setJobs((prev) =>
        prev.map((j) => (j.id === pendingJob.id ? { ...j, status: "completed" } : j))
      );
      setSimLogs((prev) => [
        `[${finishNow}] [worker-01] ACK ${pendingJob.id} -> COMPLETED (elapsed: 180ms)`,
        ...prev.slice(0, 7),
      ]);
    }, 700);
  };

  const handleSimulateFailure = () => {
    const now = new Date().toLocaleTimeString("en-US", { hour12: false });
    const target = jobs.find((j) => j.status !== "completed" && j.status !== "dead_letter");
    if (!target) return;

    const newAttempts = target.attempts + 1;
    const isDlq = newAttempts >= target.maxAttempts;
    const newStatus: JobStatus = isDlq ? "dead_letter" : "pending";

    setJobs((prev) =>
      prev.map((j) => (j.id === target.id ? { ...j, status: newStatus, attempts: newAttempts } : j))
    );

    setSimLogs((prev) => [
      `[${now}] [worker-02] ${isDlq ? "FATAL" : "WARN"} ${target.id}: Exception encountered (attempt ${newAttempts}/${target.maxAttempts}) -> ${isDlq ? "quarantined to DEAD_LETTER" : "retry scheduled (PENDING)"}`,
      ...prev.slice(0, 7),
    ]);
  };

  const handleRequeueDlq = () => {
    const dlqJob = jobs.find((j) => j.status === "dead_letter");
    if (!dlqJob) return;

    const now = new Date().toLocaleTimeString("en-US", { hour12: false });
    setJobs((prev) =>
      prev.map((j) => (j.id === dlqJob.id ? { ...j, status: "pending", attempts: 0 } : j))
    );
    setSimLogs((prev) => [
      `[${now}] [dashboard] POST /api/dead-letter/${dlqJob.id}/retry -> attempts reset, moved to PENDING`,
      ...prev.slice(0, 7),
    ]);
  };

  return (
    <div className="relative min-h-screen bg-neutral-950 text-neutral-200 overflow-x-hidden font-sans selection:bg-amber-900/40 selection:text-white">
      {/* ── SaaS Tactile Background: Grain Jitter + Warm Ambient Spotlight ──── */}
      <div className="pointer-events-none fixed inset-0 z-50 grain-jitter-overlay animate-subtle-jitter opacity-80" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-ambient-glow animate-ambient-glow" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-grid-subtle opacity-70" />

      {/* ── Fixed Clean Navbar without Section Links ──────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-40 w-full border-b border-neutral-800/80 bg-neutral-950/75 backdrop-blur-md px-6 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2.5 group">
              <img src="/logo.svg" alt="RelayX Logo" className="h-5 w-auto object-contain transition group-hover:scale-105" />
              <span className="font-tnr text-base font-bold tracking-tight text-white">RelayX</span>
            </Link>
            <span className="text-neutral-700">|</span>
            <span className="px-1.5 py-0.5 text-[9px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-800 rounded">
              v1.0 ENGINE
            </span>
          </div>

          <nav className="flex items-center gap-3 text-xs font-mono">
            <Link href="/about" className="text-neutral-400 hover:text-white transition px-2 py-1">
              About &amp; Architecture
            </Link>
            <Link
              href="/dashboard"
              className="px-3 py-1 text-xs font-semibold rounded-md bg-linear-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white transition shadow-sm font-sans flex items-center gap-1.5"
            >
              <span>📊 Live Console</span>
              <span>→</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* ── PHASE 1: Hero Section (100% Height & Centered) ─────────────────── */}
      <section className="relative z-10 min-h-screen flex flex-col justify-center items-center pt-16 pb-12 px-5 border-b border-neutral-900/80">
        <div className="max-w-3xl mx-auto text-center space-y-4 my-auto">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-neutral-800 bg-neutral-900/90 text-[11px] text-neutral-300 font-mono shadow-inner">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-tnr text-neutral-200 italic font-semibold">PostgreSQL Queue Engine</span>
            <span className="text-neutral-600">•</span>
            <span className="text-neutral-400">SELECT FOR UPDATE SKIP LOCKED</span>
          </div>

          <h1 className="font-tnr text-3xl sm:text-4xl lg:text-[44px] font-normal text-white leading-tight tracking-tight">
            Distributed background jobs, <br />
            <span className="italic text-neutral-400 font-normal">visualized in real time.</span>
          </h1>

          <p className="text-xs sm:text-sm text-neutral-400 max-w-xl mx-auto leading-relaxed font-sans font-light">
            RelayX demonstrates how PostgreSQL row-level locks power a durable, high-throughput background queue with zero duplicate execution, automatic backoff retries, and dead-letter isolation.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-4.5 py-2 rounded-lg bg-neutral-100 text-neutral-950 hover:bg-white text-xs font-semibold transition shadow-md flex items-center justify-center gap-1.5 font-sans"
            >
              <span>📊 Launch Live Console</span>
              <span>→</span>
            </Link>

            <Link
              href="/about"
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 text-xs border border-neutral-800 transition font-mono flex items-center justify-center gap-1.5"
            >
              <span>📖 Technical Guide</span>
            </Link>
          </div>

          {/* Compact 4-Card Specs Bar */}
          <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-3xl mx-auto text-left">
            <div className="p-3 rounded-lg border border-neutral-800/80 bg-neutral-900/50 backdrop-blur-md">
              <div className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider">Engine Storage</div>
              <div className="font-tnr text-sm text-white font-bold mt-0.5">PostgreSQL 16</div>
              <div className="text-[10px] text-neutral-400 font-light">ACID Guaranteed</div>
            </div>

            <div className="p-3 rounded-lg border border-neutral-800/80 bg-neutral-900/50 backdrop-blur-md">
              <div className="text-[9px] font-mono text-amber-500 uppercase tracking-wider">Atomic Locking</div>
              <div className="font-tnr text-sm text-amber-400 font-bold mt-0.5">SKIP LOCKED</div>
              <div className="text-[10px] text-neutral-400 font-light">Zero Contention</div>
            </div>

            <div className="p-3 rounded-lg border border-neutral-800/80 bg-neutral-900/50 backdrop-blur-md">
              <div className="text-[9px] font-mono text-rose-500 uppercase tracking-wider">Fault Isolation</div>
              <div className="font-tnr text-sm text-white font-bold mt-0.5">Retries + DLQ</div>
              <div className="text-[10px] text-neutral-400 font-light">Exponential Backoff</div>
            </div>

            <div className="p-3 rounded-lg border border-neutral-800/80 bg-neutral-900/50 backdrop-blur-md">
              <div className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider">Deduplication</div>
              <div className="font-tnr text-sm text-white font-bold mt-0.5">Idempotency</div>
              <div className="text-[10px] text-neutral-400 font-light">Unique Key Safe</div>
            </div>
          </div>

        </div>
      </section>

      {/* ── PHASE 2: Simulation Section (Second - 100% Height & Centered) ─── */}
      <section className="relative z-10 min-h-screen flex flex-col justify-center py-16 px-5 border-b border-neutral-900/80">
        <div className="max-w-5xl mx-auto w-full space-y-4 my-auto">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-bold">
                [ Interactive Visualizer ]
              </div>
              <h2 className="font-tnr text-2xl sm:text-3xl text-white font-normal mt-1">
                Live Queue State Simulator
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5 font-light">
                Inspect how background workers claim, process, retry, or quarantine pending jobs in real time.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
              <button
                onClick={() => handleAddJob("send_email")}
                className="px-2.5 py-1 rounded bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-neutral-200 transition"
              >
                + Enqueue
              </button>
              <button
                onClick={handleProcessJob}
                className="px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300 hover:bg-emerald-900 transition"
              >
                ▶ Claim
              </button>
              <button
                onClick={handleSimulateFailure}
                className="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-800 text-amber-300 hover:bg-amber-900 transition"
              >
                ⚡ Error
              </button>
              <button
                onClick={handleRequeueDlq}
                className="px-2.5 py-1 rounded bg-purple-950/80 border border-purple-800 text-purple-300 hover:bg-purple-900 transition"
              >
                🔄 DLQ Retry
              </button>
            </div>
          </div>

          {/* Simulator Side-by-Side View */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Table */}
            <div className="lg:col-span-7 rounded-xl border border-neutral-800 bg-neutral-900/60 backdrop-blur-md overflow-hidden flex flex-col justify-between h-77.5 shadow-lg">
              <div>
                <div className="px-3.5 py-2 border-b border-neutral-800 bg-neutral-900/90 flex items-center justify-between text-xs font-mono text-neutral-400">
                  <span className="font-tnr text-neutral-200 font-bold italic">Simulated Queue ({jobs.length})</span>
                  <span className="text-[9px] text-neutral-500 uppercase tracking-widest">STATE: ACTIVE</span>
                </div>
                
                <div className="divide-y divide-neutral-800/60 overflow-y-auto max-h-66.25">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-neutral-950 text-[9px] text-neutral-500 uppercase sticky top-0">
                      <tr>
                        <th className="px-3 py-1.5">Job ID</th>
                        <th className="px-3 py-1.5">Type</th>
                        <th className="px-3 py-1.5">Status</th>
                        <th className="px-3 py-1.5 text-right">Attempts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900 text-neutral-300 text-[11px]">
                      {jobs.map((job) => {
                        const statusColor =
                          job.status === "completed"
                            ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                            : job.status === "processing"
                            ? "bg-sky-950 text-sky-400 border-sky-800 animate-pulse"
                            : job.status === "dead_letter"
                            ? "bg-rose-950 text-rose-400 border-rose-800"
                            : "bg-neutral-900 text-neutral-400 border-neutral-800";

                        return (
                          <tr key={job.id} className="hover:bg-neutral-900/70 transition-colors">
                            <td className="px-3 py-2 text-neutral-200 font-bold">{job.id}</td>
                            <td className="px-3 py-2 text-neutral-400 truncate max-w-30">
                              {job.type}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] border uppercase ${statusColor}`}>
                                {job.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-neutral-400">
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

            {/* Event Logs */}
            <div className="lg:col-span-5 rounded-xl border border-neutral-800 bg-neutral-950 font-mono text-xs flex flex-col justify-between h-77.5 overflow-hidden shadow-lg">
              <div className="px-3.5 py-2 border-b border-neutral-800 bg-neutral-900/90 flex items-center justify-between text-neutral-400 text-xs">
                <span className="font-tnr text-neutral-200 font-bold italic">Worker Log Stream</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              <div className="p-3 space-y-1.5 overflow-y-auto text-neutral-400 bg-neutral-950/90 leading-relaxed flex-1 text-[10px]">
                {simLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`whitespace-pre-wrap break-all ${
                      log.includes("ERROR") || log.includes("FATAL")
                        ? "text-rose-400"
                        : log.includes("CLAIM")
                        ? "text-sky-300"
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

              <div className="px-3 py-1.5 border-t border-neutral-900 bg-neutral-900/50 text-[9px] text-neutral-500 flex justify-between font-mono">
                <span>SQL: FOR UPDATE SKIP LOCKED</span>
                <span>STATUS: STREAMING</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── PHASE 3: Job Lifecycle State Machine (Third - 100% Height & Centered) ── */}
      <section className="relative z-10 min-h-screen flex flex-col justify-center py-16 px-5 border-b border-neutral-900/80">
        <div className="max-w-5xl mx-auto w-full space-y-5 my-auto">
          
          <div>
            <div className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest font-bold">
              [ State Machine Flow ]
            </div>
            <h2 className="font-tnr text-2xl sm:text-3xl text-white font-normal mt-1">
              Job Lifecycle State Machine
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5 font-light">
              How jobs transition through atomic states from initial dispatch to completion or quarantine.
            </p>
          </div>

          {/* 50/50 Split: Left Content, Right 50% Image */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            
            {/* Left 50%: Explanatory Steps */}
            <div className="lg:col-span-6 space-y-2.5">
              
              <div className="p-3 rounded-lg border border-amber-900/40 bg-amber-950/15 backdrop-blur-sm space-y-1">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-tnr text-amber-300 font-bold text-sm">1. PENDING State</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300 uppercase">Queue</span>
                </div>
                <p className="text-[11px] text-neutral-400 font-sans leading-relaxed">
                  Jobs wait in the table sorted by <code className="text-neutral-300 font-mono">priority DESC</code> and <code className="text-neutral-300 font-mono">available_at ASC</code>. Immediate or scheduled.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-sky-900/40 bg-sky-950/15 backdrop-blur-sm space-y-1">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-tnr text-sky-300 font-bold text-sm">2. PROCESSING State</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300 uppercase">Active</span>
                </div>
                <p className="text-[11px] text-neutral-400 font-sans leading-relaxed">
                  Claimed atomically via <code className="text-neutral-300 font-mono">SKIP LOCKED</code>. Workers emit heartbeats every 2 minutes to prevent reaper reset.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-emerald-900/40 bg-emerald-950/15 backdrop-blur-sm space-y-1">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-tnr text-emerald-300 font-bold text-sm">3. COMPLETED State</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 uppercase">Done</span>
                </div>
                <p className="text-[11px] text-neutral-400 font-sans leading-relaxed">
                  Handler finishes with zero errors. Status changes to <code className="text-neutral-300 font-mono">completed</code> and slot is immediately freed.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-rose-900/40 bg-rose-950/15 backdrop-blur-sm space-y-1">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-tnr text-rose-300 font-bold text-sm">4. RETRY or DEAD_LETTER (DLQ)</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 uppercase">Fault Safe</span>
                </div>
                <p className="text-[11px] text-neutral-400 font-sans leading-relaxed">
                  Transient errors trigger exponential retry backoff. Exhausted jobs quarantine in the DLQ with full stack trace preservation.
                </p>
              </div>

            </div>

            {/* Right 50%: Compact Diagram Frame */}
            <div className="lg:col-span-6 rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-md p-2.5 shadow-xl">
              <div className="relative w-full rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950 aspect-video shadow-inner">
                <img
                  src="/lifecycle.jpg"
                  alt="RelayX State Machine Lifecycle Diagram"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="pt-2 text-center">
                <span className="text-[10px] font-mono text-neutral-500">
                  State Machine Blueprint • 5 Deterministic Transitions
                </span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── PHASE 4: PostgreSQL Queue Reliability (Fourth - 100% Height & Centered) ── */}
      <section className="relative z-10 min-h-screen flex flex-col justify-center py-16 px-5 border-b border-neutral-900/80">
        <div className="max-w-5xl mx-auto w-full space-y-6 my-auto">
          
          <div className="text-center space-y-1 max-w-xl mx-auto">
            <div className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
              [ Core Mechanics ]
            </div>
            <h2 className="font-tnr text-2xl sm:text-3xl text-white font-normal">
              PostgreSQL Queue Reliability
            </h2>
            <p className="text-xs text-neutral-400 font-light">
              Durable background processing guarantees without external queue dependencies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            
            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-md space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-tnr text-base text-white font-bold">01. Row-Level Locks</span>
                <span className="text-[9px] text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800 font-mono">ACID</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed font-sans font-light">
                Workers claim pending rows with <code className="text-neutral-300 font-mono">SKIP LOCKED</code>. Multiple nodes poll concurrently without locking conflicts.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-md space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-tnr text-base text-white font-bold">02. Exponential Backoff</span>
                <span className="text-[9px] text-sky-400 bg-sky-950 px-1.5 py-0.5 rounded border border-sky-800 font-mono">Resilience</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed font-sans font-light">
                Failed jobs retry with exponential delays + randomized jitter to prevent thundering herd spikes against downstream APIs.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-md space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-tnr text-base text-white font-bold">03. Dead Letter Queue</span>
                <span className="text-[9px] text-rose-400 bg-rose-950 px-1.5 py-0.5 rounded border border-rose-800 font-mono">Quarantine</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed font-sans font-light">
                Poison-pill jobs that exhaust max retries isolate into DLQ status with error traces preserved and 1-click re-queue API.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-md space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-tnr text-base text-white font-bold">04. Strict Idempotency</span>
                <span className="text-[9px] text-purple-400 bg-purple-950 px-1.5 py-0.5 rounded border border-purple-800 font-mono">Deduplication</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed font-sans font-light">
                Unique <code className="text-neutral-300 font-mono">idempotency_key</code> database indexes guarantee duplicate client requests return existing jobs without re-executing.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-md space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-tnr text-base text-white font-bold">05. Priority Queuing</span>
                <span className="text-[9px] text-amber-400 bg-amber-950 px-1.5 py-0.5 rounded border border-amber-800 font-mono">Priority</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed font-sans font-light">
                Assign priority 0–100. Workers always claim higher-priority jobs first via <code className="text-neutral-300 font-mono">ORDER BY priority DESC</code>.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-md space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-tnr text-base text-white font-bold">06. Orphan Job Reaper</span>
                <span className="text-[9px] text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800 font-mono">Recovery</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed font-sans font-light">
                Workers emit 2-min heartbeats. If a worker node crashes mid-execution, an automated reaper resets abandoned jobs back to pending.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ── PHASE 5: Architecture Image Section (Fifth - 100% Height & Centered) ── */}
      <section className="relative z-10 min-h-screen flex flex-col justify-center py-16 px-5 border-b border-neutral-900/80">
        <div className="max-w-5xl mx-auto w-full space-y-5 my-auto">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
                [ System Architecture ]
              </div>
              <h2 className="font-tnr text-2xl sm:text-3xl text-white font-normal mt-1">
                High-Level System Design (HLD)
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5 font-light">
                Complete data flow from client dispatch to PostgreSQL atomic row locks and worker execution.
              </p>
            </div>

            <Link
              href="/about"
              className="text-xs font-mono text-amber-400 hover:text-amber-300 transition flex items-center gap-1"
            >
              <span>Explore Architectural Specs</span>
              <span>→</span>
            </Link>
          </div>

          {/* Diagram Glass Card */}
          <div className="rounded-xl border border-neutral-800/90 bg-neutral-900/40 backdrop-blur-md p-3.5 sm:p-4 shadow-xl space-y-3">
            <div className="relative w-full rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950 aspect-video shadow-inner">
              <img
                src="/architecture.jpg"
                alt="RelayX High Level Architecture Diagram"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono pt-1">
              <div className="p-3 rounded-lg bg-neutral-950/80 border border-neutral-800/80">
                <span className="font-tnr text-amber-300 font-bold text-sm block mb-1">1. Producer Tier (API)</span>
                <span className="text-neutral-400 font-sans leading-relaxed text-[11px]">
                  Validates JSON schemas, enforces unique idempotency keys, and broadcasts <code className="text-neutral-200">NOTIFY NEW_JOBS</code> via PostgreSQL pub/sub.
                </span>
              </div>

              <div className="p-3 rounded-lg bg-neutral-950/80 border border-neutral-800/80">
                <span className="font-tnr text-emerald-300 font-bold text-sm block mb-1">2. Lock Engine (PostgreSQL)</span>
                <span className="text-neutral-400 font-sans leading-relaxed text-[11px]">
                  Uses <code className="text-neutral-200">FOR UPDATE SKIP LOCKED</code> to allow concurrent worker nodes to claim rows without deadlock or table locking.
                </span>
              </div>

              <div className="p-3 rounded-lg bg-neutral-950/80 border border-neutral-800/80">
                <span className="font-tnr text-sky-300 font-bold text-sm block mb-1">3. Worker Fleet &amp; Reaper</span>
                <span className="text-neutral-400 font-sans leading-relaxed text-[11px]">
                  Processes jobs with 2-minute heartbeats, computes exponential backoff with jitter, and resets orphaned jobs via a 10m reaper.
                </span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── PHASE 6: FAQ & Footer (100% Height & Centered) ─────────────────── */}
      <section className="relative z-10 min-h-screen flex flex-col justify-between pt-16 pb-6 px-5">
        <div className="max-w-3xl mx-auto w-full space-y-5 my-auto">
          
          <div className="text-center space-y-1">
            <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
              [ FAQ ]
            </div>
            <h2 className="font-tnr text-2xl sm:text-3xl text-white font-normal">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-2.5">
            {[
              {
                q: "Why build a background queue with PostgreSQL instead of Redis?",
                a: "PostgreSQL row-level locks allow you to enqueue background jobs within the same ACID database transaction as your core business records (e.g. creating a user account and enqueuing a welcome email atomically), eliminating dual-write risks and external broker costs.",
              },
              {
                q: "What makes FOR UPDATE SKIP LOCKED scalable?",
                a: "Traditional table locking forces concurrent queries to wait sequentially. SKIP LOCKED tells Postgres to ignore any row currently locked by another worker transaction, so multiple workers can each claim the next available row simultaneously without blocking each other.",
              },
              {
                q: "How does the worker detect new jobs without busy polling?",
                a: "RelayX combines reactive PostgreSQL LISTEN/NOTIFY with safety polling. When an API server inserts a job, it fires NOTIFY NEW_JOBS to wake up sleeping workers instantly, while an idle timer serves as a safety fallback.",
              },
            ].map((faq, i) => (
              <div
                key={i}
                className="rounded-lg border border-neutral-800 bg-neutral-900/40 overflow-hidden text-xs shadow-sm"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                  className="w-full p-3 text-left font-tnr text-sm text-neutral-200 font-medium flex items-center justify-between hover:bg-neutral-900/80 transition"
                >
                  <span>{faq.q}</span>
                  <span className="font-mono text-xs text-neutral-500">{activeFaq === i ? "−" : "+"}</span>
                </button>

                {activeFaq === i && (
                  <div className="px-3 pb-3 pt-1 text-neutral-400 font-sans leading-relaxed text-xs border-t border-neutral-900 font-light">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>

        {/* Minimalist Compact Footer */}
        <footer className="w-full max-w-5xl mx-auto pt-8 border-t border-neutral-900 text-xs font-mono text-neutral-500">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="RelayX" className="h-4 w-auto object-contain" />
              <span className="font-tnr text-white font-bold text-sm">RelayX</span>
              <span>•</span>
              <span className="text-neutral-400 text-xs">PostgreSQL Distributed Queue Engine</span>
            </div>

            <div className="text-neutral-500 text-[11px]">
              Open-source under MIT License.
            </div>

            <div className="flex items-center gap-3.5 text-xs">
              <Link href="/about" className="hover:text-white transition">About &amp; HLD</Link>
              <Link href="/dashboard" className="hover:text-white transition">Console</Link>
              <a href="https://github.com/Shobhit070304/distributed-job-platform" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">GitHub</a>
            </div>
          </div>
        </footer>
      </section>

    </div>
  );
}
