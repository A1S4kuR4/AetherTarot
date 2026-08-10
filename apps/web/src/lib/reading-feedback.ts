export const READING_FEEDBACK_LABELS = [
  "helpful",
  "template_like",
  "too_agreeable",
  "did_not_answer",
] as const;

export type ReadingFeedbackLabel = (typeof READING_FEEDBACK_LABELS)[number];
