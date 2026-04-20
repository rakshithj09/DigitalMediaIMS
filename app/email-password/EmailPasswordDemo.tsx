"use client";

import { User } from "@supabase/supabase-js";

type EmailPasswordDemoProps = {
  user: User | null;
};

export default function EmailPasswordDemo({ user }: EmailPasswordDemoProps) {
  return (
    <div>
      <h1>Email/Password Authentication Demo</h1>
      {user ? (
        <p>Welcome, {user.email}!</p>
      ) : (
        <p>Please sign in to access your inventory.</p>
      )}
    </div>
  );
}
