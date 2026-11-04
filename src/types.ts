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

export interface GalleryItem {
  id: number;
  img: HTMLImageElement;
  prompt: string;
}
