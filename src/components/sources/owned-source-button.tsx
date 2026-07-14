"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkCheck, BookmarkPlus, LoaderCircle } from "lucide-react";
import { clientErrorMessage, readApiResponse } from "@/lib/client-api";

type OwnedSourceButtonProps = {
  brandId: string;
  url: string;
  domain: string;
  sourceId: string | null;
};

export function OwnedSourceButton({ brandId, url, domain, sourceId }: OwnedSourceButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const isOwned = Boolean(sourceId);

  async function toggleOwnership() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/sources/owned", {
        method: isOwned ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isOwned ? { id: sourceId } : { brandId, url, label: domain }),
      });
      await readApiResponse(response, isOwned ? "取消标记失败" : "标记失败");
      router.refresh();
    } catch (cause) {
      setError(clientErrorMessage(cause, isOwned ? "取消标记失败" : "标记失败"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="source-ownership-action">
      <button
        type="button"
        className={`source-ownership-button${isOwned ? " is-owned" : ""}`}
        onClick={() => void toggleOwnership()}
        disabled={pending}
      >
        {pending ? <LoaderCircle aria-hidden="true" size={14} className="spin" /> : isOwned
          ? <BookmarkCheck aria-hidden="true" size={14} />
          : <BookmarkPlus aria-hidden="true" size={14} />}
        {isOwned ? "已标记自有" : "标记为自有"}
      </button>
      {error && <small role="status">{error}</small>}
    </div>
  );
}
