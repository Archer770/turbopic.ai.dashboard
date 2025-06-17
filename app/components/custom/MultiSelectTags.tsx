import { useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { X, ChevronsUpDown } from "lucide-react";

export interface MultiSelectTagsProps {
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MultiSelectTags({ options, values, onChange, disabled = false, placeholder = "Add tags" }: MultiSelectTagsProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const availableOptions = options.filter((opt) => !values.includes(opt) && opt.toLowerCase().includes(search.toLowerCase()));

  const addTag = (tag: string) => {
    if (!values.includes(tag)) {
      onChange([...values, tag]);
    }
    setSearch("");
    setOpen(false);
  };

  const removeTag = (tag: string) => {
    onChange(values.filter((t) => t !== tag));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {values.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground"
          >
            {tag}
            {!disabled && (
              <button onClick={() => removeTag(tag)} className="ml-2 hover:text-destructive">
                <X size={14} />
              </button>
            )}
          </span>
        ))}
      </div>

      {!disabled && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              {placeholder}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0">
            <Command>
              <CommandInput placeholder="Search tags..." value={search} onValueChange={setSearch} />
              <CommandEmpty>No tags found.</CommandEmpty>
              <CommandGroup>
                {availableOptions.map((tag) => (
                  <CommandItem key={tag} value={tag} onSelect={() => addTag(tag)}>
                    {tag}
                  </CommandItem>
                ))}
                {search && !options.includes(search) && !values.includes(search) && (
                  <CommandItem onSelect={() => addTag(search)} className="italic text-muted-foreground">
                    + Add "{search}"
                  </CommandItem>
                )}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
