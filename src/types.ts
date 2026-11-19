export interface Box {
  id: number;
  label: string;
  caption: string;
  text: string;
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
  color: string;
  z: number;
  hidden: boolean;
  locked: boolean;
}

export interface LayoutSummary {
  meta: string[];
  canvas: string;
  caption: string;
}

// A scene is one canvas document: its own size, boxes and prompt data.
// All fields are JSON-serializable so the whole set can be persisted and exported.
export interface Scene {
  id: number;
  name: string;
  width: number;
  height: number;
  boxes: Box[];
  metaText: string;
  canvasType: string;
  sceneCaption: string;
  negPrompt: string;
  bgDataUrl: string | null;
  uploadedBgDataUrl: string | null;
  bgInfo: string;
  uploadedBgInfo: string;
}

export interface GenItemLora {
  path: string;
  mult: number;
}

export interface GenItemParams {
  server: string;
  negativePrompt: string;
  width: number;
  height: number;
  count: number;
  steps: number;
  cfg: number;
  seed: number;
  clipSkip: number;
  scheduler: string;
  method: string;
  loras: GenItemLora[];
  format: string;
  createdAt: number;
}

export interface GalleryItem {
  id: number;
  img: HTMLImageElement;
  prompt: string;
  params: GenItemParams;
}
