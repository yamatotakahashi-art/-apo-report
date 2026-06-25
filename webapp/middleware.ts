import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// アプリ本体（/）と、iframe で読み込む既存アプリ（/legacy/*）をログイン必須にする。
// /api/* は各ルートハンドラ側で auth() を検証するため、ここでは対象外（fetchが
// サインインHTMLへリダイレクトされて壊れるのを防ぐ）。
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/", "/legacy/:path*", "/v2/:path*"],
};
