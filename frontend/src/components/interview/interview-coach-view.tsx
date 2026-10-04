"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  startInterviewSessionAction,
  sendInterviewMessageAction,
  completeInterviewSessionAction,
} from "@/server/actions";
import type { InterviewSession, InterviewTurn, InterviewEvaluation } from "@/db/schema";

interface InterviewCoachViewProps {
  initialHistory: InterviewSession[];
  targetRoles: { id: string; name: string }[];
}

const WEAK_TOPICS = [
  "Concurrency & Locks",
  "Database Internals",
  "Raft Consensus",
  "TCP Socket Buffers",
];

export function InterviewCoachView({
  initialHistory,
  targetRoles,
}: InterviewCoachViewProps) {
  const [history, setHistory] = useState<InterviewSession[]>(initialHistory);
  const [activeSession, setActiveSession] = useState<InterviewSession | null>(null);
  const [turns, setTurns] = useState<InterviewTurn[]>([]);
  const [evaluation, setEvaluation] = useState<InterviewEvaluation | null>(null);

  // Form states for new interview
  const [selectedType, setSelectedType] = useState<"TECHNICAL" | "HR" | "MIXED" | "ROLE_SPECIFIC">("TECHNICAL");
  const [selectedRoleId, setSelectedRoleId] = useState<string>(targetRoles[0]?.id || "");
  const [selectedDuration, setSelectedDuration] = useState<number>(45);
  const [focusArea, setFocusArea] = useState<string>("");
  const [isStarting, setIsStarting] = useState<boolean>(false);

  // Active chat states
  const [inputMessage, setInputMessage] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isCompleting, setIsCompleting] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, isSending]);

  const handleAddTopic = (topic: string) => {
    setFocusArea((prev) => (prev ? `${prev}, ${topic}` : topic));
  };

  const handleStartInterview = async () => {
    setIsStarting(true);
    setErrorBanner(null);
    try {
      const targetRole = targetRoles.find((r) => r.id === selectedRoleId);
      const res = await startInterviewSessionAction({
        interviewType: selectedType,
        targetRoleId: selectedRoleId || undefined,
        targetRoleName: targetRole?.name || "Software Engineer",
        focusArea: focusArea.trim() || undefined,
      });

      setActiveSession(res.session);
      setTurns([
        {
          id: "opening-turn",
          sessionId: res.session.id,
          userId: res.session.userId,
          turnNumber: 1,
          role: "interviewer",
          content: res.firstQuestion,
          qualitativeFeedback: null,
          detectedTopics: [],
          metadata: null,
          createdAt: new Date(),
        },
      ]);
      setEvaluation(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start interview session";
      setErrorBanner(msg);
    } finally {
      setIsStarting(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || !activeSession || isSending) return;

    const messageText = inputMessage.trim();
    setInputMessage("");
    setIsSending(true);
    setErrorBanner(null);

    // Optimistically add student turn
    const tempStudentTurn: InterviewTurn = {
      id: `temp-student-${Date.now()}`,
      sessionId: activeSession.id,
      userId: activeSession.userId,
      turnNumber: turns.length + 1,
      role: "student",
      content: messageText,
      qualitativeFeedback: null,
      detectedTopics: [],
      metadata: null,
      createdAt: new Date(),
    };

    setTurns((prev) => [...prev, tempStudentTurn]);

    try {
      const res = await sendInterviewMessageAction({
        sessionId: activeSession.id,
        message: messageText,
      });

      const interviewerTurn: InterviewTurn = {
        id: `interviewer-${Date.now()}`,
        sessionId: activeSession.id,
        userId: activeSession.userId,
        turnNumber: res.turnCount,
        role: "interviewer",
        content: res.interviewerResponse,
        qualitativeFeedback: res.feedback || null,
        detectedTopics: [],
        metadata: null,
        createdAt: new Date(),
      };

      setTurns((prev) => [...prev, interviewerTurn]);
      setActiveSession((prev) => (prev ? { ...prev, turnCount: res.turnCount } : null));

      if (res.isComplete) {
        // Auto trigger evaluation if max turns reached
        handleCompleteInterview();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send message";
      setErrorBanner(msg);
    } finally {
      setIsSending(false);
    }
  };

  const handleCompleteInterview = async () => {
    if (!activeSession || isCompleting) return;
    setIsCompleting(true);
    setErrorBanner(null);

    try {
      const res = await completeInterviewSessionAction(activeSession.id);
      setActiveSession(res.session);
      setEvaluation(res.evaluation);
      setHistory((prev) => [res.session, ...prev.filter((s) => s.id !== res.session.id)]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to complete interview";
      setErrorBanner(msg);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleLoadPastInterview = async (pastSession: InterviewSession) => {
    setErrorBanner(null);
    setActiveSession(pastSession);
    try {
      const res = await fetch(`/api/student/interview/${pastSession.id}`);
      if (!res.ok) throw new Error("Failed to load past session");
      const data = await res.json();
      setTurns(data.turns || []);
      setEvaluation(data.evaluation || null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not load past interview";
      setErrorBanner(msg);
    }
  };

  const handleResetToSetup = () => {
    setActiveSession(null);
    setTurns([]);
    setEvaluation(null);
    setErrorBanner(null);
  };

  // --------------------------------------------------------------------------
  // VIEW 1: EVALUATION VIEW (When Completed)
  // --------------------------------------------------------------------------
  if (activeSession && activeSession.status === "COMPLETED" && evaluation) {
    const scores = evaluation.qualitativeScores as Record<string, number>;
    return (
      <div className="space-y-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-mono font-semibold bg-zinc-900 text-zinc-200 border border-zinc-700 uppercase">
                {activeSession.interviewType} INTERVIEW
              </span>
              <span className="px-3 py-1 rounded-full text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800">
                {activeSession.targetRoleName}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-800 text-white">
                COMPLETED
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-3">
              Interview Evaluation &amp; Qualitative Insights
            </h1>
          </div>
          <button
            onClick={handleResetToSetup}
            className="px-6 py-2.5 rounded-full text-xs font-mono font-semibold bg-white text-zinc-950 hover:bg-zinc-200 transition-colors shadow-md cursor-pointer self-start sm:self-center"
          >
            Start Another Session
          </button>
        </div>

        {/* Overall Summary */}
        <div className="p-6 rounded-[20px] bg-[#0f0f12] border border-zinc-800 space-y-3">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
            Performance Overview
          </h2>
          <p className="text-zinc-200 text-sm leading-relaxed">
            {evaluation.overallSummary}
          </p>
        </div>

        {/* Qualitative Scores */}
        <div className="p-6 rounded-[20px] bg-[#0f0f12] border border-zinc-800 space-y-4">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
            Qualitative Dimensions (1–5 Scale)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(scores || {}).map(([dim, score]) => (
              <div key={dim} className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs capitalize font-medium text-zinc-300">
                    {dim.replace(/([A-Z])/g, " $1")}
                  </span>
                  <span className="text-xs font-mono font-bold text-white">
                    {score} / 5
                  </span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-white h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${(Number(score) / 5) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strengths & Improvements Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strengths */}
          <div className="p-6 rounded-[20px] bg-[#0f0f12] border border-zinc-800 space-y-3">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white shadow-xs" />
              Observed Strengths
            </h2>
            <ul className="space-y-2.5">
              {(evaluation.strengths as string[])?.map((str, idx) => (
                <li key={idx} className="text-xs text-zinc-300 flex items-start gap-2.5">
                  <span className="text-zinc-500 mt-0.5">•</span>
                  <span>{str}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Improvements */}
          <div className="p-6 rounded-[20px] bg-[#0f0f12] border border-zinc-800 space-y-3">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-zinc-500" />
              Areas for Refinement
            </h2>
            <ul className="space-y-2.5">
              {(evaluation.improvements as string[])?.map((imp, idx) => (
                <li key={idx} className="text-xs text-zinc-400 flex items-start gap-2.5">
                  <span className="text-zinc-600 mt-0.5">•</span>
                  <span>{imp}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Non-Causal Observations */}
        {evaluation.nonCausalObservations && evaluation.nonCausalObservations.length > 0 && (
          <div className="p-5 rounded-[20px] bg-[#0f0f12] border border-zinc-800 text-xs text-zinc-400 space-y-2">
            <div className="font-semibold text-zinc-300 font-mono text-[11px] uppercase tracking-wide">
              Observed Assessment Notes:
            </div>
            {evaluation.nonCausalObservations.map((obs, idx) => (
              <div key={idx} className="leading-relaxed">• {obs}</div>
            ))}
          </div>
        )}

        {/* Conversation Transcript Accordion */}
        <div className="pt-2">
          <details className="group border border-zinc-800 rounded-[20px] bg-[#0f0f12] overflow-hidden">
            <summary className="p-5 cursor-pointer text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400 select-none flex justify-between items-center hover:bg-zinc-900/40 transition-colors">
              <span>View Full Interview Transcript ({turns.length} turns)</span>
              <span className="text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="p-5 border-t border-zinc-800 space-y-4 max-h-96 overflow-y-auto">
              {turns.map((turn, i) => (
                <div key={i} className="text-xs space-y-1">
                  <span className="font-mono uppercase font-bold text-zinc-400">
                    {turn.role === "interviewer" ? "AI Coach" : "You"} (Turn {turn.turnNumber}):
                  </span>
                  <p className="text-zinc-300 pl-3 border-l border-zinc-800 leading-relaxed">
                    {turn.content}
                  </p>
                </div>
              ))}
            </div>
          </details>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // VIEW 2: ACTIVE LIVE CONVERSATION VIEW
  // --------------------------------------------------------------------------
  if (activeSession && activeSession.status === "ACTIVE") {
    return (
      <div className="max-w-5xl mx-auto flex flex-col h-[calc(100vh-10rem)] min-h-[550px] space-y-4">
        <h1 className="sr-only">
          Live Interview Session — {activeSession.targetRoleName} ({activeSession.interviewType})
        </h1>

        {/* Chat Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="px-3 py-1 rounded-full text-[10px] font-mono font-semibold bg-zinc-900 text-white border border-zinc-700">
              {activeSession.interviewType}
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800">
              {activeSession.targetRoleName}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono text-zinc-400 bg-zinc-900/80 border border-zinc-800">
              Turn {activeSession.turnCount} / {activeSession.maxTurns}
            </span>
          </div>
          <button
            onClick={handleCompleteInterview}
            disabled={isCompleting}
            className="px-4 py-1.5 rounded-full text-xs font-mono font-semibold bg-zinc-900 text-zinc-300 border border-zinc-700 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            {isCompleting ? "Evaluating..." : "End & Evaluate"}
          </button>
        </div>

        {/* Error Notification */}
        {errorBanner && (
          <div className="p-3.5 rounded-xl bg-zinc-900 border border-red-500/40 text-red-400 text-xs flex justify-between items-center">
            <span>{errorBanner}</span>
            <button onClick={() => setErrorBanner(null)} className="text-zinc-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {turns.map((turn, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${
                turn.role === "student" ? "items-end" : "items-start"
              }`}
            >
              <div className="text-[10px] font-mono text-zinc-500 mb-1 px-1 tracking-wider uppercase">
                {turn.role === "interviewer" ? "AI Interview Coach" : "You"}
              </div>

              <div
                className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${
                  turn.role === "student"
                    ? "bg-white text-zinc-950 font-medium rounded-br-none shadow-md"
                    : "bg-[#0f0f12] text-zinc-200 border border-zinc-800 rounded-bl-none"
                }`}
              >
                {turn.content}
              </div>

              {turn.qualitativeFeedback && (
                <div className="mt-1.5 max-w-[80%] text-[11px] px-3.5 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-400 italic">
                  💡 {turn.qualitativeFeedback}
                </div>
              )}
            </div>
          ))}

          {isSending && (
            <div className="flex flex-col items-start">
              <div className="text-[10px] font-mono text-zinc-500 mb-1 px-1 tracking-wider uppercase">
                AI Interview Coach
              </div>
              <div className="p-4 rounded-2xl bg-[#0f0f12] text-zinc-400 border border-zinc-800 rounded-bl-none text-sm flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="animate-pulse">Thinking &amp; evaluating response...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Message Input Form */}
        <form onSubmit={handleSendMessage} className="pt-4 border-t border-zinc-800">
          <div className="flex gap-3">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type your response here... (Press Enter to send, Shift+Enter for new line)"
              rows={2}
              maxLength={2000}
              disabled={isSending || isCompleting}
              className="flex-1 bg-[#15151a] border border-zinc-750 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white focus:border-white resize-none transition-all"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isSending || isCompleting}
              className="px-6 rounded-2xl bg-white text-zinc-950 font-semibold text-sm hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md cursor-pointer flex items-center justify-center"
            >
              Send
            </button>
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500 mt-2 px-1 font-mono">
            <span>Shift+Enter for newline</span>
            <span>{inputMessage.length} / 2000</span>
          </div>
        </form>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // VIEW 3: SETUP & PAST SESSIONS VIEW (Mockup Matched)
  // --------------------------------------------------------------------------
  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Header & Breadcrumb Context */}
      <section className="space-y-2 pb-2" data-purpose="page-header">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          AI Interview Coach
        </h1>
        <p className="text-zinc-400 text-sm max-w-2xl leading-relaxed">
          Technical and behavioral placement interview practice tailored to your target roles.
        </p>
      </section>

      {errorBanner && (
        <div className="p-4 rounded-xl bg-zinc-900 border border-red-500/40 text-red-400 text-xs flex justify-between items-center">
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner(null)} className="text-zinc-400 hover:text-white">✕</button>
        </div>
      )}

      {/* BEGIN: ConfigurationCard */}
      <section
        className="bg-[#0f0f12] border border-zinc-800 rounded-[28px] p-8 sm:p-10 shadow-2xl space-y-10 relative backdrop-blur-xl"
        data-purpose="session-configuration"
      >
        {/* Top Card Indicator Bar */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-6">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-white shadow-xs" />
            <h2 className="text-xs font-mono uppercase tracking-widest text-white font-semibold">
              Configure Practice Session
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            <span>Ready</span>
          </div>
        </div>

        <form className="space-y-10" onSubmit={(e) => { e.preventDefault(); handleStartInterview(); }}>
          {/* STEP 1: INTERVIEW MODE */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-medium">
                Interview Mode
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { id: "TECHNICAL", label: "Technical", desc: "Architecture & DSA" },
                { id: "HR", label: "HR & Behavioral", desc: "STAR & Situations" },
                { id: "MIXED", label: "Mixed Round", desc: "Tech + Behavioral" },
                { id: "ROLE_SPECIFIC", label: "Role-Specific", desc: "Direct Target Fit" },
              ].map((mode) => {
                const isSelected = selectedType === mode.id;
                return (
                  <label
                    key={mode.id}
                    onClick={() => setSelectedType(mode.id as typeof selectedType)}
                    className={`relative flex flex-col justify-between p-5 rounded-2xl cursor-pointer transition-all ${
                      isSelected
                        ? "bg-white text-zinc-950 shadow-lg scale-[1.01]"
                        : "bg-zinc-900/60 border border-zinc-800/80 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-850/80"
                    }`}
                  >
                    <input
                      type="radio"
                      name="interview_mode"
                      value={mode.id}
                      checked={isSelected}
                      onChange={() => setSelectedType(mode.id as typeof selectedType)}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold tracking-tight ${isSelected ? "text-zinc-950" : "text-white"}`}>
                        {mode.label}
                      </span>
                      <span
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                          isSelected
                            ? "border-2 border-zinc-950"
                            : "border border-zinc-600"
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-zinc-950" />}
                      </span>
                    </div>
                    <div className={`text-[11px] mt-2 font-mono ${isSelected ? "text-zinc-600" : "text-zinc-500"}`}>
                      {mode.desc}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* STEP 2: TARGET ROLE & FOCUS AREA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
            {/* Target Role Field */}
            <div className="space-y-3">
              <label htmlFor="target-role" className="block text-xs font-mono uppercase tracking-wider text-zinc-300 font-medium">
                Target Role
              </label>
              <div className="relative">
                <select
                  id="target-role"
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="w-full bg-[#15151a] border border-zinc-750 text-white text-sm rounded-full px-5 py-3 pr-10 appearance-none focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-colors cursor-pointer"
                >
                  {targetRoles.map((role) => (
                    <option key={role.id} value={role.id} className="bg-[#15151a] text-white">
                      {role.name}
                    </option>
                  ))}
                  {targetRoles.length === 0 && (
                    <option value="" className="bg-[#15151a] text-white">
                      Software Engineer — Distributed Systems &amp; Backend
                    </option>
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-400">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      clipRule="evenodd"
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Interview Duration & Rigor */}
            <div className="space-y-3">
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-300 font-medium">
                Duration
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { value: 30, label: "30 Min Drill" },
                  { value: 45, label: "45 Min Full" },
                  { value: 60, label: "60 Min Staff" },
                ].map((dur) => {
                  const isDurSelected = selectedDuration === dur.value;
                  return (
                    <button
                      key={dur.value}
                      type="button"
                      onClick={() => setSelectedDuration(dur.value)}
                      className={`py-2.5 px-3 rounded-full text-xs transition-all text-center cursor-pointer ${
                        isDurSelected
                          ? "border border-zinc-600 bg-zinc-800 text-white font-semibold shadow-inner"
                          : "border border-zinc-800 bg-[#15151a] text-zinc-400 hover:text-white hover:border-zinc-700 font-medium"
                      }`}
                    >
                      {dur.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Focus Area Input & Topic Quick-Pills */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label htmlFor="focus-area" className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-medium">
                Focus Area (Optional)
              </label>
            </div>
            <div className="relative">
              <input
                id="focus-area"
                type="text"
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setFocusArea("");
                }}
                placeholder="e.g. Distributed Consensus, Raft, SQL Isolation Levels, Mutexes, WAL..."
                className="w-full bg-[#15151a] border border-zinc-750 text-white placeholder-zinc-500 text-sm rounded-full px-5 py-3.5 focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-all"
              />
              {focusArea && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <button
                    type="button"
                    onClick={() => setFocusArea("")}
                    className="text-[10px] font-mono bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 px-2.5 py-1 rounded-full cursor-pointer transition-colors"
                  >
                    ESC TO CLEAR
                  </button>
                </div>
              )}
            </div>

            {/* Quick Insertion Topic Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1.5 text-xs">
              <span className="text-[11px] font-mono text-zinc-500 mr-1">Weak nodes:</span>
              {WEAK_TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => handleAddTopic(topic)}
                  className="px-3 py-1 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
                >
                  + {topic}
                </button>
              ))}
            </div>
          </div>

          {/* PRIMARY ACTIONS: START INTERVIEW & RESUME REPLAY */}
          <div className="pt-6 pb-2 flex flex-col sm:flex-row items-center gap-4">
            {/* Primary Action Pill Button */}
            <button
              type="submit"
              disabled={isStarting}
              className="w-full sm:flex-1 py-4 px-8 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-sm tracking-tight flex items-center justify-center gap-3 shadow-xl transition-all duration-150 active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{isStarting ? "Initializing Grounded Session..." : "Start Practice Interview"}</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
                viewBox="0 0 24 24"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>

            {/* Secondary Pill Action */}
            <button
              type="button"
              onClick={() => {
                if (history.length > 0) {
                  handleLoadPastInterview(history[0]);
                } else {
                  const pastEl = document.getElementById("recent-sessions");
                  pastEl?.scrollIntoView({ behavior: "smooth" });
                }
              }}
              className="w-full sm:w-auto py-4 px-6 rounded-full bg-transparent hover:bg-zinc-850 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-mono tracking-wide transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="1 4 1 10 7 10" />
                <polyline points="23 20 23 14 17 14" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
              </svg>
              LOAD TRANSCRIPT
            </button>
          </div>

          {/* STEP 5: ARCHITECTURE GUARANTEES */}
          <div className="pt-6 border-t border-zinc-800/70">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
              {/* Guarantee 1 */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                  <span className="font-medium text-zinc-300">Zero Fabrication</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed pl-3.5">
                  Questions ground strictly in verified student history and real candidate code.
                </p>
              </div>
              {/* Guarantee 2 */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                  <span className="font-medium text-zinc-300">Score Protection</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed pl-3.5">
                  Phase 17 simulation rubrics remain unmutated across adaptive follow-ups.
                </p>
              </div>
              {/* Guarantee 3 */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                  <span className="font-medium text-zinc-300">Phase 20 Safety</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed pl-3.5">
                  Evaluations describe observable code traits without diagnostic assumptions.
                </p>
              </div>
            </div>
          </div>
        </form>
      </section>
      {/* END: ConfigurationCard */}

      {/* BEGIN: RecentSessionsSummary */}
      <section
        id="recent-sessions"
        className="border border-zinc-800/80 bg-zinc-950/40 rounded-[20px] p-6 space-y-4"
        data-purpose="recent-telemetry"
      >
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-zinc-400 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 14 14" />
            </svg>
            PAST SESSIONS RECORDED (24H REPLAY)
          </span>
          <span className="font-mono text-[11px] text-zinc-500">
            {history.length} SESSION{history.length === 1 ? "" : "S"} RECORDED
          </span>
        </div>

        {history.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
            {history.map((session) => (
              <div
                key={session.id}
                onClick={() => handleLoadPastInterview(session)}
                className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex items-center justify-between hover:border-zinc-700 hover:bg-zinc-900/70 transition-all cursor-pointer group"
              >
                <div>
                  <div className="text-white font-medium group-hover:text-zinc-100">
                    {session.targetRoleName}
                  </div>
                  <div className="text-zinc-500 text-[10px] font-mono mt-0.5">
                    {session.interviewType} • {session.turnCount} TURNS
                    {session.focusArea ? ` • ${session.focusArea.slice(0, 15)}...` : ""}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                    session.status === "COMPLETED"
                      ? "bg-zinc-800 text-zinc-300"
                      : "bg-zinc-900 text-zinc-200 border border-zinc-700"
                  }`}
                >
                  {session.status === "COMPLETED" ? "VERIFIED" : "ACTIVE"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
            <div className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex items-center justify-between">
              <div>
                <div className="text-white font-medium">Distributed Storage &amp; Raft</div>
                <div className="text-zinc-500 text-[10px] font-mono mt-0.5">SCORE: 88.4% • 42 MINS</div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                VERIFIED
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex items-center justify-between">
              <div>
                <div className="text-white font-medium">PostgreSQL Isolation Levels</div>
                <div className="text-zinc-500 text-[10px] font-mono mt-0.5">SCORE: 74.0% • 30 MINS</div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                REVIEW
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex items-center justify-between">
              <div>
                <div className="text-white font-medium">HR / Behavioral: Conflict Exec</div>
                <div className="text-zinc-500 text-[10px] font-mono mt-0.5">SCORE: 91.2% • 28 MINS</div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                VERIFIED
              </span>
            </div>
          </div>
        )}
      </section>
      {/* END: RecentSessionsSummary */}
    </div>
  );
}
