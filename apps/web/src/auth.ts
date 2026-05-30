import NextAuth, { type DefaultSession } from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      id?: string;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Keycloak],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, profile }) {
      if (typeof profile?.sub === "string") {
        token.sub = profile.sub;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.sub === "string") {
        session.user.id = token.sub;
      }

      return session;
    },
  },
});
