"use client";

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  ArrowRightFromLine,
  BookOpen,
  Brain,
  CheckCircle2,
  CircleHelp,
  Cloud,
  Edit3,
  Eye,
  Focus,
  GitBranch,
  Grid2X2,
  History,
  Home,
  Layers,
  LayoutDashboard,
  LogIn,
  Menu,
  PenSquare,
  Plus,
  RotateCw,
  Scale,
  ScrollText,
  Sparkles,
  SplitSquareHorizontal,
  Square,
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
  edit_note: Edit3,
  edit_square: PenSquare,
  filter_1: Square,
  flare: WandSparkles,
  gavel: Scale,
  grid_view: Grid2X2,
  history: History,
  history_edu: ScrollText,
  home: Home,
  keyboard_double_arrow_down: ArrowDownToLine,
  login: LogIn,
  menu: Menu,
  north_east: ArrowRightFromLine,
  psychology: Brain,
  psychiatry: Brain,
  refresh: RotateCw,
  stacks: Layers,
  stars: Sparkles,
  style: Sparkles,
  splitscreen: SplitSquareHorizontal,
  visibility: Eye,
  warning: AlertTriangle,
  waves: Waves,
} satisfies Record<string, ComponentType<LucideProps>>;

export type LegacyIconName = keyof typeof icons | (string & {});

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
