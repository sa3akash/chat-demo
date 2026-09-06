"use client";

import { useAuth } from "@/context/AuthContext";
import React from "react";

const ChatPage = () => {
  const { user, loading } = useAuth();

  return <div>ChatPage { loading ? "Loading..." : user?.username}</div>;
};

export default ChatPage;
