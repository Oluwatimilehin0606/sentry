ALTER TABLE "domains" ADD COLUMN "developer_name" text;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "developer_email" text;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "developer_auto_send" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "developer_stop_token" text;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "developer_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "developer_sent_to" text;