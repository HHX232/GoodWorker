import { prisma } from "@/shared/prisma/prisma"
import bcrypt from "bcryptjs"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = schema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password } = parsed.data

        const student = await prisma.student.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            password: true,
          },
        })

        if (student?.password) {
          const ok = await bcrypt.compare(password, student.password)
          if (!ok) return null

          return {
            id: student.id,
            name: student.name,
            email: student.email,
            role: "STUDENT",
          }
        }

        const teacher = await prisma.teacher.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            password: true,
          },
        })

        if (teacher?.password) {
          const ok = await bcrypt.compare(password, teacher.password)
          if (!ok) return null

          const adminRecord = await prisma.adminEmail.findUnique({
            where: { email: teacher.email },
            select: { id: true },
          })

          return {
            id: teacher.id,
            name: teacher.name,
            email: teacher.email,
            role: adminRecord ? "ADMIN" : "TEACHER",
          }
        }

        return null
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.id = user.id
      token.role = user.role
    }
    return token
  },
  async session({ session, token }) {
    return {
      ...session,
      user: {
        ...session.user,
        id: token.id as string,
        role: token.role as "STUDENT" | "TEACHER" | "ADMIN",
      },
    }
  },
}
})