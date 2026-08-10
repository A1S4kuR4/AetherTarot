import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GuidanceSection } from "./GuidanceSection";

describe("GuidanceSection", () => {
  it("numbers the listed reflections from one after the lead paragraph", () => {
    const html = renderToStaticMarkup(
      createElement(GuidanceSection, {
        guidance: ["引导思考", "第一条建议", "第二条建议", "第三条建议"],
      }),
    );

    expect(html).toContain("引导思考");
    expect(html).not.toContain('<ol start="2"');
    expect(html).toContain(">1.</span>");
    expect(html).toContain(">2.</span>");
    expect(html).toContain(">3.</span>");
  });
});
