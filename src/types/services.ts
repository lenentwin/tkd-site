export interface UserSession {
  mode: "demo";
  displayName: string;
}
export interface AuthService {
  signIn: () => Promise<UserSession>;
  signOut: () => Promise<void>;
}
export type BookingStatus = "demo-only";
export interface BookingRequest {
  locationId: string;
  participantType: "child" | "adult";
  fullName: string;
  birthDate: string;
  requestedDate: string;
}
export interface BookingResult {
  status: BookingStatus;
  message: string;
}
export interface BookingService {
  submit: (request: BookingRequest) => Promise<BookingResult>;
}
export interface ReviewsSource {
  getReviews: () => Promise<import("./content").ReviewItem[]>;
}
