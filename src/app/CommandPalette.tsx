import { useEffect, useMemo, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useI18n } from "@/core/i18n";
import { tools } from "@/core/registry";
import { useAppStore } from "@/core/store";
import type { Tool, ToolCommand } from "@/core/types";

export function CommandPalette({ onSelectTool }: { onSelectTool: (toolId: string) => void }) {
  const { t } = useI18n();
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
      <CommandInput placeholder={t("app.command.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("app.command.empty")}</CommandEmpty>
        <CommandGroup heading={t("app.command.tools")}>
          {tools.map((tool) => {
            const Icon = tool.icon;
            const toolName = t(tool.nameKey);
            return (
              <CommandItem
                key={tool.id}
                value={`${tool.id} ${toolName} ${t(tool.keywordsKey)}`}
                onSelect={() => choose(tool.id)}
              >
                <Icon className="mr-2 h-4 w-4" strokeWidth={1.75} />
                {toolName}
              </CommandItem>
            );
          })}
        </CommandGroup>
        {commands.length > 0 && (
          <CommandGroup heading={t("app.command.actions")}>
            {commands.map(({ command, tool }) => {
              const toolName = t(tool.nameKey);
              const commandTitle = t(command.titleKey);
              return (
                <CommandItem
                  key={`${tool.id}:${command.id}`}
                  value={`${tool.id} ${toolName} ${commandTitle}`}
                  onSelect={() => runCommand(tool, command)}
                >
                  {toolName}: {commandTitle}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
