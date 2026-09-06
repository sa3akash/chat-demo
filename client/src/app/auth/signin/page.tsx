import { LoginForm } from '@/components/auth/LoginForm'
import React from 'react'

const SigninPage = () => {
 
    return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  
  )
}

export default SigninPage