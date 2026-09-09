import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

const BASE_URL = import.meta.env.VITE_SITE_URL ?? "http://localhost:8080";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env["SUPABASE_URL"]!;
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;

        const supabase = createClient<Database>(url, key, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
                headers.delete("Authorization");
              }
              headers.set("apikey", key);
              return fetch(input as RequestInfo, { ...init, headers });
            },
          },
        });

        const { data, error } = await supabase
          .from("consultores")
          .select("slug, updated_at")
          .eq("publicado", true)
          .order("nome", { ascending: true });

        if (error) {
          return new Response(`Erro ao gerar sitemap: ${error.message}`, { status: 500 });
        }

        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/privacidade", changefreq: "yearly", priority: "0.3" },
        ];

        for (const c of data ?? []) {
          entries.push({
            path: `/consultores/${c.slug}`,
            changefreq: "weekly",
            priority: "0.8",
            lastmod: c.updated_at ? new Date(c.updated_at).toISOString().split("T")[0] : undefined,
          });
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
