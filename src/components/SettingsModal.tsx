import GenerationSection from "./GenerationSection";

export default function SettingsModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className={"modal-backdrop" + (open ? "" : " hidden")}
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal wide" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <GenerationSection open={open} />
        </div>
      </div>
    </div>
  );
}
