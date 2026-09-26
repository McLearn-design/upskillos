// The Help modal's sidebar groups and colors. Split out of src/components/ui/HelpModal.jsx.

import {
  BookOpen,
  Compass,
  Bot,
  Bug,
  CheckSquare,
  Code2,
  Eye,
  FileText,
  Heart,
  Layers,
  Play,
  Terminal,
  Wrench,
  Zap,
} from "lucide-react";

export const SIDEBAR_COLORS = {
  rose: {
    bg: "bg-gradient-to-r from-rose-50 to-orange-50/50 dark:from-rose-500/15 dark:to-orange-500/10",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200/50 dark:border-rose-700/30",
    iconBg: "bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400",
    groupHover: "hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300",
    activeGradient: 'bg-gradient-to-r from-rose-500 to-orange-600 shadow-rose-500/20',
  },
  emerald: {
    bg: "bg-gradient-to-r from-emerald-50 to-teal-50/50 dark:from-emerald-500/15 dark:to-teal-500/10",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200/50 dark:border-emerald-700/30",
    iconBg: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    groupHover: "hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300",
    activeGradient: 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-500/20',
  },
  violet: {
    bg: "bg-gradient-to-r from-violet-50 to-purple-50/50 dark:from-violet-500/15 dark:to-purple-500/10",
    text: "text-violet-700 dark:text-violet-300",
    border: "border-violet-200/50 dark:border-violet-700/30",
    iconBg: "bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400",
    groupHover: "hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300",
    activeGradient: 'bg-gradient-to-r from-violet-500 to-purple-600 shadow-violet-500/20',
  },
  sky: {
    bg: "bg-gradient-to-r from-sky-50 to-blue-50/50 dark:from-sky-500/15 dark:to-blue-500/10",
    text: "text-sky-700 dark:text-sky-300",
    border: "border-sky-200/50 dark:border-sky-700/30",
    iconBg: "bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400",
    groupHover: "hover:bg-sky-50 dark:hover:bg-sky-500/10 hover:text-sky-700 dark:hover:text-sky-300",
    activeGradient: 'bg-gradient-to-r from-sky-500 to-blue-600 shadow-sky-500/20',
  },
  fuchsia: {
    bg: "bg-gradient-to-r from-fuchsia-50 to-pink-50/50 dark:from-fuchsia-500/15 dark:to-pink-500/10",
    text: "text-fuchsia-700 dark:text-fuchsia-300",
    border: "border-fuchsia-200/50 dark:border-fuchsia-700/30",
    iconBg: "bg-fuchsia-100 dark:bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400",
    groupHover: "hover:bg-fuchsia-50 dark:hover:bg-fuchsia-500/10 hover:text-fuchsia-700 dark:hover:text-fuchsia-300",
    activeGradient: 'bg-gradient-to-r from-fuchsia-500 to-pink-600 shadow-fuchsia-500/20',
  },
  indigo: {
    bg: "bg-gradient-to-r from-indigo-50 to-blue-50/50 dark:from-indigo-500/15 dark:to-blue-500/10",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-200/50 dark:border-indigo-700/30",
    iconBg: "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400",
    groupHover: "hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-700 dark:hover:text-indigo-300",
    activeGradient: 'bg-gradient-to-r from-indigo-500 to-blue-600 shadow-indigo-500/20',
  },
  amber: {
    bg: "bg-gradient-to-r from-amber-50 to-yellow-50/50 dark:from-amber-500/15 dark:to-yellow-500/10",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200/50 dark:border-amber-700/30",
    iconBg: "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400",
    groupHover: "hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300",
    activeGradient: 'bg-gradient-to-r from-amber-500 to-yellow-600 shadow-amber-500/20',
  },
  brand: {
    bg: "bg-gradient-to-r from-brand-50 to-indigo-50/50 dark:from-brand-500/10 dark:to-indigo-500/5",
    text: "text-brand-700 dark:text-brand-300",
    border: "border-brand-200/50 dark:border-brand-700/30",
    iconBg: "bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400",
    groupHover: "hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200",
    activeGradient: 'bg-gradient-to-r from-brand-500 to-indigo-600 shadow-brand-500/20',
  }
};

// Destinations, in order: Contribute (the most visited), Report a problem, Using UpSkillOS, About.
// Group names starting "Contribute ·" are sub-groups of one destination.
export const NAV = [
  {
    group: "Help",
    items: [{ id: "home", label: "Help home", Icon: Compass, color: 'brand' }],
  },
  {
    group: "Contribute · Start here",
    items: [
      { id: "overview", label: "How to Contribute", Icon: BookOpen, color: 'emerald' },
      { id: "first-lesson", label: "Your First Lesson", Icon: Play, color: 'emerald' },
      { id: "anatomy", label: "Cell Types", Icon: Eye, color: 'emerald' },
    ],
  },
  {
    group: "Contribute · Content",
    items: [
      { id: "types", label: "Lesson Types", Icon: Layers, color: 'violet' },
      { id: "formatting", label: "Formatting Guide", Icon: FileText, color: 'violet' },
    ],
  },
  {
    group: "Contribute · Code & visuals",
    items: [
      { id: "opencalc", label: "opencalc Library", Icon: Terminal, color: 'sky' },
      { id: "use-viz", label: "Using Vizs", Icon: Zap, color: 'fuchsia' },
      { id: "build-viz", label: "Building Vizs", Icon: Code2, color: 'fuchsia' },
    ],
  },
  {
    group: "Contribute · Quality & AI",
    items: [
      { id: "standards", label: "Content Standards", Icon: CheckSquare, color: 'emerald' },
      { id: "ai-prompts", label: "AI Prompts", Icon: Bot, color: 'indigo' },
    ],
  },
  {
    group: "Report a problem",
    items: [{ id: "feedback", label: "Feedback & Bugs", Icon: Bug, color: 'rose' }],
  },
  {
    group: "Using UpSkillOS",
    items: [{ id: "troubleshooting", label: "Troubleshooting", Icon: Wrench, color: 'amber' }],
  },
  {
    group: "About",
    items: [{ id: "about", label: "About", Icon: Heart, color: 'rose' }],
  },
];
