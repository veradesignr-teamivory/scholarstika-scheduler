import { notFound } from "next/navigation";
import { getPost } from "@/lib/db";
import { readinessProblems } from "@/lib/validate";
import SetupError from "../../components/SetupError";
import TopBar from "../../components/TopBar";
import PostEditor from "./PostEditor";

export const dynamic = "force-dynamic";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const post = await getPost(id);
    if (!post) notFound();
    return (
      <main className="wrap">
        <TopBar current="posts" />
        <PostEditor initial={post} initialProblems={readinessProblems(post)} />
      </main>
    );
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // let notFound() through
    return (
      <main className="wrap">
        <TopBar current="posts" />
        <SetupError message={e instanceof Error ? e.message : String(e)} />
      </main>
    );
  }
}
