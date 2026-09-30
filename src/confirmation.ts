import Swal from 'sweetalert2/dist/sweetalert2.esm.js';
import 'sweetalert2/dist/sweetalert2.min.css';

export type ConfirmationOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
};

/** Shared confirmation only: timers and editable proposals retain their own UI. */
export async function confirmAction({
  title,
  message,
  confirmLabel,
  destructive = false,
}: ConfirmationOptions): Promise<boolean> {
  // A second click must not replace a confirmation already awaiting a decision.
  if (Swal.isVisible()) return false;
  const result = await Swal.fire({
    titleText: title,
    text: message,
    icon: destructive ? 'warning' : 'question',
    iconColor: 'var(--color-kanban)',
    showCancelButton: true,
    confirmButtonText: confirmLabel,
    cancelButtonText: 'Cancelar',
    buttonsStyling: false,
    focusCancel: true,
    returnFocus: true,
    heightAuto: false,
    allowOutsideClick: false,
    allowEscapeKey: true,
    keydownListenerCapture: true,
    customClass: {
      container: 'kd-confirm-container',
      popup: 'kd-confirm',
      title: 'kd-confirm-title',
      htmlContainer: 'kd-confirm-message',
      actions: 'kd-confirm-actions',
      confirmButton: destructive ? 'kd-confirm-button kd-confirm-danger' : 'kd-confirm-button kd-confirm-accept',
      cancelButton: 'kd-confirm-button kd-confirm-cancel',
    },
  });
  return result.isConfirmed;
}
