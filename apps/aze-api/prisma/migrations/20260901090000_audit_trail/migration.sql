-- Prisma cannot express partitioned tables, so this parent and its maintenance
-- functions stay hand-written. The Prisma model above it remains the read/write API.
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event" TEXT NOT NULL,
    "actorUserId" TEXT,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "details" JSONB,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id", "occurredAt")
) PARTITION BY RANGE ("occurredAt");

CREATE INDEX "audit_events_actorUserId_occurredAt_idx"
    ON "audit_events"("actorUserId", "occurredAt");
CREATE INDEX "audit_events_subjectType_subjectId_occurredAt_idx"
    ON "audit_events"("subjectType", "subjectId", "occurredAt");
CREATE INDEX "audit_events_event_occurredAt_idx"
    ON "audit_events"("event", "occurredAt");

CREATE OR REPLACE FUNCTION create_audit_partition_for_month(requested_month date)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    partition_start date := date_trunc('month', requested_month)::date;
    partition_end date := (date_trunc('month', requested_month) + interval '1 month')::date;
    partition_name text := 'audit_events_' || to_char(requested_month, 'YYYY_MM');
BEGIN
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF "audit_events" FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        partition_start,
        partition_end
    );
END;
$$;

CREATE OR REPLACE FUNCTION drop_audit_partitions_older_than(retention_months integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    partition record;
    cutoff date;
    dropped integer := 0;
BEGIN
    IF retention_months < 1 THEN
        RAISE EXCEPTION 'retention_months must be a positive integer';
    END IF;

    cutoff := (date_trunc('month', CURRENT_DATE) - make_interval(months => retention_months - 1))::date;

    FOR partition IN
        SELECT child_namespace.nspname AS schema_name, child.relname AS table_name
        FROM pg_inherits
        JOIN pg_class parent ON parent.oid = pg_inherits.inhparent
        JOIN pg_class child ON child.oid = pg_inherits.inhrelid
        JOIN pg_namespace parent_namespace ON parent_namespace.oid = parent.relnamespace
        JOIN pg_namespace child_namespace ON child_namespace.oid = child.relnamespace
        WHERE parent.relname = 'audit_events'
          AND parent_namespace.nspname = current_schema()
          AND child.relname ~ '^audit_events_[0-9]{4}_[0-9]{2}$'
          AND to_date(substring(child.relname FROM '[0-9]{4}_[0-9]{2}$'), 'YYYY_MM') < cutoff
    LOOP
        EXECUTE format('DROP TABLE %I.%I', partition.schema_name, partition.table_name);
        dropped := dropped + 1;
    END LOOP;

    RETURN dropped;
END;
$$;

SELECT create_audit_partition_for_month(CURRENT_DATE);
SELECT create_audit_partition_for_month((CURRENT_DATE + interval '1 month')::date);
