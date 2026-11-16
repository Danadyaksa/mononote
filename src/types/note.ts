export interface Note {
  id: string;
  title: string;
  preview: string;
  contentJson: string;
  plainText: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  filePath?: string;
}

export interface NoteSummary {
  id: string;
  title: string;
  preview: string;
  pinned: boolean;
  updatedAt: number;
  isExternal?: boolean;
}

export interface MarkdownFileData {
  path: string;
  filename: string;
  content: string;
}
