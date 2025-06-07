import NextAuth, { NextAuthConfig, User } from "next-auth"
import Keycloak from "next-auth/providers/keycloak"
import { JWT } from "next-auth/jwt"

interface TokenWithRefresh extends JWT {
  accessToken?: string
  accessTokenExpires?: number
  refreshToken?: string
  error?: string
  user?: User
}

async function refreshAccessToken(token: TokenWithRefresh): Promise<TokenWithRefresh> {
  try {
    const url = `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
      body: new URLSearchParams({
        client_id: process.env.KEYCLOAK_CLIENT_ID!,
        client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken!,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
    };
  } catch (error) {
    console.error('Error refreshing access token:', error);
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

export const authConfig: NextAuthConfig = {
  providers: [
    Keycloak({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
    })
  ],
  debug: process.env.NODE_ENV === "development",
  trustHost: true,
  callbacks: {
    async jwt({ token, account, user }) {
      // Initial sign in
      if (account && user) {
        return {
          accessToken: account.access_token,
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : Date.now() + 60 * 60 * 1000, // 1 hour default
          refreshToken: account.refresh_token,
          user,
        };
      }

      // Return previous token if the access token has not expired yet
      if (Date.now() < (token.accessTokenExpires || 0)) {
        return token;
      }

      // Access token has expired, try to update it
      return refreshAccessToken(token as TokenWithRefresh);
    },
    async session({ session, token }) {
      // Handle token refresh errors
      if (token.error) {
        session.error = token.error;
      }

      // Add the access token to the session
      if (token.accessToken) {
        session.accessToken = token.accessToken;
      }
      
      return session;
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
