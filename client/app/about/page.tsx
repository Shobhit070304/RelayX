"use client";

import React from "react";
import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="relative min-h-screen bg-neutral-950 text-neutral-200 overflow-x-hidden font-sans selection:bg-amber-900/40 selection:text-white">
      {/* ── SaaS Tactile Background: Grain Jitter + Warm Ambient Spotlight ──── */}
      <div className="pointer-events-none fixed inset-0 z-50 grain-jitter-overlay animate-subtle-jitter opacity-80" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-ambient-glow animate-ambient-glow" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-grid-subtle opacity-70" />

      {/* ── Fixed Compact Navigation Bar ──────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-40 w-full border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md px-6 py-4 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2.5 group">
              <img src="/logo.svg" alt="RelayX Logo" className="h-5 w-auto object-contain transition group-hover:scale-105" />
              <span className="font-tnr text-base font-bold tracking-tight text-white">RelayX</span>
            </Link>
            <span className="text-neutral-700">/</span>
            <span className="text-xs font-mono text-neutral-400">About & Architecture</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-neutral-400 hover:text-white transition font-mono px-2 py-1"
            >
              Home
            </Link>
            <Link
              href="/dashboard"
              className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-linear-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white transition shadow-sm flex items-center gap-1 font-sans"
            >
              <span>📊 Console</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Educational Content ──────────────────────────────────────── */}
      <main className="relative z-10 max-w-5xl mx-auto pt-24 pb-16 px-4 sm:px-5 space-y-10">
        
        {/* Hero Mission */}
        <section className="space-y-3 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border border-amber-500/30 bg-amber-950/30 text-[10px] text-amber-300 font-mono">
            <span>🎓 Systems Engineering Deep-Dive</span>
          </div>

          <h1 className="font-tnr text-3xl sm:text-4xl font-normal text-white tracking-tight leading-tight">
            Why RelayX Was Built
          </h1>

          <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed font-sans font-light">
            An open-source educational project designed to understand how{" "}
            <strong className="text-neutral-200">background jobs execute</strong>, how{" "}
            <strong className="text-neutral-200">distributed workers coordinate</strong> without duplicate tasks, 
            and how <strong className="text-neutral-200">PostgreSQL row-level locking</strong> powers a queue without Redis or RabbitMQ.
          </p>
        </section>

        {/* ── Problem & Solution Cards (Compact Glassmorphic) ──────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="p-4 rounded-xl border border-rose-900/40 bg-neutral-900/50 backdrop-blur-md space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-mono text-[10px] font-bold uppercase tracking-wider">
              <span>⚠️ The Distributed Queue Dilemma</span>
            </div>
            <h3 className="font-tnr text-base font-bold text-white">Why Relational Queues Used to Fail</h3>
            <p className="text-[11px] text-neutral-400 leading-relaxed font-light">
              Historically, using SQL databases as queues suffered from <strong>lock contention</strong>. 
              If 10 workers ran <code className="text-neutral-200 bg-neutral-950 px-1 py-0.5 rounded font-mono text-[10px]">SELECT * FROM jobs WHERE status = &apos;pending&apos; LIMIT 1</code> simultaneously:
            </p>
            <ul className="text-[11px] text-neutral-400 space-y-1 list-disc pl-4 font-light">
              <li>They selected the same row, executing the job 10 times concurrently.</li>
              <li>Or standard <code className="text-neutral-300 font-mono">FOR UPDATE</code> locked the whole table, causing workers to block each other and stalling throughput.</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl border border-emerald-900/40 bg-neutral-900/50 backdrop-blur-md space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-[10px] font-bold uppercase tracking-wider">
              <span>💡 The Modern Solution</span>
            </div>
            <h3 className="font-tnr text-base font-bold text-white">PostgreSQL `SKIP LOCKED`</h3>
            <p className="text-[11px] text-neutral-400 leading-relaxed font-light">
              PostgreSQL introduced <code className="text-emerald-300 bg-neutral-950 px-1 py-0.5 rounded font-mono text-[10px]">FOR UPDATE SKIP LOCKED</code>. 
              When a worker queries for a job:
            </p>
            <ul className="text-[11px] text-neutral-400 space-y-1 list-disc pl-4 font-light">
              <li>It instantly locks only the specific row it is claiming.</li>
              <li>Other concurrent workers scanning the table <strong>automatically skip all locked rows</strong> with zero waiting and zero contention.</li>
              <li>Execution is atomic, ACID-safe, and durable on disk.</li>
            </ul>
          </div>
        </section>

        {/* ── Architecture Trade-Offs Table ─────────────────────────────────── */}
        <section className="space-y-3 pt-4 border-t border-neutral-900">
          <div>
            <div className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
              [ Trade-Off Analysis ]
            </div>
            <h2 className="font-tnr text-2xl sm:text-3xl text-white font-normal mt-0.5">
              Architectural Comparison
            </h2>
            <p className="text-xs text-neutral-400 font-light">
              When to use PostgreSQL row locks vs specialized message brokers.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-neutral-950/90 text-neutral-400 uppercase text-[9px] border-b border-neutral-800">
                  <tr>
                    <th className="p-3">Feature</th>
                    <th className="p-3 text-amber-300">RelayX (PostgreSQL)</th>
                    <th className="p-3">Redis (BullMQ)</th>
                    <th className="p-3">AWS SQS / RabbitMQ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-sans text-xs">
                  <tr className="hover:bg-neutral-900/40">
                    <td className="p-3 font-bold font-mono text-neutral-200 text-[11px]">ACID Guarantees</td>
                    <td className="p-3 text-emerald-400 text-[11px]">✅ Atomic transactions with business data</td>
                    <td className="p-3 text-neutral-400 text-[11px]">⚠️ Dual-write risk across separate services</td>
                    <td className="p-3 text-neutral-400 text-[11px]">❌ Requires outbox pattern to guarantee delivery</td>
                  </tr>
                  <tr className="hover:bg-neutral-900/40">
                    <td className="p-3 font-bold font-mono text-neutral-200 text-[11px]">Infrastructure Footprint</td>
                    <td className="p-3 text-emerald-400 text-[11px]">✅ Zero extra servers (uses existing database)</td>
                    <td className="p-3 text-neutral-400 text-[11px]">⚠️ Requires running &amp; maintaining Redis instance</td>
                    <td className="p-3 text-neutral-400 text-[11px]">⚠️ External cloud service / recurring monthly cost</td>
                  </tr>
                  <tr className="hover:bg-neutral-900/40">
                    <td className="p-3 font-bold font-mono text-neutral-200 text-[11px]">Throughput Capacity</td>
                    <td className="p-3 text-amber-300 text-[11px]">⚡ ~2,000–10,000 jobs/sec (adequate for 95% of apps)</td>
                    <td className="p-3 text-emerald-400 text-[11px]">🚀 50,000+ jobs/sec (in-memory)</td>
                    <td className="p-3 text-emerald-400 text-[11px]">🚀 100,000+ jobs/sec (unlimited cloud scale)</td>
                  </tr>
                  <tr className="hover:bg-neutral-900/40">
                    <td className="p-3 font-bold font-mono text-neutral-200 text-[11px]">Queryability &amp; Inspection</td>
                    <td className="p-3 text-emerald-400 text-[11px]">✅ Standard SQL queries, joins, and filters</td>
                    <td className="p-3 text-neutral-400 text-[11px]">⚠️ Key-value lookups; complex reporting</td>
                    <td className="p-3 text-neutral-400 text-[11px]">❌ Opaque streaming queue</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Code Tour Cards ──────────────────────────────────────────────── */}
        <section className="space-y-3 pt-4 border-t border-neutral-900">
          <div>
            <div className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
              [ Source Code Tour ]
            </div>
            <h2 className="font-tnr text-2xl sm:text-3xl text-white font-normal mt-0.5">
              Key Implementation Files
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3.5 rounded-lg border border-neutral-800 bg-neutral-900/50 backdrop-blur-sm space-y-1">
              <span className="text-emerald-400 font-bold block text-xs">server/src/worker.ts</span>
              <p className="text-neutral-400 font-sans text-[11px] leading-relaxed">
                Contains the worker loop, concurrency slot reservation, PostgreSQL <code className="text-neutral-200">LISTEN / NOTIFY</code> reactive wakeup client, and graceful shutdown.
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-neutral-800 bg-neutral-900/50 backdrop-blur-sm space-y-1">
              <span className="text-sky-400 font-bold block text-xs">server/src/services/jobs.service.ts</span>
              <p className="text-neutral-400 font-sans text-[11px] leading-relaxed">
                Houses the SQL queries for <code className="text-neutral-200">FOR UPDATE SKIP LOCKED</code>, exponential backoff calculation with jitter, and the orphaned job reaper.
              </p>
            </div>
          </div>
        </section>

        {/* ── Call to Action Card ──────────────────────────────────────────── */}
        <section className="p-6 rounded-xl border border-amber-900/40 bg-linear-to-b from-amber-950/20 to-neutral-900/50 backdrop-blur-md text-center space-y-3">
          <h3 className="font-tnr text-2xl font-normal text-white">Ready to Experiment?</h3>
          <p className="text-xs text-neutral-400 max-w-md mx-auto font-light font-sans">
            Dispatch test jobs, simulate provider outages, trigger retries, and inspect PostgreSQL queue behavior in real time.
          </p>
          <div className="pt-1 flex items-center justify-center gap-2.5">
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg bg-linear-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-semibold text-xs transition shadow-md font-sans"
            >
              Launch Live Console →
            </Link>
            <Link
              href="/"
              className="px-3.5 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-mono text-xs border border-neutral-800 transition"
            >
              Back to Home
            </Link>
          </div>
        </section>

      </main>
    </div>
  );
}
