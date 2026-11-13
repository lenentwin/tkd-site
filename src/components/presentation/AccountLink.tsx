import { Link } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { useContent } from "../../app/providers/ContentProvider";
import Icon from "./Icon";

export default function AccountLink({ className = "button", onClick }: { className?: string; onClick?: () => void }) {
  const { session } = useAuth();
  const { content } = useContent();
  return <Link className={className} to={session ? "/account" : "/login"} onClick={onClick}>
    {session ? "Личный кабинет" : content.brand.bookingLabel}<Icon name="arrow" />
  </Link>;
}
