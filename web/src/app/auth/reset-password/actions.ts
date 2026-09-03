"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** "Forgot password" flow, step 2 of 2 -- reached only after /auth/callback
 * has already exchanged the emailed link's code for a real (recovery-type)
 * session, so supabase.auth.getUser() below succeeds without asking for the
 * old password. If that session is missing or has expired (an old/reused
 * link), send them back to request a fresh one rather than erroring here. */
export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (password.length < 6) {
    redirect(`/auth/reset-password?error=${encodeURIComponent("Password must be at least 6 characters.")}`);
  }
  if (password !== confirmPassword) {
    redirect(`/auth/reset-password?error=${encodeURIComponent("Passwords don't match.")}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?mode=forgot&error=${encodeURIComponent("This reset link is invalid or has expired. Please request a new one.")}`);
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/auth/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/login?message=${encodeURIComponent("Password updated. Please sign in.")}`);
}
