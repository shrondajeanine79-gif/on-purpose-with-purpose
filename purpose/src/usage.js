export const USAGE = `PURPOSE - private owner-directed assistant for On Purpose With Purpose

Usage: node bin/purpose.js <command> [options]

Commands:
  status                 Show project, phase, governance, and Hive readiness
  workflows              List authorized workflows and their phase/enabled state
  capabilities           List capabilities and approval requirements
  gaps                   List brand standards that NEEDS OWNER REVIEW
  inventory              Summarize the product, page, link, and asset inventory
  review                 Print read-only inventory findings
  intent <file.json>     Validate an owner directive from a JSON file
  request <file.json>    Create a pending approval record from a validated directive
  approvals [status]     List approval records (pending|approved|rejected|consumed)
  approve <id> [note]    Record owner approval for a pending item
  reject <id> [note]     Record owner rejection for a pending item
  audit [--verify]       Print the audit log, optionally verifying the hash chain
  db-init                Create the local SQLite database and apply migrations
  db-status              Show local database path, migrations, and row counts
  draft <file.json>      Guarded Hive draft. Requires approval record, HIVE_API_KEY,
                         and PURPOSE_ENABLE_HIVE=1. Produces text only. No execution.

All write commands record an audit event. No command publishes, sends, charges,
changes bookings, or modifies the website.
`;

export function formatJson(value) {
  return JSON.stringify(value, null, 2);
}
