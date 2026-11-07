export interface Note {
  id: string;
  title: string;
  preview: string;
  contentJson: string;
  plainText: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface NoteSummary {
  id: string;
  title: string;
  preview: string;
  pinned: boolean;
  updatedAt: number;
}
