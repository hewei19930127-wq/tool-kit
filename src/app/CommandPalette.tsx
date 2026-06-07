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
import type { Tool, ToolCommand } from "@/core/types";

export function CommandPalette({ onSelectTool }: { onSelectTool: (toolId: string) => void }) {
  const [open, setOpen] = useState(false);
  const commands = useMemo(
    () => tools.flatMap((tool) => (tool.commands ?? []).map((command) => ({ command, tool }))),
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
    onSelectTool(toolId);
    setOpen(false);
  };

  const runCommand = (tool: Tool, command: ToolCommand) => {
    onSelectTool(tool.id);
    const store = useAppStore.getState();
    command.run({
      input: store.toolInputs[tool.id] ?? "",
      setInput: (text: string) => store.setToolInput(tool.id, text),
    });
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
                onSelect={() => runCommand(tool, command)}
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
