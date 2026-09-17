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
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-900 text-neutral-200 border border-neutral-700">
                {activeSession.interviewType} INTERVIEW
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-900 text-neutral-400 border border-neutral-800">
                {activeSession.targetRoleName}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-800 text-white">
                COMPLETED
              </span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight mt-2">
              Interview Evaluation & Qualitative Insights
            </h1>
          </div>
          <button
            onClick={handleResetToSetup}
            className="px-4 py-2 rounded-full text-sm font-medium bg-white text-black hover:bg-neutral-200 transition-colors shadow-sm"
          >
            Start Another Session
          </button>
        </div>

        {/* Overall Summary */}
        <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Performance Overview
          </h2>
          <p className="text-neutral-200 text-sm leading-relaxed">
            {evaluation.overallSummary}
          </p>
        </div>

        {/* Qualitative Scores */}
        <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Qualitative Dimensions (1–5 Scale)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(scores || {}).map(([dim, score]) => (
              <div key={dim} className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs capitalize font-medium text-neutral-300">
                    {dim.replace(/([A-Z])/g, " $1")}
                  </span>
                  <span className="text-xs font-mono font-bold text-white">
                    {score} / 5
                  </span>
                </div>
                <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-white h-1.5 rounded-full"
                    style={{ width: `${(Number(score) / 5) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strengths & Improvements Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Strengths */}
          <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white" />
              Observed Strengths
            </h2>
            <ul className="space-y-2">
              {(evaluation.strengths as string[])?.map((str, idx) => (
                <li key={idx} className="text-xs text-neutral-300 flex items-start gap-2">
                  <span className="text-neutral-500 mt-0.5">•</span>
                  <span>{str}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Improvements */}
          <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-neutral-500" />
              Areas for Refinement
            </h2>
            <ul className="space-y-2">
              {(evaluation.improvements as string[])?.map((imp, idx) => (
                <li key={idx} className="text-xs text-neutral-400 flex items-start gap-2">
                  <span className="text-neutral-600 mt-0.5">•</span>
                  <span>{imp}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Non-Causal Observations */}
        {evaluation.nonCausalObservations && evaluation.nonCausalObservations.length > 0 && (
          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 space-y-1">
            <div className="font-semibold text-neutral-300">Empirical Observations (Phase 20 Guard):</div>
            {evaluation.nonCausalObservations.map((obs, idx) => (
              <div key={idx}>• {obs}</div>
            ))}
          </div>
        )}

        {/* Conversation Transcript Accordion */}
        <div className="pt-2">
          <details className="group border border-neutral-800 rounded-2xl bg-neutral-950 overflow-hidden">
            <summary className="p-4 cursor-pointer text-xs font-semibold uppercase tracking-wider text-neutral-400 select-none flex justify-between items-center hover:bg-neutral-900 transition-colors">
              <span>View Full Interview Transcript ({turns.length} turns)</span>
              <span className="text-neutral-500 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="p-4 border-t border-neutral-800 space-y-4 max-h-96 overflow-y-auto">
              {turns.map((turn, i) => (
                <div key={i} className="text-xs space-y-1">
                  <span className="font-mono uppercase font-bold text-neutral-500">
                    {turn.role === "interviewer" ? "AI Coach" : "You"} (Turn {turn.turnNumber}):
                  </span>
                  <p className="text-neutral-300 pl-2 border-l border-neutral-800">
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
      <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)] min-h-[500px]">
        {/* Chat Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-900 text-white border border-neutral-700">
              {activeSession.interviewType}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-900 text-neutral-400 border border-neutral-800">
              {activeSession.targetRoleName}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono text-neutral-400 bg-neutral-900 border border-neutral-800">
              Turn {activeSession.turnCount} / {activeSession.maxTurns}
            </span>
          </div>
          <button
            onClick={handleCompleteInterview}
            disabled={isCompleting}
            className="px-3 py-1 rounded-full text-xs font-medium bg-neutral-900 text-neutral-300 border border-neutral-700 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            {isCompleting ? "Evaluating..." : "End & Evaluate"}
          </button>
        </div>

        {/* Error Notification */}
        {errorBanner && (
          <div className="p-3 mb-3 rounded-xl bg-neutral-900 border border-red-500/40 text-red-400 text-xs flex justify-between items-center">
            <span>{errorBanner}</span>
            <button onClick={() => setErrorBanner(null)} className="text-neutral-400 hover:text-white">✕</button>
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
              <div className="text-[11px] font-mono text-neutral-500 mb-1 px-1">
                {turn.role === "interviewer" ? "AI Interview Coach" : "You"}
              </div>

              <div
                className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${
                  turn.role === "student"
                    ? "bg-white text-black rounded-br-none"
                    : "bg-neutral-950 text-neutral-200 border border-neutral-800 rounded-bl-none"
                }`}
              >
                {turn.content}
              </div>

              {turn.qualitativeFeedback && (
                <div className="mt-1.5 max-w-[80%] text-[11px] px-3 py-1 rounded-lg bg-neutral-900/60 border border-neutral-800/80 text-neutral-400 italic">
                  💡 {turn.qualitativeFeedback}
                </div>
              )}
            </div>
          ))}

          {isSending && (
            <div className="flex flex-col items-start">
              <div className="text-[11px] font-mono text-neutral-500 mb-1 px-1">
                AI Interview Coach
              </div>
              <div className="p-4 rounded-2xl bg-neutral-950 text-neutral-400 border border-neutral-800 rounded-bl-none text-sm flex items-center gap-2">
                <span className="animate-pulse">Thinking & evaluating response...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Message Input Form */}
        <form onSubmit={handleSendMessage} className="pt-4 border-t border-neutral-800 mt-2">
          <div className="flex gap-2">
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
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 resize-none"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isSending || isCompleting}
              className="px-5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
          <div className="flex justify-between text-[11px] text-neutral-500 mt-1.5 px-1 font-mono">
            <span>Shift+Enter for newline</span>
            <span>{inputMessage.length} / 2000</span>
          </div>
        </form>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // VIEW 3: SETUP & PAST SESSIONS VIEW
  // --------------------------------------------------------------------------
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Title & Introduction */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-900 text-white border border-neutral-800">
            PHASE 26
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-900 text-neutral-400 border border-neutral-800">
            GROQ AI INTERVIEW LAYER
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          NAIRA AI Interview Coach
        </h1>
        <p className="text-neutral-400 text-sm mt-1 max-w-2xl">
          Conduct realistic, conversational placement interviews grounded in your target role,
          resume-verified skills, and multidimensional practice history.
        </p>
      </div>

      {errorBanner && (
        <div className="p-3 rounded-xl bg-neutral-900 border border-red-500/40 text-red-400 text-xs flex justify-between items-center">
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner(null)} className="text-neutral-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Start Interview Configuration Card */}
      <div className="p-6 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">
          Configure New Practice Session
        </h2>

        {/* Interview Type Selector */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-neutral-400">Interview Mode</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { id: "TECHNICAL", label: "Technical", desc: "Architecture & DSA" },
              { id: "HR", label: "HR & Behavioral", desc: "STAR & Situations" },
              { id: "MIXED", label: "Mixed", desc: "Tech + Behavioral" },
              { id: "ROLE_SPECIFIC", label: "Role-Specific", desc: "Direct Target Fit" },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setSelectedType(mode.id as typeof selectedType)}
                className={`p-3 rounded-xl text-left border transition-all ${
                  selectedType === mode.id
                    ? "bg-white text-black border-white"
                    : "bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-700"
                }`}
              >
                <div className="text-xs font-bold">{mode.label}</div>
                <div className={`text-[11px] mt-0.5 ${selectedType === mode.id ? "text-neutral-600" : "text-neutral-500"}`}>
                  {mode.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Target Role Selector */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-neutral-400">Target Role</label>
          <select
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-neutral-600"
          >
            {targetRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
            {targetRoles.length === 0 && (
              <option value="">Software Engineer (Default)</option>
            )}
          </select>
        </div>

        {/* Optional Focus Area */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-neutral-400">
            Optional Focus Area <span className="text-neutral-500">(e.g. System Design, SQL Transactions, Concurrency)</span>
          </label>
          <input
            type="text"
            value={focusArea}
            onChange={(e) => setFocusArea(e.target.value)}
            placeholder="Leave empty for balanced topic coverage"
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
          />
        </div>

        {/* Operating Guarantees Pill Card */}
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 text-xs text-neutral-400 space-y-1.5">
          <div className="font-semibold text-neutral-300 flex items-center gap-2">
            <span>🛡️</span> Architecture Guarantees
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <div className="p-2 rounded-lg bg-neutral-950 border border-neutral-800">
              <span className="font-medium text-neutral-300">Zero Fabrication</span>
              <p className="text-[11px] text-neutral-500 mt-0.5">Questions ground strictly in verified student context.</p>
            </div>
            <div className="p-2 rounded-lg bg-neutral-950 border border-neutral-800">
              <span className="font-medium text-neutral-300">Score Protection</span>
              <p className="text-[11px] text-neutral-500 mt-0.5">Authoritative Phase 17 simulation formulas remain unmutated.</p>
            </div>
            <div className="p-2 rounded-lg bg-neutral-950 border border-neutral-800">
              <span className="font-medium text-neutral-300">Phase 20 Safety</span>
              <p className="text-[11px] text-neutral-500 mt-0.5">Evaluations describe observable traits without causal diagnosis.</p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleStartInterview}
          disabled={isStarting}
          className="w-full py-3 rounded-full bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isStarting ? "Initializing Grounded Session..." : "Start Practice Interview"}
        </button>
      </div>

      {/* Past Sessions History */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Interview History ({history.length})
          </h2>
          <div className="divide-y divide-neutral-800 border border-neutral-800 rounded-2xl bg-neutral-950 overflow-hidden">
            {history.map((session) => (
              <div
                key={session.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-900/50 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-900 text-neutral-200 border border-neutral-700">
                      {session.interviewType}
                    </span>
                    <span className="text-sm font-medium text-white">
                      {session.targetRoleName}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.2 rounded-full ${
                        session.status === "COMPLETED"
                          ? "bg-neutral-800 text-neutral-300"
                          : "bg-neutral-900 text-neutral-500 border border-neutral-800"
                      }`}
                    >
                      {session.status}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {new Date(session.createdAt).toLocaleDateString()} · {session.turnCount} turns
                    {session.focusArea ? ` · Focus: ${session.focusArea}` : ""}
                  </div>
                </div>

                <button
                  onClick={() => handleLoadPastInterview(session)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-900 text-neutral-300 border border-neutral-700 hover:bg-white hover:text-black transition-colors self-start sm:self-center"
                >
                  {session.status === "COMPLETED" ? "Review Evaluation" : "Resume Session"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
