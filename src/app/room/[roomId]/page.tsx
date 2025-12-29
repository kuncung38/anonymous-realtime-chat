"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMessages, useSendMessage } from "@/hooks/messages";
import { useDestroyRoom, useRoomAccess } from "@/hooks/room";
import { useUsername } from "@/hooks/use-username";
import { useRealtime } from "@/lib/realtime-client";
import { cn } from "@/lib/utils";
import { formatTime, formatTimeRemaining } from "@/utils/formatter";

export default function Page() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;

  const queryClient = useQueryClient();

  const { username } = useUsername();

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [copyStatus, setCopyStatus] = useState("COPY");
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const { data: ttlData, error: accessError } = useRoomAccess(roomId);

  useEffect(() => {
    if (ttlData?.ttl) {
      setTimeRemaining(ttlData.ttl);
    }
  }, [ttlData]);

  useEffect(() => {
    if (timeRemaining === null || timeRemaining < 0) {
      return;
    }

    if (timeRemaining === 0) {
      router.push("/?destroyed=true");
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, router]);

  const { data: messages } = useMessages(roomId);

  const { mutate: sendMessage, isPending } = useSendMessage();

  const handleSendMessage = () => {
    if (input.trim() === "") return;
    sendMessage({ text: input, sender: username, roomId });
    setInput("");
    inputRef.current?.focus();
  };

  useRealtime({
    channels: [roomId],
    events: ["chat.destroy", "chat.message"],
    onData: ({ event, data }) => {
      switch (event) {
        case "chat.message":
          queryClient.setQueryData(
            ["messages", roomId],
            (old: { messages: (typeof data)[] } | undefined) => {
              const oldMessages = old?.messages ?? [];
              if (oldMessages.some((m) => m.id === data.id)) {
                return old;
              }
              return {
                ...(old ?? { messages: [] }),
                messages: [...oldMessages, data],
              };
            },
          );
          // Auto-scroll to latest message
          setTimeout(() => {
            messagesContainerRef.current?.scrollTo({
              top: messagesContainerRef.current.scrollHeight,
              behavior: "smooth",
            });
          }, 100);
          break;
        case "chat.destroy":
          router.replace("/?destroyed=true");
          break;
      }
    },
  });

  const { mutate: destroyRoom } = useDestroyRoom();

  useEffect(() => {
    if (accessError) {
      const error = accessError.message;
      if (error === "room-busy") {
        router.push("/?error=room-busy");
      } else if (error === "room-not-found") {
        router.push("/?error=room-not-found");
      } else if (error === "room-full") {
        router.push("/?error=room-full");
      } else {
        router.push("/?error=access-denied");
      }
    }
  }, [accessError, router]);

  if (!ttlData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-zinc-600 text-sm font-mono">
          Validating room access...
        </div>
      </div>
    );
  }

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopyStatus("COPIED!");
    setTimeout(() => setCopyStatus("COPY"), 2000);
  };

  return (
    <main className="flex flex-col h-screen max-h-screen overflow-hidden">
      <header className="border-b border-zinc-800 p-4 flex items-center justify-between bg-zinc-900/30">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500 uppercase">Room ID</span>

            <div className="flex items-center gap-2">
              <p className="font-bold text-green-500">{roomId}</p>

              <button
                type="button"
                className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 rounded text-zinc-400 transition-colors ml-5"
                onClick={copyLink}
              >
                {copyStatus}
              </button>
            </div>
          </div>

          <div className="h-8 w-px bg-zinc-800" />

          <div className="flex flex-col">
            <p className="text-xs text-zinc-500 uppercase">Self-Destruct</p>
            <p
              className={cn(
                "text-sm font-bold flex items-center gap-2",
                typeof timeRemaining === "number" && timeRemaining < 60
                  ? "text-red-500"
                  : "text-amber-500",
              )}
            >
              {typeof timeRemaining === "number"
                ? formatTimeRemaining(timeRemaining)
                : "--:--"}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="text-xs bg-zinc-800 hover:bg-red-600 px-3 py-1.5 rounded text-zinc-400 hover:text-white font-bold transition-all group flex items-center gap-2 disabled:opacity-50 "
          onClick={() => destroyRoom(roomId)}
        >
          <span className="group-hover:animate-pulse">💣</span>
          DESTROY NOW
        </button>
      </header>

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin"
      >
        {!messages?.messages.length && (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-600 text-sm font-mono">
              No messages yet, start the convo
            </p>
          </div>
        )}

        {messages?.messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex flex-col",
              m.sender === username ? "items-end" : "items-start",
            )}
          >
            <div className="max-w-[80%] group">
              <div
                className={cn(
                  "flex items-baseline gap-3 mb-1",
                  m.sender === username ? "flex-row-reverse" : "flex-row",
                )}
              >
                <span
                  className={cn(
                    "text-xs font-bold",
                    m.sender === username ? "text-green-500" : "text-blue-500",
                  )}
                >
                  {m.sender === username ? "YOU" : m.sender}
                </span>

                <span className="text-[10px] text-zinc-600">
                  {formatTime(m.timestamp)}
                </span>
              </div>

              <div
                className={cn(
                  "rounded-lg px-3 py-2",
                  m.sender === username
                    ? "bg-green-600/20 border border-green-600/30"
                    : "bg-zinc-800 border border-zinc-700",
                )}
              >
                <p className="text-sm text-zinc-300 leading-relaxed break-all">
                  {m.text}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
        <div className="flex gap-4">
          <div className="flex-1 relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500 animate-pulse">
              {">"}
            </span>

            <input
              type="text"
              value={input}
              ref={inputRef}
              onKeyDown={(e) => {
                if (e.key === "Enter" && input.trim()) {
                  handleSendMessage();
                }
              }}
              placeholder="Type message..."
              onChange={(e) => setInput(e.target.value)}
              // biome-ignore lint/a11y/noAutofocus: why not
              autoFocus={true}
              className="w-full bg-black border border-zinc-800 focus:border-zinc-700 focus:outline-none transition-all text-zinc-100 placeholder:text-zinc-700 py-3 pl-8 pr-4 text-sm"
            />
          </div>
          <button
            type="button"
            className="bg-zinc-800 text-zinc-400 px-6 text-sm font-bold hover:text-zinc-200 hover:bg-zinc-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            onClick={() => {
              handleSendMessage();
            }}
            disabled={!input.trim() || isPending}
          >
            SEND
          </button>
        </div>
      </div>
    </main>
  );
}
