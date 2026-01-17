"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/page.module.css";

type AssetType = "pe_vc" | "public_equities" | "real_estate";

export function CreateCaseForm() {
  const router = useRouter();
  const [assetType, setAssetType] = useState<AssetType>("pe_vc");
  const [title, setTitle] = useState("");
  const [thesis, setThesis] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputs = useMemo(() => ({ thesis }), [thesis]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assetType,
          title: title.trim() || undefined,
          inputs,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const data = (await res.json()) as { case: { id: string } };
      router.push(`/cases/${data.case.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create case");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <div className={styles.row}>
        <div className={styles.field}>
          <div className={styles.label}>Asset type</div>
          <select
            className={styles.select}
            value={assetType}
            onChange={(e) => setAssetType(e.target.value as AssetType)}
            disabled={busy}
          >
            <option value="pe_vc">PE / VC</option>
            <option value="public_equities">Public equities</option>
            <option value="real_estate">Real estate</option>
          </select>
        </div>

        <div className={styles.field}>
          <div className={styles.label}>Title (optional)</div>
          <input
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Acme Series B, MSFT long, Dallas multifamily"
            disabled={busy}
          />
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.label}>Thesis (optional)</div>
        <textarea
          className={styles.textarea}
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          placeholder="What’s the investment thesis? What needs to be true?"
          disabled={busy}
        />
      </div>

      {error ? (
        <div className={styles.caseSub} role="alert">
          {error}
        </div>
      ) : null}

      <div className={styles.actions}>
        <button className={styles.button} type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create case"}
        </button>
      </div>
    </form>
  );
}
