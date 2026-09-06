CREATE TYPE "conversation_type" AS ENUM('direct', 'group', 'channel', 'community', 'secret');--> statement-breakpoint
CREATE TYPE "message_type" AS ENUM('text', 'image', 'video', 'audio', 'document', 'poll', 'system', 'encrypted');--> statement-breakpoint
CREATE TYPE "user_status" AS ENUM('online', 'offline', 'away', 'dnd');--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" varchar PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"fingerprint" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(100) NOT NULL,
	"phone" varchar(50),
	"password_hash" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"two_factor_secret" text,
	"status" "user_status" DEFAULT 'offline'::"user_status" NOT NULL,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "conversation_members" (
	"id" varchar PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"conversation_id" varchar(64) NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"last_read_message_id" varchar(64),
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"is_muted" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" "conversation_type" DEFAULT 'direct'::"conversation_type" NOT NULL,
	"title" varchar(255),
	"icon_url" text,
	"dm_hash" varchar(128) UNIQUE,
	"last_message_id" varchar(64),
	"last_message_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"conversation_id" varchar(64) NOT NULL,
	"sender_id" varchar(64) NOT NULL,
	"reply_to_id" varchar(64),
	"content" text,
	"type" "message_type" DEFAULT 'text'::"message_type" NOT NULL,
	"attachments" jsonb DEFAULT '[]' NOT NULL,
	"reactions" jsonb DEFAULT '{}' NOT NULL,
	"is_edited" boolean DEFAULT false NOT NULL,
	"deleted_for_everyone" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"actor_id" varchar(64),
	"type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'
);
--> statement-breakpoint
CREATE INDEX "cm_user_id_idx" ON "conversation_members" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cm_user_conv_unique" ON "conversation_members" ("conversation_id","user_id");--> statement-breakpoint
CREATE INDEX "msg_conv_created_idx" ON "messages" ("conversation_id","created_at");--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id");