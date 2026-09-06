"use server";

import { cookies } from "next/headers";

const BASE_URL = "http://localhost:4400/auth";

async function setCookies(name: string, value: string, maxAge: number = 7) {
  const cookieStore = await cookies();
  cookieStore.set(name, value, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * maxAge,
  });
}

export const signUp = async (
  usernameOrEmail: string,
  email: string,
  password: string,
) => {
  const response = await fetch(`${BASE_URL}/sign-up`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: usernameOrEmail,
      email,
      password,
    }),
  });

  console.log("response", response);

  if (!response.ok) {
    return {
      error: "Failed to sign up",
      success: false,
    };
  }

  if (!response.headers.get("content-type")?.includes("application/json")) {
    const message = await response.text();
    return {
      error: message,
      success: false,
    };
  }

  const data = await response.json();
  const { username, accessToken, refreshToken } = data;

  await setCookies("accessToken", accessToken);
  await setCookies("refreshToken", refreshToken, 30);

  return {
    data: { username, accessToken },
    success: true,
    error: null,
  };
};

export const signIn = async (usernameOrEmail: string, password: string) => {
  const response = await fetch(`${BASE_URL}/sign-in`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: usernameOrEmail,
      password,
    }),
  });
  if (!response.ok) {
    return {
      error: "Failed to sign in",
      success: false,
    };
  }
  if (!response.headers.get("content-type")?.includes("application/json")) {
    const message = await response.text();
    return {
      error: message,
      success: false,
    };
  }

  const data = await response.json();
  const { username, accessToken, refreshToken } = data;

  await setCookies("accessToken", accessToken);
  await setCookies("refreshToken", refreshToken, 30);

  return {
    data: { username, accessToken },
    success: true,
    error: null,
  };
};
