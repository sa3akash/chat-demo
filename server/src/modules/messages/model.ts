// Model define the data structure and validation for the request and response
import { t, type UnwrapSchema } from 'elysia'
import { createInsertSchema } from 'drizzle-typebox'
import { table } from '@/db'


export const _messageSchema = createInsertSchema(table.messages);

export const _userPublicSchema = t.Nullable(t.Object({
  id: t.String(),
  username: t.String(),
  email: t.String(),
}));

export const messageSchema = {
	sendMessageBody: t.Object({
		conversationId: t.String(),
		content: t.String(),
		type: t.Optional(t.String()),
	}),
	getMessagesByConversationQuery: t.Object({
		conversationId: t.String(),
		limit: t.Optional(t.Number()),
		cursor: t.Optional(t.String()),
	}),
	getMessagesByConversationResponse: t.Object({
		messages: t.Array(t.Composite([
  _messageSchema,
  t.Object({
    sender: t.Nullable(_userPublicSchema),
  }),
])),
		nextCursor: t.Nullable(t.String()),
	}),
	messagesResponse: t.Array(_messageSchema),
	singleMessageResponse: _messageSchema,
	sendMessageInvalid: t.Literal('Invalid message content'),
	getMessagesByConversationInvalid: t.Literal('Invalid conversation id')
} as const

// Optional, cast all model to TypeScript type
export type MessageSchema = {
	[k in keyof typeof messageSchema]: UnwrapSchema<typeof messageSchema[k]>
}