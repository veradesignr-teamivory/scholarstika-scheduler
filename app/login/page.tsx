export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="wrap" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div className="card">
        <div className="eyebrow">Scholarstika Scheduler</div>
        <h1>Sign in</h1>
        {error === "wrong" && <div className="notice bad">That password is incorrect.</div>}
        {error === "setup" && (
          <div className="notice bad">
            No password is set yet. Add an <code>ADMIN_PASSWORD</code> environment variable in Vercel and redeploy.
          </div>
        )}
        <form method="post" action="/api/login" style={{ display: "grid", gap: 12 }}>
          <label>
            Password
            <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
          </label>
          <button type="submit">Sign in</button>
        </form>
      </div>
    </main>
  );
}
