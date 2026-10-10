import { useEffect, useState } from "react";
import { FileText, RefreshCw, Trash2 } from "lucide-react";
import { TextModal } from "@/components/TextModal";
import { deleteDocument, getDocument, listDocuments, type DocumentSummary } from "@/lib/api";

export function HistoryPage() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [actionId, setActionId] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setDocuments(await listDocuments());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load history");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const view = async (item: DocumentSummary) => {
    setActionId(item.id);
    try {
      const document = await getDocument(item.id);
      setText(document.text);
      setTitle(item.filename);
      setModalOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load document");
    } finally {
      setActionId("");
    }
  };
  const remove = async (item: DocumentSummary) => {
    if (!window.confirm(`Delete ${item.filename}?`)) return;
    setActionId(item.id);
    try {
      await deleteDocument(item.id);
      setDocuments((current) => current.filter((entry) => entry.id !== item.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete document");
    } finally {
      setActionId("");
    }
  };
  return (
    <main className="min-w-0 flex-1 space-y-4">
      <header className="glass px-5 py-3">
        <h1 className="text-lg font-semibold">Extraction history</h1>
        <p className="text-sm text-faint">Your recent extracted documents</p>
      </header>
      <section className="glass p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Documents</h2>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className="size-4" /> Retry
          </button>
        </div>
        {loading ? (
          <div className="space-y-3" aria-label="Loading history">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="history-skeleton" />
            ))}
          </div>
        ) : error ? (
          <div className="empty-state">
            <p className="text-rose">{error}</p>
            <button type="button" onClick={() => void load()} className="secondary-button">
              Retry
            </button>
          </div>
        ) : documents.length === 0 ? (
          <div className="empty-state">
            <FileText className="mx-auto mb-3 size-7 text-faint" />
            No extractions yet. Upload a CV in Workspace to begin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Pages</th>
                  <th>Date</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((item) => (
                  <tr key={item.id}>
                    <td className="text-heading">{item.filename}</td>
                    <td>{item.page_count}</td>
                    <td>{new Date(item.created_at).toLocaleString()}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => void view(item)}
                          disabled={actionId === item.id}
                        >
                          <FileText className="size-4" /> View text
                        </button>
                        <button
                          type="button"
                          className="icon-button text-rose"
                          onClick={() => void remove(item)}
                          disabled={actionId === item.id}
                          aria-label={`Delete ${item.filename}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <TextModal open={modalOpen} title={title} text={text} onClose={() => setModalOpen(false)} />
    </main>
  );
}
