import styles from "./page.module.css";
import Link from "next/link";
import { listCases } from "@/lib/sqlite";
import { CreateCaseForm } from "@/components/create-case-form";

export default function Home() {
  const casesPromise = listCases();
  return (
    <div className={styles.page}>
      <main className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Family office IC agent</h1>
          <p className={styles.subtitle}>
            Create an investment case, upload documents, and generate an IC memo + strict
            decision JSON with evidence and hard constraint gating.
          </p>
        </header>

        <section className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Create a case</div>
            <CreateCaseForm />
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Recent cases</div>
            <CaseList casesPromise={casesPromise} />
          </div>
        </section>
      </main>
    </div>
  );
}

async function CaseList({ casesPromise }: { casesPromise: ReturnType<typeof listCases> }) {
  const cases = await casesPromise;
  if (cases.length === 0) {
    return <div className={styles.caseSub}>No cases yet. Create one to get started.</div>;
  }
  return (
    <div className={styles.caseList}>
      {cases.map((c) => (
        <div key={c.id} className={styles.caseRow}>
          <div className={styles.caseMeta}>
            <div className={styles.caseName}>{c.title ?? c.id}</div>
            <div className={styles.caseSub}>
              {c.assetType} • {new Date(c.createdAt).toLocaleString()}
            </div>
          </div>
          <Link className={styles.link} href={`/cases/${c.id}`}>
            Open
          </Link>
        </div>
      ))}
    </div>
  );
}
