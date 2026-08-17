import { MediaItem } from "@/stores/media.store";

const SVG_BG_1 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450' viewBox='0 0 800 450'><defs><linearGradient id='g1' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%231e1b4b'/><stop offset='100%' stop-color='%234338ca'/></linearGradient></defs><rect width='800' height='450' fill='url(%23g1)'/></svg>";
const SVG_BG_2 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450' viewBox='0 0 800 450'><defs><linearGradient id='g2' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%23064e3b'/><stop offset='100%' stop-color='%23059669'/></linearGradient></defs><rect width='800' height='450' fill='url(%23g2)'/></svg>";
const SVG_BG_4 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450' viewBox='0 0 800 450'><defs><linearGradient id='g4' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%231e293b'/><stop offset='100%' stop-color='%23334155'/></linearGradient></defs><rect width='800' height='450' fill='url(%23g4)'/></svg>";

export const MOCK_MEDIA: MediaItem[] = [
  {
    id: "m1",
    filename: "Spoken_English_Pronunciation_Lecture1.mp4",
    type: "video",
    thumbnail: SVG_BG_1,
    size: 450 * 1024 * 1024, // 450MB
    duration: "45:20",
    resolution: "1080p",
    createdAt: "2 hours ago",
    status: "Ready",
    visibility: "Public",
    usageCount: 2,
  },
  {
    id: "m2",
    filename: "Vowel_Modulation_Speech_Drill.mp4",
    type: "video",
    thumbnail: SVG_BG_2,
    size: 1.2 * 1024 * 1024 * 1024, // 1.2GB
    duration: "01:15:30",
    resolution: "4K",
    createdAt: "Yesterday",
    status: "Processing",
    visibility: "Private",
    usageCount: 0,
  },
  {
    id: "m3",
    filename: "IELTS_Speaking_Band8_Cheatsheet.pdf",
    type: "pdf",
    size: 2.4 * 1024 * 1024, // 2.4MB
    pages: 12,
    createdAt: "3 days ago",
    status: "Ready",
    visibility: "Public",
    usageCount: 5,
  },
  {
    id: "m4",
    filename: "English_Batch_Cover_V2.png",
    type: "image",
    thumbnail: SVG_BG_4,
    size: 4.8 * 1024 * 1024, // 4.8MB
    resolution: "1920x1080",
    createdAt: "Last week",
    status: "Ready",
    visibility: "Public",
    usageCount: 1,
  },
  {
    id: "m5",
    filename: "Corrupted_Audio_Upload.mp4",
    type: "video",
    size: 15 * 1024 * 1024, // 15MB
    createdAt: "Last month",
    status: "Failed",
    visibility: "Private",
    usageCount: 0,
  },
];
