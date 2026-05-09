#!/usr/bin/env python3
"""
Strip Supabase-managed-only pieces from a pg_dump plain SQL file so it restores
on vanilla PostgreSQL (e.g. Windows/pgAdmin): roles bootstrap, no vault/pg_graphql
extensions, no pg_dump \\restrict lines, no optional event triggers.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

BOOTSTRAP = r"""
--
-- Local restore: stub roles referenced by the Supabase dump (not full Supabase parity)
--
DO $bootstrap$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_user') THEN
    CREATE ROLE dashboard_user NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin NOLOGIN NOINHERIT CREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_realtime_admin') THEN
    CREATE ROLE supabase_realtime_admin NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgbouncer') THEN
    CREATE ROLE pgbouncer NOLOGIN;
  END IF;
END
$bootstrap$;


"""

GRAPHQL_STUB = r"""
--
-- Stand-in graphql_public.graphql (pg_graphql is not installed on typical local Postgres)
--
CREATE OR REPLACE FUNCTION graphql_public.graphql(
    "operationName" text DEFAULT NULL,
    query text DEFAULT NULL,
    variables jsonb DEFAULT NULL,
    extensions jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
AS $graphql_stub$
SELECT jsonb_build_object(
  'errors', jsonb_build_array(
    jsonb_build_object(
      'message', 'pg_graphql is not installed locally; GraphQL is disabled.'
    )
  )
);
$graphql_stub$;


ALTER FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) OWNER TO supabase_admin;


"""

EVENT_TRIGGERS_TO_DROP = (
    "issue_graphql_placeholder",
    "issue_pg_cron_access",
    "issue_pg_graphql_access",
    "issue_pg_net_access",
    "pgrst_ddl_watch",
    "pgrst_drop_watch",
)


def clean_content(text: str) -> str:
    lines = text.splitlines(keepends=True)
    out: list[str] = []
    n = len(lines)
    i = 0
    bootstrap_done = False
    graphql_stub_done = False

    def at(idx: int) -> str:
        return lines[idx] if idx < n else ""

    while i < n:
        s = lines[i]

        if s.startswith("\\restrict") or s.startswith("\\unrestrict"):
            i += 1
            continue

        if s.strip() == "SET row_security = off;" and not bootstrap_done:
            out.append(s)
            out.append(BOOTSTRAP)
            bootstrap_done = True
            i += 1
            continue

        # Vault schema (extension tables are not available locally)
        if "-- Name: vault; Type: SCHEMA;" in s:
            while i < n and not at(i).startswith("CREATE SCHEMA vault"):
                i += 1
            if i < n:
                i += 1
            while i < n and at(i).strip() == "":
                i += 1
            if i < n and at(i).startswith("ALTER SCHEMA vault OWNER"):
                i += 1
            while i < n and at(i).strip() == "":
                i += 1
            continue

        if "CREATE EXTENSION IF NOT EXISTS supabase_vault" in s:
            i += 1
            while i < n and not at(i).startswith("COMMENT ON EXTENSION supabase_vault"):
                i += 1
            if i < n:
                i += 1
            while i < n and at(i).strip() == "":
                i += 1
            continue

        if "CREATE EXTENSION IF NOT EXISTS pg_graphql" in s:
            i += 1
            while i < n and not at(i).startswith("COMMENT ON EXTENSION pg_graphql"):
                i += 1
            if i < n:
                i += 1
            while i < n and at(i).strip() == "":
                i += 1
            continue

        if "COPY vault.secrets" in s:
            while i < n and "COPY vault.secrets" not in at(i):
                i += 1
            if i < n:
                i += 1
            if i < n and at(i).strip() == r"\.":
                i += 1
            while i < n and at(i).strip() == "":
                i += 1
            continue

        skip_trigger = None
        for name in EVENT_TRIGGERS_TO_DROP:
            if s.startswith(f"CREATE EVENT TRIGGER {name}"):
                skip_trigger = name
                break
        if skip_trigger:
            while i < n and not at(i).startswith(f"ALTER EVENT TRIGGER {skip_trigger} OWNER TO "):
                i += 1
            if i < n:
                i += 1
            while i < n and at(i).strip() == "":
                i += 1
            continue

        # Vault ACL sections (TOC + GRANT/REVOKE); schema ACL uses "Name: SCHEMA vault" not "Schema: vault"
        if s.startswith("-- Name:") and (
            "Schema: vault;" in s or "Name: SCHEMA vault;" in s
        ):
            i += 1
            while i < n and (at(i).startswith("--") or at(i).strip() == ""):
                i += 1
            while i < n and (at(i).startswith("GRANT ") or at(i).startswith("REVOKE ")):
                i += 1
            while i < n and at(i).strip() == "":
                i += 1
            continue

        if ("vault." in s or " ON SCHEMA vault " in s) and (
            s.startswith("GRANT ") or s.startswith("REVOKE ")
        ):
            while i < n and (at(i).startswith("GRANT ") or at(i).startswith("REVOKE ")):
                if "vault." in at(i) or " ON SCHEMA vault " in at(i):
                    i += 1
                else:
                    break
            while i < n and at(i).strip() == "":
                i += 1
            continue

        out.append(s)
        if not graphql_stub_done and s.startswith("ALTER SCHEMA graphql_public OWNER TO "):
            out.append(GRAPHQL_STUB)
            graphql_stub_done = True

        i += 1

    result = "".join(out)
    result = re.sub(r"\n{4,}", "\n\n\n", result)
    return result


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: clean_supabase_dump.py INPUT.sql OUTPUT.sql", file=sys.stderr)
        sys.exit(1)
    inp = Path(sys.argv[1])
    outp = Path(sys.argv[2])
    text = inp.read_text(encoding="utf-8")
    cleaned = clean_content(text)
    outp.write_text(cleaned, encoding="utf-8", newline="\n")
    print(f"Wrote {outp} ({len(cleaned)} bytes)")


if __name__ == "__main__":
    main()
