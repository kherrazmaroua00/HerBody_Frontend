export type ChatMessage = {
  id: string;
  role: "user" | "organ";
  text: string;
  organId: import("./organ").OrganId;
  sources?: { title: string; url?: string }[];
  status?: "sending" | "error";
};

export type ConversationSummary = {
  id: number;
  organId: import("./organ").OrganId | null;
  title: string;
  updatedAt?: string;
};
