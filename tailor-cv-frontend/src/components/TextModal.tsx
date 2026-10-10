import { Copy, Download, X } from "lucide-react";

export function TextModal({
  open,
  title,
  text,
  onClose,
}: {
  open: boolean;
  title: string;
  text: string;
  onClose: () => void;
}) {
  if (!open) return null;
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "extracted-cv.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="glass modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="text-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="text-modal-title" className="font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close extracted text"
            className="icon-button"
          >
            <X className="size-4" />
          </button>
        </div>
        <pre className="modal-text">{text}</pre>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(text)}
            className="secondary-button"
          >
            <Copy className="size-4" /> Copy
          </button>
          <button type="button" onClick={download} className="secondary-button">
            <Download className="size-4" /> Download .txt
          </button>
        </div>
      </section>
    </div>
  );
}
