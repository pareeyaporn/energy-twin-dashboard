export function integrationHead(title: string, description: string) {
  return { meta: [
    { title: `Energy Twin — ${title}` },
    { name: "description", content: description },
    { property: "og:title", content: `Energy Twin — ${title}` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] };
}