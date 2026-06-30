import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPrewarmUrls } from "./prewarm-production.mjs";

test("buildPrewarmUrls creates route, static chunk, and image optimizer URLs", () => {
  const urls = buildPrewarmUrls({
    origin: "https://aethertarot.example",
    routes: ["/", "/reading"],
    routeStats: [
      {
        route: "/",
        firstLoadChunkPaths: [
          ".next\\static\\chunks\\shared.js",
          ".next/static/chunks/home.js",
        ],
      },
      {
        route: "/reading",
        firstLoadChunkPaths: [
          ".next/static/chunks/shared.js",
          ".next/static/chunks/reading.js",
        ],
      },
    ],
    deck: [
      { imageUrl: "/cardsV2/major_0_fool.png" },
      { imageUrl: "/cardsV2/major_1_magician.png" },
    ],
    imageWidths: [384, 640],
    imageQuality: 75,
    imageLimit: 1,
  });

  assert.deepEqual(urls, [
    "https://aethertarot.example/",
    "https://aethertarot.example/reading",
    "https://aethertarot.example/_next/static/chunks/shared.js",
    "https://aethertarot.example/_next/static/chunks/home.js",
    "https://aethertarot.example/_next/static/chunks/reading.js",
    "https://aethertarot.example/_next/image?url=%2FcardsV2%2Freveal%2Fmajor_0_fool.webp&w=384&q=75",
    "https://aethertarot.example/_next/image?url=%2FcardsV2%2Freveal%2Fmajor_0_fool.webp&w=640&q=75",
  ]);
});

test("buildPrewarmUrls rejects non-http origins", () => {
  assert.throws(
    () =>
      buildPrewarmUrls({
        origin: "file:///tmp/secret",
        routes: ["/"],
        routeStats: [],
        deck: [],
      }),
    /http/,
  );
});
