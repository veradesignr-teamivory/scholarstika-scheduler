import Link from "next/link";

export default function TopBar({ current }: { current: "posts" | "connect" | "settings" }) {
  const item = (key: typeof current, href: string, label: string) => (
    <Link href={href} aria-current={current === key ? "page" : undefined}>
      {label}
    </Link>
  );
  return (
    <header className="top">
      <Link href="/" className="brand">
        Scholarstika<small>Scheduler</small>
      </Link>
      <nav>
        {item("posts", "/", "Posts")}
        {item("connect", "/connect", "Connect accounts")}
        {item("settings", "/settings", "Settings")}
      </nav>
    </header>
  );
}
