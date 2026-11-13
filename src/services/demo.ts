import type {
  AuthService,
  BookingService,
} from "../types/services";

export const DEMO_BOOKING_MESSAGE =
  "Это демонстрация интерфейса. Отправка заявок будет доступна после подключения системы записи";
export const demoAuthService: AuthService = {
  signIn: async () => ({ mode: "demo", displayName: "Демо-участник" }),
  signOut: async () => {},
};
export const demoBookingService: BookingService = {
  // No network request or persistence. The request lives only in component memory.
  submit: async () => ({ status: "demo-only", message: DEMO_BOOKING_MESSAGE }),
};
