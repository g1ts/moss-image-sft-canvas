import { useRef, type ChangeEvent } from "react";
import { useStore, activeScene } from "../store";

export default function BackgroundSection() {
  const bgInfo = useStore(activeScene).bgInfo;
  const setUploadedBg = useStore(s => s.setUploadedBg);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onload = () => {
        const sc = activeScene(useStore.getState());
        setUploadedBg(
          img,
          img.naturalWidth + "×" + img.naturalHeight + " → " + sc.width + "×" + sc.height,
          dataUrl
        );
      };
      img.onerror = () => setUploadedBg(null, "", null);
      img.src = dataUrl;
    };
    reader.onerror = () => setUploadedBg(null, "", null);
    reader.readAsDataURL(f);
  };

  const onClear = () => {
    setUploadedBg(null, "", null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="cs-section">
      <h2>Background</h2>
      <div className="row">
        <input type="file" id="bgFile" accept="image/*" hidden ref={fileRef} onChange={onFile} />
        <button id="btnBgLoad" onClick={() => fileRef.current?.click()}>
          Upload image
        </button>
        <button id="btnBgClear" className="danger" onClick={onClear}>
          Remove
        </button>
      </div>
      <div className="row">
        <span id="bgInfo">{bgInfo}</span>
      </div>
    </div>
  );
}
