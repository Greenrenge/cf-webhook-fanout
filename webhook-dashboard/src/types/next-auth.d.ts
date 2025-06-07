import "next-auth"
import { User as NextAuthUser } from "next-auth"

declare module "next-auth" {
  interface Session {
    accessToken?: string
    error?: string
  }
  
  interface User {
    accessToken?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    accessTokenExpires?: number
    refreshToken?: string
    error?: string
    user?: NextAuthUser
  }
}
