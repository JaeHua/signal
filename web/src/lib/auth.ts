import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import { prisma } from "@/lib/prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      if (!profile) return false

      const githubId = Number(profile.id)
      const githubLogin = String(profile.login)

      await prisma.user.upsert({
        where: { githubId },
        create: {
          githubId,
          githubLogin,
          name: user.name ?? githubLogin,
          email: user.email,
          avatarUrl: user.image,
        },
        update: {
          name: user.name ?? githubLogin,
          email: user.email,
          avatarUrl: user.image,
        },
      })

      return true
    },

    async jwt({ token, profile }) {
      if (profile) {
        const githubId = Number(profile.id)
        const dbUser = await prisma.user.findUnique({ where: { githubId } })
        if (dbUser) {
          token.userId = dbUser.id
          token.githubLogin = dbUser.githubLogin
        }
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string
        session.user.githubLogin = token.githubLogin as string
      }
      return session
    },
  },
})
