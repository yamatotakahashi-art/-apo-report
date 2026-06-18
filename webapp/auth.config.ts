import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge（middleware）でも読める軽量設定。DBやNode専用APIは入れない。
export const authConfig = {
  providers: [Google],
  pages: { signIn: "/signin" },
  callbacks: {
    // middleware から呼ばれる。ログイン必須ページのガード。
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnSignin = nextUrl.pathname.startsWith("/signin");
      if (isOnSignin) return true;
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
