"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import React, { useState, useTransition } from "react";
import { searchUserByUsername } from "@/actions/auth";
import { addConversation } from "@/actions/conversation";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const ConversationHeader = () => {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<{ username: string; id: string }[]>([]);
  const [search, setSearch] = useState("");
  const [loading, startTransition] = useTransition();

  const router = useRouter();

  const handleSearchUser = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = await searchUserByUsername(search);
    if (result.success) {
      setUsers(result.data);
    }
  };

  const createConversation = async (userId: string) => {
    startTransition(async () => {
      const result = await addConversation({
        participants: [userId],
      });
      if (!result.success) {
        toast.add({
          type: "error",
          description: result.error,
        });
      }
      setOpen(false);
      router.push(`/chat?id=${result.data?.id}`);
    });
  };

  return (
    <div className="flex items-center justify-between mb-4 border-b pb-2">
      <h1 className="text-2xl font-bold">Conversations</h1>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger>Add</DialogTrigger>
        <DialogContent className="sm:max-w-106.25">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              Make changes to your profile here. Click save when you&apos;re
              done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username" className="text-right">
                Username
              </Label>
              <form
                className="flex items-center gap-2"
                onSubmit={handleSearchUser}
              >
                <Input
                  id="username"
                  placeholder="Search user by username"
                  className="col-span-3"
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Button
                  variant={"outline"}
                  disabled={search.length < 2}
                  type="submit"
                >
                  Search
                </Button>
              </form>
            </div>
            {/* list all searched users */}
            <div>
              {users.map((data, index) => {
                return (
                  <Button
                    key={index}
                    onClick={() => createConversation(data.id)}
                    className="w-full my-1"
                    disabled={loading}
                  >
                    <p>
                      {data.username}{" "}
                      {loading && (
                        <Loader2 className="inline-block animate-spin" />
                      )}
                    </p>
                  </Button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConversationHeader;
