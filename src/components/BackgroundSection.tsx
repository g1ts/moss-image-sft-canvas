import { useRef, type ChangeEvent } from "react";
import { useStore } from "../store";

export default function BackgroundSection() {
  const bgInfo = useStore(s => s.bgInfo);
  const setUploadedBg = useStore(s => s.setUploadedBg);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      const st = useStore.getState();
      setUploadedBg(
        img,
        img.naturalWidth + "×" + img.naturalHeight + " → " + st.width + "×" + st.height
      );
    };
    img.src = URL.createObjectURL(f);
  };

  const onClear = () => {
    setUploadedBg(null, "");
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
