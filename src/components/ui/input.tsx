"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Qué acepta un campo numérico además de dígitos: el punto solo si admite
 * decimales (step no entero) y el signo solo si admite negativos (sin min o
 * con min negativo). Así no se pueden escribir letras, "e", comas, etc.
 */
function numberRules({ step, min }: Pick<InputProps, "step" | "min">) {
  const decimals =
    step === "any" || (step !== undefined && !Number.isInteger(Number(step)));
  const negatives = min === undefined || min === "" || Number(min) < 0;
  const pattern = new RegExp(
    `^${negatives ? "-?" : ""}\\d*${decimals ? "(\\.\\d*)?" : ""}$`,
  );
  return { decimals, negatives, pattern };
}

/** Si la tecla puede escribirse en el campo numérico tal como está */
function acceptsKey(
  key: string,
  input: HTMLInputElement,
  { decimals, negatives }: ReturnType<typeof numberRules>,
  dotPending: boolean,
): boolean {
  if (/^\d$/.test(key)) return true;
  // badInput: hay texto que aún no es un número (p. ej. "-" a medias)
  const empty = input.value === "" && !input.validity.badInput;
  if (key === "-") return negatives && empty;
  // dotPending: Firefox reporta "12" mientras se escribe "12.", así que el
  // punto recién tecleado aún no aparece en el valor
  if (key === ".") {
    return (
      decimals &&
      !dotPending &&
      !input.value.includes(".") &&
      !input.validity.badInput
    );
  }
  return false;
}

/**
 * Texto pegado como número: sin espacios ni "$", y sin las comas de miles
 * ("$1,500.00" → "1500.00"). Otras comas se dejan, así "12,50" no se toma
 * por 1250 y se rechaza.
 */
function normalizePasted(text: string): string {
  const clean = text.replace(/[\s$]/g, "");
  return /^-?\d{1,3}(,\d{3})+(\.\d*)?$/.test(clean)
    ? clean.replace(/,/g, "")
    : clean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onKeyDown, onInput, onPaste, onDrop, ...props }, ref) => {
    const rules = type === "number" ? numberRules(props) : null;
    const dotPending = React.useRef(false);

    return (
      <input
        type={type}
        // Teclado numérico en móvil
        inputMode={rules ? (rules.decimals ? "decimal" : "numeric") : undefined}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          // Sin las flechas del navegador para subir/bajar el número
          rules &&
            "[appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none",
          className,
        )}
        ref={ref}
        onKeyDown={(e) => {
          if (rules && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (e.key.length !== 1) {
              // Borrar o mover el cursor: el punto pendiente pudo desaparecer
              dotPending.current = false;
            } else if (
              !acceptsKey(e.key, e.currentTarget, rules, dotPending.current)
            ) {
              e.preventDefault();
            } else if (e.key === ".") {
              dotPending.current = true;
            }
          }
          onKeyDown?.(e);
        }}
        onInput={(e) => {
          // Ya se ve el punto, o el campo quedó vacío: nada pendiente
          const input = e.currentTarget;
          if (
            input.value.includes(".") ||
            (input.value === "" && !input.validity.badInput)
          ) {
            dotPending.current = false;
          }
          onInput?.(e);
        }}
        onPaste={(e) => {
          const text = e.clipboardData?.getData("text");
          if (rules && text !== undefined) {
            const number = normalizePasted(text);
            if (!rules.pattern.test(number)) {
              e.preventDefault();
            } else if (number !== text) {
              // Pegar la versión limpia en lugar del texto original
              e.preventDefault();
              document.execCommand("insertText", false, number);
            }
          }
          onPaste?.(e);
        }}
        onDrop={(e) => {
          const text = e.dataTransfer?.getData("text");
          if (
            rules &&
            text !== undefined &&
            !rules.pattern.test(normalizePasted(text))
          ) {
            e.preventDefault();
          }
          onDrop?.(e);
        }}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
