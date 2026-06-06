import { useEffect, useMemo, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { tools } from "@/core/registry";
import { useAppStore } from "@/core/store";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const commands = useMemo(
    () =>
      tools.flatMap((tool) =>
        (tool.commands ?? []).map((command) => ({ command, tool })),
      ),
    [],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const choose = (toolId: string) => {
    setActiveTool(toolId);
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search tools and actions..." />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Tools">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <CommandItem
                key={tool.id}
                value={`${tool.name} ${tool.keywords.join(" ")}`}
                onSelect={() => choose(tool.id)}
              >
                <Icon className="mr-2 h-4 w-4" strokeWidth={1.75} />
                {tool.name}
              </CommandItem>
            );
          })}
        </CommandGroup>
        {commands.length > 0 && (
          <CommandGroup heading="Actions">
            {commands.map(({ command, tool }) => (
              <CommandItem
                key={`${tool.id}:${command.id}`}
                value={`${tool.name} ${command.title}`}
                onSelect={() => choose(tool.id)}
              >
                {tool.name}: {command.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
