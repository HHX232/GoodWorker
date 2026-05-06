import { ONLY_TEACHERS_PAGES } from "@/shared/constants/pages/pages.constants"
import { NextResponse } from "next/server"
import { auth } from "./auth"

const teacherOnlyPaths = [
  "/statistics",
  "/calendar",
  "/teacher-profile",
  ...ONLY_TEACHERS_PAGES,
]

const studentOnlyPaths = [
  "/student-profile",
]

const authPaths = [
  "/profile",
]

const publicRoutes = [
  "/login",
  "/register",
  "/forgot-password",
]

export default auth((req) => {
  const { auth: session } = req
  const path = req.nextUrl.pathname

  const isLoggedIn = !!session
  const role = session?.user?.role

  const isTeacherOnly = teacherOnlyPaths.some((p) => path.startsWith(p))
  const isStudentOnly = studentOnlyPaths.some((p) => path.startsWith(p))
  const isAuthRequired = authPaths.some((p) => path.startsWith(p))
  const isPublicRoute = publicRoutes.some((p) => path.startsWith(p))

  if ((isTeacherOnly || isStudentOnly || isAuthRequired) && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (isTeacherOnly && role !== "TEACHER") {
    return NextResponse.redirect(new URL("/student-profile", req.url))
  }

  if (isStudentOnly && role !== "STUDENT") {
    return NextResponse.redirect(new URL("/teacher-profile", req.url))
  }

  if (isPublicRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}