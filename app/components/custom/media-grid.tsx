import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Trash2, Eye, Plus } from "lucide-react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

export type ImageItem = {
  id: string;
  imageUrl?: string;
  file?: File;
};

interface MediaGridProps {
  imageUrls?: ImageItem[];
  onChange?: (images: ImageItem[]) => void;
  disabled?: boolean;
  max?: number;
  bigfirst?: boolean;
}

export function MediaGrid({ imageUrls = [], onChange, disabled = false, max = 10, bigfirst = false }: MediaGridProps) {
  const [images, setImages] = useState<ImageItem[]>(imageUrls);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    onChange?.(images);
  }, [images]);

  useEffect(() => {
    setImages(imageUrls);
  }, [imageUrls]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;

    const newImages: ImageItem[] = files.map((file) => ({ file, id: generateId() }));
    setImages((prev) => [...prev, ...newImages].slice(0, max));
  }, [max]);

  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages: ImageItem[] = files.map((file) => ({ file, id: generateId() }));
    setImages((prev) => [...prev, ...newImages].slice(0, max));
  };

  const handleDelete = (index: number) => {
    setImages((prev) => [...prev.slice(0, index), ...prev.slice(index + 1)]);
  };

  const handleOpenLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {images.map((image, i) => (
        <div
          key={image.id || i}
          className={`relative group aspect-square overflow-hidden rounded border bg-muted ${
            i === 0 && bigfirst ? "col-span-2 row-span-2" : ""
          }`}
        >
          <img
            src={image.imageUrl || (image.file && URL.createObjectURL(image.file))}
            alt="preview"
            className="object-cover w-full h-full"
            onClick={() => handleOpenLightbox(i)}
          />

          {!disabled && (
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-between p-1">
              <Button size="icon" variant="ghost" className="text-white" onClick={() => handleDelete(i)}>
                <Trash2 size={18} />
              </Button>
              <Button size="icon" variant="ghost" className="text-white" onClick={() => handleOpenLightbox(i)}>
                <Eye size={18} />
              </Button>
            </div>
          )}
        </div>
      ))}

      {!disabled && images.length < max && (
        <div
          onClick={openFileDialog}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex items-center justify-center aspect-square cursor-pointer border-2 border-dashed rounded bg-muted hover:bg-muted/50"
        >
          <Plus size={24} className="text-muted-foreground" />
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleSelectFiles}
            ref={fileInputRef}
            className="hidden"
          />
        </div>
      )}

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={images.map((img) => ({
          src: img.imageUrl || (img.file && URL.createObjectURL(img.file)) || "",
        }))}
      />
    </div>
  );
}

const generateId = () => Math.random().toString(36).slice(2);
