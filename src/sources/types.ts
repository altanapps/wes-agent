/**
 * A unit of your communication, from any channel. The diagnostic engine is
 * channel-agnostic: Slack, email, and calls all just produce Message[].
 */
export type Channel = "slack" | "email" | "call" | "telegram" | "manual";

export interface Message {
  text: string;
  channel: Channel;
  /** ISO date — enables trajectory ("is this weakness improving?"). */
  date?: string;
  /** Who it was to (investor, cofounder, candidate…) — sharpens diagnosis. */
  audience?: string;
}

/** A feeder that pulls your sent communication from one place. */
export interface Source {
  name: Channel;
  fetch(): Promise<Message[]>;
}
