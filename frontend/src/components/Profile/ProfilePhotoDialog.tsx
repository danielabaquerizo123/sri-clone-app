import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";

type ProfilePhotoDialogProps = {
  open: boolean;
  currentPhotoUrl?: string | null;
  nombreUsuario: string;
  loading: boolean;
  error?: string;
  onClose: () => void;
  onSave: (file: File) => Promise<void>;
};

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];
const maxSizeBytes = 2 * 1024 * 1024;

export default function ProfilePhotoDialog({
  open,
  currentPhotoUrl,
  nombreUsuario,
  loading,
  error,
  onClose,
  onSave,
}: ProfilePhotoDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [localError, setLocalError] = useState("");
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    cancelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, onClose, open]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setLocalError("");
    }
  }, [open]);

  if (!open) return null;

  const chooseFile = (file?: File) => {
    setLocalError("");

    if (!file) return;

    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

    if (!allowedTypes.has(file.type) || !allowedExtensions.includes(extension)) {
      setLocalError("Use una imagen JPG, PNG o WEBP.");
      return;
    }

    if (file.size === 0) {
      setLocalError("Seleccione una imagen válida.");
      return;
    }

    if (file.size > maxSizeBytes) {
      setLocalError("La imagen no puede superar 2 MB.");
      return;
    }

    setSelectedFile(file);
  };

  const handleSave = async () => {
    if (!selectedFile) {
      setLocalError("Seleccione una imagen antes de guardar.");
      return;
    }

    try {
      await onSave(selectedFile);
    } catch {
      // El componente padre ya publica el error junto al diálogo.
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-photo-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="profile-photo-title" className="text-lg font-black text-[#003565]">
              Foto de perfil
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              JPG, PNG o WEBP hasta 2 MB.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 flex flex-col items-center gap-4">
          <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border-4 border-blue-50 bg-slate-100">
            {previewUrl || currentPhotoUrl ? (
              <img
                src={previewUrl || currentPhotoUrl || ""}
                alt={`Foto de ${nombreUsuario}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <Camera size={44} className="text-slate-400" />
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2 text-sm font-black text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          >
            <ImagePlus size={16} />
            {selectedFile ? "Elegir otra imagen" : "Seleccionar imagen"}
          </button>

          {(localError || error) && (
            <p className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
              {localError || error}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || !selectedFile}
            className="inline-flex items-center gap-2 rounded-xl bg-[#003565] px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-[#00284d] disabled:opacity-50"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
