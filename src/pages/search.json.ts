import type { APIRoute } from "astro";
import { getSortedPosts, plainText, readingMinutes } from "../lib/post";

export const GET: APIRoute = async () => {
  const posts = await getSortedPosts();

  const index = posts.map((post) => ({
    id: post.id,
    title: post.data.title,
    description: post.data.description,
    tags: post.data.tags,
    date: post.data.pubDate.toISOString().slice(0, 10),
    minutes: readingMinutes(post.body),
    body: plainText(post.body ?? "").slice(0, 6000),
  }));

  return new Response(JSON.stringify(index), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};
