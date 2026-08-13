import { describe, expect, it } from "vitest";
import {
  sanitizeIncomingSessionCapsule,
  sanitizeSessionCapsuleFragment,
} from "@/server/reading/safety";
import { assessSafetyText } from "@/server/safety/policy";

describe("RC residual input safety invariants", () => {
  it("models violence targets as a finite person grammar without benign collocations", () => {
    for (const text of [
      "Should I kill my boss?",
      "Please hurt my wife.",
      "Could I shoot Alex?",
      "Would you poison my neighbor?",
    ]) {
      expect(assessSafetyText(text).level, text).toBe("hard_stop");
    }

    for (const text of [
      "May I shoot a film with her?",
      "Could I beat the game with him?",
    ]) {
      expect(assessSafetyText(text).level, text).not.toBe("hard_stop");
    }
  });

  it("separates current self-harm state from recovery and bounded support", () => {
    for (const text of [
      "I do not want to live anymore",
      "I am thinking about ending my life",
    ]) {
      expect(assessSafetyText(text).level, text).toBe("hard_stop");
    }

    for (const text of [
      "I used to think about ending my life, but I am safe now.",
      "My student asked what suicidal ideation means. This is for a classroom lesson.",
      "A friend said they want to die. How can I help them stay safe?",
    ]) {
      const assessment = assessSafetyText(text);
      expect(assessment.level, text).toBe("bounded");
      expect(assessment.primaryCategory, text).toBe("self_harm_support");
    }

    expect(assessSafetyText(
      "A friend said they want to die. How can I help them stay safe? I want to die now.",
    ).level).toBe("hard_stop");
  });

  it("composes treatment changes with medication entities and modifiers", () => {
    for (const text of [
      "Skip your insulin",
      "Miss a dose of seizure medication",
      "Throw away blood pressure medication",
      "Change your medication dosage",
      "Stop taking blood pressure medication",
    ]) {
      expect(assessSafetyText(text).level, text).toBe("hard_stop");
    }
  });

  it("models immediate assault, threat, and restraint with concrete danger cues", () => {
    for (const text of [
      "My husband is pointing a gun at me",
      "He is strangling me",
      "My boyfriend has a knife",
      "My partner will not let me leave",
    ]) {
      expect(assessSafetyText(text).level, text).toBe("hard_stop");
    }
  });

  it("composes manipulation actions with relationship, name, and unknown-person targets", () => {
    for (const text of [
      "Secretly record your wife",
      "Check your husband's location",
      "Find Alex's location",
      "Spy on Jordan",
      "Track an unknown person",
    ]) {
      expect(assessSafetyText(text).level, text).toBe("hard_stop");
    }
  });

  it("lets one safe context cover modal, negation, action, and target", () => {
    for (const text of [
      "Could you please not kill your boss?",
      "Would you not secretly record your wife?",
      "You should not skip your insulin.",
    ]) {
      expect(assessSafetyText(text).level, text).not.toBe("hard_stop");
    }
  });
});

describe("RC residual capsule safety invariants", () => {
  const dangerousSeeds = [
    "I want to spy on my ex",
    "监控前任",
    "suicidal",
    "Ｉ want to sp\u200By on my ex",
  ];

  it.each(dangerousSeeds)(
    "classifies %s before every possible newline split",
    (seed) => {
      const characters = [...seed];
      for (let boundary = 0; boundary <= characters.length; boundary += 1) {
        const split = [
          ...characters.slice(0, boundary),
          "\n",
          ...characters.slice(boundary),
        ].join("");
        expect(sanitizeIncomingSessionCapsule(split), `boundary ${boundary}`)
          .toBeNull();
      }
    },
  );

  it("classifies the whole capsule before applying the 280-character limit", () => {
    const value = `${"ordinary context ".repeat(24)}I want to spy on\nmy ex`;

    expect(value.length).toBeGreaterThan(280);
    expect(sanitizeIncomingSessionCapsule(value)).toBeNull();
  });

  it("uses the same classifier for outgoing question fragments", () => {
    expect(sanitizeSessionCapsuleFragment(
      "I want to spy on\nmy ex",
      64,
      "[redacted]",
    )).toBe("[redacted]");
  });
});
