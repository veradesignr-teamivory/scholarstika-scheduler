import Link from "next/link";

export default function TopBar({ current }: { current: "posts" | "settings" }) {
  return (
    <header className="top">
      <Link href="/" className="brand">
        Scholarstika<small>Scheduler</small>
      </Link>
      <nav>
        <Link href="/" aria-current={current === "posts" ? "page" : undefined}>
          Posts
        </Link>
        <Link href="/settings" aria-current={current === "settings" ? "page" : undefined}>
          Connections &amp; settings
        </Link>
      </nav>
    </header>
  );
}
