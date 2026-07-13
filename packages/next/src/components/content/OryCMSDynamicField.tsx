"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OryCMSSchemaField } from "@/schema";

interface OryCMSDynamicFieldProps {
  field: OryCMSSchemaField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
}

function FieldWrapper({
  field,
  error,
  children,
}: {
  field: OryCMSSchemaField;
  error?: string;
  children: React.ReactNode;
}) {
  const label = field.label ?? field.name;
  const isBoolean = field.type === "boolean";

  return (
    <div className="space-y-1.5">
      {isBoolean ? (
        <div className="flex items-center gap-3">
          {children}
          <Label htmlFor={field.name} className="cursor-pointer">
            {label}
            {field.required && <span className="ml-1 text-destructive">*</span>}
          </Label>
        </div>
      ) : (
        <>
          <Label htmlFor={field.name}>
            {label}
            {field.required && <span className="ml-1 text-destructive">*</span>}
          </Label>
          {field.description && (
            <p className="text-[11.5px] text-muted-foreground">{field.description}</p>
          )}
          {children}
        </>
      )}
      {error && <p className="text-[11.5px] text-destructive">{error}</p>}
    </div>
  );
}

export function OryCMSDynamicField({
  field,
  value,
  onChange,
  error,
  disabled,
}: OryCMSDynamicFieldProps) {
  const strVal = value == null ? "" : String(value);
  const inputClass = cn("h-9", error && "border-destructive focus-visible:ring-destructive");

  return (
    <FieldWrapper field={field} error={error}>
      {(() => {
        switch (field.type) {
          case "text":
          case "email":
            return (
              <Input
                id={field.name}
                type={field.type === "email" ? "email" : "text"}
                value={strVal}
                onChange={(e) => onChange(e.target.value)}
                placeholder={field.type === "text" ? (field.placeholder ?? "") : "you@example.com"}
                className={inputClass}
                disabled={disabled}
              />
            );

          case "password":
            return (
              <Input
                id={field.name}
                type="password"
                value={strVal}
                onChange={(e) => onChange(e.target.value)}
                placeholder="••••••••"
                className={inputClass}
                disabled={disabled}
              />
            );

          case "slug":
            return (
              <Input
                id={field.name}
                type="text"
                value={strVal}
                onChange={(e) =>
                  onChange(
                    e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, "-")
                      .replace(/[^a-z0-9-]/g, ""),
                  )
                }
                placeholder="my-slug"
                className={cn(inputClass, "font-mono text-[13px]")}
                disabled={disabled}
              />
            );

          case "number":
            return (
              <Input
                id={field.name}
                type="number"
                value={strVal}
                onChange={(e) =>
                  onChange(
                    e.target.value === ""
                      ? null
                      : field.integer
                        ? parseInt(e.target.value, 10)
                        : parseFloat(e.target.value),
                  )
                }
                step={field.integer ? 1 : "any"}
                min={field.min}
                max={field.max}
                className={inputClass}
                disabled={disabled}
              />
            );

          case "date":
            return (
              <Input
                id={field.name}
                type={field.includeTime ? "datetime-local" : "date"}
                value={strVal}
                onChange={(e) => onChange(e.target.value || null)}
                className={inputClass}
                disabled={disabled}
              />
            );

          case "textarea":
            return (
              <Textarea
                id={field.name}
                value={strVal}
                onChange={(e) => onChange(e.target.value)}
                rows={field.rows ?? 4}
                className={cn(error && "border-destructive")}
                disabled={disabled}
              />
            );

          case "richText":
            return (
              <div
                className={cn(
                  "rounded-md border border-input bg-surface-muted/40 px-3 py-2.5 text-[12.5px] text-muted-foreground",
                  error && "border-destructive",
                )}
              >
                <p className="font-medium text-foreground/70">Rich text editor</p>
                <p className="mt-0.5 text-[11.5px]">
                  Full editor coming in a future release. Using plain textarea for now.
                </p>
                <Textarea
                  id={field.name}
                  value={strVal}
                  onChange={(e) => onChange(e.target.value)}
                  rows={5}
                  className="mt-2 bg-background"
                  disabled={disabled}
                />
              </div>
            );

          case "boolean":
            return (
              <Switch
                id={field.name}
                checked={Boolean(value)}
                onCheckedChange={(checked) => onChange(checked)}
                disabled={disabled}
              />
            );

          case "select":
            if (field.multiple) {
              // Multi-select: render checkboxes
              const currentArr: string[] = Array.isArray(value) ? (value as string[]) : [];
              return (
                <div className="space-y-2 rounded-md border border-input bg-transparent p-3">
                  {field.options.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex cursor-pointer items-center gap-2.5 text-[13px]"
                    >
                      <input
                        type="checkbox"
                        checked={currentArr.includes(opt.value)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...currentArr, opt.value]
                            : currentArr.filter((v) => v !== opt.value);
                          onChange(next);
                        }}
                        disabled={disabled}
                        className="h-4 w-4 rounded border border-input"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              );
            }
            return (
              <Select value={strVal} onValueChange={(v) => onChange(v)} disabled={disabled}>
                <SelectTrigger id={field.name} className={cn("h-9", error && "border-destructive")}>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );

          case "json":
            return (
              <Textarea
                id={field.name}
                value={
                  value == null
                    ? ""
                    : typeof value === "string"
                      ? value
                      : JSON.stringify(value, null, 2)
                }
                onChange={(e) => {
                  try {
                    onChange(JSON.parse(e.target.value));
                  } catch {
                    onChange(e.target.value); // keep raw string while editing
                  }
                }}
                rows={6}
                className={cn("font-mono text-[12px]", error && "border-destructive")}
                placeholder='{"key": "value"}'
                disabled={disabled}
              />
            );

          case "relation":
            return (
              <div className="rounded-md border border-dashed border-input bg-surface-muted/40 px-3 py-3 text-[12.5px] text-muted-foreground">
                <span className="font-medium text-foreground/70">Relation → {field.target}</span>
                <p className="mt-0.5 text-[11.5px]">
                  Relation picker coming in a future release. Enter UUID directly.
                </p>
                <Input
                  id={field.name}
                  value={strVal}
                  onChange={(e) => onChange(e.target.value || null)}
                  placeholder="UUID of related record"
                  className={cn("mt-2 h-9 font-mono text-[12px]", error && "border-destructive")}
                  disabled={disabled}
                />
              </div>
            );

          case "media":
            return (
              <div className="rounded-md border border-dashed border-input bg-surface-muted/40 px-3 py-3 text-[12.5px] text-muted-foreground">
                <span className="font-medium text-foreground/70">Media field</span>
                <p className="mt-0.5 text-[11.5px]">
                  Media picker coming in a future release. Enter media UUID directly.
                </p>
                <Input
                  id={field.name}
                  value={strVal}
                  onChange={(e) => onChange(e.target.value || null)}
                  placeholder="Media UUID"
                  className={cn("mt-2 h-9 font-mono text-[12px]", error && "border-destructive")}
                  disabled={disabled}
                />
              </div>
            );
        }
      })()}
    </FieldWrapper>
  );
}
