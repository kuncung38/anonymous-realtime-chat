import { useMutation } from "@tanstack/react-query";
import { client } from "@/lib/client";

export const useCreateNewRoom = () =>
  useMutation({
    mutationFn: async () => {
      return await client.room.post();
    },
  });
