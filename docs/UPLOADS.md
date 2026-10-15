# Uploads

OryCMS stores uploaded media files under `public/uploads` in the host Next.js
app. The host app serves that folder as static files — OryCMS itself does not
run a serving route for uploads.

Because the files are served the same way as any other static asset, the
headers they're served with are controlled by the host app's own Next.js
configuration, not by OryCMS. We recommend setting the headers below for the
uploads path.

## Recommended headers

Add a `headers()` entry for the uploads path in your `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/uploads/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Content-Security-Policy", value: "default-src 'none'; sandbox" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- `X-Content-Type-Options: nosniff` tells the browser to trust the
  `Content-Type` a file was served with instead of guessing one from its
  contents.
- The `Content-Security-Policy` value disables active content and script
  execution for anything served from the uploads path.

## Scaffolding

A future version of `create-ory-cms`'s init flow offers to add this snippet
to a new project's `next.config.ts` automatically.
