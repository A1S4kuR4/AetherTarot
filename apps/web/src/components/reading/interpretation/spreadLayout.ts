import { cn } from "@/lib/utils";

export interface SpreadLayout {
  container: string;
  itemClass: (index: number) => string;
  isEmphasized: (index: number) => boolean;
}

export const FALLBACK_LAYOUT: SpreadLayout = {
  container: "flex flex-wrap items-end justify-center gap-4 md:gap-6",
  itemClass: () => "w-[96px] sm:w-[110px] md:w-[130px]",
  isEmphasized: () => false,
};

// Canonical spread compositions for the reading hero. The product ships
// exactly five spreads (1 / 3 / 4 / 7 / 10 cards); each must keep its own
// editorial composition instead of degrading into the generic flex-wrap
// fallback.
export function getSpreadLayout(spreadId: string, total: number): SpreadLayout {
  if (spreadId === "single" || total === 1) {
    return {
      container: "flex justify-center",
      itemClass: () => "w-[150px] md:w-[180px]",
      isEmphasized: () => true,
    };
  }

  if (spreadId === "holy-triangle" && total === 3) {
    // 过去(根) → 现在(路径) → 未来(天空)：一行时间流向，逐张抬升呼应根—路径—天空
    return {
      container: "flex items-end justify-center gap-4 md:gap-8",
      itemClass: (index) =>
        cn(
          "w-[104px] sm:w-[118px] md:w-[130px]",
          index === 1 && "-translate-y-3 md:-translate-y-4",
          index === 2 && "w-[112px] -translate-y-6 sm:w-[126px] md:w-[142px] md:-translate-y-8",
        ),
      isEmphasized: (index) => index === 2,
    };
  }

  if (spreadId === "four-aspects" && total === 4) {
    return {
      container:
        "mx-auto grid max-w-[340px] grid-cols-2 gap-x-4 gap-y-7 md:max-w-[420px] md:gap-x-8",
      itemClass: () => "w-full justify-self-center md:w-[150px]",
      isEmphasized: () => false,
    };
  }

  if (spreadId === "seven-card" && total === 7) {
    // 上行时间线（过去/现在/最近结果），中间答案主轴，下行环境与投射
    return {
      container:
        "flex flex-wrap items-end justify-center gap-4 md:grid md:grid-cols-6 md:gap-x-4 md:gap-y-8",
      itemClass: (index) =>
        cn(
          "w-[86px] justify-self-center sm:w-[96px]",
          index <= 2 && "md:col-span-2 md:w-[118px]",
          index === 3 && "md:col-span-2 md:col-start-3 md:w-[150px]",
          index >= 4 && "md:col-span-2 md:w-[118px]",
        ),
      isEmphasized: (index) => index === 3,
    };
  }

  if (spreadId === "celtic-cross" && total === 10) {
    // 核心与挑战先行，其余剖面随后分行展开
    return {
      container:
        "flex flex-wrap items-end justify-center gap-3 md:grid md:grid-cols-4 md:gap-x-4 md:gap-y-8",
      itemClass: (index) =>
        cn(
          "w-[74px] justify-self-center sm:w-[84px]",
          index <= 1 && "md:col-span-2 md:w-[142px]",
          index >= 2 && "md:col-span-1 md:w-[108px]",
        ),
      isEmphasized: (index) => index <= 1,
    };
  }

  return FALLBACK_LAYOUT;
}
