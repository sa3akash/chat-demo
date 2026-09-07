// Model define the data structure and validation for the request and response
import { t, type UnwrapSchema } from 'elysia'

export const AuthModel = {
	signInBody: t.Object({
		username: t.String(),
		password: t.String(),
	}),
	authTokensResponse: t.Object({
		username: t.String(),
		id: t.String(),
		accessToken: t.String(),
		refreshToken: t.String(),
	}),

	signupBody: t.Object({
		username: t.String(),
		email: t.String(),
		password: t.String(),
	}),

	refreshTokenBody: t.Object({
		refreshToken: t.String(),
	}),

	signUpError: t.Literal('User already exists'),

	signInInvalid: t.Literal('Invalid username or password'),
} as const

// Optional, cast all model to TypeScript type
export type AuthModel = {
	[k in keyof typeof AuthModel]: UnwrapSchema<typeof AuthModel[k]>
}