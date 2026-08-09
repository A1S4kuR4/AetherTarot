"use client";

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  ArrowRightFromLine,
  BookOpen,
  Brain,
  CheckCircle2,
  CircleAlert,
  CircleHelp,
  Cloud,
  Download,
  Edit3,
  Eye,
  Focus,
  GitBranch,
  Grid2X2,
  History,
  Home,
  Hourglass,
  Info,
  Layers,
  LayoutDashboard,
  LoaderCircle,
  LogIn,
  LogOut,
  Menu,
  MessageSquareText,
  NotebookPen,
  PenSquare,
  Plus,
  RotateCw,
  Scale,
  ScrollText,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  SplitSquareHorizontal,
  Square,
  UserRound,
  WandSparkles,
  Waves,
  X,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

const icons = {
  account_tree: GitBranch,
  add: Plus,
  arrow_forward: ArrowRight,
  arrow_right_alt: ArrowRightFromLine,
  auto_awesome: Sparkles,
  auto_stories: BookOpen,
  center_focus_strong: Focus,
  change_history: SplitSquareHorizontal,
  check_circle: CheckCircle2,
  close: X,
  cloud: Cloud,
  dashboard: LayoutDashboard,
  download: Download,
  edit_note: Edit3,
  edit_square: PenSquare,
  error: CircleAlert,
  feedback_note: MessageSquareText,
  feedback_replay_consent: ShieldCheck,
  filter_1: Square,
  flare: WandSparkles,
  gavel: Scale,
  grid_view: Grid2X2,
  history: History,
  history_edu: ScrollText,
  home: Home,
  hourglass_top: Hourglass,
  info: Info,
  ios_share: Share2,
  keyboard_double_arrow_down: ArrowDownToLine,
  login: LogIn,
  logout: LogOut,
  menu: Menu,
  north_east: ArrowRightFromLine,
  person: UserRound,
  progress_activity: LoaderCircle,
  psychology: Brain,
  psychiatry: Brain,
  reading_notes: NotebookPen,
  refresh: RotateCw,
  search: Search,
  share: Share2,
  sober_check_reflection: ShieldCheck,
  stacks: Layers,
  stars: Sparkles,
  style: Sparkles,
  splitscreen: SplitSquareHorizontal,
  visibility: Eye,
  warning: AlertTriangle,
  waves: Waves,
} satisfies Record<string, ComponentType<LucideProps>>;

export type LegacyIconName = keyof typeof icons;

export default function LegacyIcon({
  name,
  className,
}: {
  name: LegacyIconName;
  className?: string;
}) {
  const Icon = icons[name as keyof typeof icons] ?? CircleHelp;

  return (
    <Icon
      aria-hidden="true"
      focusable="false"
      size="1em"
      strokeWidth={1.8}
      className={cn("inline-block shrink-0 align-[-0.125em]", className)}
    />
  );
}
