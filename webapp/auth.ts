import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { sql } from "./lib/db";

const list = (v?: string) =>
  (v || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const allowedDomains = list(process.env.ALLOWED_EMAIL_DOMAINS);
const adminEmails = list(process.env.ADMIN_EMAILS);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,

    // 社内ドメイン＆メール検証済みのみ許可
    async signIn({ profile, user }) {
      const email = (profile?.email || user?.email || "").toLowerCase();
      if (!email) return false;
      if (profile && profile.email_verified === false) return false;
      if (allowedDomains.length) {
        const domain = email.split("@")[1] || "";
        if (!allowedDomains.includes(domain)) return false;
      }
      return true;
    },

    // 初回サインイン時のみ users を upsert し、role をトークンへ焼き込む。
    // 以降のリクエスト（middleware含む）は user 無しなのでDBに触れない。
    async jwt({ token, user, profile }) {
      if (user) {
        const email = (user.email || (token.email as string) || "").toLowerCase();
        const name = user.name || (profile?.name as string) || "";
        const seedRole = adminEmails.includes(email) ? "staff" : "intern";
        try {
          const rows = (await sql`
            insert into users (email, name, role)
            values (${email}, ${name}, ${seedRole})
            on conflict (email) do update set name = excluded.name
            returning role
          `) as { role: string }[];
          token.role = (rows[0]?.role as "staff" | "intern") || seedRole;
        } catch (e) {
          console.error("[auth] users upsert failed:", e);
          token.role = seedRole;
        }
        token.email = email;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as "staff" | "intern") || "intern";
        if (token.email) session.user.email = token.email as string;
      }
      return session;
    },
  },
});
