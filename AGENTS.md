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
- Persist every report, photo and correction to an account-scoped IndexedDB record before network access; revisioned pending records sync to Cloud user_data on reconnect, focus and periodic retries, so network failure never blocks durable local saves or overwrites pending edits.
- Keep report models and validation in browser-safe pure modules, with storage in a hook and document generation dynamically loaded from user actions; this preserves SSR safety and keeps export libraries out of initial rendering.
- Use the index route for the report workspace with three workflow steps; these steps edit the same local document rather than separate content pages.
- Load the illustrative report once only when local report content is empty, and mark initialization in IndexedDB; this protects existing reports and prevents cleared examples from returning.
- Report grouping, stats and issue ordering live in pure functions in `report-model.ts`, shared by preview, PDF, Word and Excel; keeps every output consistent.
- Photo figure numbers come from pure helpers in `report-model.ts` computed over the unfiltered grouped order, so a photo keeps the same number in the preview and in every exported document even when export filters hide other pieces.
- PDF summary pages are reserved up front and filled after layout; the preview reuses `buildPdf` page numbers so the on-screen summary matches the file.
- Saved reports update only on explicit archive saves, matched by stable identity (legacy title/client/date fallback); keep five previous snapshots in account-scoped backup records and retain correction ids, so workspace edits remain independent until saved.
- Project plans are stored on the report as JPEG sheets (PDF pages rendered with pdfjs-dist) and pieces keep an optional marker with fractional x/y; outputs draw markers onto the sheet so PDF, Word and screen match at any size.
- Keep installation manifest-only without an app-shell service worker; offline edits use IndexedDB in an already opened app, while a fully offline cold launch is not supported and previews remain uncached.
- Images inside synced records are uploaded one by one to the private `photos` bucket by content hash and replaced with `photo-ref:` references online, then rehydrated and cached locally; keeps records small so slow connections never block saving.

- Inspection decision options are account-scoped settings in the existing offline-first store; historical piece values and archived snapshots are never relabeled automatically, and summaries count the actual stored labels.
- Version inspection settings and append newly introduced choices once through a pure upgrade helper; this preserves custom choices and allows later removal without restoring them on reload.
- Read-only sharing uses hashed random capabilities in owner-only rows, a narrow read RPC, and short-lived signed photo URLs scoped to the authorized payload; anonymous visitors never receive edit privileges or access to other account records.
- Continuous camera capture uses a component-owned media stream stopped on unmount; append each compressed photo independently without closing the piece editor.
