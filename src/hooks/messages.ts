import { useMutation, useQuery } from "@tanstack/react-query";
import { client } from "@/lib/client";

export const useMessages = (roomId: string) =>
  useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      const res = await client.messages.get({
        query: {
          roomId,
        },
      });
      return res.data;
    },
  });

export const useSendMessage = () =>
  useMutation({
    mutationFn: async ({
      text,
      sender,
      roomId,
    }: {
      text: string;
      sender: string;
      roomId: string;
    }) => {
      await client.messages.post(
        {
          sender,
          text,
        },
        {
          query: {
            roomId,
          },
        },
      );
    },
  });
