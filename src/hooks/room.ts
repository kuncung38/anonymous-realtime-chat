import { useMutation, useQuery } from "@tanstack/react-query";
import { client } from "@/lib/client";

export const useCreateNewRoom = () =>
  useMutation({
    mutationFn: async () => {
      return await client.room.post();
    },
  });

export const useRoomAccess = (roomId: string) =>
  useQuery({
    queryKey: ["room-access", roomId],
    queryFn: async () => {
      const res = await client.room.get({
        query: { roomId },
      });
      
      if (res.error) {
        const errorMessage = typeof res.error === 'object' && res.error !== null && 'error' in res.error 
          ? String(res.error.error)
          : 'Access denied';
        throw new Error(errorMessage);
      }
      
      if (!res.data) {
        throw new Error("Access denied");
      }
      
      return res.data;
    },
    retry: false,
  });

export const useRoomTtl = (roomId: string) =>
  useQuery({
    queryKey: ["ttl", roomId],
    queryFn: async () => {
      const res = await client.room.ttl.get({
        query: {
          roomId,
        },
      });

      return res.data;
    },
  });

export const useDestroyRoom = () =>
  useMutation({
    mutationFn: async (roomId: string) => {
      await client.room.delete(null, {
        query: {
          roomId,
        },
      });
    },
  });
