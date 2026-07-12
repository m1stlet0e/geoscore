"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PromptItem = { id: string; category: string; active: boolean; text: string; weight: number };

const categoryNames: Record<string, string> = { DISCOVERY: "品类发现", PROBLEM: "痛点解决", COMPARISON: "对比选择", PURCHASE: "购买决策", BRANDED: "品牌健康" };

export function PromptEditor({ prompts }: { prompts: PromptItem[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function update(id: string, payload: { text?: string; active?: boolean }) {
    setPending(id); setError("");
    const response = await fetch(`/api/prompts/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json(); setPending(null);
    if (!response.ok) { setError(result.message ?? "更新失败"); return; }
    setEditing(null); router.refresh();
  }

  return <div>{error && <p className="form-error">{error}</p>}<ol>{prompts.map((prompt, index) => <li key={prompt.id} data-inactive={!prompt.active || undefined}><span>{String(index + 1).padStart(2, "0")}</span><div><small>{categoryNames[prompt.category] ?? prompt.category}</small>{editing === prompt.id ? <form action={(data) => update(prompt.id, { text: String(data.get("text")) })} className="prompt-edit-form"><input name="text" defaultValue={prompt.text} autoFocus /><button disabled={pending === prompt.id}>保存</button><button type="button" onClick={() => setEditing(null)}>取消</button></form> : <p>{prompt.text}</p>}</div><div className="prompt-controls"><b>×{prompt.weight}</b><button onClick={() => setEditing(prompt.id)}>编辑</button><button onClick={() => update(prompt.id, { active: !prompt.active })} disabled={pending === prompt.id}>{prompt.active ? "停用" : "启用"}</button></div></li>)}</ol></div>;
}
