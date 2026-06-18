import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";

export default async function SignIn() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f5f0",
      }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid #e0ddd2",
          borderRadius: 12,
          padding: "32px 28px",
          maxWidth: 380,
          width: "90%",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>
          営業報告・メールジェネレーター
        </h1>
        <p style={{ fontSize: 13, color: "#5f5e5a", lineHeight: 1.7, margin: "0 0 20px" }}>
          社内メンバー専用です。<br />会社のGoogleアカウントでログインしてください。
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #185fa5",
              background: "#185fa5",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Googleでログイン
          </button>
        </form>
        <p style={{ fontSize: 11, color: "#888780", margin: "16px 0 0" }}>
          許可されたドメイン以外のアカウントはログインできません。
        </p>
      </div>
    </div>
  );
}
