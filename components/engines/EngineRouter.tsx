"use client";

import type { EngineDef } from "@/lib/engines";
import CoinEngine from "./CoinEngine";
import DiceEngine from "./DiceEngine";
import WheelEngine from "./WheelEngine";
import BottleEngine from "./BottleEngine";
import PersonEngine from "./PersonEngine";
import Magic8Engine from "./Magic8Engine";
import YesNoEngine from "./YesNoEngine";
import NumberEngine from "./NumberEngine";
import ColorEngine from "./ColorEngine";
import EmojiEngine from "./EmojiEngine";
import LetterEngine from "./LetterEngine";
import DirectionEngine from "./DirectionEngine";
import RPSEngine from "./RPSEngine";
import CardEngine from "./CardEngine";
import NameEngine from "./NameEngine";
import TeamEngine from "./TeamEngine";
import PairEngine from "./PairEngine";
import FortuneEngine from "./FortuneEngine";
import FingerEngine from "./FingerEngine";
import TimerEngine from "./TimerEngine";
import ComingSoon from "./ComingSoon";

export default function EngineRouter({ engine }: { engine: EngineDef }) {
  switch (engine.slug) {
    case "coin":
      return <CoinEngine engine={engine} />;
    case "dice":
      return <DiceEngine engine={engine} />;
    case "wheel":
      return <WheelEngine engine={engine} />;
    case "bottle":
      return <BottleEngine engine={engine} />;
    case "person":
      return <PersonEngine engine={engine} />;
    case "magic8":
      return <Magic8Engine engine={engine} />;
    case "yesno":
      return <YesNoEngine engine={engine} />;
    case "number":
      return <NumberEngine engine={engine} />;
    case "color":
      return <ColorEngine engine={engine} />;
    case "emoji":
      return <EmojiEngine engine={engine} />;
    case "letter":
      return <LetterEngine engine={engine} />;
    case "direction":
      return <DirectionEngine engine={engine} />;
    case "rps":
      return <RPSEngine engine={engine} />;
    case "card":
      return <CardEngine engine={engine} />;
    case "name":
      return <NameEngine engine={engine} />;
    case "team":
      return <TeamEngine engine={engine} />;
    case "pair":
      return <PairEngine engine={engine} />;
    case "fortune":
      return <FortuneEngine engine={engine} />;
    case "finger":
      return <FingerEngine engine={engine} />;
    case "timer":
      return <TimerEngine engine={engine} />;
    default:
      return <ComingSoon engine={engine} />;
  }
}
