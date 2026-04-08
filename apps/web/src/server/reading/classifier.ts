import type { QuestionType } from "@aethertarot/shared-types";

const QUESTION_TYPE_PATTERNS: Array<[QuestionType, RegExp[]]> = [
  [
    "relationship",
    [
      /感情|爱情|恋爱|关系|伴侣|前任|暧昧|婚姻|分手|复合/i,
      /boyfriend|girlfriend|relationship|love/i,
    ],
  ],
  [
    "career",
    [
      /工作|职业|事业|求职|升职|团队|项目|老板|同事|offer|转岗/i,
      /career|job|work|promotion/i,
    ],
  ],
  [
    "self_growth",
    [
      /成长|内在|疗愈|情绪|状态|习惯|自我|能量|觉察/i,
      /growth|healing|inner/i,
    ],
  ],
  [
    "decision",
    [
      /要不要|应不应该|该不该|是否|选择|决定|取舍|怎么选/i,
      /decision|choose|whether/i,
    ],
  ],
];

export function classifyQuestion(question: string): QuestionType {
  for (const [questionType, patterns] of QUESTION_TYPE_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(question))) {
      return questionType;
    }
  }

  return "other";
}
