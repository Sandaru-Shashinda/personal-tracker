const EMOJI = ["", "😞", "😕", "😐", "🙂", "😄"];

export function moodEmojiServer(m: number | null | undefined) {
  return m ? (EMOJI[m] ?? "") : "";
}
