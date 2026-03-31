/**
 * adhoc-drive-archive — DEPRECATED / NOT USED
 *
 * Drive archival for ad hoc training records is handled entirely by the
 * MX-LMS desktop app (electron/main.cjs → ipcMain.handle('adhoc:archive')).
 *
 * When a record's status reaches 'complete', MX-LMS picks it up in its
 * PendingAdHocPanel, generates an HTML summary, and uploads it to the
 * technician's Google Drive folder using the existing drive.cjs integration.
 * It then sets status = 'archived' and drive_url on the record.
 *
 * No server-side keys or pdf-lib dependency needed here.
 */

import type { Handler } from "@netlify/functions"

export const handler: Handler = async () => ({
  statusCode: 410,
  body: JSON.stringify({ error: "Archival is handled by MX-LMS desktop app" }),
})
