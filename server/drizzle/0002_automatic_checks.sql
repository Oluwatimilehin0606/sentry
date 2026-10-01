ALTER TABLE "domains" ADD COLUMN "next_check_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "alerts_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "domains_next_check_idx" ON "domains" USING btree ("next_check_at");