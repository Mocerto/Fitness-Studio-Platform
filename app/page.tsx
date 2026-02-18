import Link from "next/link";

export default function HomePage() {
  return (
    <section className="stack">
      <h1>Fitness Studio ERP</h1>
      <p>MVP admin area.</p>
      <p>
        Start with <Link href="/members">Members CRUD</Link>.
      </p>
      <p>
        Continue with <Link href="/plans">Plans CRUD</Link>.
      </p>
    </section>
  );
}
