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
import { Input } from "@/components/ui/input";
import React, { useState, useTransition } from "react";
import { searchUserByUsername, signOut } from "@/actions/auth";
import { addConversation } from "@/actions/conversation";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  Search,
  LogOut,
  UserPlus,
  Users,
  Check,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";

interface ConversationHeaderProps {
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  searchQuery = "",
  onSearchChange,
}) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [searchedUsers, setSearchedUsers] = useState<{ username: string; id: string }[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, startTransition] = useTransition();

  const { user, storeUser } = useAuth();
  const { isConnected } = useSocket();
  const router = useRouter();

  const handleSearchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (search.length < 2) return;

    const result = await searchUserByUsername(search);
    if (result.success && result.data) {
      // Filter out self
      const filtered = result.data.filter((u: any) => u.id !== user?.id);
      setSearchedUsers(filtered);
    }
  };

  const handleStartDirectChat = async (targetUserId: string) => {
    startTransition(async () => {
      const result = await addConversation({
        participants: [targetUserId],
      });
      if (!result.success) {
        toast.add({
          type: "error",
          description: result.error || "Failed to start conversation",
        });
        return;
      }
      setOpen(false);
      setSearch("");
      setSearchedUsers([]);
      router.push(`/chat?id=${result.data?.id}`);
    });
  };

  const handleCreateGroupChat = async () => {
    if (selectedUserIds.length < 2) {
      toast.add({
        type: "error",
        description: "Please select at least 2 participants for a group chat",
      });
      return;
    }

    startTransition(async () => {
      const result = await addConversation({
        participants: selectedUserIds,
      });
      if (!result.success) {
        toast.add({
          type: "error",
          description: result.error || "Failed to create group",
        });
        return;
      }
      setOpen(false);
      setSelectedUserIds([]);
      setSearchedUsers([]);
      router.push(`/chat?id=${result.data?.id}`);
    });
  };

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSignOut = async () => {
    await signOut();
    storeUser(null);
    router.push("/auth/signin");
  };

  const userInitials = (user?.username || "U").slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-3 pb-3 border-b border-border/60">
      {/* Profile Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs shadow-xs">
              {userInitials}
            </div>
            <span
              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${
                isConnected ? "bg-emerald-500" : "bg-muted-foreground/50"
              }`}
            />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold truncate text-foreground leading-tight">
              {user?.username || "My Account"}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium">
              {isConnected ? "Connected" : "Reconnecting..."}
            </p>
          </div>
        </div>

        {/* Sign out button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSignOut}
          className="rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>

      {/* Title & New Chat Modal */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground tracking-tight">Chats</h1>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button
                size="sm"
                className="rounded-xl h-8 px-3 text-xs gap-1.5 shadow-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                New Chat
              </Button>
            }
          />

          <DialogContent className="sm:max-w-md p-6">
            <DialogHeader>
              <DialogTitle>Start a Conversation</DialogTitle>
              <DialogDescription>
                Find colleagues by username to start messaging.
              </DialogDescription>
            </DialogHeader>

            {/* Mode Switcher */}
            <div className="flex rounded-xl bg-muted/60 p-1 my-2">
              <button
                type="button"
                onClick={() => setMode("direct")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  mode === "direct"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Direct Message
              </button>
              <button
                type="button"
                onClick={() => setMode("group")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  mode === "group"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Group Chat
              </button>
            </div>

            {/* Search Input Form */}
            <form onSubmit={handleSearchUser} className="flex items-center gap-2 my-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by username..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 rounded-xl"
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                disabled={search.length < 2 || loading}
                size="sm"
                className="rounded-xl px-4"
              >
                Search
              </Button>
            </form>

            {/* User Search Results List */}
            <div className="flex flex-col gap-1 max-h-60 overflow-y-auto mt-2 pr-1">
              {searchedUsers.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  {search.length < 2
                    ? "Type at least 2 characters to search"
                    : "No users found matching query"}
                </div>
              ) : (
                searchedUsers.map((u) => {
                  const isSelected = selectedUserIds.includes(u.id);

                  if (mode === "group") {
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleSelectUser(u.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl text-left text-sm transition-colors ${
                          isSelected
                            ? "bg-primary/15 border border-primary/30"
                            : "hover:bg-muted/70"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                            {u.username.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-foreground">{u.username}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-primary" />}
                      </button>
                    );
                  }

                  return (
                    <Button
                      key={u.id}
                      variant="outline"
                      onClick={() => handleStartDirectChat(u.id)}
                      disabled={loading}
                      className="justify-start p-3 h-auto rounded-xl gap-2.5 hover:border-primary"
                    >
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {u.username.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium">{u.username}</span>
                      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin ml-auto" />}
                    </Button>
                  );
                })
              )}
            </div>

            {/* Group Creation Button */}
            {mode === "group" && selectedUserIds.length > 0 && (
              <div className="pt-3 border-t border-border mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {selectedUserIds.length} users selected
                </span>
                <Button
                  onClick={handleCreateGroupChat}
                  disabled={loading || selectedUserIds.length < 2}
                  className="rounded-xl"
                  size="sm"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Create Group
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Conversation Filter Search Box */}
      {onSearchChange && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-xs rounded-xl bg-muted/40 border-border/60 focus-visible:ring-primary/40"
          />
        </div>
      )}
    </div>
  );
};

export default ConversationHeader;
