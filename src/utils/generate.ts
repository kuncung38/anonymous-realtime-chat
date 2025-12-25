const adjectives = [
  "swift",
  "silent",
  "brave",
  "clever",
  "lazy",
  "fierce",
  "calm",
  "bold",
  "gentle",
  "wild",
  "cool",
  "chill",
  "fuzzy",
  "sharp",
  "smooth",
  "quick",
  "steady",
  "curious",
  "fearless",
  "mighty",
  "nimble",
  "playful",
  "quiet",
  "sneaky",
  "loyal",
  "proud",
  "witty",
  "eager",
  "lucky",
  "sly",
  "frosty",
  "sunny",
  "stormy",
  "shadowy",
  "bright",
  "ancient",
  "cosmic",
  "neon",
  "urban",
  "rogue",
];

const animals = [
  "wolf",
  "fox",
  "panda",
  "tiger",
  "lion",
  "eagle",
  "hawk",
  "owl",
  "bear",
  "otter",
  "panther",
  "leopard",
  "cheetah",
  "lynx",
  "jaguar",
  "dragon",
  "phoenix",
  "falcon",
  "raven",
  "crow",
  "shark",
  "orca",
  "dolphin",
  "whale",
  "seal",
  "cobra",
  "viper",
  "python",
  "gecko",
  "iguana",
  "bison",
  "buffalo",
  "elk",
  "moose",
  "deer",
  "rabbit",
  "hare",
  "badger",
  "ferret",
  "weasel",
];

export function rand(max: number) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

const DEFAULT_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

export function nanoid(size = 10): string {
  let id = "";

  while (id.length < size) {
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);

    for (let i = 0; i < bytes.length && id.length < size; i++) {
      const c = DEFAULT_ALPHABET[bytes[i] & 63];
      if (c !== "-" && c !== "_") {
        id += c;
      }
    }
  }

  return id;
}

export function generateUsername() {
  return `${adjectives[rand(adjectives.length)]}-${
    animals[rand(animals.length)]
  }-${nanoid(5)}`;
}
