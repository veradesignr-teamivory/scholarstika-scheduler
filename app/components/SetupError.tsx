export default function SetupError({ message }: { message: string }) {
  return (
    <div className="card">
      <h2>One more setup step</h2>
      <div className="notice bad">{message}</div>
      <ol className="steps">
        <li>In your Vercel project, open <b>Storage</b> and add <b>Upstash Redis</b> (free tier). Connect it to this project.</li>
        <li>Also add <b>Blob</b> storage and connect it, for your images and videos.</li>
        <li>Redeploy from the <b>Deployments</b> tab, then reload this page.</li>
      </ol>
    </div>
  );
}
