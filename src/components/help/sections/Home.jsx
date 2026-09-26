// The Help modal's landing section: the four destinations, most-visited first.
import { BookOpen, Bug, Heart, Wrench } from "lucide-react";
import { SectionHeading } from "../primitives.jsx";

const DESTINATIONS = [
  {
    id: "overview",
    title: "Contribute",
    body: "Write or fix a lesson, build a visualization, and open a pull request. Start with How to Contribute.",
    Icon: BookOpen,
    tone: "border-emerald-200 dark:border-emerald-900/60 hover:border-emerald-400 text-emerald-700 dark:text-emerald-300",
  },
  {
    id: "feedback",
    title: "Report a problem",
    body: "Found a bug or a mistake in a lesson, or have an idea? Report it or browse what's already been reported.",
    Icon: Bug,
    tone: "border-rose-200 dark:border-rose-900/60 hover:border-rose-400 text-rose-700 dark:text-rose-300",
  },
  {
    id: "troubleshooting",
    title: "Using UpSkillOS",
    body: "Fix common problems without losing your progress, or take the guided tour.",
    Icon: Wrench,
    tone: "border-amber-200 dark:border-amber-900/60 hover:border-amber-400 text-amber-700 dark:text-amber-300",
    tour: true,
  },
  {
    id: "about",
    title: "About",
    body: "What UpSkillOS is, who builds it, and where it's going.",
    Icon: Heart,
    tone: "border-slate-200 dark:border-slate-700 hover:border-slate-400 text-slate-700 dark:text-slate-300",
  },
];

export function SectionHome({ onSelectSection, onStartTour }) {
  return (
    <div>
      <SectionHeading sub="What would you like to do?">Help</SectionHeading>
      <div className="grid gap-4 sm:grid-cols-2">
        {DESTINATIONS.map(({ id, title, body, Icon, tone, tour }) => (
          <div key={id} className={`rounded-2xl border-2 bg-white dark:bg-slate-900 p-5 transition-colors ${tone}`}>
            <button onClick={() => onSelectSection?.(id)} className="w-full text-left">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-5 h-5" />
                <span className="text-base font-bold">{title}</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{body}</p>
            </button>
            {tour && onStartTour && (
              <button onClick={onStartTour} className="mt-3 text-xs font-semibold underline underline-offset-2">
                Take the tour
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
