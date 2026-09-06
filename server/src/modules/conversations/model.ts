// Model define the data structure and validation for the request and response
import { t, type UnwrapSchema } from 'elysia'

export const ConversationModel = {
	// create conversation
    createConversationBody: t.Object({
        participants: t.Array(t.String()),
    }),

    createConversationInvalid: t.Literal('Invalid participants')
} as const

// Optional, cast all model to TypeScript type
export type ConversationModel = {
	[k in keyof typeof ConversationModel]: UnwrapSchema<typeof ConversationModel[k]>
}