import { useEffect, useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "~/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandEmpty,
} from "~/components/ui/command";
import { X, ChevronsUpDown } from "lucide-react";

export interface Option {
  label: string;
  value: string;
}

interface MultiSelectComboboxProps {
  title?: string;
  placeholder?: string;
  options: Option[];
  value: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}

export function MultiSelectCombobox({
  title,
  placeholder = "Select",
  options,
  value,
  onChange,
  disabled = false,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedOptions = useMemo(() =>
    options.filter((opt) => value.includes(opt.value)),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    return options.filter(
      (opt) => !value.includes(opt.value) && regex.test(opt.label)
    );
  }, [options, value, search]);

  const addValue = (val: string) => {
    if (!value.includes(val)) {
      onChange([...value, val]);
    }
    setSearch("");
  };

  const removeValue = (val: string) => {
    onChange(value.filter((v) => v !== val));
  };

  return (
    <div className="space-y-2">
      {title && <label className="block text-sm font-medium text-muted-foreground">{title}</label>}

      <div className="flex flex-wrap gap-2">
        {selectedOptions.map((opt) => (
          <span
            key={opt.value}
            className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground"
          >
            {opt.label}
            <button
              onClick={() => removeValue(opt.value)}
              className="ml-2 hover:text-destructive"
            >
              <X size={14} />
            </button>
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
              <CommandInput
                placeholder="Search..."
                value={search}
                onValueChange={setSearch}
              />
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((opt) => (
                  <CommandItem key={opt.value} onSelect={() => addValue(opt.value)}>
                    {opt.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
