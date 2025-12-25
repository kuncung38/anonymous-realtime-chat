export const formatTimeRemaining = (seconds: number) => {
  let final = "";
  if (seconds > 86400) {
    final += `${Math.floor(seconds / 86400)} days `;
  }

  const format = (x: number) => x.toString().padStart(2, "0");
  const hours = Math.floor(seconds / 3600) % 24;

  if (hours) {
    final += `${format(hours)}:`;
  }

  const mins = Math.floor(seconds / 60) % 60;
  const secs = seconds % 60;
  final += `${format(mins)}:${format(secs)}`;

  return final;
};

export const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};
