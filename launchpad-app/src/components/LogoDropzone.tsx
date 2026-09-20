"use client";

import { type DragEvent, useRef, useState } from "react";
import { logoError } from "@/lib/uploads";

export function LogoDropzone({ value, onChange }: { value: string; onChange: (imageUrl: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string>();

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const invalid = logoError(file);
    if (invalid) return setError(invalid);

    setError(undefined);
    setIsUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      onChange(result.logoUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setIsDraggingOver(false);
    upload(event.dataTransfer.files[0]);
  };

  return (
    <div className="flex w-full flex-col gap-2 sm:w-36">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={drop}
        className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed text-xs text-muted transition ${
          isDraggingOver ? "border-brand bg-brand/10" : "border-line bg-ink hover:border-brand/60"
        }`}
      >
        {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : isUploading ? "Uploading…" : "Logo"}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          upload(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
      {value && !error && (
        <button type="button" className="text-xs text-muted underline hover:text-white" onClick={() => onChange("")}>
          Remove
        </button>
      )}
    </div>
  );
}
