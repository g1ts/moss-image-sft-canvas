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
}

export interface LayoutSummary {
  meta: string[];
  canvas: string;
  caption: string;
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
