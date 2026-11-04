import { useEffect, useRef } from "react";
import { useStore } from "../store";

function downloadItem(id: number, img: HTMLImageElement): void {
  const m = img.src.match(/^data:image\/([a-z0-9+.-]+)/i);
  const ext = m && m[1].toLowerCase() !== "svg+xml" ? m![1].toLowerCase() : "png";
  const a = document.createElement("a");
  a.href = img.src;
  a.download = "moss-image-sft-canvas-" + id + "-" + img.naturalWidth + "x" + img.naturalHeight + "." + ext;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function Gallery() {
  const gallery = useStore(s => s.gallery);
  const bgImage = useStore(s => s.bgImage);
  const useAsBg = useStore(s => s.useAsBg);
  const deleteItem = useStore(s => s.deleteGalleryItem);
  const listRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(gallery.length);

  useEffect(() => {
    if (gallery.length > prevCount.current && listRef.current) {
      listRef.current.scrollLeft = 0;
    }
    prevCount.current = gallery.length;
  }, [gallery.length]);

  return (
    <div id="gallery" ref={listRef}>
      {gallery.map(g => (
        <div
          key={g.id}
          className={"g-item" + (bgImage === g.img ? " active" : "")}
          onClick={() => useAsBg(g.id)}
        >
          <img src={g.img.src} alt="" />
          <div className="g-cap">
            {(g.prompt || "image") + "  " + g.img.naturalWidth + "×" + g.img.naturalHeight}
          </div>
          <button
            className="g-del"
            title="Remove from gallery"
            onClick={e => {
              e.stopPropagation();
              deleteItem(g.id);
            }}
          >
            ✕
          </button>
          <button
            className="g-dl"
            title="Download image"
            onClick={e => {
              e.stopPropagation();
              downloadItem(g.id, g.img);
            }}
          >
            ⬇
          </button>
        </div>
      ))}
    </div>
  );
}
