import EmailPasswordDemo from "./EmailPasswordDemo";
import { createSupabaseServerClient } from "../../lip/supabase/server-client";

export default async function EmailPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <EmailPasswordDemo user={user} />;
}
