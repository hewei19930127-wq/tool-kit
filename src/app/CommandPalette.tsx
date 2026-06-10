import { useMemo } from "react";
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

export function CommandPalette({
  open,
  onOpenChange,
  onSelectTool,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTool: (toolId: string) => void;
}) {
  const { t } = useI18n();
  const commands = useMemo(
    () => tools.flatMap((tool) => (tool.commands ?? []).map((command) => ({ command, tool }))),
    [],
  );

  const choose = (toolId: string) => {
    onSelectTool(toolId);
    onOpenChange(false);
  };

  const runCommand = (tool: Tool, command: ToolCommand) => {
    onSelectTool(tool.id);
    const store = useAppStore.getState();
    command.run({
      input: store.toolInputs[tool.id] ?? "",
      setInput: (text: string) => store.setToolInput(tool.id, text),
    });
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
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
