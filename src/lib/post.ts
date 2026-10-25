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

export interface TagCount {
  tag: string;
  count: number;
  hue: number;
}

/** 同一个标签永远得到同一个色相，颜色不会随构建顺序漂移 */
export function tagHue(tag: string): number {
  let h = 0;
  for (const ch of tag) h = (h * 31 + (ch.codePointAt(0) ?? 0)) % 360;
  return h;
}

export function tagCounts(posts: Post[]): TagCount[] {
  const map = new Map<string, number>();
  for (const p of posts) {
    for (const t of p.data.tags) map.set(t, (map.get(t) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([tag, count]) => ({ tag, count, hue: tagHue(tag) }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh-CN"));
}

/** 去掉 markdown 痕迹，给搜索索引和摘要用 */
export function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`|~\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
