-- CreateIndex
CREATE INDEX "Post_teacherId_idx" ON "Post"("teacherId");

-- CreateIndex
CREATE INDEX "Post_categoryId_idx" ON "Post"("categoryId");

-- CreateIndex
CREATE INDEX "Post_moderationStatus_visibility_idx" ON "Post"("moderationStatus", "visibility");

-- CreateIndex
CREATE INDEX "Post_viewCount_idx" ON "Post"("viewCount");

-- CreateIndex
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");

-- CreateIndex
CREATE INDEX "Post_isVip_vipExpiresAt_idx" ON "Post"("isVip", "vipExpiresAt");

-- CreateIndex
CREATE INDEX "Teacher_isVip_createdAt_idx" ON "Teacher"("isVip", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherCategory_categoryId_idx" ON "TeacherCategory"("categoryId");

-- CreateIndex
CREATE INDEX "VideoCallRoom_ownerId_idx" ON "VideoCallRoom"("ownerId");

-- CreateIndex
CREATE INDEX "VideoCallRoom_endedAt_idx" ON "VideoCallRoom"("endedAt");
