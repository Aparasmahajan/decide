"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { EngineDef } from "@/lib/engines";
import ComingSoon from "./ComingSoon";

type EngineProps = { engine: EngineDef };

/**
 * Every /engine/[slug] route is served by the same page component, so a static
 * `import` of each engine put all 26 of them into one client bundle: opening
 * /engine/coin downloaded, parsed and evaluated the dice, wheel, bottle, tree
 * and twenty-two other engines before the coin could become interactive.
 *
 * `next/dynamic` splits each engine into its own chunk, so a route ships only
 * the engine it actually renders. These are still server-rendered (no
 * `ssr: false`), so the prerendered HTML is unchanged — only the JavaScript
 * delivery changes.
 */
const ENGINE_COMPONENTS: Record<string, ComponentType<EngineProps>> = {
  coin: dynamic(() => import("./CoinEngine")),
  dice: dynamic(() => import("./DiceEngine")),
  wheel: dynamic(() => import("./WheelEngine")),
  bottle: dynamic(() => import("./BottleEngine")),
  person: dynamic(() => import("./PersonEngine")),
  magic8: dynamic(() => import("./Magic8Engine")),
  yesno: dynamic(() => import("./YesNoEngine")),
  number: dynamic(() => import("./NumberEngine")),
  color: dynamic(() => import("./ColorEngine")),
  emoji: dynamic(() => import("./EmojiEngine")),
  letter: dynamic(() => import("./LetterEngine")),
  direction: dynamic(() => import("./DirectionEngine")),
  rps: dynamic(() => import("./RPSEngine")),
  card: dynamic(() => import("./CardEngine")),
  name: dynamic(() => import("./NameEngine")),
  team: dynamic(() => import("./TeamEngine")),
  pair: dynamic(() => import("./PairEngine")),
  fortune: dynamic(() => import("./FortuneEngine")),
  finger: dynamic(() => import("./FingerEngine")),
  timer: dynamic(() => import("./TimerEngine")),
  truthdare: dynamic(() => import("./TruthDareEngine")),
  task: dynamic(() => import("./TaskEngine")),
  prize: dynamic(() => import("./PrizeEngine")),
  tree: dynamic(() => import("./TreeEngine")),
  object: dynamic(() => import("./ObjectEngine")),
  flipbook: dynamic(() => import("./FlipBookEngine")),
  value: dynamic(() => import("./ValueEngine")),
};

export default function EngineRouter({ engine }: EngineProps) {
  const Engine = ENGINE_COMPONENTS[engine.slug];
  if (!Engine) return <ComingSoon engine={engine} />;
  return <Engine engine={engine} />;
}
