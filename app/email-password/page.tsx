import EmailPasswordDemo from "./EmailPasswordDemo";
import { createFirebaseServerAuthClient } from "../../lib/firebase/server-auth";

export const dynamic = "force-dynamic";

export default async function EmailPasswordPage() {
    const firebaseClient = await createFirebaseServerAuthClient();
    const {
        data: { user },
    } = await firebaseClient.auth.getUser();

    return <EmailPasswordDemo user={user} />;
}
