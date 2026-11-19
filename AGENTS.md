<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Application architecture
- Store reports, compressed images and corrections in Cloud user_data under the authenticated user; IndexedDB is an account-scoped cache and a one-time legacy migration source, so accounts never import another account's cache.
- Keep report models and validation in browser-safe pure modules, with storage in a hook and document generation dynamically loaded from user actions; this preserves SSR safety and keeps export libraries out of initial rendering.
- Use the index route for the report workspace with three workflow steps; these steps edit the same local document rather than separate content pages.
- Load the illustrative report once only when local report content is empty, and mark initialization in IndexedDB; this protects existing reports and prevents cleared examples from returning.
- Report grouping, stats and issue ordering live in pure functions in `report-model.ts`, shared by preview, PDF, Word and Excel; keeps every output consistent.
- PDF summary pages are reserved up front and filled after layout; the preview reuses `buildPdf` page numbers so the on-screen summary matches the file.
- Saved reports are independent snapshots (`saved-reports-v1`) and corrections are keyed by snapshot id (`corrections-v1`) with per-issue status, note and photos; later edits in the workspace never alter a saved report or its corrections.
- Project plans are stored on the report as JPEG sheets (PDF pages rendered with pdfjs-dist) and pieces keep an optional marker with fractional x/y; outputs draw markers onto the sheet so PDF, Word and screen match at any size.
- Keep home-screen installation manifest-only without an app-shell service worker; online account storage requires connectivity and previews must remain uncached.
