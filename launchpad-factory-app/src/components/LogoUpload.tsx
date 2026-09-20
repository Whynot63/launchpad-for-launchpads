"use client";

import { type DragEvent, useRef, useState } from "react";
import { logoError } from "@/lib/uploads";

export function LogoUpload({ value, onChange }: { value: string; onChange: (logoUrl: string) => void }) {
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
    <div className="flex flex-col gap-2 text-sm">
      <span className="font-medium">Logo</span>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={drop}
        className={`flex h-28 items-center gap-4 rounded-xl border border-dashed px-4 text-left transition ${
          isDraggingOver ? "border-brand bg-brand/10" : "border-line bg-ink hover:border-brand/60"
        }`}
      >
        {value && <img src={value} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />}
        <span className="text-muted">
          {isUploading ? "Uploading…" : value ? "Drop another image or click to replace" : "Drop an image here or click to choose"}
        </span>
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
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : (
        <span className="text-xs text-muted">
          Optional. PNG, JPEG, WebP, or GIF up to 1 MB.{" "}
          {value && (
            <button type="button" className="underline hover:text-white" onClick={() => onChange("")}>
              Remove
            </button>
          )}
        </span>
      )}
    </div>
  );
}
