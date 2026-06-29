import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Lost in space",
};

export default function NotFound() {
  return (
    <main className="page-shell">
      <div className="page-frame flex min-h-[calc(100vh-3rem)] items-center justify-center">
        <section className="panel pop-in w-full max-w-lg p-8 text-center sm:p-10">
          <span className="eyebrow" style={{ color: "var(--accent)" }}>
            error 404
          </span>
          <h1 className="title mt-3 text-5xl sm:text-6xl">
            <span className="shimmer">Lost in space</span>
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-6" style={{ color: "var(--muted)" }}>
            This room drifted out of range. Check the code or head back to mission control.
          </p>
          <Link href="/" className="btn btn-primary mt-7 inline-flex">
            Return home
          </Link>
        </section>
      </div>
    </main>
  );
}
