import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "~/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "~/components/ui/command";
import { ChevronsUpDown } from "lucide-react";

export interface SingleSelectComboboxProps {
  options: string[];
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
  noempty?: boolean;
  error?: boolean;
  reloadContentByInput?: (text: string) => void;
}

export function SingleSelectCombobox({
  options,
  value,
  onChange,
  placeholder = "Select",
  title,
  disabled = false,
  noempty = false,
  error = false,
  reloadContentByInput,
}: SingleSelectComboboxProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  const displayLabel = value || placeholder;

  useEffect(() => {
    if (reloadContentByInput && input) {
      const timeout = setTimeout(() => reloadContentByInput(input), 300);
      return () => clearTimeout(timeout);
    }
  }, [input, reloadContentByInput]);

  return (
    <div className="space-y-2">
      {title && <label className="block text-sm font-medium text-muted-foreground">{title}</label>}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            disabled={disabled}
            aria-expanded={open}
            className={`w-full justify-between ${error ? "border-red-500" : ""}`}
          >
            {displayLabel}
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Command>
            <CommandInput
              placeholder="Search..."
              value={input}
              onValueChange={setInput}
            />
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {!noempty && (
                <CommandItem onSelect={() => onChange?.("")}>None</CommandItem>
              )}
              {options.map((option) => (
                <CommandItem
                  key={option}
                  onSelect={() => {
                    onChange?.(option);
                    setOpen(false);
                  }}
                >
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
