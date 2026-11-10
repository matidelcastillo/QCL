export type BookStatus = "quiero" | "lei";

export type Book = {
  id: string;
  owner_id: string;
  title: string;
  author: string;
  status: BookStatus;
  read_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};
