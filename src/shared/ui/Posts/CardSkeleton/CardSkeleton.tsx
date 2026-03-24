import { Skeleton } from "@mui/material";
import { FC } from "react";
import style from "./CardSkeleton.module.scss";

export const CardSkeleton: FC = () => (
  <div className={style.skeleton_card}>
    <div className={style.skeleton_header}>
      <Skeleton variant="circular" width={42} height={42} />
      <div className={style.skeleton_header_text}>
        <Skeleton variant="rounded" width={120} height={14} />
        <Skeleton variant="rounded" width={80} height={12} />
      </div>
    </div>
    <Skeleton variant="rounded" width="60%" height={18} />
    <Skeleton variant="rounded" width="90%" height={14} />
    <Skeleton variant="rounded" width="100%" height={177} />
    <Skeleton variant="rounded" width={130} height={36} />
  </div>
);
