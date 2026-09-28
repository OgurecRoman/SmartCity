export type FeedAuthor = {
  id: number;
  name: string;
  role: string;
};

export type AnnouncementItem = {
  id: number;
  houseId: number;
  houseAddress: string;
  title: string;
  description: string;
  author: FeedAuthor;
  photoUrls: string[];
  createdAt: string;
  updatedAt: string;
};

export type NewsItem = {
  id: number;
  houseId: number;
  houseAddress: string;
  title: string;
  description: string;
  contact: string;
  author: FeedAuthor;
  photoUrls: string[];
  isMine?: boolean;
  createdAt: string;
  updatedAt: string;
};
