import { notFound } from "next/navigation";
import { findEngine, ENGINES } from "@/lib/engines";
import EngineRouter from "@/components/engines/EngineRouter";

export function generateStaticParams() {
  return ENGINES.map((e) => ({ slug: e.slug }));
}

export default async function EnginePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const engine = findEngine(slug);
  if (!engine) return notFound();
  return <EngineRouter engine={engine} />;
}
