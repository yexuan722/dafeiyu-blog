import { getCollection, type CollectionEntry } from "astro:content";

export type Post = CollectionEntry<"posts">;

/** 2026-10-24 这种格式，中文环境下手动归一化分隔符 */
export function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .replace(/\//g, "-");
}

/** 按中文阅读速度粗算，450 字/分钟，最少 1 分钟 */
export function readingMinutes(body?: string): number {
  const plain = (body ?? "").replace(/[#*`>|~\-\[\]()]/g, "");
  return Math.max(1, Math.round(plain.length / 450));
}

export async function getSortedPosts(): Promise<Post[]> {
  const posts = await getCollection("posts", ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function allTags(posts: Post[]): string[] {
  return [...new Set(posts.flatMap((p) => p.data.tags))].sort();
}
