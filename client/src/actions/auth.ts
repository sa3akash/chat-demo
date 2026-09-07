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
  const { username, accessToken, refreshToken, id } = data;

  await setCookies("accessToken", accessToken);
  await setCookies("refreshToken", refreshToken, 30);

  return {
    data: { username, accessToken, id },
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
  const { username, accessToken, refreshToken,id } = data;

  await setCookies("accessToken", accessToken);
  await setCookies("refreshToken", refreshToken, 30);

  return {
    data: { username, accessToken, id },
    success: true,
    error: null,
  };
};

export const getUser = async () => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;

  if (!accessToken) {
    return {
      error: "No access token found",
      success: false,
    };
  }

  const response = await fetch(`${BASE_URL}/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    return {
      error: "Failed to get user",
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

  const {user} = await response.json();
  return {
    data: {
      username: user.username,
      id: user.id,
      accessToken,
    },
    success: true,
    error: null,
  };
};


export const searchUserByUsername=async(username:string)=>{
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken) {
      return {
        error: "No access token found",
        success: false,
      };
    }
    const response = await fetch(`${BASE_URL}/search?username=${username}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      return {
        error: "Failed to search user",
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
    const users = await response.json();
    return {
      data: users,
      success: true,
      error: null,
    };
  } catch (error) {
    console.log(error);
    return {
      error: "Internal server error",
      success: false,
    };
  }
}