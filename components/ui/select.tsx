"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Base UI no es Radix: su <Select.Value> muestra el VALOR CRUDO salvo que
// <Select.Root> reciba `items` para resolver la etiqueta. Como este wrapper se
// portó con la API de Radix (donde Value toma el texto del Item seleccionado),
// todos los selects con valor inicial mostraban el valor de máquina: la
// calculadora decía "obra_nueva" en vez de "Obra nueva", y los filtros de
// Proyectos decían "todos" en vez de "Todos los estados".
//
// En vez de tocar los 24 archivos que usan Select, el wrapper deriva `items`
// de los <SelectItem> que ya recibe como hijos. Así la API se comporta como
// los llamadores ya asumen, y el arreglo cubre el código futuro.
// ---------------------------------------------------------------------------

type ItemDerivado = { label: React.ReactNode; value: unknown }

function recolectarItems(node: React.ReactNode, acc: ItemDerivado[]): void {
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return
    const props = child.props as { value?: unknown; children?: React.ReactNode }
    if (child.type === SelectItem) {
      acc.push({ value: props.value, label: props.children })
      return
    }
    if (props.children) recolectarItems(props.children, acc)
  })
}

function Select<Value>({ children, items, ...props }: SelectPrimitive.Root.Props<Value>) {
  const derivados = React.useMemo(() => {
    if (items) return items // un `items` explícito siempre manda
    const acc: ItemDerivado[] = []
    recolectarItems(children, acc)
    return acc.length > 0 ? acc : undefined
  }, [items, children])

  return (
    <SelectPrimitive.Root
      data-slot="select"
      items={derivados as SelectPrimitive.Root.Props<Value>["items"]}
      {...props}
    >
      {children}
    </SelectPrimitive.Root>
  )
}

function SelectGroup(props: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue(props: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors outline-none data-[placeholder]:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="text-muted-foreground">
        <ChevronDown className="size-4" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  ...props
}: SelectPrimitive.Popup.Props) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner sideOffset={6} className="z-50 outline-none">
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "max-h-72 min-w-[var(--anchor-width)] overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none",
            className
          )}
          {...props}
        >
          {children}
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-3 text-sm outline-none select-none data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center">
        <Check className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-3 py-1.5 text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
}
