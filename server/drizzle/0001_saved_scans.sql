CREATE TYPE "public"."scan_mode" AS ENUM('full', 'light');--> statement-breakpoint
ALTER TABLE "scans" DROP CONSTRAINT "scans_domain_id_domains_id_fk";
--> statement-breakpoint
ALTER TABLE "scans" ALTER COLUMN "domain_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "hostname" text NOT NULL;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "mode" "scan_mode" NOT NULL;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "final_url" text;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scans_user_created_idx" ON "scans" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "scans_user_hostname_created_idx" ON "scans" USING btree ("user_id","hostname","created_at");