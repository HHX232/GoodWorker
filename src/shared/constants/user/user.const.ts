export const USER_ROLES = ["Teacher", "Student", "Admin"] as const;
export const UserRolesObject: Record<typeof USER_ROLES[number], typeof USER_ROLES[number]> = {
  Teacher: "Teacher",
  Student: "Student",
  Admin: "Admin"
}
