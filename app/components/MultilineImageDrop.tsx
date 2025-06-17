import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Trash2 } from "lucide-react";
import { cn } from "~/lib/utils"; 
import { Progress } from "~/components/ui/progress";

interface ImageFile {
  file: File;
  id: string;
  imageUrl?: string;
}

interface MediaLine {
  files: ImageFile[];
  progress: number;
  status: "in_form" | "loading" | "success" | "error";
}

export type MultilineValue = Record<string, MediaLine>;

interface MultilineImageDropProps {
  value: MultilineValue;
  onChange: (updater: (prev: MultilineValue) => MultilineValue) => void;
  maxCount?: number;
  allowMultiple?: boolean;
}

export function MultilineImageDrop({ value = {}, onChange, maxCount = 20, allowMultiple = true }: MultilineImageDropProps) {
  const [availableCount, setAvailableCount] = useState(maxCount);

  useEffect(() => {
    let count = 0;
    Object.values(value).forEach((line) => (count += line.files.length));
    setAvailableCount(maxCount - count);
  }, [value, maxCount]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const handleDrop = useCallback((acceptedFiles: File[], key: string | null = null) => {
    const newLines = { ...value };

    acceptedFiles.slice(0, availableCount).forEach((file) => {
      const id = generateId();
      let prefix = key;

      if (!prefix && file.name) {
        const nameParts = file.name.split("_");
        if (nameParts.length > 1) prefix = nameParts[0];
      }

      const imageObj = { file, id };

      if (prefix) {
        if (!newLines[prefix]) {
          newLines[prefix] = { progress: 0, status: "in_form", files: [] };
        }
        newLines[prefix].files.push(imageObj);
      } else {
        newLines[id] = { progress: 0, status: "in_form", files: [imageObj] };
      }
    });

    onChange(() => newLines);
  }, [value, availableCount, onChange]);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleDrop(Array.from(e.target.files));
    }
  };

  const [isDragging, setIsDragging] = useState(false);

const handleDropEvent = (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
  handleDrop(files);
};

const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  setIsDragging(true);
};

const handleDragLeave = () => {
  setIsDragging(false);
};

  return (
    <div>
      <div className="grid gap-4 max-h-[40vh] overflow-y-auto pr-2">
        {Object.entries(value).map(([lineKey, line]) => (
          <MediaLine key={lineKey} lineKey={lineKey} data={line} onChange={onChange} handleDrop={handleDrop} />
        ))}
      </div>
      {availableCount > 0 && (
        
<div
  className={cn(
    "rounded border border-dashed p-4 text-center cursor-pointer transition",
    isDragging ? "bg-muted/30 border-primary" : "bg-muted hover:bg-muted/50"
  )}
  onDrop={handleDropEvent}
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
>
  <input
    type="file"
    accept="image/*"
    multiple={allowMultiple}
    className="hidden"
    id="dropzone-file"
    onChange={onFileInput}
  />
  <label
  htmlFor="dropzone-file"
  className="flex flex-col items-center justify-center gap-2 text-muted-foreground cursor-pointer"
>
  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed">
    <span className="text-2xl">+</span>
  </div>
  <div className="text-sm font-medium text-center">
    Drag & drop or click to upload
  </div>
  <div className="text-xs text-muted-foreground">(remaining {availableCount})</div>
</label>
</div>
      )}
    </div>
  );
}

function MediaLine({ lineKey, data, onChange, handleDrop }: { lineKey: string; data: MediaLine; onChange: MultilineImageDropProps["onChange"]; handleDrop: (files: File[], key?: string) => void }) {
  const deleteLine = () => {
    onChange((prev) => {
      const copy = { ...prev };
      delete copy[lineKey];
      return copy;
    });
  };

  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="relative rounded border p-2">
      <div className="flex gap-4 overflow-x-auto">
        {data.files.map((img) => (
          <ImagePreview key={img.id} image={img} lineKey={lineKey} onChange={onChange} />
        ))}
        {data.files.length < 8 && (
  <div
    className={cn(
      "flex items-center justify-center w-24 h-24 border-2 border-dashed cursor-pointer transition",
      isDragging ? "bg-muted/20 ring-2 ring-primary" : "hover:bg-muted/30"
    )}
    onDrop={(e) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"))
      handleDrop(files, lineKey)
    }}
    onDragOver={(e) => {
      e.preventDefault()
      setIsDragging(true)
    }}
    onDragLeave={() => setIsDragging(false)}
  >
    <label className="w-full h-full flex items-center justify-center cursor-pointer">
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files && handleDrop(Array.from(e.target.files), lineKey)}
      />
      <span className="text-sm">+ Add</span>
    </label>
  </div>
  
)}
      </div>
      {"progress" in data && typeof data.progress === "number" && data.progress > 0 && (
        <Progress value={data.progress} className="h-2 w-full" />
      )}
      <Button size="icon" variant="ghost" className="absolute top-1 right-1" onClick={deleteLine}>
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

function ImagePreview({ image, lineKey, onChange }: { image: ImageFile; lineKey: string; onChange: MultilineImageDropProps["onChange"] }) {
  const ref = useRef<string | null>(null);

  useEffect(() => {
    if (image.file && !image.imageUrl) {
      ref.current = URL.createObjectURL(image.file);
    }
    return () => {
      if (ref.current) URL.revokeObjectURL(ref.current);
    };
  }, [image]);

  const handleDelete = () => {
    onChange((prev) => {
      const copy = { ...prev };
      if (!copy[lineKey]) return prev;
      copy[lineKey].files = copy[lineKey].files.filter((f) => f.id !== image.id);
      if (copy[lineKey].files.length === 0) delete copy[lineKey];
      return copy;
    });
  };

  return (
    <div className="relative w-24 h-24 border rounded overflow-hidden">
      <img src={image.imageUrl ?? ref.current ?? ""} alt="preview" className="w-full h-full object-cover" />
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-1 right-1 bg-white/80"
        onClick={handleDelete}
      >
        <Trash2 className="w-4 h-4 text-red-500" />
      </Button>
    </div>
  );
}
