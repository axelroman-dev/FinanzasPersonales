import { useState } from "react";

/**
 * Key que cambia cada vez que un diálogo se abre. Se pone en el componente del
 * formulario para que se monte de nuevo: empieza limpio al crear y con los
 * datos actuales al editar, en lugar de conservar lo que quedó la vez anterior.
 */
export function useFormResetKey(open: boolean): number {
  const [key, setKey] = useState(0);
  const [prevOpen, setPrevOpen] = useState(open);
  // Ajuste de estado durante el render (patrón recomendado por React), así el
  // formulario nuevo aparece desde el primer frame sin parpadeo
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setKey((k) => k + 1);
  }
  return key;
}
