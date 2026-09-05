import { Elysia } from 'elysia'

import { Auth } from './service'
import { AuthModel } from './model'

export const auth = new Elysia({ prefix: '/auth' })
	.get(
		'/sign-in',
		async ({ body, cookie: { session } }) => {
			const response = await Auth.signIn(body)

			// Set session cookie
			// (Elysia cookie is proxy, it can never be null/undefined)
			session!.value = response.token

			return response
		}, {
			body: AuthModel.signInBody,
			// response is optional, use to enforce return type
			response: {
				200: AuthModel.signInResponse,
				400: AuthModel.signInInvalid
			}
		}
	)