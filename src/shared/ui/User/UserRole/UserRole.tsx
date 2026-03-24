import { FC } from "react";
import style from "./UserRole.module.scss";
import { IUserRole } from "@/shared/types";




const ROLE_LABELS: Record<string, string> = {
  Teacher: "Teacher",
  Student: "Student",
  Admin: "Admin",
};

const getBoxClass = (
  userRole: string | undefined,
  isVip: boolean,
  blurBg: boolean,
  styleModule: typeof style
): string => {
  if (blurBg) {
    const hasVisualRole = isVip || userRole === "Admin" || userRole === "Teacher";
    return `${styleModule.user_box} ${
      hasVisualRole ? styleModule.blurBg : styleModule.blurBg_no_padding
    }`;
  }

  if (isVip) return `${styleModule.user_box} ${styleModule.vipBox}`;
  if (userRole === "Admin") return `${styleModule.user_box} ${styleModule.adminBox}`;
  if (userRole === "Teacher") return `${styleModule.user_box} ${styleModule.teacherBox}`;
  return `${styleModule.user_box} ${styleModule.defaultBox}`;
};

const getTextClass = (
  userRole: string | undefined,
  isVip: boolean,
  styleModule: typeof style
): string => {
  if (isVip) return `${styleModule.user_text} ${styleModule.vipText}`;
  if (userRole === "Admin") return `${styleModule.user_text} ${styleModule.adminText}`;
  if (userRole === "Teacher") return `${styleModule.user_text} ${styleModule.teacherText}`;
  return `${styleModule.user_text} ${styleModule.defaultText}`;
};


const AdminIcon: FC<{ accentColor: string }> = ({ accentColor }) => (
  <svg
    className={style.user_image}
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3.31151 5.10449L3.33317 5.10449C3.45667 5.10449 3.56858 5.17722 3.61874 5.29008L4.99984 8.39755L6.38094 5.29008C6.4311 5.17722 6.54301 5.10449 6.66651 5.10449L6.68817 5.10449C7.06253 5.10448 7.37472 5.10447 7.62254 5.13779C7.88412 5.17296 8.12029 5.25032 8.31007 5.4401C8.49984 5.62988 8.57721 5.86605 8.61238 6.12763C8.6457 6.37545 8.64569 6.68763 8.64567 7.062V7.81303C8.64567 8.5987 8.64567 8.99154 8.40159 9.23562C8.15752 9.4797 7.76468 9.4797 6.97901 9.4797H3.02067C2.235 9.4797 1.84216 9.4797 1.59808 9.23562C1.354 8.99154 1.354 8.5987 1.354 7.81303V7.06198C1.35399 6.68762 1.35398 6.37545 1.3873 6.12763C1.42247 5.86605 1.49983 5.62988 1.68961 5.4401C1.87939 5.25032 2.11556 5.17296 2.37714 5.13779C2.62496 5.10447 2.93714 5.10448 3.31151 5.10449Z"
      fill={`#${accentColor}`}
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.31718 5.2527C4.37412 5.16057 4.4747 5.10449 4.58301 5.10449H5.41634C5.52465 5.10449 5.62523 5.16057 5.68217 5.2527C5.73911 5.34483 5.74429 5.45988 5.69585 5.55675L5.3215 6.30545L5.51809 7.87823C5.52388 7.92453 5.51923 7.97154 5.50447 8.01581L5.29614 8.64081C5.2536 8.76842 5.13418 8.85449 4.99967 8.85449C4.86517 8.85449 4.74575 8.76842 4.70321 8.64081L4.49488 8.01581C4.48012 7.97154 4.47547 7.92453 4.48125 7.87823L4.67785 6.30545L4.3035 5.55675C4.25506 5.45988 4.26024 5.34483 4.31718 5.2527Z"
      fill="#868897"
    />
    <path
      d="M3.229 2.29183C3.229 1.31383 4.02183 0.520996 4.99984 0.520996C5.97784 0.520996 6.77067 1.31383 6.77067 2.29183V2.7085C6.77067 3.6865 5.97784 4.47933 4.99984 4.47933C4.02183 4.47933 3.229 3.6865 3.229 2.7085V2.29183Z"
      fill={`#${accentColor}`}
    />
  </svg>
);

const TeacherIcon: FC<{ accentColor: string }> = ({ accentColor }) => (
  <svg
    className={style.user_image}
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1 2.5C1 2.22386 1.22386 2 1.5 2H8.5C8.77614 2 9 2.22386 9 2.5V7C9 7.27614 8.77614 7.5 8.5 7.5H5.5V8H6.5C6.77614 8 7 8.22386 7 8.5C7 8.77614 6.77614 9 6.5 9H3.5C3.22386 9 3 8.77614 3 8.5C3 8.22386 3.22386 8 3.5 8H4.5V7.5H1.5C1.22386 7.5 1 7.27614 1 7V2.5Z"
      fill={`#${accentColor}`}
    />
    <rect x="2" y="3" width="4" height="0.8" rx="0.4" fill="white" />
    <rect x="2" y="4.5" width="2.5" height="0.8" rx="0.4" fill="white" />
  </svg>
);

const VipIcon: FC = () => (
  <svg
    className={style.user_image}
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5 1L6.18 3.4L9 3.82L7 5.77L7.46 8.58L5 7.27L2.54 8.58L3 5.77L1 3.82L3.82 3.4L5 1Z"
      fill="#fff"
    />
  </svg>
);


const UserRole: FC<IUserRole> = ({
  userRole,
  isVip = false,
  fontSize = "12",
  accentColor = "868897",
  blurBg = false,
}) => {
  const boxClass = getBoxClass(userRole, isVip, blurBg, style);
  const textClass = getTextClass(userRole, isVip, style);

  const label = isVip
    ? "VIP"
    : ROLE_LABELS[userRole ?? ""] ?? "Student";

  return (
    <div className={boxClass}>
      {isVip && <VipIcon />}
      {!isVip && userRole === "Admin" && <AdminIcon accentColor={accentColor} />}
      {!isVip && userRole === "Teacher" && <TeacherIcon accentColor={accentColor} />}

      <p
        style={{ color: `#${accentColor}`, fontSize: `${fontSize}px` }}
        className={textClass}
      >
        {label}
      </p>
    </div>
  );
};

export default UserRole;