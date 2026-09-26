// HelpModal.jsx — Interactive contributor tutorial system
// A full in-app documentation site for contributors of all skill levels.

import { useEffect, useState } from "react";
import { useTour } from "../../context/TourContext.jsx";
import { BookOpen, ChevronRight, X } from "lucide-react";
import { NAV, SIDEBAR_COLORS } from "../help/nav.js";
import { SectionAIPrompts } from "../help/sections/AIPrompts.jsx";
import { SectionAbout } from "../help/sections/About.jsx";
import { SectionAnatomy } from "../help/sections/Anatomy.jsx";
import { SectionBuildViz } from "../help/sections/BuildViz.jsx";
import { SectionFeedback } from "../help/sections/Feedback.jsx";
import { SectionFirstLesson } from "../help/sections/FirstLesson.jsx";
import { SectionFormatting } from "../help/sections/Formatting.jsx";
import { SectionHome } from "../help/sections/Home.jsx";
import { SectionOpencalc } from "../help/sections/Opencalc.jsx";
import { SectionOverview } from "../help/sections/Overview.jsx";
import { SectionStandards } from "../help/sections/Standards.jsx";
import { SectionTroubleshooting } from "../help/sections/Troubleshooting.jsx";
import { SectionTypes } from "../help/sections/Types.jsx";
import { SectionUseViz } from "../help/sections/UseViz.jsx";

const SECTION_MAP = {
  home: SectionHome,
  feedback: SectionFeedback,
  overview: SectionOverview,
  "first-lesson": SectionFirstLesson,
  anatomy: SectionAnatomy,
  types: SectionTypes,
  formatting: SectionFormatting,
  opencalc: SectionOpencalc,
  "use-viz": SectionUseViz,
  "build-viz": SectionBuildViz,
  standards: SectionStandards,
  "ai-prompts": SectionAIPrompts,
  troubleshooting: SectionTroubleshooting,
  about: SectionAbout,
};

// ─── MAIN MODAL ──────────────────────────────────────────────────────────────

// The last section opened, so a returning contributor lands where they left off.
// First visit (or an unknown saved id) opens Help home.
const LAST_SECTION_KEY = "oc-help-section";
function initialSection() {
  try {
    const saved = localStorage.getItem(LAST_SECTION_KEY);
    return saved && SECTION_MAP[saved] ? saved : "home";
  } catch {
    return "home";
  }
}

export default function HelpModal({ isOpen, onClose }) {
  const [activeSection, setSection] = useState(initialSection);
  const setActiveSection = (id) => {
    setSection(id);
    try { localStorage.setItem(LAST_SECTION_KEY, id); } catch { /* storage blocked: just don't remember */ }
  };
  const tour = useTour();
  const startTour = tour ? () => { onClose(); tour.startTour(); } : undefined;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const ActiveSection = SECTION_MAP[activeSection] ?? SectionHome;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md transition-all duration-300 ease-out"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl h-[96vh] sm:h-[92vh] bg-white dark:bg-slate-900 rounded-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.3)] dark:shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow accent bar at the top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-400 via-indigo-500 to-purple-500 z-50"></div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10 shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-40 relative">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Help
              </h1>
              <p className="hidden sm:block text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                Contribute <span className="opacity-50 mx-1">•</span> Report a problem <span className="opacity-50 mx-1">•</span> Using UpSkillOS <span className="opacity-50 mx-1">•</span> About
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Reachable at every screen width, unlike Delta's panel — the one way to reopen the tour on a phone. */}
            {tour && (
              <button
                onClick={startTour}
                className="whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                Take the tour
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              aria-label="Close docs"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden relative bg-slate-50/30 dark:bg-slate-950/30">
          {/* Left nav — desktop */}
          <nav className="hidden sm:block w-64 shrink-0 border-r border-slate-200/60 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 overflow-y-auto py-5 px-3 z-30 sidebar-scroll">
            {NAV.map((group) => (
              <div key={group.group} className="mb-6">
                <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
                  {group.group}
                  <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></span>
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = activeSection === item.id;
                    const c = SIDEBAR_COLORS[item.color || 'brand'];
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`group flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? `${c.bg} ${c.text} shadow-sm border ${c.border}`
                            : `text-slate-600 dark:text-slate-400 border border-transparent ${c.groupHover}`
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg transition-colors ${isActive ? c.iconBg : "bg-transparent text-slate-400 group-hover:text-inherit"}`}>
                          <item.Icon className="w-4 h-4 shrink-0" />
                        </div>
                        <span className="tracking-tight">{item.label}</span>
                        {isActive && (
                          <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Mobile tabs */}
          <div className="sm:hidden w-full shrink-0 flex gap-2 overflow-x-auto px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md absolute top-0 left-0 z-40 shadow-sm sidebar-scroll">
            {NAV.flatMap((g) => g.items).map((item) => {
              const c = SIDEBAR_COLORS[item.color || 'brand'];
              const isActive = activeSection === item.id;
              return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 shrink-0 border ${
                  isActive 
                    ? `${c.activeGradient} text-white border-transparent shadow-md` 
                    : `bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 ${c.groupHover}`
                }`}
              >
                <item.Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            )})}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-8 sm:mt-0 mt-[68px] bg-transparent sidebar-scroll">
            <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ActiveSection key={activeSection} onNavigate={onClose} onSelectSection={setActiveSection} onStartTour={startTour} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
