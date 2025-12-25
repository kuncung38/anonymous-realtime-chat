import { useEffect, useState } from "react";
import { USERNAME_STORAGE_KEY } from "@/utils/const";
import { generateUsername } from "@/utils/generate";

export const useUsername = () => {
  const [username, setUsername] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(USERNAME_STORAGE_KEY);
    if (stored) {
      setUsername(stored);
      return;
    }

    const generated = generateUsername();
    setUsername(generated);
  }, []);

  return { username, setUsername };
};
