import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getEnvironmentVariables() {
    const supabaseURL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
    const supabaseAnonKey =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE?.trim();

    if (!supabaseURL || !supabaseAnonKey) {
        throw new Error(
            "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
        );
    }
    return { supabaseURL, supabaseAnonKey };
}

export async function createSupabaseServerClient() {
    const { supabaseURL, supabaseAnonKey } = getEnvironmentVariables();
    const cookieStore = await cookies();

    return createServerClient(supabaseURL, supabaseAnonKey, {
        cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: (cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        try {
                            cookieStore.set(name, value, options as unknown as Record<string, unknown>);
                        } catch (err) {
                            console.error("Failed to set cookie", name, err);
                        }
                    });
                } catch (error) {
                    console.error(error);
                }
            },
        },
    });
}
