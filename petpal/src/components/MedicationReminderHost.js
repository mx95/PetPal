import { useMedicationReminders } from '../pets/useMedicationReminders';

/** Invisible host — schedules browser notifications for pet medications. */
export function MedicationReminderHost() {
  useMedicationReminders();
  return null;
}
